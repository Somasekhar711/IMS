import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { SECURITY_QUESTIONS, normalizeAnswer } from '../config/securityQuestions.js';

const router = express.Router();

router.get('/security-questions', (req, res) => {
  return res.json(SECURITY_QUESTIONS);
});

router.post('/register', (req, res) => {
  const { fullName, email, password, securityQuestion, securityAnswer } = req.body;

  if (!fullName || !email || !password || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'fullName, email, password, securityQuestion, and securityAnswer are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
    return res.status(400).json({ message: 'Choose a valid security question' });
  }

  if (normalizeAnswer(securityAnswer).length < 2) {
    return res.status(400).json({ message: 'Security answer is too short' });
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
      const securityAnswerHash = await bcrypt.hash(normalizeAnswer(securityAnswer), 10);

      pool.query(
        'INSERT INTO users (full_name, email, password_hash, role, security_question, security_answer_hash) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, full_name, email, role',
        [fullName, email, passwordHash, 'admin', securityQuestion, securityAnswerHash],
        (err, insertResult) => {
          if (err) {
            console.error('Database error', err);
            return res.status(500).json({ message: 'Server error' });
          }

          const user = insertResult.rows[0];
          const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '7d',
          });

          return res.status(201).json({
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.role,
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

  pool.query('SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1', [email], async (err, result) => {
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
        token,
      });
    } catch (error) {
      console.error('Compare error', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

router.post('/security-question', async (req, res) => {
  const email = req.body.email?.trim();

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const result = await pool.query('SELECT security_question FROM users WHERE email = $1', [email]);

    if (result.rowCount === 0 || !result.rows[0].security_question) {
      return res.status(404).json({ message: 'No account with a security question was found for that email' });
    }

    return res.json({ securityQuestion: result.rows[0].security_question });
  } catch (error) {
    console.error('Security question lookup error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const email = req.body.email?.trim();
  const { securityAnswer, newPassword } = req.body;

  if (!email || !securityAnswer || !newPassword) {
    return res.status(400).json({ message: 'Email, security answer, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query('SELECT id, security_answer_hash FROM users WHERE email = $1', [email]);

    if (result.rowCount === 0 || !result.rows[0].security_answer_hash) {
      return res.status(400).json({ message: 'Security answer is incorrect' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(normalizeAnswer(securityAnswer), user.security_answer_hash);
    if (!match) {
      return res.status(400).json({ message: 'Security answer is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, user.id]);

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

router.put('/security-question', authRequired, async (req, res) => {
  const { currentPassword, securityQuestion, securityAnswer } = req.body;

  if (!currentPassword || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ message: 'Current password, security question, and answer are required' });
  }

  if (!SECURITY_QUESTIONS.includes(securityQuestion)) {
    return res.status(400).json({ message: 'Choose a valid security question' });
  }

  if (normalizeAnswer(securityAnswer).length < 2) {
    return res.status(400).json({ message: 'Security answer is too short' });
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

    const securityAnswerHash = await bcrypt.hash(normalizeAnswer(securityAnswer), 10);
    await pool.query(
      'UPDATE users SET security_question = $1, security_answer_hash = $2, updated_at = NOW() WHERE id = $3',
      [securityQuestion, securityAnswerHash, req.user.id]
    );

    return res.json({ message: 'Security question updated successfully' });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
