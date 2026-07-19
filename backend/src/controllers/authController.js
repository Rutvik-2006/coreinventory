const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

/** Generate a signed JWT for a user */
const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });

/** Generate a 6-digit OTP */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) throw createError('Email already registered', 409);

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [name, email, password_hash, role || 'staff']
    );

    const token = signToken(rows[0].id);
    res.status(201).json({ success: true, token, user: rows[0] });
  } catch (err) { next(err); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      'SELECT id, name, email, role, password_hash, is_active FROM users WHERE email = $1',
      [email]
    );

    if (!rows.length) throw createError('Invalid email or password', 401);
    const user = rows[0];

    if (!user.is_active) throw createError('Account is deactivated', 403);

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw createError('Invalid email or password', 401);

    const token = signToken(user.id);
    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) { next(err); }
};

// ── Forgot Password (OTP) ─────────────────────────────────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);

    // Always return success to prevent email enumeration
    if (rows.length) {
      const otp = generateOTP();
      const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      await query(
        'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3',
        [otp, expires, email]
      );
      // In production: send via email/SMS. For now, return in response (dev only).
      console.log(`[OTP] ${email}: ${otp}`);
    }

    res.json({ success: true, message: 'If the email exists, an OTP has been sent', 
      ...(process.env.NODE_ENV !== 'production' && rows.length 
        ? { dev_otp: 'Check server console' } : {}) 
    });
  } catch (err) { next(err); }
};

// ── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    const { rows } = await query(
      `SELECT id, otp_code, otp_expires_at FROM users 
       WHERE email = $1 AND is_active = TRUE`,
      [email]
    );

    if (!rows.length) throw createError('Invalid request', 400);
    const user = rows[0];

    if (!user.otp_code || user.otp_code !== otp)
      throw createError('Invalid OTP', 400);

    if (new Date() > new Date(user.otp_expires_at))
      throw createError('OTP has expired', 400);

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash=$1, otp_code=NULL, otp_expires_at=NULL WHERE id=$2',
      [password_hash, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
};

// ── Me (current user profile) ─────────────────────────────────────────────────
exports.me = async (req, res) => {
  res.json({ success: true, user: req.user });
};
