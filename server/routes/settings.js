import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function mapSettings(row) {
  return {
    phone: row.phone || '',
    currencySymbol: row.currency_symbol,
    lowStockAlertEnabled: row.low_stock_alert_enabled,
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT phone, currency_symbol, low_stock_alert_enabled FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
    return res.json(mapSettings(result.rows[0]));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/', authRequired, async (req, res) => {
  const { phone } = req.body;
  const currencySymbol = (req.body.currencySymbol || '₹').toString().trim().slice(0, 5) || '₹';
  const lowStockAlertEnabled = req.body.lowStockAlertEnabled !== false;

  try {
    const result = await pool.query(`
      UPDATE users
      SET phone = $1, currency_symbol = $2, low_stock_alert_enabled = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING phone, currency_symbol, low_stock_alert_enabled
    `, [phone?.trim() || null, currencySymbol, lowStockAlertEnabled, req.user.id]);

    return res.json(mapSettings(result.rows[0]));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
