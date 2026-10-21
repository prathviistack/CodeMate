import mongoose from "mongoose";

export const ANALYSIS_STATUSES = ["pending", "running", "ready", "failed"];
export const INGESTION_STATUSES = ["pending", "running", "done", "failed"];
export const LEARNING_STATUSES = ["not_started", "in_progress", "completed"];

const projectSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Persistent per-user number. Allocated from User.projectCounter and never reused.
    number: { type: Number, required: true },
    // User-chosen display name. Independent from the GitHub repository name.
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },

    // Repository identity (set at import; never edited by renaming the project).
    githubUrl: { type: String, required: true },
    repoOwner: { type: String, required: true },
    repoName: { type: String, required: true },
    repoKey: { type: String, required: true }, // lowercase "owner/name" for duplicate detection
    defaultBranch: { type: String, required: true },
    snapshotSha: { type: String, required: true }, // commit imported; citations are tied to this
    repoDescription: { type: String, default: "", maxlength: 1000 },
    githubLanguage: { type: String, default: "" }, // GitHub's guess; NOT our detection
    stars: { type: Number, default: 0 },
    repoSizeKb: { type: Number, default: 0 },

    // Filled by the analysis pipeline (Phases 4-5). Empty until real evidence exists.
    languages: { type: [String], default: [] },
    frameworks: { type: [String], default: [] },
    summary: { type: String, default: "" },

    // Repository file import (Phase 4). Separate from analysisStatus, which is about understanding the code.
    ingestionStatus: { type: String, enum: INGESTION_STATUSES, default: "pending" },
    ingestionStage: { type: String, default: "" }, // "downloading" | "saving" while running
    ingestionError: { type: String, default: "" },
    ingestionStartedAt: { type: Date },
    ingestionFinishedAt: { type: Date },
    ingestionStats: {
      totalFiles: { type: Number, default: 0 },
      storedFiles: { type: Number, default: 0 },
      storedBytes: { type: Number, default: 0 },
      skippedFiles: { type: Number, default: 0 },
      skipped: { type: mongoose.Schema.Types.Mixed, default: {} }, // reason -> count
      truncated: { type: Boolean, default: false },
      redactedFiles: { type: Number, default: 0 },
    },

    analysisStatus: { type: String, enum: ANALYSIS_STATUSES, default: "pending" },
    analysisError: { type: String, default: "" },
    learningStatus: { type: String, enum: LEARNING_STATUSES, default: "not_started" },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date },
    lastAccessedAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

projectSchema.index({ ownerId: 1, number: 1 }, { unique: true });
// One saved project per repository per user: importing the same repo again never creates a duplicate.
projectSchema.index({ ownerId: 1, repoKey: 1 }, { unique: true });
projectSchema.index({ ownerId: 1, archived: 1, lastActivityAt: -1 });

projectSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.ownerId = ret.ownerId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Project", projectSchema);
