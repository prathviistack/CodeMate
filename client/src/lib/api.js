import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true, // HttpOnly session cookie
  timeout: 20000,
  // Custom header required by the server's CSRF guard on state-changing requests.
  headers: { "X-Requested-With": "codemate" },
});

// Normalise server errors: { error: { code, message, details } }
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const apiErr = err.response?.data?.error;
    err.friendly =
      apiErr?.message ||
      (err.code === "ECONNABORTED" ? "Request timed out" : err.response ? err.message : "Cannot reach the server");
    err.apiCode = apiErr?.code;
    err.fieldErrors = apiErr?.details && typeof apiErr.details === "object" ? apiErr.details : {};
    return Promise.reject(err);
  }
);

export const getHealth = () => api.get("/health").then((r) => r.data);

export const authApi = {
  me: () => api.get("/auth/me").then((r) => r.data.user),
  register: (body) => api.post("/auth/register", body).then((r) => r.data.user),
  login: (body) => api.post("/auth/login", body).then((r) => r.data.user),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  updateProfile: (body) => api.patch("/auth/profile", body).then((r) => r.data.user),
  changePassword: (body) => api.post("/auth/password", body).then((r) => r.data),
};

export const projectsApi = {
  list: (params) => api.get("/projects", { params }).then((r) => r.data),
  stats: () => api.get("/projects/stats").then((r) => r.data.stats),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data.project),
  import: (body) => api.post("/projects/import", body).then((r) => r.data.project),
  rename: (id, name) => api.patch(`/projects/${id}`, { name }).then((r) => r.data.project),
  archive: (id) => api.post(`/projects/${id}/archive`).then((r) => r.data.project),
  restore: (id) => api.post(`/projects/${id}/restore`).then((r) => r.data.project),
  deletionPreview: (id) => api.get(`/projects/${id}/deletion-preview`).then((r) => r.data.items),
  ingestion: (id) => api.get(`/projects/${id}/ingestion`).then((r) => r.data),
  startImport: (id) => api.post(`/projects/${id}/ingestion/retry`).then((r) => r.data.project),
  files: (id) => api.get(`/projects/${id}/files`).then((r) => r.data),
  fileContent: (id, path) => api.get(`/projects/${id}/files/content`, { params: { path } }).then((r) => r.data),
  remove: (id) => api.delete(`/projects/${id}`, { data: { confirm: true } }).then((r) => r.data),
  tutorChat: (id, body) => api.post(`/projects/${id}/tutor/chat`, body).then((r) => r.data),
  tutorConversations: (id) => api.get(`/projects/${id}/tutor/conversations`).then((r) => r.data.conversations),
  tutorConversation: (id, conversationId) => api.get(`/projects/${id}/tutor/conversations/${conversationId}`).then((r) => r.data),
  deleteTutorConversation: (id, conversationId) => api.delete(`/projects/${id}/tutor/conversations/${conversationId}`).then((r) => r.data),
  lessons: (id) => api.get(`/projects/${id}/learning/lessons`).then((r) => r.data),
  lesson: (id, lessonId) => api.get(`/projects/${id}/learning/lessons/${lessonId}`).then((r) => r.data),
  quizzes: (id) => api.get(`/projects/${id}/learning/quizzes`).then((r) => r.data),
  quiz: (id, quizId) => api.get(`/projects/${id}/learning/quizzes/${quizId}`).then((r) => r.data),
  submitQuizAttempt: (id, quizId, body) => api.post(`/projects/${id}/learning/quizzes/${quizId}/submit`, body).then((r) => r.data),
};

// Lets lists, the dashboard and the topbar refresh after any project change.
export const notifyProjectsChanged = () => window.dispatchEvent(new Event("codemate:projects-changed"));
