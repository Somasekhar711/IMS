import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authRequired, (req, res) => {
  const search = (req.query.search || '').trim();

  let query = `
    SELECT
      p.id,
      p.hsn,
      p.item_name,
      p.item_price,
      p.gst_percent,
      p.discount_percent,
      p.manufactured_date,
      p.expiry_date,
      p.stock_updated_date,
      p.stock_present,
      p.threshold_stock,
      c.name AS category_name,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
  `;

  const params = [];

  if (search) {
    query += ` WHERE LOWER(p.item_name) LIKE $${params.length + 1} OR LOWER(p.hsn) LIKE $${params.length + 1} OR LOWER(c.name) LIKE $${params.length + 1}`;
    params.push(`%${search.toLowerCase()}%`);
  }

  query += ' ORDER BY p.created_at DESC';

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    return res.json(
      result.rows.map((row) => ({
        id: row.id,
        hsn: row.hsn,
        itemName: row.item_name,
        itemPrice: Number(row.item_price),
        itemCategory: row.category_name || '',
        gst: Number(row.gst_percent),
        discount: Number(row.discount_percent),
        mfd: row.manufactured_date || '',
        expiryDate: row.expiry_date || '',
        stockUpdatedDate: row.stock_updated_date || '',
        stockPresent: row.stock_present,
        thresholdStock: row.threshold_stock,
      }))
    );
  });
});

router.post('/', authRequired, async (req, res) => {
  const {
    hsn,
    itemName,
    itemPrice,
    itemCategory,
    gst,
    discount,
    mfd,
    expiryDate,
    stockUpdatedDate,
    stockPresent,
    thresholdStock,
  } = req.body;

  if (!hsn || !itemName || itemPrice === undefined || itemPrice === null || itemPrice === '') {
    return res.status(400).json({ message: 'HSN, item name, and price are required' });
  }

  let categoryId = null;

  try {
    if (itemCategory && itemCategory.trim()) {
      const catResult = await pool.query('SELECT id FROM categories WHERE name = $1', [itemCategory.trim()]);
      if (catResult.rowCount > 0) {
        categoryId = catResult.rows[0].id;
      } else {
        const insertResult = await pool.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [itemCategory.trim()]);
        categoryId = insertResult.rows[0].id;
      }
    }
  } catch (err) {
    console.error('Category error', err);
    return res.status(500).json({ message: 'Server error' });
  }

  const sql = `
    INSERT INTO products (hsn, item_name, item_price, category_id, gst_percent, discount_percent, manufactured_date, expiry_date, stock_updated_date, stock_present, threshold_stock)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, hsn, item_name, item_price, gst_percent, discount_percent, manufactured_date, expiry_date, stock_updated_date, stock_present, threshold_stock
  `;

  const values = [
    hsn,
    itemName,
    Number(itemPrice) || 0,
    categoryId,
    Number(gst) || 0,
    Number(discount) || 0,
    mfd || null,
    expiryDate || null,
    stockUpdatedDate || null,
    Number(stockPresent) || 0,
    Number(thresholdStock) || 0,
  ];

  try {
    const result = await pool.query(sql, values);
    const row = result.rows[0];

    return res.status(201).json({
      id: row.id,
      hsn: row.hsn,
      itemName: row.item_name,
      itemPrice: Number(row.item_price),
      itemCategory: itemCategory || '',
      gst: Number(row.gst_percent),
      discount: Number(row.discount_percent),
      mfd: row.manufactured_date || '',
      expiryDate: row.expiry_date || '',
      stockUpdatedDate: row.stock_updated_date || '',
      stockPresent: row.stock_present,
      thresholdStock: row.threshold_stock,
    });
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authRequired, (req, res) => {
  const { id } = req.params;

  pool.query('DELETE FROM products WHERE id = $1', [id], (err, result) => {
    if (err) {
      console.error('Database error', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    return res.status(204).send();
  });
});

router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { itemPrice, itemCategory, gst, discount, mfd, expiryDate, stockUpdatedDate, stockPresent, thresholdStock } = req.body;

  try {
    let categoryId = null;
    if (itemCategory && itemCategory.trim()) {
      const category = await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [itemCategory.trim()]);
      categoryId = category.rows[0].id;
    }

    const result = await pool.query(`
      UPDATE products
      SET item_price = $1, category_id = $2, gst_percent = $3, discount_percent = $4,
          manufactured_date = $5, expiry_date = $6, stock_updated_date = $7,
          stock_present = $8, threshold_stock = $9, updated_at = NOW()
      WHERE id = $10
      RETURNING id, hsn, item_name, item_price, gst_percent, discount_percent,
                manufactured_date, expiry_date, stock_updated_date, stock_present, threshold_stock
    `, [Number(itemPrice) || 0, categoryId, Number(gst) || 0, Number(discount) || 0, mfd || null, expiryDate || null, stockUpdatedDate || null, Number(stockPresent) || 0, Number(thresholdStock) || 0, id]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found' });
    const row = result.rows[0];
    return res.json({ id: row.id, hsn: row.hsn, itemName: row.item_name, itemPrice: Number(row.item_price), itemCategory: itemCategory || '', gst: Number(row.gst_percent), discount: Number(row.discount_percent), mfd: row.manufactured_date || '', expiryDate: row.expiry_date || '', stockUpdatedDate: row.stock_updated_date || '', stockPresent: row.stock_present, thresholdStock: row.threshold_stock });
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/stock', authRequired, async (req, res) => {
  const { id } = req.params;
  const stockPresent = Number(req.body.stockPresent);
  if (!Number.isInteger(stockPresent) || stockPresent < 0) return res.status(400).json({ message: 'Stock must be a non-negative integer' });

  try {
    const result = await pool.query('UPDATE products SET stock_present = $1, stock_updated_date = CURRENT_DATE, updated_at = NOW() WHERE id = $2 RETURNING id, stock_present, stock_updated_date', [stockPresent, id]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found' });
    return res.json({ id: result.rows[0].id, stockPresent: result.rows[0].stock_present, stockUpdatedDate: result.rows[0].stock_updated_date });
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
