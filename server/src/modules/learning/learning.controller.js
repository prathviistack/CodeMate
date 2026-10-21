import Lesson from "../../models/Lesson.js";
import Quiz from "../../models/Quiz.js";
import { AppError } from "../../utils/errors.js";

// Lessons

export async function listLessons(req, res) {
  const { projectId } = req.params;

  const lessons = await Lesson.find({ projectId })
    .sort({ order: 1 })
    .lean();

  res.json(
  lessons.map((lesson) => ({
    ...lesson,
    id: String(lesson._id),
    projectId: String(lesson.projectId),
  }))
);
}

export async function getLesson(req, res) {
  const { projectId, lessonId } = req.params;

  const lesson = await Lesson.findOne({ _id: lessonId, projectId });
  if (!lesson) {
    throw new AppError("Lesson not found", 404);
  }

  res.json(lesson);
}

// Quizzes

export async function listQuizzes(req, res) {
  const { projectId } = req.params;

  const quizzes = await Quiz.find({ projectId })
    .sort({ order: 1 })
    .lean();

  res.json(
  quizzes.map((quiz) => ({
    ...quiz,
    id: String(quiz._id),
    projectId: String(quiz.projectId),
  }))
);
}

export async function getQuiz(req, res) {
  const { projectId, quizId } = req.params;

  const quiz = await Quiz.findOne({ _id: quizId, projectId });
  if (!quiz) {
    throw new AppError("Quiz not found", 404);
  }

  res.json(quiz);
}

export async function submitQuizAttempt(req, res) {
  const { projectId, quizId } = req.params;
  const { answers } = req.body; // Array of option indices

  const quiz = await Quiz.findOne({ _id: quizId, projectId });
  if (!quiz) {
    throw new AppError("Quiz not found", 404);
  }

  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new AppError("Invalid answers format", 400);
  }

  // Calculate score
  let correct = 0;
  const feedback = quiz.questions.map((q, idx) => ({
    questionIndex: idx,
    correct: answers[idx] === q.correctOptionIndex,
    explanation: q.explanation,
  }));

  correct = feedback.filter(f => f.correct).length;
  const score = Math.round((correct / quiz.questions.length) * 100);

  res.json({
    score,
    correct,
    total: quiz.questions.length,
    feedback,
  });
}
