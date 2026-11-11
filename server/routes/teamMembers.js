import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { validateIdParam } from '../middleware/validateId.js';
import { authRequired } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { normalizePermissions, generateTempPassword } from '../config/permissionModules.js';
import { logActivity } from '../config/activityLog.js';

const router = express.Router();
router.param('id', validateIdParam);
const ROLES = ['admin', 'manager', 'staff'];
const STATUSES = ['invited', 'active'];

router.use(authRequired, requireAdmin);

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
    hasLogin: Boolean(row.password_hash),
    empId: row.emp_id || '',
    permissions: row.permissions || {},
    mustChangePassword: row.must_change_password,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, role, status, notes, created_at, emp_id, password_hash, permissions, must_change_password FROM team_members WHERE owner_user_id = $1 ORDER BY LOWER(name)',
      [req.user.id]
    );
    return res.json(result.rows.map(mapMember));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { name, email, phone, notes } = req.body;
  const trimmedName = name?.trim();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'staff';
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'invited';
  const enableLogin = Boolean(req.body.enableLogin);
  const empId = req.body.empId?.trim();

  if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

  if (enableLogin && !empId) {
    return res.status(400).json({ message: 'Employee ID is required to grant login access' });
  }

  try {
    let passwordHash = null;
    let tempPassword = null;
    let permissions = {};

    if (enableLogin) {
      tempPassword = generateTempPassword();
      passwordHash = await bcrypt.hash(tempPassword, 10);
      permissions = normalizePermissions(req.body.permissions);
    }

    const result = await pool.query(`
      INSERT INTO team_members (owner_user_id, name, email, phone, role, status, notes, emp_id, password_hash, must_change_password, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
      RETURNING id, name, email, phone, role, status, notes, created_at, emp_id, password_hash, permissions, must_change_password
    `, [req.user.id, trimmedName, email?.trim() || null, phone?.trim() || null, role, status, notes?.trim() || null, enableLogin ? empId : null, passwordHash, JSON.stringify(permissions)]);

    const member = mapMember(result.rows[0]);
    if (tempPassword) member.tempPassword = tempPassword;

    logActivity(req.user.id, req.user, 'create', 'teamMembers', `Added team member "${trimmedName}"${enableLogin ? ` with login access (${empId})` : ''}`);

    return res.status(201).json(member);
  } catch (error) {
    if (error.code === '23505') {
      const message = error.constraint?.includes('emp_id')
        ? 'This employee ID is already in use'
        : 'A team member with this email already exists';
      return res.status(409).json({ message });
    }
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, notes } = req.body;
  const trimmedName = name?.trim();
  const role = ROLES.includes(req.body.role) ? req.body.role : 'staff';
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'invited';
  const enableLogin = Boolean(req.body.enableLogin);
  const empId = req.body.empId?.trim();
  const resetPassword = Boolean(req.body.resetPassword);

  if (!trimmedName) return res.status(400).json({ message: 'Name is required' });

  if (enableLogin && !empId) {
    return res.status(400).json({ message: 'Employee ID is required to grant login access' });
  }

  try {
    const existing = await pool.query('SELECT password_hash FROM team_members WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (existing.rowCount === 0) return res.status(404).json({ message: 'Team member not found' });

    let tempPassword = null;
    let passwordHash = existing.rows[0].password_hash;
    let mustChangePassword;
    let permissions;
    let finalEmpId;

    if (enableLogin) {
      finalEmpId = empId;
      permissions = normalizePermissions(req.body.permissions);
      if (!passwordHash || resetPassword) {
        tempPassword = generateTempPassword();
        passwordHash = await bcrypt.hash(tempPassword, 10);
        mustChangePassword = true;
      } else {
        mustChangePassword = undefined; // leave as-is
      }
    } else {
      finalEmpId = null;
      passwordHash = null;
      permissions = {};
      mustChangePassword = true;
    }

    const result = await pool.query(`
      UPDATE team_members
      SET name = $1, email = $2, phone = $3, role = $4, status = $5, notes = $6, emp_id = $7,
          password_hash = $8, permissions = $9,
          must_change_password = COALESCE($10, must_change_password), updated_at = NOW()
      WHERE id = $11 AND owner_user_id = $12
      RETURNING id, name, email, phone, role, status, notes, created_at, emp_id, password_hash, permissions, must_change_password
    `, [trimmedName, email?.trim() || null, phone?.trim() || null, role, status, notes?.trim() || null, finalEmpId, passwordHash, JSON.stringify(permissions), mustChangePassword ?? null, id, req.user.id]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Team member not found' });

    const member = mapMember(result.rows[0]);
    if (tempPassword) member.tempPassword = tempPassword;

    logActivity(req.user.id, req.user, 'update', 'teamMembers', `Updated team member "${trimmedName}"`);

    return res.json(member);
  } catch (error) {
    if (error.code === '23505') {
      const message = error.constraint?.includes('emp_id')
        ? 'This employee ID is already in use'
        : 'A team member with this email already exists';
      return res.status(409).json({ message });
    }
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM team_members WHERE id = $1 AND owner_user_id = $2 RETURNING name', [id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Team member not found' });

    logActivity(req.user.id, req.user, 'delete', 'teamMembers', `Removed team member "${result.rows[0].name}"`);

    return res.status(204).send();
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
