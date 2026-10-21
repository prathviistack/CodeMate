import Project from "../models/Project.js";
import RepoFile from "../models/RepoFile.js";
import { AppError } from "../utils/errors.js";
import { openSnapshotStream } from "../github/archiveDownload.js";
import { extractRepoFiles } from "../github/archiveExtractor.js";
import { analyzeRepository } from "../code-analysis/analyzeRepository.js";
import { generateLessonsAndQuizzes } from "../modules/learning/generateLessons.js";

// In-process background job. One run per project at a time; a run can be cancelled
// (e.g. when the project is deleted). If the server restarts mid-run, the project is
// marked failed on startup so the user can retry (see recoverInterruptedIngestions).
const running = new Map(); // projectId -> { ac, promise }

export const isIngesting = (projectId) => running.has(String(projectId));

export async function startIngestion(projectId) {
  const key = String(projectId);
  if (running.has(key)) return false;

  const entry = { ac: new AbortController(), promise: null };
  running.set(key, entry);
  try {
    const res = await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          ingestionStatus: "running",
          ingestionStage: "downloading",
          ingestionError: "",
          ingestionStartedAt: new Date(),
        },
        $unset: { ingestionFinishedAt: "" },
      }
    );
    if (res.matchedCount === 0) {
      running.delete(key);
      return false;
    }
  } catch (err) {
    running.delete(key);
    throw err;
  }

  entry.promise = runIngestion(projectId, entry.ac)
    .catch((err) => console.error(`[ingestion] unexpected failure for ${key}:`, err))
    .finally(() => running.delete(key));
  return true;
}

/** Cancels a running ingestion and resolves once it has fully stopped. */
export async function cancelIngestion(projectId) {
  const entry = running.get(String(projectId));
  if (!entry) return;
  entry.ac.abort();
  await entry.promise;
}

async function runIngestion(projectId, ac) {
  try {
    const project = await Project.findById(projectId);
    if (!project) return;

    const stream = await openSnapshotStream(
      { owner: project.repoOwner, repo: project.repoName, sha: project.snapshotSha },
      { signal: ac.signal }
    );
    const { files, stats } = await extractRepoFiles(stream);
    if (ac.signal.aborted) return;

    const staged = await Project.updateOne({ _id: projectId }, { $set: { ingestionStage: "saving" } });
    if (staged.matchedCount === 0) return; // project was deleted meanwhile

    await RepoFile.deleteMany({ projectId });
    const BATCH = 50;
    for (let i = 0; i < files.length; i += BATCH) {
      if (ac.signal.aborted) throw new Error("aborted");
      await RepoFile.insertMany(
        files.slice(i, i + BATCH).map((f) => ({ ...f, projectId })),
        { ordered: false }
      );
    }

    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          ingestionStatus: "done",
          ingestionStage: "",
          ingestionError: "",
          ingestionFinishedAt: new Date(),
          lastActivityAt: new Date(),
          ingestionStats: stats,
        },
      }
    );

    // Run analysis after successful ingestion
    if (ac.signal.aborted) return;
    await runAnalysis(projectId, ac);
  } catch (err) {
    // Never leave a half-imported file set behind.
    await RepoFile.deleteMany({ projectId }).catch(() => {});
    if (ac.signal.aborted) return;
    if (!(err instanceof AppError)) console.error(`[ingestion] ${projectId}:`, err);
    const message = err instanceof AppError ? err.message : "Something went wrong while importing the repository's files. Please retry.";
    await Project.updateOne(
      { _id: projectId },
      { $set: { ingestionStatus: "failed", ingestionStage: "", ingestionError: message, ingestionFinishedAt: new Date() } }
    ).catch(() => {});
  }
}

async function runAnalysis(projectId, ac) {
  try {
    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          analysisStatus: "running",
          analysisError: "",
        },
      }
    );

    const { languages, frameworks, summary } = await analyzeRepository(projectId);
    if (ac.signal.aborted) return;

    const project = await Project.findByIdAndUpdate(
      projectId,
      {
        $set: {
          analysisStatus: "ready",
          languages,
          frameworks,
          summary,
        },
      },
      { new: true }
    );
    if (!project) return;

    // Generate lessons and quizzes after successful analysis
    if (ac.signal.aborted) return;
    try {
      await generateLessonsAndQuizzes(projectId, project);
    } catch (genErr) {
      console.warn(`[learning] Failed to generate lessons for ${projectId}:`, genErr);
      // Don't fail the entire process if lesson generation fails
    }
  } catch (err) {
    console.error(`[analysis] ${projectId}:`, err);
    const message = "Could not analyze the repository's technologies. You can still browse the code.";
    await Project.updateOne(
      { _id: projectId },
      { $set: { analysisStatus: "failed", analysisError: message } }
    ).catch(() => {});
  }
}

/** Run once at startup: a run that was in flight when the server stopped can never finish. */
export async function recoverInterruptedIngestions() {
  const res = await Project.updateMany(
    { ingestionStatus: "running" },
    {
      $set: {
        ingestionStatus: "failed",
        ingestionStage: "",
        ingestionError: "The import was interrupted because the server restarted. Please retry.",
        ingestionFinishedAt: new Date(),
      },
    }
  );
  return res.modifiedCount;
}
