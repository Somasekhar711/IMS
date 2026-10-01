import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

function normalizeProductIds(productIds) {
  if (!Array.isArray(productIds)) return null;

  const normalized = [...new Set(productIds.map((id) => String(id)))];
  if (normalized.some((id) => !/^\d+$/.test(id))) return null;
  return normalized;
}

async function ensureProductsBelongToUser(client, productIds, userId) {
  if (productIds.length === 0) return true;

  const result = await client.query(
    'SELECT COUNT(*)::int AS count FROM products WHERE owner_user_id = $1 AND id = ANY($2::bigint[])',
    [userId, productIds]
  );
  return Number(result.rows[0].count) === productIds.length;
}

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.contact_person,
        s.phone,
        s.email,
        s.address,
        s.tax_id,
        s.notes,
        s.created_at,
        COALESCE(
          JSON_AGG(JSON_BUILD_OBJECT('id', p.id, 'itemName', p.item_name, 'hsn', p.hsn))
            FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) AS products
      FROM suppliers s
      LEFT JOIN supplier_products sp ON sp.supplier_id = s.id AND sp.owner_user_id = s.owner_user_id
      LEFT JOIN products p ON p.id = sp.product_id AND p.owner_user_id = s.owner_user_id
      WHERE s.owner_user_id = $1
      GROUP BY s.id
      ORDER BY LOWER(s.name)
    `, [req.user.id]);

    return res.json(result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      taxId: row.tax_id || '',
      notes: row.notes || '',
      createdAt: row.created_at,
      products: row.products,
    })));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const { name, contactPerson, phone, email, address, taxId, notes } = req.body;
  const trimmedName = name?.trim();
  const productIds = normalizeProductIds(req.body.productIds ?? []);

  if (!trimmedName) return res.status(400).json({ message: 'Supplier name is required' });
  if (!productIds) return res.status(400).json({ message: 'Product selections are invalid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productsValid = await ensureProductsBelongToUser(client, productIds, req.user.id);
    if (!productsValid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'One or more selected products are unavailable' });
    }

    const result = await client.query(`
      INSERT INTO suppliers (owner_user_id, name, contact_person, phone, email, address, tax_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, contact_person, phone, email, address, tax_id, notes, created_at
    `, [req.user.id, trimmedName, contactPerson?.trim() || null, phone?.trim() || null, email?.trim() || null, address?.trim() || null, taxId?.trim() || null, notes?.trim() || null]);

    const supplier = result.rows[0];
    if (productIds.length > 0) {
      await client.query(`
        INSERT INTO supplier_products (supplier_id, product_id, owner_user_id)
        SELECT $1, product.id, $3
        FROM products product
        WHERE product.id = ANY($2::bigint[]) AND product.owner_user_id = $3
      `, [supplier.id, productIds, req.user.id]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      taxId: supplier.tax_id || '',
      notes: supplier.notes || '',
      createdAt: supplier.created_at,
      products: [],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: 'A supplier with this name already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, contactPerson, phone, email, address, taxId, notes } = req.body;
  const trimmedName = name?.trim();
  const productIds = normalizeProductIds(req.body.productIds ?? []);

  if (!trimmedName) return res.status(400).json({ message: 'Supplier name is required' });
  if (!productIds) return res.status(400).json({ message: 'Product selections are invalid' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const productsValid = await ensureProductsBelongToUser(client, productIds, req.user.id);
    if (!productsValid) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'One or more selected products are unavailable' });
    }

    const result = await client.query(`
      UPDATE suppliers
      SET name = $1, contact_person = $2, phone = $3, email = $4,
          address = $5, tax_id = $6, notes = $7, updated_at = NOW()
      WHERE id = $8 AND owner_user_id = $9
      RETURNING id, name, contact_person, phone, email, address, tax_id, notes, created_at
    `, [trimmedName, contactPerson?.trim() || null, phone?.trim() || null, email?.trim() || null, address?.trim() || null, taxId?.trim() || null, notes?.trim() || null, id, req.user.id]);

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Supplier not found' });
    }

    await client.query('DELETE FROM supplier_products WHERE supplier_id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (productIds.length > 0) {
      await client.query(`
        INSERT INTO supplier_products (supplier_id, product_id, owner_user_id)
        SELECT $1, product.id, $3
        FROM products product
        WHERE product.id = ANY($2::bigint[]) AND product.owner_user_id = $3
      `, [id, productIds, req.user.id]);
    }

    await client.query('COMMIT');
    const supplier = result.rows[0];
    return res.json({
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      taxId: supplier.tax_id || '',
      notes: supplier.notes || '',
      createdAt: supplier.created_at,
      products: [],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: 'A supplier with this name already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  try {
    const supplier = await pool.query('SELECT id FROM suppliers WHERE id = $1 AND owner_user_id = $2', [req.params.id, req.user.id]);
    if (supplier.rowCount === 0) return res.status(404).json({ message: 'Supplier not found' });

    const productCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM supplier_products WHERE supplier_id = $1 AND owner_user_id = $2',
      [req.params.id, req.user.id]
    );
    const count = Number(productCount.rows[0].count);
    if (count > 0) {
      return res.status(409).json({
        message: `This supplier is associated with ${count} product${count === 1 ? '' : 's'}. Remove the associations before deleting it.`,
      });
    }

    await pool.query('DELETE FROM suppliers WHERE id = $1 AND owner_user_id = $2', [req.params.id, req.user.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;