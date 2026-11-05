import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { SECURITY_QUESTIONS, normalizeAnswer } from '../config/securityQuestions.js';

const router = express.Router();

function generateWarehouseId() {
  return 'WH-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

async function insertUserWithWarehouseId(fields, values, attempt = 0) {
  const warehouseId = generateWarehouseId();
  try {
    return await pool.query(
      `INSERT INTO users (${fields}, warehouse_id) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}, $${values.length + 1}) RETURNING id, full_name, email, role, warehouse_id`,
      [...values, warehouseId]
    );
  } catch (error) {
    if (error.code === '23505' && error.constraint?.includes('warehouse_id') && attempt < 5) {
      return insertUserWithWarehouseId(fields, values, attempt + 1);
    }
    throw error;
  }
}

router.get('/security-questions', (req, res) => {
  return res.json(SECURITY_QUESTIONS);
});

router.post('/register', async (req, res) => {
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

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const securityAnswerHash = await bcrypt.hash(normalizeAnswer(securityAnswer), 10);

    const insertResult = await insertUserWithWarehouseId(
      'full_name, email, password_hash, role, security_question, security_answer_hash',
      [fullName, email, passwordHash, 'admin', securityQuestion, securityAnswerHash]
    );

    const user = insertResult.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, actorType: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.status(201).json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      warehouseId: user.warehouse_id,
      token,
    });
  } catch (error) {
    console.error('Register error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  pool.query('SELECT id, full_name, email, password_hash, role, warehouse_id FROM users WHERE email = $1', [email], async (err, result) => {
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

      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, actorType: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      return res.json({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        warehouseId: user.warehouse_id,
        token,
      });
    } catch (error) {
      console.error('Compare error', error);
      return res.status(500).json({ message: 'Server error' });
    }
  });
});

router.post('/employee-login', async (req, res) => {
  const warehouseId = req.body.warehouseId?.trim();
  const empId = req.body.empId?.trim();
  const { password } = req.body;

  if (!warehouseId || !empId || !password) {
    return res.status(400).json({ message: 'Warehouse ID, employee ID, and password are required' });
  }

  try {
    const ownerResult = await pool.query('SELECT id FROM users WHERE warehouse_id = $1', [warehouseId]);
    if (ownerResult.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid warehouse ID, employee ID, or password' });
    }

    const ownerId = ownerResult.rows[0].id;

    const memberResult = await pool.query(
      'SELECT id, name, status, password_hash, must_change_password FROM team_members WHERE owner_user_id = $1 AND UPPER(emp_id) = UPPER($2)',
      [ownerId, empId]
    );

    if (memberResult.rowCount === 0 || !memberResult.rows[0].password_hash) {
      return res.status(401).json({ message: 'Invalid warehouse ID, employee ID, or password' });
    }

    const member = memberResult.rows[0];

    if (member.status !== 'active') {
      return res.status(403).json({ message: 'This account has been disabled' });
    }

    const match = await bcrypt.compare(password, member.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid warehouse ID, employee ID, or password' });
    }

    const token = jwt.sign(
      { id: ownerId, actorType: 'employee', teamMemberId: member.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      actorType: 'employee',
      fullName: member.name,
      empId,
      warehouseId,
      mustChangePassword: member.must_change_password,
      token,
    });
  } catch (error) {
    console.error('Employee login error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/employee-password', authRequired, async (req, res) => {
  if (req.user.actorType !== 'employee') {
    return res.status(403).json({ message: 'Employees only' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }

  try {
    const result = await pool.query(
      'SELECT password_hash FROM team_members WHERE id = $1 AND owner_user_id = $2',
      [req.user.teamMemberId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE team_members SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
      [passwordHash, req.user.teamMemberId]
    );

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/employee-permissions', authRequired, async (req, res) => {
  if (req.user.actorType !== 'employee') {
    return res.status(403).json({ message: 'Employees only' });
  }

  try {
    const result = await pool.query(
      'SELECT status, permissions FROM team_members WHERE id = $1 AND owner_user_id = $2',
      [req.user.teamMemberId, req.user.id]
    );

    if (result.rowCount === 0 || result.rows[0].status !== 'active') {
      return res.status(403).json({ message: 'Account access has been disabled' });
    }

    return res.json({ permissions: result.rows[0].permissions || {} });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
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

router.put('/profile', authRequired, requireAdmin, async (req, res) => {
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

router.put('/password', authRequired, requireAdmin, async (req, res) => {
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

router.put('/security-question', authRequired, requireAdmin, async (req, res) => {
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
