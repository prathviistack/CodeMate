const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePassword(p) {
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 128) return "Password must be at most 128 characters";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Password must contain a letter and a number";
  return null;
}

export function validateSignup({ name, email, password, confirmPassword }) {
  const e = {};
  if (name.trim().length < 2) e.name = "Name must be at least 2 characters";
  if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
  const pw = validatePassword(password);
  if (pw) e.password = pw;
  if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
  return e;
}

export function validateLogin({ email, password }) {
  const e = {};
  if (!EMAIL_RE.test(email.trim())) e.email = "Enter a valid email address";
  if (!password) e.password = "Password is required";
  return e;
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  const e = {};
  if (!currentPassword) e.currentPassword = "Current password is required";
  const pw = validatePassword(newPassword);
  if (pw) e.newPassword = pw;
  if (newPassword !== confirmPassword) e.confirmPassword = "Passwords do not match";
  return e;
}

// Server returns { field: ["msg"] }; flatten to { field: "msg" }.
export function firstFieldErrors(fieldErrors = {}) {
  return Object.fromEntries(Object.entries(fieldErrors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]));
}
