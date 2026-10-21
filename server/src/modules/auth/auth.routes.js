import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as ctrl from "./auth.controller.js";

const router = Router();

// Brute-force protection on credential endpoints.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "rate_limited", message: "Too many attempts. Please try again later." } },
});

router.post("/register", credentialLimiter, asyncHandler(ctrl.register));
router.post("/login", credentialLimiter, asyncHandler(ctrl.login));
router.post("/logout", asyncHandler(ctrl.logout));
router.get("/me", requireAuth, asyncHandler(ctrl.me));
router.patch("/profile", requireAuth, asyncHandler(ctrl.updateProfile));
router.post("/password", requireAuth, credentialLimiter, asyncHandler(ctrl.changePassword));

export default router;
