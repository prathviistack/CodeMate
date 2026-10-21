import mongoose from "mongoose";
import Project from "../models/Project.js";
import { asyncHandler, AppError } from "../utils/errors.js";

// Ownership gate for every /projects/:projectId/... route (including all later phases).
// Always queries by BOTH id and ownerId, so a guessed id belonging to someone else
// behaves exactly like a project that does not exist (404, no information leak).
export const loadOwnedProject = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) throw new AppError(404, "Project not found", "project_not_found");
  const project = await Project.findOne({ _id: projectId, ownerId: req.user._id });
  if (!project) throw new AppError(404, "Project not found", "project_not_found");
  req.project = project;
  next();
});
