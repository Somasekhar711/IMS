import pool from '../config/db.js';

const LEVEL_RANK = { none: 0, read: 1, write: 2 };

export function requireAdmin(req, res, next) {
  if (req.user.actorType === 'employee') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
}

export function requirePermission(moduleKey, minLevel) {
  return async (req, res, next) => {
    if (req.user.actorType !== 'employee') {
      return next();
    }

    try {
      const result = await pool.query(
        'SELECT status, permissions, name, emp_id FROM team_members WHERE id = $1 AND owner_user_id = $2',
        [req.user.teamMemberId, req.user.id]
      );

      if (result.rowCount === 0 || result.rows[0].status !== 'active') {
        return res.status(403).json({ message: 'Account access has been disabled' });
      }

      const level = result.rows[0].permissions?.[moduleKey] || 'none';
      if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
        return res.status(403).json({ message: 'You do not have permission to perform this action' });
      }

      req.user.teamMemberName = result.rows[0].name;
      req.user.empId = result.rows[0].emp_id;

      next();
    } catch (error) {
      console.error('Permission check error', error);
      return res.status(500).json({ message: 'Server error' });
    }
  };
}
