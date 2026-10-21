import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authApi } from "../lib/api.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import FormField from "../features/auth/FormField.jsx";
import { useToast } from "../components/ui/Toast.jsx";
import { validatePasswordChange, firstFieldErrors } from "../features/auth/validation.js";

function ProfileCard() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Name must be at least 2 characters");
    setError("");
    setSaving(true);
    try {
      setUser(await authApi.updateProfile({ name: name.trim() }));
      toast.success("Profile updated");
    } catch (err) {
      setError(firstFieldErrors(err.fieldErrors).name || err.friendly);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
      <h2 className="font-medium">Profile</h2>
      <FormField label="Name" id="profile-name" value={name} onChange={(e) => setName(e.target.value)} error={error} />
      <FormField label="Email" id="profile-email" value={user.email} disabled hint="Email cannot be changed." readOnly />
      <button className="btn-primary" disabled={saving || name.trim() === user.name}>
        {saving && <Loader2 size={16} className="animate-spin" />} Save changes
      </button>
    </form>
  );
}

function PasswordCard() {
  const toast = useToast();
  const empty = { currentPassword: "", newPassword: "", confirmPassword: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    const v = validatePasswordChange(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    try {
      await authApi.changePassword(form);
      setForm(empty);
      toast.success("Password changed. Other devices were signed out.");
    } catch (err) {
      const fe = firstFieldErrors(err.fieldErrors);
      setErrors(Object.keys(fe).length ? fe : { currentPassword: err.friendly });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-4 p-6">
      <h2 className="font-medium">Change password</h2>
      <FormField label="Current password" id="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} error={errors.currentPassword} />
      <FormField label="New password" id="newPassword" type="password" autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} error={errors.newPassword} hint="At least 8 characters, with a letter and a number." />
      <FormField label="Confirm new password" id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} error={errors.confirmPassword} />
      <button className="btn-primary" disabled={saving}>
        {saving && <Loader2 size={16} className="animate-spin" />} Update password
      </button>
    </form>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your account.</p>
      <div className="mt-6 grid max-w-3xl gap-4">
        <ProfileCard />
        <PasswordCard />
      </div>
    </div>
  );
}
