import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    questions: [
      {
        text: String,
        options: [String], // Multiple choice options
        correctOptionIndex: Number, // Index of correct answer in options array
        explanation: String, // Why this answer is correct
      },
    ],
    difficulty: { type: String, enum: ["beginner", "intermediate", "advanced"], default: "intermediate" },
    estimatedMinutes: { type: Number, default: 15 },
    order: { type: Number }, // For display order
    relatedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Lesson" }],
    relatedFiles: [
      {
        path: String,
        relevance: String,
      },
    ],
    isAuto: { type: Boolean, default: true }, // Auto-generated from lessons/code
  },
  { timestamps: true }
);

quizSchema.index({ projectId: 1, order: 1 });

quizSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.projectId = ret.projectId.toString();
    ret.relatedLessons = ret.relatedLessons?.map(id => id.toString()) || [];
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("Quiz", quizSchema);
