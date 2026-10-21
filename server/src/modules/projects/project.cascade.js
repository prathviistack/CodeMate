// Registry of everything stored per project. Later phases (files, chunks, analysis,
// roadmap, conversations, progress, quizzes, notes) register their models here so that
// deleting a project removes all of its data and the confirmation dialog can say what is lost.
const entries = [];

/** @param {{label: string, model: import("mongoose").Model, field?: string}} entry */
export function registerProjectData({ label, model, field = "projectId" }) {
  entries.push({ label, model, field });
}

export async function previewProjectData(projectId) {
  const items = [];
  for (const e of entries) {
    const count = await e.model.countDocuments({ [e.field]: projectId });
    if (count > 0) items.push({ label: e.label, count });
  }
  return items;
}

export async function deleteProjectData(projectId) {
  for (const e of entries) await e.model.deleteMany({ [e.field]: projectId });
}
