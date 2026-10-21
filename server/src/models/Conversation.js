import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    messages: [
      {
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, required: true },
        citations: [
          {
            fileId: { type: mongoose.Schema.Types.ObjectId, ref: "RepoFile" },
            path: String,
            excerpt: String,
            startLine: Number,
            endLine: Number,
          },
        ],
        createdAt: { type: Date, default: Date.now },
      },
    ],
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.index({ projectId: 1, ownerId: 1, lastMessageAt: -1 });
conversationSchema.index({ projectId: 1, ownerId: 1 });

conversationSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.projectId = ret.projectId.toString();
    ret.ownerId = ret.ownerId.toString();
    ret.messages = ret.messages.map((m) => ({
      ...m,
      fileId: m.fileId?.toString(),
    }));
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Conversation", conversationSchema);
