import Project from "../../models/Project.js";
import User from "../../models/User.js";
import { AppError } from "../../utils/errors.js";
import { parseGithubUrl } from "../../github/githubUrl.js";
import { fetchRepoSnapshot } from "../../github/githubClient.js";
import { importSchema, renameSchema, deleteSchema, listQuerySchema } from "./project.schemas.js";
import { previewProjectData, deleteProjectData } from "./project.cascade.js";
import { startIngestion, cancelIngestion } from "../../jobs/ingestion.js";
import "./project.registrations.js";

const MAX_PROJECTS = Number(process.env.MAX_PROJECTS_PER_USER) || 25;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Atomic, monotonically increasing number. Deleting projects never lowers it,
// so a number is never reused. A failed import may leave a gap, which is harmless.
async function nextProjectNumber(userId) {
  const user = await User.findByIdAndUpdate(userId, { $inc: { projectCounter: 1 } }, { new: true });
  return user.projectCounter;
}

export async function importProject(req, res) {
  const { url, name } = importSchema.parse(req.body);
  const ref = parseGithubUrl(url);

  // Same repository again: point at the existing project instead of overwriting or duplicating it.
  const existing = await Project.findOne({ ownerId: req.user._id, repoKey: ref.key });
  if (existing) {
    throw new AppError(409, `You already imported this repository as "${existing.name}".`, "already_imported", {
      projectId: existing._id.toString(),
    });
  }

  if ((await Project.countDocuments({ ownerId: req.user._id })) >= MAX_PROJECTS) {
    throw new AppError(403, `You've reached the limit of ${MAX_PROJECTS} projects. Delete one to import another.`, "project_limit");
  }

  const snapshot = await fetchRepoSnapshot(ref);
  const number = await nextProjectNumber(req.user._id);

  let project;
  try {
    project = await Project.create({
      ...snapshot,
      ownerId: req.user._id,
      number,
      name: name || `Project ${number}`,
      repoKey: `${snapshot.repoOwner}/${snapshot.repoName}`.toLowerCase(),
    });
  } catch (err) {
    if (err.code === 11000) {
      // Concurrent double-submit of the same repository.
      const dup = await Project.findOne({ ownerId: req.user._id, repoKey: ref.key });
      throw new AppError(409, "You already imported this repository.", "already_imported", { projectId: dup?._id.toString() });
    }
    throw err;
  }

  // Start importing the repository's files in the background. A failure to start must not
  // lose the project: the user can retry from the workspace.
  try {
    await startIngestion(project._id);
  } catch (err) {
    console.error("[import] could not start ingestion:", err);
  }
  res.status(201).json({ project: (await Project.findById(project._id)) || project });
}

export async function listProjects(req, res) {
  const { q, sort, archived, analysis, learning, page, limit } = listQuerySchema.parse(req.query);

  const filter = { ownerId: req.user._id };
  if (archived !== "all") filter.archived = archived === "true";
  if (analysis) filter.analysisStatus = analysis;
  if (learning) filter.learningStatus = learning;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { repoName: rx }, { repoOwner: rx }];
    const num = q.match(/^(?:project\s*)?(\d{1,6})$/i);
    if (num) filter.$or.push({ number: Number(num[1]) });
  }

  const sorts = { activity: { lastActivityAt: -1 }, accessed: { lastAccessedAt: -1 }, created: { createdAt: -1 }, number: { number: 1 }, name: { name: 1 } };
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .sort({ ...sorts[sort], _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Project.countDocuments(filter),
  ]);
  res.json({ projects, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}

export async function projectStats(req, res) {
  const rows = await Project.aggregate([
    { $match: { ownerId: req.user._id } },
    { $group: { _id: { archived: "$archived", analysis: "$analysisStatus", learning: "$learningStatus" }, n: { $sum: 1 } } },
  ]);
  const stats = { total: 0, active: 0, archived: 0, analyzing: 0, analyzed: 0, learning: 0, completed: 0 };
  for (const { _id, n } of rows) {
    stats.total += n;
    if (_id.archived) {
      stats.archived += n;
      continue;
    }
    stats.active += n;
    if (_id.analysis === "running" || _id.analysis === "pending") stats.analyzing += n;
    if (_id.analysis === "ready") stats.analyzed += n;
    if (_id.learning === "in_progress") stats.learning += n;
    if (_id.learning === "completed") stats.completed += n;
  }
  res.json({ stats });
}

export async function getProject(req, res) {
  // Opening a project records access time; this is not a "learning activity".
  req.project.lastAccessedAt = new Date();
  await req.project.save();
  res.json({ project: req.project });
}

export async function renameProject(req, res) {
  const { name } = renameSchema.parse(req.body);
  // Only the user-facing name changes. repoOwner/repoName/githubUrl are never touched.
  req.project.name = name;
  await req.project.save();
  res.json({ project: req.project });
}

export async function archiveProject(req, res) {
  req.project.archived = true;
  req.project.archivedAt = new Date();
  await req.project.save();
  res.json({ project: req.project });
}

export async function restoreProject(req, res) {
  req.project.archived = false;
  req.project.archivedAt = undefined;
  await req.project.save();
  res.json({ project: req.project });
}

export async function deletionPreview(req, res) {
  res.json({ items: await previewProjectData(req.project._id) });
}

export async function deleteProject(req, res) {
  deleteSchema.parse(req.body);
  await cancelIngestion(req.project._id); // stop any running import first so it cannot re-create files
  await deleteProjectData(req.project._id);
  await Project.deleteOne({ _id: req.project._id, ownerId: req.user._id });
  res.json({ ok: true });
}
