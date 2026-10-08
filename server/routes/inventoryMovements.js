import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const { productId, type } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  let query = `
    SELECT
      m.id, m.product_id, p.item_name, p.hsn, m.movement_type, m.quantity_change,
      m.reference_type, m.reference_id, m.note, m.stock_after, m.created_at
    FROM inventory_movements m
    JOIN products p ON p.id = m.product_id
    WHERE m.owner_user_id = $1
  `;
  const params = [req.user.id];

  if (productId) {
    if (!/^\d+$/.test(productId)) {
      return res.status(400).json({ message: 'productId must be a valid id' });
    }
    params.push(productId);
    query += ` AND m.product_id = $${params.length}`;
  }

  if (type && ['purchase', 'sale', 'adjustment'].includes(type)) {
    params.push(type);
    query += ` AND m.movement_type = $${params.length}`;
  }

  params.push(limit);
  query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${params.length}`;

  try {
    const result = await pool.query(query, params);
    return res.json(result.rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      itemName: row.item_name,
      hsn: row.hsn,
      movementType: row.movement_type,
      quantityChange: row.quantity_change,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      note: row.note || '',
      stockAfter: row.stock_after,
      createdAt: row.created_at,
    })));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
