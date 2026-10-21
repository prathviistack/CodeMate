import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthShell from "../features/auth/AuthShell.jsx";
import FormField from "../features/auth/FormField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { validateLogin, firstFieldErrors } from "../features/auth/validation.js";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    const v = validateLogin(form);
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await login({ email: form.email.trim(), password: form.password });
      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      setErrors(firstFieldErrors(err.fieldErrors));
      setFormError(err.friendly);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue learning your codebases."
      footer={<>New to CodeMate? <Link to="/signup" className="text-purple hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <FormField label="Email" id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
        <FormField label="Password" id="password" type="password" autoComplete="current-password" value={form.password} onChange={set("password")} error={errors.password} />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthShell>
  );
}
