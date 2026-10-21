import mongoose from "mongoose";

// One stored text file from an imported repository snapshot. Content is already
// secret-redacted (see code-analysis/secrets.js) and never executed.
const repoFileSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    path: { type: String, required: true, maxlength: 500 }, // repository-relative, validated
    language: { type: String, default: "Other" },
    kind: { type: String, enum: ["source", "config", "docs", "data", "other"], default: "other" },
    size: { type: Number, required: true }, // bytes of stored content
    lines: { type: Number, required: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true }, // sha256 of stored content (change detection)
    redactions: { type: Number, default: 0 }, // secret-like values removed from this file
    note: { type: String, default: "" },
    indexingStatus: { type: String, enum: ["pending", "indexed", "failed"], default: "pending" }, // used by code search (Phase 6)
  },
  { timestamps: true }
);

repoFileSchema.index({ projectId: 1, path: 1 }, { unique: true });

export default mongoose.model("RepoFile", repoFileSchema);
