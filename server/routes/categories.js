import express from 'express';
import pool from '../config/db.js';
import { validateIdParam } from '../middleware/validateId.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logActivity } from '../config/activityLog.js';

const router = express.Router();
router.param('id', validateIdParam);

router.get('/', authRequired, requirePermission('categories', 'read'), (req, res) => {
  const search = (req.query.search || '').trim();

  let query = `
    SELECT
      c.id,
      c.name,
      c.description,
      c.created_at,
      COUNT(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.owner_user_id = $1
    WHERE c.owner_user_id = $1
  `;

  const params = [req.user.id];

  if (search) {
    query += ` AND LOWER(c.name) LIKE $${params.length + 1}`;
    params.push(`%${search.toLowerCase()}%`);
  }

  query += ' GROUP BY c.id, c.name, c.description, c.created_at ORDER BY c.name ASC';

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    return res.json(result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      productCount: Number(row.product_count),
    })));
  });
});

router.post('/', authRequired, requirePermission('categories', 'write'), async (req, res) => {
  const { name, description } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  try {
    const duplicate = await pool.query(
      'SELECT id FROM categories WHERE owner_user_id = $1 AND LOWER(name) = LOWER($2)',
      [req.user.id, trimmedName]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: 'Category already exists' });
    }

    const result = await pool.query(
      'INSERT INTO categories (owner_user_id, name, description) VALUES ($1, $2, $3) RETURNING id, name, description, created_at',
      [req.user.id, trimmedName, description || null]
    );

    const row = result.rows[0];
    logActivity(req.user.id, req.user, 'create', 'categories', `Created category "${row.name}"`);
    return res.status(201).json({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      productCount: 0,
    });
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authRequired, requirePermission('categories', 'write'), async (req, res) => {
  const { id } = req.params;
  const trimmedName = req.body.name?.trim();

  if (!trimmedName) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  try {
    const duplicate = await pool.query(
      'SELECT id FROM categories WHERE owner_user_id = $1 AND LOWER(name) = LOWER($2) AND id != $3',
      [req.user.id, trimmedName, id]
    );

    if (duplicate.rowCount > 0) {
      return res.status(409).json({ message: 'Category already exists' });
    }

    const result = await pool.query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 AND owner_user_id = $4 RETURNING id, name, description, created_at',
      [trimmedName, req.body.description || null, id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const row = result.rows[0];
    logActivity(req.user.id, req.user, 'update', 'categories', `Updated category "${row.name}"`);
    return res.json({
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      productCount: 0,
    });
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authRequired, requirePermission('categories', 'write'), async (req, res) => {
  const { id } = req.params;

  try {
    const category = await pool.query('SELECT id, name FROM categories WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (category.rowCount === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const productCountResult = await pool.query(
      'SELECT COUNT(*)::int AS product_count FROM products WHERE category_id = $1 AND owner_user_id = $2',
      [id, req.user.id]
    );

    const productCount = Number(productCountResult.rows[0].product_count || 0);
    if (productCount > 0) {
      return res.status(409).json({
        message: `This category is used by ${productCount} product${productCount > 1 ? 's' : ''}. Move or remove those products before deleting it.`,
      });
    }

    await pool.query('DELETE FROM categories WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);

    logActivity(req.user.id, req.user, 'delete', 'categories', `Deleted category "${category.rows[0].name}"`);

    return res.status(204).send();
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
