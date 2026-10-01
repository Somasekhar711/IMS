import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();
const ROLES = ['admin', 'manager', 'staff'];
const STATUSES = ['invited', 'active'];

function mapMember(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    status: row.status,
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role, status, notes, created_at FROM team_members WHERE owner_user_id = $1 ORDER BY LOWER(name)',
      [req.user.id]
    );
    return res.json(result.rows.map(mapMember));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const { name, email, phone, notes } = req.body;
  const trimmedName = name?.trim();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'staff';
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'invited';

  if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

  try {
    const result = await pool.query(`
      INSERT INTO team_members (owner_user_id, name, email, phone, role, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, phone, role, status, notes, created_at
    `, [req.user.id, trimmedName, email?.trim() || null, phone?.trim() || null, role, status, notes?.trim() || null]);

    return res.status(201).json(mapMember(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A team member with this email already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, notes } = req.body;
  const trimmedName = name?.trim();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'staff';
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'invited';

  if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

  try {
    const result = await pool.query(`
      UPDATE team_members
      SET name = $1, email = $2, phone = $3, role = $4, status = $5, notes = $6, updated_at = NOW()
      WHERE id = $7 AND owner_user_id = $8
      RETURNING id, name, email, phone, role, status, notes, created_at
    `, [trimmedName, email?.trim() || null, phone?.trim() || null, role, status, notes?.trim() || null, id, req.user.id]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Team member not found' });
    return res.json(mapMember(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A team member with this email already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM team_members WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Team member not found' });
    return res.status(204).send();
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
