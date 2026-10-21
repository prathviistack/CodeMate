import User from "../models/User.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { COOKIE_NAME, findSession, clearSessionCookie } from "../modules/auth/session.service.js";

// Attaches req.user (full user doc) and req.sessionToken. Every protected route
// (and every project-scoped route later) must run behind this.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  const session = await findSession(token);
  if (!session) {
    if (token) clearSessionCookie(res);
    throw new AppError(401, "Please log in to continue", "unauthenticated");
  }
  const user = await User.findById(session.userId);
  if (!user) throw new AppError(401, "Please log in to continue", "unauthenticated");
  req.user = user;
  req.sessionToken = token;
  next();
});
