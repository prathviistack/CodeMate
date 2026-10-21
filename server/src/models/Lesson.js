import mongoose from "mongoose";

const lessonSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    content: { type: String, required: true }, // Markdown-formatted lesson
    keyPoints: [String], // Main takeaways
    codeExamples: [
      {
        title: String,
        code: String,
        language: String,
        explanation: String,
      },
    ],
    relatedFiles: [
      {
        path: String,
        relevance: String, // Brief explanation of why this file is relevant
      },
    ],
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
    estimatedMinutes: { type: Number, default: 10 },
    order: { type: Number }, // For display order
    isAuto: { type: Boolean, default: true }, // Auto-generated from analysis
  },
  { timestamps: true }
);

lessonSchema.index({ projectId: 1, order: 1 });

lessonSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.projectId = ret.projectId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Lesson", lessonSchema);
