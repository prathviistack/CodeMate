import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthShell from "../features/auth/AuthShell.jsx";
import FormField from "../features/auth/FormField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { validateSignup, firstFieldErrors } from "../features/auth/validation.js";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    const v = validateSignup(form);
    setErrors(v);
    if (Object.keys(v).length) return;

    setSubmitting(true);
    try {
      await signup({ ...form, name: form.name.trim(), email: form.email.trim() });
      navigate("/app", { replace: true });
    } catch (err) {
      const fe = firstFieldErrors(err.fieldErrors);
      setErrors(fe);
      if (!Object.keys(fe).length) setFormError(err.friendly);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Import a repository and start understanding it."
      footer={<>Already have an account? <Link to="/login" className="text-purple hover:underline">Log in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</div>}
        <FormField label="Name" id="name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <FormField label="Email" id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="you@example.com" />
        <FormField label="Password" id="password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} error={errors.password} hint="At least 8 characters, with a letter and a number." />
        <FormField label="Confirm password" id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
