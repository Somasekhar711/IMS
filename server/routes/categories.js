import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

router.get('/', (req, res) => {
  pool.query('SELECT id, name, description, created_at FROM categories ORDER BY name ASC', (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    return res.json(result.rows.map((row) => ({ id: row.id, name: row.name, description: row.description })));
  });
});

router.post('/', (req, res) => {
  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }

  pool.query(
    'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id, name, description, created_at',
    [name.trim(), description || null],
    (err, result) => {
      if (err) {
        if (err.code === '23505') {
          return res.status(409).json({ message: 'Category already exists' });
        }
        console.error('Database error', err);
        return res.status(500).json({ message: 'Server error' });
      }

      return res.status(201).json({ id: result.rows[0].id, name: result.rows[0].name, description: result.rows[0].description });
    }
  );
});

export default router;
