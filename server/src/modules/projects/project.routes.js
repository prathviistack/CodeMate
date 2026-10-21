import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { loadOwnedProject } from "../../middleware/loadProject.js";
import * as ctrl from "./project.controller.js";
import * as files from "./project.files.controller.js";

const router = Router();
router.use(requireAuth);

// Imports call GitHub, so cap them per user.
const importLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.IMPORT_RATE_LIMIT) || 30,
  keyGenerator: (req) => req.user._id.toString(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many imports. Please try again later." } },
});

router.post("/import", importLimiter, asyncHandler(ctrl.importProject));
router.get("/", asyncHandler(ctrl.listProjects));
router.get("/stats", asyncHandler(ctrl.projectStats));

router.get("/:projectId", loadOwnedProject, asyncHandler(ctrl.getProject));
router.patch("/:projectId", loadOwnedProject, asyncHandler(ctrl.renameProject));
router.post("/:projectId/archive", loadOwnedProject, asyncHandler(ctrl.archiveProject));
router.post("/:projectId/restore", loadOwnedProject, asyncHandler(ctrl.restoreProject));
router.get("/:projectId/ingestion", loadOwnedProject, asyncHandler(files.getIngestion));
router.post("/:projectId/ingestion/retry", loadOwnedProject, importLimiter, asyncHandler(files.retryIngestion));
router.get("/:projectId/files", loadOwnedProject, asyncHandler(files.listFiles));
router.get("/:projectId/files/content", loadOwnedProject, asyncHandler(files.getFileContent));
router.get("/:projectId/deletion-preview", loadOwnedProject, asyncHandler(ctrl.deletionPreview));
router.delete("/:projectId", loadOwnedProject, asyncHandler(ctrl.deleteProject));

export default router;
