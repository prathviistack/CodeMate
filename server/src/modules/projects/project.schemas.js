import { z } from "zod";
import { ANALYSIS_STATUSES, LEARNING_STATUSES } from "../../models/Project.js";

const projectName = z.string().trim().min(1, "Project name cannot be empty").max(80, "Project name must be at most 80 characters");

export const importSchema = z.object({
  url: z.string().trim().min(1, "Enter a GitHub repository URL").max(300),
  // Optional: blank means "use the default Project N name".
  name: z
    .string()
    .trim()
    .max(80, "Project name must be at most 80 characters")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export const renameSchema = z.object({ name: projectName }).strict();

export const deleteSchema = z.object({ confirm: z.literal(true, { errorMap: () => ({ message: "Deletion must be explicitly confirmed" }) }) });

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["activity", "accessed", "created", "number", "name"]).default("activity"),
  archived: z.enum(["false", "true", "all"]).default("false"),
  analysis: z.enum(ANALYSIS_STATUSES).optional(),
  learning: z.enum(LEARNING_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
