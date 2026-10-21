import Project from "../../models/Project.js";
import RepoFile from "../../models/RepoFile.js";
import { AppError } from "../../utils/errors.js";
import { startIngestion, isIngesting } from "../../jobs/ingestion.js";
import { safeRelativePath } from "../../github/archiveExtractor.js";
import { z } from "zod";

const INGESTION_FIELDS = "ingestionStatus ingestionStage ingestionError ingestionStats ingestionStartedAt ingestionFinishedAt";

// Lightweight status for polling (does not touch lastAccessedAt).
export async function getIngestion(req, res) {
  const p = await Project.findById(req.project._id).select(INGESTION_FIELDS).lean();
  res.json({
    ingestionStatus: p.ingestionStatus,
    ingestionStage: p.ingestionStage,
    ingestionError: p.ingestionError,
    ingestionStats: p.ingestionStats,
    ingestionStartedAt: p.ingestionStartedAt,
    ingestionFinishedAt: p.ingestionFinishedAt,
  });
}

// Starts a first import (older projects) or retries a failed one without creating a duplicate project.
export async function retryIngestion(req, res) {
  const p = req.project;
  if (isIngesting(p._id) || p.ingestionStatus === "running") {
    throw new AppError(409, "The import is already running.", "ingestion_running");
  }
  if (p.ingestionStatus === "done") {
    throw new AppError(409, "This project's files are already imported.", "ingestion_done");
  }
  await startIngestion(p._id);
  const fresh = await Project.findById(p._id);
  res.status(202).json({ project: fresh });
}

export async function listFiles(req, res) {
  const files = await RepoFile.find({ projectId: req.project._id })
    .select("path language kind size lines redactions -_id")
    .sort({ path: 1 })
    .limit(5000)
    .lean();
  res.json({ files, total: files.length, snapshotSha: req.project.snapshotSha });
}

const contentQuery = z.object({ path: z.string().min(1).max(500) });

export async function getFileContent(req, res) {
  const { path } = contentQuery.parse(req.query);
  // Paths are only ever used as database keys, never as filesystem paths, but validate anyway.
  if (!safeRelativePath(path)) throw new AppError(400, "Invalid file path", "invalid_path");

  const file = await RepoFile.findOne({ projectId: req.project._id, path })
    .select("path language kind size lines content contentHash redactions note -_id")
    .lean();
  if (!file) throw new AppError(404, "File not found in this project", "file_not_found");
  res.json({ file, snapshotSha: req.project.snapshotSha, githubUrl: req.project.githubUrl });
}
