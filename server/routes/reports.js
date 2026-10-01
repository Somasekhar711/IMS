import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

const RANGE_DAYS = { 7: 7, 30: 30, 90: 90 };

function rangeStartDate(range) {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

router.get('/summary', authRequired, async (req, res) => {
  const startDate = rangeStartDate(req.query.range);

  try {
    const salesResult = await pool.query(
      startDate
        ? 'SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM sales_orders WHERE owner_user_id = $1 AND order_date >= $2'
        : 'SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM sales_orders WHERE owner_user_id = $1',
      startDate ? [req.user.id, startDate] : [req.user.id]
    );

    const purchasesResult = await pool.query(
      startDate
        ? 'SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM purchase_orders WHERE owner_user_id = $1 AND order_date >= $2'
        : 'SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM purchase_orders WHERE owner_user_id = $1',
      startDate ? [req.user.id, startDate] : [req.user.id]
    );

    const topProductsResult = await pool.query(
      startDate
        ? `SELECT p.id, p.item_name, SUM(soi.quantity)::int AS quantity, COALESCE(SUM(soi.line_total), 0) AS revenue
           FROM sales_order_items soi
           JOIN sales_orders so ON so.id = soi.sales_order_id
           JOIN products p ON p.id = soi.product_id
           WHERE soi.owner_user_id = $1 AND so.order_date >= $2
           GROUP BY p.id, p.item_name
           ORDER BY quantity DESC
           LIMIT 5`
        : `SELECT p.id, p.item_name, SUM(soi.quantity)::int AS quantity, COALESCE(SUM(soi.line_total), 0) AS revenue
           FROM sales_order_items soi
           JOIN products p ON p.id = soi.product_id
           WHERE soi.owner_user_id = $1
           GROUP BY p.id, p.item_name
           ORDER BY quantity DESC
           LIMIT 5`,
      startDate ? [req.user.id, startDate] : [req.user.id]
    );

    const stockResult = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE stock_present = 0)::int AS out_of_stock,
         COUNT(*) FILTER (WHERE stock_present > 0 AND stock_present <= threshold_stock)::int AS low_stock,
         COUNT(*)::int AS total_products
       FROM products WHERE owner_user_id = $1`,
      [req.user.id]
    );

    const movementsResult = await pool.query(
      startDate
        ? 'SELECT COUNT(*)::int AS count FROM inventory_movements WHERE owner_user_id = $1 AND created_at >= $2'
        : 'SELECT COUNT(*)::int AS count FROM inventory_movements WHERE owner_user_id = $1',
      startDate ? [req.user.id, startDate] : [req.user.id]
    );

    return res.json({
      salesTotal: Number(salesResult.rows[0].total),
      salesCount: salesResult.rows[0].count,
      purchasesTotal: Number(purchasesResult.rows[0].total),
      purchasesCount: purchasesResult.rows[0].count,
      topProducts: topProductsResult.rows.map((row) => ({
        id: row.id,
        itemName: row.item_name,
        quantity: row.quantity,
        revenue: Number(row.revenue),
      })),
      outOfStockCount: stockResult.rows[0].out_of_stock,
      lowStockCount: stockResult.rows[0].low_stock,
      totalProducts: stockResult.rows[0].total_products,
      movementsCount: movementsResult.rows[0].count,
    });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
