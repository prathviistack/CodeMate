import mongoose from "mongoose";

// Only a SHA-256 hash of the session token is stored, so a database leak
// cannot be used to hijack live sessions.
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, maxlength: 300 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Session", sessionSchema);
