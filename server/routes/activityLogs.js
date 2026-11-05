import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';

const router = express.Router();

router.get('/', authRequired, requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const before = req.query.before;

  const params = [req.user.id];
  let query = `
    SELECT id, actor_type, actor_name, action, module, description, created_at
    FROM activity_logs
    WHERE owner_user_id = $1
  `;

  if (before && /^\d+$/.test(before)) {
    params.push(before);
    query += ` AND id < $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY created_at DESC, id DESC LIMIT $${params.length}`;

  try {
    const result = await pool.query(query, params);
    return res.json(result.rows.map((row) => ({
      id: row.id,
      actorType: row.actor_type,
      actorName: row.actor_name,
      action: row.action,
      module: row.module,
      description: row.description,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
