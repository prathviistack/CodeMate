import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence for cookie auth:
//  1. SameSite cookie (set in session.service.js)
//  2. Origin must match CLIENT_URL when the browser sends one
//  3. A custom header is required; cross-site pages cannot set it without a
//     CORS preflight, which our CORS policy rejects for foreign origins.
export function csrfGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();

  const origin = req.get("origin");
  if (origin && origin !== env.clientUrl) {
    return next(new AppError(403, "Request origin not allowed", "csrf_origin"));
  }
  if (req.get("x-requested-with") !== "codemate") {
    return next(new AppError(403, "Missing CSRF header", "csrf_header"));
  }
  next();
}
