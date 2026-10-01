import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../config/mailer.js';

const router = express.Router();

const RESET_OTP_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_OTP_TTL_MS = 30 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

async function createAndSendVerificationEmail(userId, email) {
  const otp = generateOtp();
  const tokenHash = hashToken(otp);
  const expiresAt = new Date(Date.now() + VERIFICATION_OTP_TTL_MS);

  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await pool.query(
    'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );

  await sendVerificationEmail(email, otp);
}

router.post('/register', (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'fullName, email, and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  pool.query('SELECT id FROM users WHERE email = $1', [email], async (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (result.rowCount > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    try {
      const passwordHash = await bcrypt.hash(password, 10);

      pool.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role',
        [fullName, email, passwordHash, 'admin'],
        (err, insertResult) => {
          if (err) {
            console.error('Database error', err);
            return res.status(500).json({ message: 'Server error' });
          }

          const user = insertResult.rows[0];
          const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '7d',
          });

          createAndSendVerificationEmail(user.id, user.email).catch((emailError) => {
            console.error('Verification email error', emailError);
          });

          return res.status(201).json({
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
            emailVerified: false,
            token,
          });
        }
      );
    } catch (error) {
      console.error('Hash error', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  pool.query('SELECT id, full_name, email, password_hash, role, email_verified_at FROM users WHERE email = $1', [email], async (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    try {
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      return res.json({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        emailVerified: Boolean(user.email_verified_at),
        token,
      });
    } catch (error) {
      console.error('Compare error', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

router.post('/verify-email', authRequired, async (req, res) => {
  const otp = req.body.otp?.trim();

  if (!otp) {
    return res.status(400).json({ message: 'Code is required' });
  }

  try {
    const tokenResult = await pool.query(
      'SELECT id, token_hash, expires_at, attempts FROM email_verification_tokens WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );

    if (tokenResult.rowCount === 0 || new Date(tokenResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired code. Request a new one.' });
    }

    const verificationToken = tokenResult.rows[0];

    if (verificationToken.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }

    if (hashToken(otp) !== verificationToken.token_hash) {
      await pool.query('UPDATE email_verification_tokens SET attempts = attempts + 1 WHERE id = $1', [verificationToken.id]);
      return res.status(400).json({ message: 'Invalid or expired code. Request a new one.' });
    }

    const userResult = await pool.query(
      'UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, role',
      [req.user.id]
    );
    await pool.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [verificationToken.id]);

    const user = userResult.rows[0];
    return res.json({
      message: 'Email verified successfully',
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      emailVerified: true,
    });
  } catch (error) {
    console.error('Verify email error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/resend-verification', authRequired, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT email, email_verified_at FROM users WHERE id = $1', [req.user.id]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    if (user.email_verified_at) {
      return res.json({ message: 'Your email is already verified', alreadyVerified: true });
    }

    await createAndSendVerificationEmail(req.user.id, user.email);
    return res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const email = req.body.email?.trim();

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const genericResponse = { message: 'If an account exists for that email, a reset code has been sent.' };

  try {
    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);

    if (userResult.rowCount === 0) {
      return res.json(genericResponse);
    }

    const user = userResult.rows[0];
    const otp = generateOtp();
    const tokenHash = hashToken(otp);
    const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MS);

    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    await sendPasswordResetEmail(user.email, otp);

    return res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const email = req.body.email?.trim();
  const otp = req.body.otp?.trim();
  const { newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: 'Email, code, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userResult.rowCount === 0) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const userId = userResult.rows[0].id;

    const tokenResult = await pool.query(
      'SELECT id, token_hash, expires_at, attempts FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (tokenResult.rowCount === 0 || new Date(tokenResult.rows[0].expires_at) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const resetToken = tokenResult.rows[0];

    if (resetToken.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new code.' });
    }

    if (hashToken(otp) !== resetToken.token_hash) {
      await pool.query('UPDATE password_reset_tokens SET attempts = attempts + 1 WHERE id = $1', [resetToken.id]);
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, userId]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetToken.id]);

    return res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', authRequired, async (req, res) => {
  const trimmedName = req.body.fullName?.trim();
  if (!trimmedName) {
    return res.status(400).json({ message: 'Full name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, role',
      [trimmedName, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    return res.json({ id: user.id, fullName: user.full_name, email: user.email, role: user.role });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, req.user.id]);

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
