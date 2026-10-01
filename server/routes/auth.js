import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

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
