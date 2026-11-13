import express from 'express';
import pool from '../config/db.js';
import { validateIdParam } from '../middleware/validateId.js';
import { authRequired } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { logActivity } from '../config/activityLog.js';

const router = express.Router();
router.param('id', validateIdParam);

const isBlank = (value) => value === undefined || value === null || value === '';

// Barcodes from EAN/UPC (digits) and Code 128/39 labels: printable characters, no spaces.
const BARCODE_PATTERN = /^[\x21-\x7E]{1,64}$/;

// Mirrors the CHECK constraints on the products table so bad input is answered
// with a clear 400 instead of surfacing as a database error (500).
function productProblem({ itemPrice, costPrice, gst, discount, stockPresent, thresholdStock, mfd, expiryDate, barcode }) {
  const numbers = { Price: itemPrice, 'Cost price': costPrice, 'GST%': gst, 'Discount%': discount, Stock: stockPresent, 'Threshold stock': thresholdStock };
  for (const [label, value] of Object.entries(numbers)) {
    if (isBlank(value)) continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return `${label} must be a non-negative number`;
  }

  if (Number(gst) > 100) return 'GST% cannot be more than 100';
  if (Number(discount) > 100) return 'Discount% cannot be more than 100';

  for (const [label, value] of [['Stock', stockPresent], ['Threshold stock', thresholdStock]]) {
    if (!isBlank(value) && !Number.isInteger(Number(value))) return `${label} must be a whole number`;
  }

  for (const [label, value] of [['Manufactured date', mfd], ['Expiry date', expiryDate]]) {
    const isDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    if (!isBlank(value) && !isDate) return `${label} must be a valid date (YYYY-MM-DD)`;
  }

  if (mfd && expiryDate && expiryDate < mfd) return 'Expiry date cannot be before the manufactured date';

  if (!isBlank(barcode) && !(typeof barcode === 'string' && BARCODE_PATTERN.test(barcode.trim()))) {
    return 'Barcode must be 1 to 64 characters with no spaces';
  }
  return null;
}

const normaliseBarcode = (value) => (isBlank(value) ? null : String(value).trim());
const normaliseCost = (value) => (isBlank(value) ? null : Number(value));

// 23505 = unique violation. Two unique rules apply to products: HSN and barcode.
function duplicateMessage(error) {
  return error.constraint === 'products_owner_barcode_idx'
    ? 'Another product already has this barcode'
    : 'A product with this HSN already exists';
}

const PRODUCT_COLUMNS = `p.id, p.hsn, p.barcode, p.item_name, p.item_price, p.cost_price, p.gst_percent, p.discount_percent,
  p.manufactured_date, p.expiry_date, p.stock_updated_date, p.stock_present, p.threshold_stock`;

function mapProduct(row, categoryName) {
  return {
    id: row.id,
    hsn: row.hsn,
    barcode: row.barcode || '',
    itemName: row.item_name,
    itemPrice: Number(row.item_price),
    costPrice: row.cost_price === null || row.cost_price === undefined ? '' : Number(row.cost_price),
    itemCategory: categoryName || '',
    gst: Number(row.gst_percent),
    discount: Number(row.discount_percent),
    mfd: row.manufactured_date || '',
    expiryDate: row.expiry_date || '',
    stockUpdatedDate: row.stock_updated_date || '',
    stockPresent: row.stock_present,
    thresholdStock: row.threshold_stock,
  };
}

// Finds the account's category by name (case-insensitive), creating it if needed.
async function categoryIdFor(userId, actor, name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) return null;

  const existing = await pool.query('SELECT id FROM categories WHERE owner_user_id = $1 AND LOWER(name) = LOWER($2)', [userId, trimmed]);
  if (existing.rowCount > 0) return existing.rows[0].id;

  const created = await pool.query('INSERT INTO categories (owner_user_id, name) VALUES ($1, $2) RETURNING id', [userId, trimmed]);
  logActivity(userId, actor, 'create', 'categories', `Created category "${trimmed}"`);
  return created.rows[0].id;
}

router.get('/', authRequired, requirePermission('products', 'read'), async (req, res) => {
  const search = (req.query.search || '').trim();
  const params = [req.user.id];
  let query = `
    SELECT ${PRODUCT_COLUMNS}, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.owner_user_id = $1
  `;

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    query += ` AND (LOWER(p.item_name) LIKE $2 OR LOWER(p.hsn) LIKE $2 OR LOWER(c.name) LIKE $2 OR LOWER(COALESCE(p.barcode, '')) LIKE $2)`;
  }
  query += ' ORDER BY p.created_at DESC';

  try {
    const result = await pool.query(query, params);
    return res.json(result.rows.map((row) => mapProduct(row, row.category_name)));
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, requirePermission('products', 'write'), async (req, res) => {
  const {
    hsn, itemName, itemPrice, costPrice, itemCategory, gst, discount, mfd, expiryDate, stockUpdatedDate, stockPresent, thresholdStock, barcode,
  } = req.body;

  const missing = [[hsn, 'HSN'], [itemName, 'Item name'], [itemPrice, 'Item price']].filter(([value]) => isBlank(value)).map(([, label]) => label);
  if (missing.length) {
    return res.status(400).json({ message: `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required` });
  }

  const problem = productProblem(req.body);
  if (problem) {
    return res.status(400).json({ message: problem });
  }

  try {
    const categoryId = await categoryIdFor(req.user.id, req.user, itemCategory);
    const result = await pool.query(`
      INSERT INTO products (owner_user_id, hsn, barcode, item_name, item_price, cost_price, category_id, gst_percent, discount_percent,
                            manufactured_date, expiry_date, stock_updated_date, stock_present, threshold_stock)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING ${PRODUCT_COLUMNS.replace(/p\./g, '')}
    `, [
      req.user.id, hsn, normaliseBarcode(barcode), itemName, Number(itemPrice) || 0, normaliseCost(costPrice), categoryId,
      Number(gst) || 0, Number(discount) || 0, mfd || null, expiryDate || null, stockUpdatedDate || null,
      Number(stockPresent) || 0, Number(thresholdStock) || 0,
    ]);
    const row = result.rows[0];

    logActivity(req.user.id, req.user, 'create', 'products', `Created product "${row.item_name}" (HSN ${row.hsn})`);
    return res.status(201).json(mapProduct(row, itemCategory));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: duplicateMessage(err) });
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authRequired, requirePermission('products', 'write'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 AND owner_user_id = $2 RETURNING item_name', [req.params.id, req.user.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    logActivity(req.user.id, req.user, 'delete', 'products', `Deleted product "${result.rows[0].item_name}"`);
    return res.status(204).send();
  } catch (err) {
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authRequired, requirePermission('products', 'write'), async (req, res) => {
  const { id } = req.params;
  const { itemPrice, itemCategory, gst, discount, mfd, expiryDate, stockUpdatedDate, stockPresent, thresholdStock } = req.body;

  const problem = productProblem(req.body);
  if (problem) {
    return res.status(400).json({ message: problem });
  }

  // Cost price and barcode change only when the request includes them, so an
  // older client that does not know these fields cannot wipe them.
  const hasCost = Object.prototype.hasOwnProperty.call(req.body, 'costPrice');
  const hasBarcode = Object.prototype.hasOwnProperty.call(req.body, 'barcode');

  try {
    const categoryId = await categoryIdFor(req.user.id, req.user, itemCategory);
    const result = await pool.query(`
      UPDATE products
      SET item_price = $1, category_id = $2, gst_percent = $3, discount_percent = $4,
          manufactured_date = $5, expiry_date = $6, stock_updated_date = $7,
          stock_present = $8, threshold_stock = $9,
          cost_price = CASE WHEN $12::boolean THEN $13::numeric ELSE cost_price END,
          barcode = CASE WHEN $14::boolean THEN $15::varchar ELSE barcode END,
          updated_at = NOW()
      WHERE id = $10 AND owner_user_id = $11
      RETURNING ${PRODUCT_COLUMNS.replace(/p\./g, '')}
    `, [
      Number(itemPrice) || 0, categoryId, Number(gst) || 0, Number(discount) || 0, mfd || null, expiryDate || null, stockUpdatedDate || null,
      Number(stockPresent) || 0, Number(thresholdStock) || 0, id, req.user.id,
      hasCost, hasCost ? normaliseCost(req.body.costPrice) : null,
      hasBarcode, hasBarcode ? normaliseBarcode(req.body.barcode) : null,
    ]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Product not found' });
    const row = result.rows[0];
    logActivity(req.user.id, req.user, 'update', 'products', `Updated product "${row.item_name}" (HSN ${row.hsn})`);
    return res.json(mapProduct(row, itemCategory));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: duplicateMessage(err) });
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:id/stock', authRequired, requirePermission('inventory', 'write'), async (req, res) => {
  const { id } = req.params;
  const stockPresent = Number(req.body.stockPresent);
  const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
  if (!Number.isInteger(stockPresent) || stockPresent < 0) return res.status(400).json({ message: 'Stock must be a non-negative integer' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query('SELECT item_name, stock_present FROM products WHERE id = $1 AND owner_user_id = $2 FOR UPDATE', [id, req.user.id]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Product not found' });
    }

    const previousStock = Number(current.rows[0].stock_present);
    const result = await client.query('UPDATE products SET stock_present = $1, stock_updated_date = CURRENT_DATE, updated_at = NOW() WHERE id = $2 AND owner_user_id = $3 RETURNING id, stock_present, stock_updated_date', [stockPresent, id, req.user.id]);

    const quantityChange = stockPresent - previousStock;
    if (quantityChange !== 0) {
      await client.query(`
        INSERT INTO inventory_movements (owner_user_id, product_id, movement_type, quantity_change, reference_type, note, stock_after)
        VALUES ($1, $2, 'adjustment', $3, 'manual', $4, $5)
      `, [req.user.id, id, quantityChange, reason || null, stockPresent]);
    }

    await client.query('COMMIT');

    if (quantityChange !== 0) {
      logActivity(req.user.id, req.user, 'update', 'inventory', `Adjusted stock for "${current.rows[0].item_name}" (${quantityChange > 0 ? '+' : ''}${quantityChange})`);
    }

    return res.json({ id: result.rows[0].id, stockPresent: result.rows[0].stock_present, stockUpdatedDate: result.rows[0].stock_updated_date });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database error', err);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
