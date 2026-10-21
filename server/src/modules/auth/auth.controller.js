import bcrypt from "bcryptjs";
import User from "../../models/User.js";
import { AppError } from "../../utils/errors.js";
import {
  registerSchema,
  loginSchema,
  profileSchema,
  changePasswordSchema,
} from "./auth.schemas.js";
import {
  COOKIE_NAME,
  createSession,
  destroySession,
  destroyOtherSessions,
  clearSessionCookie,
} from "./session.service.js";

const BCRYPT_ROUNDS = 12;
// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync("codemate-dummy-password", BCRYPT_ROUNDS);

export async function register(req, res) {
  const { name, email, password } = registerSchema.parse(req.body);

  if (await User.exists({ email })) {
    throw new AppError(409, "An account with this email already exists", "email_taken", { email: ["Email already registered"] });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, passwordHash, lastLoginAt: new Date() });
  } catch (err) {
    // Race: two signups with the same email at once.
    if (err.code === 11000) throw new AppError(409, "An account with this email already exists", "email_taken", { email: ["Email already registered"] });
    throw err;
  }

  await createSession(res, user._id, req.get("user-agent"));
  res.status(201).json({ user: user.toSafeJSON() });
}

export async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);
  const user = await User.findOne({ email }).select("+passwordHash");

  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid email or password", "invalid_credentials");

  user.lastLoginAt = new Date();
  await user.save();
  await createSession(res, user._id, req.get("user-agent"));
  res.json({ user: user.toSafeJSON() });
}

export async function logout(req, res) {
  await destroySession(req.cookies?.[COOKIE_NAME]);
  clearSessionCookie(res);
  res.json({ ok: true });
}

export async function me(req, res) {
  res.json({ user: req.user.toSafeJSON() });
}

export async function updateProfile(req, res) {
  const { name } = profileSchema.parse(req.body);
  req.user.name = name;
  await req.user.save();
  res.json({ user: req.user.toSafeJSON() });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await User.findById(req.user._id).select("+passwordHash");

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Current password is incorrect", "wrong_password", { currentPassword: ["Incorrect password"] });
  }
  user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();
  // Sign out every other device; keep this one.
  await destroyOtherSessions(user._id, req.sessionToken);
  res.json({ ok: true });
}
