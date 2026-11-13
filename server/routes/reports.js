import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = express.Router();

const RANGE_DAYS = { 7: 7, 30: 30, 90: 90 };
const EXPIRY_WARNING_DAYS = 30;

function rangeStartDate(range) {
  const days = RANGE_DAYS[range];
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const moneyOrNull = (value) => (value === null || value === undefined ? null : money(value));

// Gross profit only counts sales lines whose unit cost is known. Lines sold
// before a product had a cost price are reported separately as "uncosted".
const LINE_PROFIT = 'CASE WHEN soi.unit_cost IS NOT NULL THEN soi.line_total - soi.quantity * soi.unit_cost END';

router.get('/summary', authRequired, requirePermission('reports', 'read'), async (req, res) => {
  const startDate = rangeStartDate(req.query.range);
  // Every sales/purchase query shares the same account + date filter: $1 = account, $2 = start date (or NULL for all time).
  const params = [req.user.id, startDate];
  const inRange = (alias) => `${alias}.owner_user_id = $1 AND ($2::date IS NULL OR ${alias}.order_date >= $2::date)`;

  try {
    const [sales, purchases, profit, topProducts, byCategory, topCustomers, trend, stock, stockItems, expiring, movements] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM sales_orders so WHERE ${inRange('so')}`, params),
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS total FROM purchase_orders po WHERE ${inRange('po')}`, params),
      pool.query(`
        SELECT
          COALESCE(SUM(soi.quantity), 0)::int AS units_sold,
          COALESCE(SUM(soi.quantity * soi.unit_cost), 0) AS cost_of_goods,
          COALESCE(SUM(CASE WHEN soi.unit_cost IS NOT NULL THEN soi.line_total END), 0) AS costed_revenue,
          COALESCE(SUM(CASE WHEN soi.unit_cost IS NULL THEN soi.line_total END), 0) AS uncosted_revenue,
          COALESCE(SUM(${LINE_PROFIT}), 0) AS gross_profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE ${inRange('so')}`, params),
      pool.query(`
        SELECT p.id, p.item_name, SUM(soi.quantity)::int AS quantity, SUM(soi.line_total) AS revenue, SUM(${LINE_PROFIT}) AS profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        JOIN products p ON p.id = soi.product_id
        WHERE ${inRange('so')}
        GROUP BY p.id, p.item_name
        ORDER BY quantity DESC, revenue DESC
        LIMIT 5`, params),
      pool.query(`
        SELECT COALESCE(c.name, 'Uncategorised') AS category, SUM(soi.quantity)::int AS quantity, SUM(soi.line_total) AS revenue, SUM(${LINE_PROFIT}) AS profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        JOIN products p ON p.id = soi.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${inRange('so')}
        GROUP BY COALESCE(c.name, 'Uncategorised')
        ORDER BY revenue DESC`, params),
      pool.query(`
        SELECT so.customer_id, COALESCE(cu.name, 'Walk-in customers') AS name, COUNT(*)::int AS orders, SUM(so.total_amount) AS revenue
        FROM sales_orders so
        LEFT JOIN customers cu ON cu.id = so.customer_id AND cu.owner_user_id = so.owner_user_id
        WHERE ${inRange('so')}
        GROUP BY so.customer_id, cu.name
        ORDER BY revenue DESC
        LIMIT 5`, params),
      // Daily totals for a set range; monthly totals for "all time".
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC($3, so.order_date), 'YYYY-MM-DD') AS period,
               SUM(soi.line_total) AS revenue, SUM(${LINE_PROFIT}) AS profit
        FROM sales_order_items soi
        JOIN sales_orders so ON so.id = soi.sales_order_id
        WHERE ${inRange('so')}
        GROUP BY 1
        ORDER BY 1`, [...params, startDate ? 'day' : 'month']),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE stock_present = 0)::int AS out_of_stock,
          COUNT(*) FILTER (WHERE stock_present > 0 AND stock_present <= threshold_stock)::int AS low_stock,
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE cost_price IS NULL)::int AS products_without_cost,
          COALESCE(SUM(stock_present * item_price), 0) AS value_at_price,
          COALESCE(SUM(stock_present * cost_price), 0) AS value_at_cost,
          COALESCE(SUM(CASE WHEN cost_price IS NOT NULL THEN stock_present * item_price END), 0) AS costed_value_at_price
        FROM products WHERE owner_user_id = $1`, [req.user.id]),
      // The products behind the low / out-of-stock counts, so the report can list them.
      pool.query(`
        SELECT p.id, p.item_name, p.hsn, c.name AS category_name, p.stock_present, p.threshold_stock, p.expiry_date
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.owner_user_id = $1 AND p.stock_present <= p.threshold_stock
        ORDER BY p.stock_present ASC, LOWER(p.item_name) ASC`, [req.user.id]),
      pool.query(`
        SELECT p.id, p.item_name, p.hsn, c.name AS category_name, p.stock_present, p.threshold_stock, p.expiry_date,
               (p.expiry_date - CURRENT_DATE) AS days_left, p.stock_present * COALESCE(p.cost_price, p.item_price) AS value_at_risk
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.owner_user_id = $1 AND p.expiry_date IS NOT NULL AND p.expiry_date <= CURRENT_DATE + $2::int
        ORDER BY p.expiry_date ASC, LOWER(p.item_name) ASC`, [req.user.id, EXPIRY_WARNING_DAYS]),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM inventory_movements WHERE owner_user_id = $1 AND ($2::date IS NULL OR created_at >= $2::date)',
        params
      ),
    ]);

    const stockItem = (row) => ({
      id: row.id,
      itemName: row.item_name,
      hsn: row.hsn,
      itemCategory: row.category_name || '',
      stockPresent: row.stock_present,
      thresholdStock: row.threshold_stock,
      expiryDate: row.expiry_date || '',
    });

    const salesTotal = money(sales.rows[0].total);
    const salesCount = sales.rows[0].count;
    const p = profit.rows[0];
    const costedRevenue = money(p.costed_revenue);
    const grossProfit = money(p.gross_profit);
    const s = stock.rows[0];

    return res.json({
      salesTotal,
      salesCount,
      purchasesTotal: money(purchases.rows[0].total),
      purchasesCount: purchases.rows[0].count,
      averageOrderValue: salesCount ? money(salesTotal / salesCount) : 0,
      unitsSold: p.units_sold,
      costOfGoodsSold: money(p.cost_of_goods),
      grossProfit,
      // Margin on the sales whose cost is known, as a percentage of their revenue.
      grossMarginPercent: costedRevenue > 0 ? Math.round((grossProfit / costedRevenue) * 1000) / 10 : null,
      uncostedRevenue: money(p.uncosted_revenue),
      topProducts: topProducts.rows.map((row) => ({
        id: row.id, itemName: row.item_name, quantity: row.quantity, revenue: money(row.revenue), profit: moneyOrNull(row.profit),
      })),
      salesByCategory: byCategory.rows.map((row) => ({
        category: row.category, quantity: row.quantity, revenue: money(row.revenue), profit: moneyOrNull(row.profit),
      })),
      topCustomers: topCustomers.rows.map((row) => ({
        customerId: row.customer_id, name: row.name, orders: row.orders, revenue: money(row.revenue),
      })),
      salesTrend: {
        interval: startDate ? 'day' : 'month',
        startDate,
        points: trend.rows.map((row) => ({ period: row.period, revenue: money(row.revenue), profit: moneyOrNull(row.profit) })),
      },
      outOfStockCount: s.out_of_stock,
      lowStockCount: s.low_stock,
      totalProducts: s.total_products,
      productsWithoutCost: s.products_without_cost,
      inventoryValueAtPrice: money(s.value_at_price),
      inventoryValueAtCost: money(s.value_at_cost),
      // Profit the current stock would make if sold at list price (products with a known cost only).
      potentialProfit: money(Number(s.costed_value_at_price) - Number(s.value_at_cost)),
      lowStockItems: stockItems.rows.filter((row) => row.stock_present > 0).map(stockItem),
      outOfStockItems: stockItems.rows.filter((row) => row.stock_present === 0).map(stockItem),
      expiringItems: expiring.rows.map((row) => ({ ...stockItem(row), daysLeft: row.days_left, valueAtRisk: money(row.value_at_risk) })),
      movementsCount: movements.rows[0].count,
    });
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
