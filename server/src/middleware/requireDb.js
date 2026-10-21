import mongoose from "mongoose";
import { AppError } from "../utils/errors.js";

export function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return next(
      new AppError(503, "The database is not connected. Check MONGODB_URI on the server.", "db_unavailable")
    );
  }
  next();
}
