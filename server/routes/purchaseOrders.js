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
    const unitCost = Number(item?.unitCost);

    if (!/^\d+$/.test(productId)) return null;
    if (!Number.isInteger(quantity) || quantity <= 0) return null;
    if (!Number.isFinite(unitCost) || unitCost < 0) return null;

    normalized.push({ productId, quantity, unitCost, lineTotal: Math.round(quantity * unitCost * 100) / 100 });
  }

  return normalized;
}

function mapOrder(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name || '',
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
      unitCost: Number(item.unitCost),
      lineTotal: Number(item.lineTotal),
    })),
  };
}

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        po.id, po.supplier_id, s.name AS supplier_name, po.order_date, po.reference,
        po.notes, po.total_amount, po.created_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', poi.id, 'productId', poi.product_id, 'itemName', p.item_name, 'hsn', p.hsn,
              'quantity', poi.quantity, 'unitCost', poi.unit_cost, 'lineTotal', poi.line_total
            ) ORDER BY poi.id
          ) FILTER (WHERE poi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.owner_user_id = po.owner_user_id
      LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
      LEFT JOIN products p ON p.id = poi.product_id AND p.owner_user_id = po.owner_user_id
      WHERE po.owner_user_id = $1
      GROUP BY po.id, s.name
      ORDER BY po.order_date DESC, po.id DESC
    `, [req.user.id]);

    return res.json(result.rows.map(mapOrder));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const { supplierId, orderDate, reference, notes } = req.body;
  const items = normalizeItems(req.body.items);

  if (!items) return res.status(400).json({ message: 'At least one valid line item (product, quantity, unit cost) is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (supplierId) {
      if (!/^\d+$/.test(String(supplierId))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected supplier is unavailable' });
      }
      const supplier = await client.query('SELECT id FROM suppliers WHERE id = $1 AND owner_user_id = $2', [supplierId, req.user.id]);
      if (supplier.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Selected supplier is unavailable' });
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const productsResult = await client.query(
      'SELECT id, item_name FROM products WHERE owner_user_id = $1 AND id = ANY($2::bigint[])',
      [req.user.id, productIds]
    );
    if (productsResult.rowCount !== productIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'One or more selected products are unavailable' });
    }

    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;

    const orderResult = await client.query(`
      INSERT INTO purchase_orders (owner_user_id, supplier_id, order_date, reference, notes, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, supplier_id, order_date, reference, notes, total_amount, created_at
    `, [req.user.id, supplierId || null, orderDate || new Date().toISOString().slice(0, 10), reference?.trim() || null, notes?.trim() || null, totalAmount]);

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(`
        INSERT INTO purchase_order_items (purchase_order_id, product_id, owner_user_id, quantity, unit_cost, line_total)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [order.id, item.productId, req.user.id, item.quantity, item.unitCost, item.lineTotal]);

      const stockResult = await client.query(`
        UPDATE products
        SET stock_present = stock_present + $1, stock_updated_date = CURRENT_DATE, updated_at = NOW()
        WHERE id = $2 AND owner_user_id = $3
        RETURNING stock_present
      `, [item.quantity, item.productId, req.user.id]);

      await client.query(`
        INSERT INTO inventory_movements (owner_user_id, product_id, movement_type, quantity_change, reference_type, reference_id, note, stock_after)
        VALUES ($1, $2, 'purchase', $3, 'purchase_order', $4, $5, $6)
      `, [req.user.id, item.productId, item.quantity, order.id, reference?.trim() || null, stockResult.rows[0].stock_present]);
    }

    await client.query('COMMIT');

    const supplierName = supplierId
      ? (await pool.query('SELECT name FROM suppliers WHERE id = $1 AND owner_user_id = $2', [supplierId, req.user.id])).rows[0]?.name || ''
      : '';
    const itemsWithNames = productsResult.rows.reduce((map, row) => ({ ...map, [row.id]: row.item_name }), {});

    return res.status(201).json(mapOrder({
      ...order,
      supplier_name: supplierName,
      items: items.map((item) => ({
        productId: item.productId,
        itemName: itemsWithNames[item.productId],
        hsn: '',
        quantity: item.quantity,
        unitCost: item.unitCost,
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

    const order = await client.query('SELECT id FROM purchase_orders WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (order.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Purchase order not found' });
    }

    const items = await client.query(
      'SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = $1',
      [id]
    );

    for (const item of items.rows) {
      const result = await client.query(`
        UPDATE products
        SET stock_present = stock_present - $1, updated_at = NOW()
        WHERE id = $2 AND owner_user_id = $3 AND stock_present >= $1
        RETURNING id
      `, [item.quantity, item.product_id, req.user.id]);

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Cannot delete this order: stock from it has already been sold or adjusted below the received quantity.' });
      }
    }

    await client.query("DELETE FROM inventory_movements WHERE reference_type = 'purchase_order' AND reference_id = $1 AND owner_user_id = $2", [id, req.user.id]);
    await client.query('DELETE FROM purchase_orders WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);

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
