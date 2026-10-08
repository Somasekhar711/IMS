import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const normalized = [];
  for (const item of items) {
    const productId = String(item?.productId ?? '');
    const quantity = Number(item?.quantity);
    const unitPrice = Number(item?.unitPrice);

    if (!/^\d+$/.test(productId)) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;

    normalized.push({ productId, quantity, unitPrice, lineTotal: Math.round(quantity * unitPrice * 100) / 100 });
  }

  return normalized;
}

function mapOrder(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name || '',
    orderDate: row.order_date,
    reference: row.reference || '',
    notes: row.notes || '',
    totalAmount: Number(row.total_amount),
    createdAt: row.created_at,
    items: (row.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      itemName: item.itemName,
      hsn: item.hsn,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        so.id, so.customer_id, c.name AS customer_name, so.order_date, so.reference,
        so.notes, so.total_amount, so.created_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', soi.id, 'productId', soi.product_id, 'itemName', p.item_name, 'hsn', p.hsn,
              'quantity', soi.quantity, 'unitPrice', soi.unit_price, 'lineTotal', soi.line_total
            ) ORDER BY soi.id
          ) FILTER (WHERE soi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM sales_orders so
      LEFT JOIN customers c ON c.id = so.customer_id AND c.owner_user_id = so.owner_user_id
      LEFT JOIN sales_order_items soi ON soi.sales_order_id = so.id
      LEFT JOIN products p ON p.id = soi.product_id AND p.owner_user_id = so.owner_user_id
      WHERE so.owner_user_id = $1
      GROUP BY so.id, c.name
      ORDER BY so.order_date DESC, so.id DESC
    `, [req.user.id]);

    return res.json(result.rows.map(mapOrder));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const { customerId, orderDate, reference, notes } = req.body;
  const items = normalizeItems(req.body.items);

  if (!items) return res.status(400).json({ message: 'At least one valid line item (product, quantity, unit price) is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (customerId) {
      if (!/^\d+$/.test(String(customerId))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected customer is unavailable' });
      }
      const customer = await client.query('SELECT id FROM customers WHERE id = $1 AND owner_user_id = $2', [customerId, req.user.id]);
      if (customer.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected customer is unavailable' });
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const productsResult = await client.query(
      'SELECT id, item_name, stock_present FROM products WHERE owner_user_id = $1 AND id = ANY($2::bigint[])',
      [req.user.id, productIds]
    );
    if (productsResult.rowCount !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'One or more selected products are unavailable' });
    }

    const stockByProduct = productsResult.rows.reduce((map, row) => ({ ...map, [row.id]: Number(row.stock_present) }), {});
    const requestedByProduct = items.reduce((map, item) => ({
      ...map,
      [item.productId]: (map[item.productId] || 0) + item.quantity,
    }), {});

    for (const [productId, requested] of Object.entries(requestedByProduct)) {
      if (requested > stockByProduct[productId]) {
        await client.query('ROLLBACK');
        const name = productsResult.rows.find((row) => String(row.id) === productId)?.item_name || `product ${productId}`;
        return res.status(400).json({ message: `Not enough stock for ${name}: ${stockByProduct[productId]} available, ${requested} requested` });
      }
    }

    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;

    const orderResult = await client.query(`
      INSERT INTO sales_orders (owner_user_id, customer_id, order_date, reference, notes, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, customer_id, order_date, reference, notes, total_amount, created_at
    `, [req.user.id, customerId || null, orderDate || new Date().toISOString().slice(0, 10), reference?.trim() || null, notes?.trim() || null, totalAmount]);

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(`
        INSERT INTO sales_order_items (sales_order_id, product_id, owner_user_id, quantity, unit_price, line_total)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.id, item.productId, req.user.id, item.quantity, item.unitPrice, item.lineTotal]);

      const stockResult = await client.query(`
        UPDATE products
        SET stock_present = stock_present - $1, stock_updated_date = CURRENT_DATE, updated_at = NOW()
        WHERE id = $2 AND owner_user_id = $3 AND stock_present >= $1
        RETURNING stock_present
      `, [item.quantity, item.productId, req.user.id]);

      if (stockResult.rowCount === 0) {
        await client.query('ROLLBACK');
        const name = productsResult.rows.find((row) => String(row.id) === item.productId)?.item_name || `product ${item.productId}`;
        return res.status(409).json({ message: `Not enough stock for ${name}: it may have just been sold in another order.` });
      }

      await client.query(`
        INSERT INTO inventory_movements (owner_user_id, product_id, movement_type, quantity_change, reference_type, reference_id, note, stock_after)
        VALUES ($1, $2, 'sale', $3, 'sales_order', $4, $5, $6)
      `, [req.user.id, item.productId, -item.quantity, order.id, reference?.trim() || null, stockResult.rows[0].stock_present]);
    }

    await client.query('COMMIT');

    const customerName = customerId
      ? (await pool.query('SELECT name FROM customers WHERE id = $1 AND owner_user_id = $2', [customerId, req.user.id])).rows[0]?.name || ''
      : '';
    const itemsWithNames = productsResult.rows.reduce((map, row) => ({ ...map, [row.id]: row.item_name }), {});

    return res.status(201).json(mapOrder({
      ...order,
      customer_name: customerName,
      items: items.map((item) => ({
        productId: item.productId,
        itemName: itemsWithNames[item.productId],
        hsn: '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const order = await client.query('SELECT id FROM sales_orders WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (order.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Sales order not found' });
    }

    const items = await client.query(
      'SELECT product_id, quantity FROM sales_order_items WHERE sales_order_id = $1',
      [id]
    );

    for (const item of items.rows) {
      await client.query(`
        UPDATE products
        SET stock_present = stock_present + $1, updated_at = NOW()
        WHERE id = $2 AND owner_user_id = $3
      `, [item.quantity, item.product_id, req.user.id]);
    }

    await client.query("DELETE FROM inventory_movements WHERE reference_type = 'sales_order' AND reference_id = $1 AND owner_user_id = $2", [id, req.user.id]);
    await client.query('DELETE FROM sales_orders WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);

    await client.query('COMMIT');
    return res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
