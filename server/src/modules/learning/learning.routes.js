import { Router } from "express";
import { asyncHandler } from "../../utils/errors.js";
import * as ctrl from "./learning.controller.js";

const router = Router({ mergeParams: true });

// Lessons
router.get("/lessons", asyncHandler(ctrl.listLessons));
router.get("/lessons/:lessonId", asyncHandler(ctrl.getLesson));

// Quizzes
router.get("/quizzes", asyncHandler(ctrl.listQuizzes));
router.get("/quizzes/:quizId", asyncHandler(ctrl.getQuiz));
router.post("/quizzes/:quizId/submit", asyncHandler(ctrl.submitQuizAttempt));

export default router;
