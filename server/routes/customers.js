import express from 'express';
import pool from '../config/db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, contact_person, phone, email, address, tax_id, notes, created_at
      FROM customers
      WHERE owner_user_id = $1
      ORDER BY LOWER(name)
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
    })));
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authRequired, async (req, res) => {
  const { name, contactPerson, phone, email, address, taxId, notes } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) return res.status(400).json({ message: 'Customer name is required' });

  try {
    const result = await pool.query(`
      INSERT INTO customers (owner_user_id, name, contact_person, phone, email, address, tax_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, contact_person, phone, email, address, tax_id, notes, created_at
    `, [req.user.id, trimmedName, contactPerson?.trim() || null, phone?.trim() || null, email?.trim() || null, address?.trim() || null, taxId?.trim() || null, notes?.trim() || null]);

    const row = result.rows[0];
    return res.status(201).json({
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      taxId: row.tax_id || '',
      notes: row.notes || '',
      createdAt: row.created_at,
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A customer with this name already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { name, contactPerson, phone, email, address, taxId, notes } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) return res.status(400).json({ message: 'Customer name is required' });

  try {
    const result = await pool.query(`
      UPDATE customers
      SET name = $1, contact_person = $2, phone = $3, email = $4,
          address = $5, tax_id = $6, notes = $7, updated_at = NOW()
      WHERE id = $8 AND owner_user_id = $9
      RETURNING id, name, contact_person, phone, email, address, tax_id, notes, created_at
    `, [trimmedName, contactPerson?.trim() || null, phone?.trim() || null, email?.trim() || null, address?.trim() || null, taxId?.trim() || null, notes?.trim() || null, id, req.user.id]);

    if (result.rowCount === 0) return res.status(404).json({ message: 'Customer not found' });

    const row = result.rows[0];
    return res.json({
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      taxId: row.tax_id || '',
      notes: row.notes || '',
      createdAt: row.created_at,
    });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'A customer with this name already exists' });
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await pool.query('SELECT id FROM customers WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    if (customer.rowCount === 0) return res.status(404).json({ message: 'Customer not found' });

    const orderCount = await pool.query(
      'SELECT COUNT(*)::int AS count FROM sales_orders WHERE customer_id = $1 AND owner_user_id = $2',
      [id, req.user.id]
    );
    const count = Number(orderCount.rows[0].count);
    if (count > 0) {
      return res.status(409).json({
        message: `This customer has ${count} sales order${count === 1 ? '' : 's'} on record. Remove those orders before deleting it.`,
      });
    }

    await pool.query('DELETE FROM customers WHERE id = $1 AND owner_user_id = $2', [id, req.user.id]);
    return res.status(204).send();
  } catch (error) {
    console.error('Database error', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
