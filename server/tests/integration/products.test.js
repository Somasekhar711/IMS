import { describe, expect, test, beforeAll } from '@jest/globals';
import { api, registerAdmin, createProduct, getProduct } from '../helpers/api.js';

describe('API: products', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-28 creates a product and returns it', async () => {
    const res = await api().post('/api/products').set(admin.auth).send({
      hsn: '1905', itemName: 'Marie Biscuits', itemPrice: 25.5, itemCategory: 'Grocery', gst: 5, stockPresent: 40, thresholdStock: 10,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ hsn: '1905', itemName: 'Marie Biscuits', itemPrice: 25.5, itemCategory: 'Grocery', gst: 5, stockPresent: 40, thresholdStock: 10 });
  });

  test.each([
    ['HSN', { itemName: 'X', itemPrice: 1 }],
    ['item name', { hsn: '1', itemPrice: 1 }],
    ['price', { hsn: '1', itemName: 'X' }],
  ])('IT-29 rejects a product without %s', async (_label, body) => {
    const res = await api().post('/api/products').set(admin.auth).send(body);
    expect(res.status).toBe(400);
  });

  test('IT-30 rejects a duplicate HSN within the same account', async () => {
    const product = await createProduct(admin.auth);
    const res = await api().post('/api/products').set(admin.auth).send({ hsn: product.hsn, itemName: 'Copy', itemPrice: 1 });
    expect(res.status).toBe(409);
  });

  test.each([
    ['negative price', { itemPrice: -5 }],
    ['negative stock', { stockPresent: -1 }],
    ['GST above 100%', { gst: 101 }],
    ['discount above 100%', { discount: 150 }],
    ['expiry before manufacture date', { mfd: '2026-06-01', expiryDate: '2026-01-01' }],
  ])('IT-31 rejects invalid product data with 400, not a server error (%s)', async (_label, overrides) => {
    const res = await api().post('/api/products').set(admin.auth).send({ hsn: `BAD${Math.random()}`.slice(0, 12), itemName: 'Bad', itemPrice: 10, ...overrides });
    expect(res.status).toBe(400);
  });

  test('IT-32 keeps DATE fields as plain YYYY-MM-DD (no timezone shift)', async () => {
    const product = await createProduct(admin.auth, { mfd: '2026-01-15', expiryDate: '2027-01-15' });
    const stored = await getProduct(admin.auth, product.id);
    expect(stored.mfd).toBe('2026-01-15');
    expect(stored.expiryDate).toBe('2027-01-15');
  });

  test('IT-33 searches by name, HSN, and category (case-insensitive)', async () => {
    await createProduct(admin.auth, { hsn: 'SRCH77', itemName: 'Basmati Rice', itemCategory: 'Staples' });

    for (const term of ['basmati', 'srch77', 'STAPLES']) {
      const res = await api().get('/api/products').query({ search: term }).set(admin.auth);
      expect(res.body.map((product) => product.itemName)).toContain('Basmati Rice');
    }

    const none = await api().get('/api/products').query({ search: 'zzz-no-match' }).set(admin.auth);
    expect(none.body).toEqual([]);
  });

  test('IT-34 updates price and stock of an existing product', async () => {
    const product = await createProduct(admin.auth);
    const res = await api().put(`/api/products/${product.id}`).set(admin.auth).send({ itemPrice: 199.99, stockPresent: 7, thresholdStock: 3 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ itemPrice: 199.99, stockPresent: 7, thresholdStock: 3 });
  });

  test('IT-35 returns 404 when updating a product that does not exist', async () => {
    const res = await api().put('/api/products/99999999').set(admin.auth).send({ itemPrice: 1 });
    expect(res.status).toBe(404);
  });

  test('IT-36 returns 404 (not a server error) for a non-numeric product id', async () => {
    const res = await api().delete('/api/products/abc').set(admin.auth);
    expect(res.status).toBe(404);
  });

  test('IT-37 deletes a product, and a second delete returns 404', async () => {
    const product = await createProduct(admin.auth);
    const first = await api().delete(`/api/products/${product.id}`).set(admin.auth);
    expect(first.status).toBe(204);
    const second = await api().delete(`/api/products/${product.id}`).set(admin.auth);
    expect(second.status).toBe(404);
  });
});

describe('API: stock adjustments', () => {
  let admin;
  let product;
  beforeAll(async () => {
    admin = await registerAdmin();
    product = await createProduct(admin.auth, { stockPresent: 10 });
  });

  test('IT-38 adjusting stock updates the product and writes a ledger entry', async () => {
    const res = await api().patch(`/api/products/${product.id}/stock`).set(admin.auth).send({ stockPresent: 25, reason: 'Stock count' });
    expect(res.status).toBe(200);
    expect(res.body.stockPresent).toBe(25);

    const ledger = await api().get('/api/inventory-movements').query({ productId: product.id }).set(admin.auth);
    expect(ledger.body[0]).toMatchObject({ movementType: 'adjustment', quantityChange: 15, stockAfter: 25, note: 'Stock count' });
  });

  test('IT-39 an adjustment that changes nothing writes no ledger entry', async () => {
    const before = await api().get('/api/inventory-movements').query({ productId: product.id }).set(admin.auth);
    await api().patch(`/api/products/${product.id}/stock`).set(admin.auth).send({ stockPresent: 25 });
    const after = await api().get('/api/inventory-movements').query({ productId: product.id }).set(admin.auth);
    expect(after.body.length).toBe(before.body.length);
  });

  test.each([[-1], [2.5], ['abc']])('IT-40 rejects an invalid stock value (%p)', async (value) => {
    const res = await api().patch(`/api/products/${product.id}/stock`).set(admin.auth).send({ stockPresent: value });
    expect(res.status).toBe(400);
  });

  test('IT-41 stock can be set to exactly zero (boundary)', async () => {
    const res = await api().patch(`/api/products/${product.id}/stock`).set(admin.auth).send({ stockPresent: 0 });
    expect(res.status).toBe(200);
    expect(res.body.stockPresent).toBe(0);
  });
});

describe('API: data isolation between accounts', () => {
  let alice;
  let bob;
  let aliceProduct;
  beforeAll(async () => {
    alice = await registerAdmin({ fullName: 'Alice' });
    bob = await registerAdmin({ fullName: 'Bob' });
    aliceProduct = await createProduct(alice.auth, { hsn: 'ISO-1', itemName: 'Alice Only' });
  });

  test('IT-42 one account cannot see another account\'s products', async () => {
    const res = await api().get('/api/products').set(bob.auth);
    expect(res.body.find((product) => product.itemName === 'Alice Only')).toBeUndefined();
  });

  test('IT-43 one account cannot update or delete another account\'s product', async () => {
    const update = await api().put(`/api/products/${aliceProduct.id}`).set(bob.auth).send({ itemPrice: 1 });
    expect(update.status).toBe(404);
    const remove = await api().delete(`/api/products/${aliceProduct.id}`).set(bob.auth);
    expect(remove.status).toBe(404);
    expect(await getProduct(alice.auth, aliceProduct.id)).toBeDefined();
  });

  test('IT-44 two accounts may reuse the same HSN', async () => {
    const res = await api().post('/api/products').set(bob.auth).send({ hsn: 'ISO-1', itemName: 'Bob Copy', itemPrice: 5 });
    expect(res.status).toBe(201);
  });
});

describe('API: categories', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-45 creates a category', async () => {
    const res = await api().post('/api/categories').set(admin.auth).send({ name: '  Beverages ', description: 'Drinks' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Beverages');
  });

  test('IT-46 rejects a blank category name', async () => {
    const res = await api().post('/api/categories').set(admin.auth).send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  test('IT-47 rejects a duplicate name ignoring letter case', async () => {
    const res = await api().post('/api/categories').set(admin.auth).send({ name: 'BEVERAGES' });
    expect(res.status).toBe(409);
  });

  test('IT-48 adding a product with a new category creates that category automatically', async () => {
    await createProduct(admin.auth, { itemCategory: 'Snacks' });
    const res = await api().get('/api/categories').set(admin.auth);
    const snacks = res.body.find((category) => category.name === 'Snacks');
    expect(snacks.productCount).toBe(1);
  });

  test('IT-49 refuses to delete a category that still has products', async () => {
    const list = await api().get('/api/categories').set(admin.auth);
    const snacks = list.body.find((category) => category.name === 'Snacks');
    const res = await api().delete(`/api/categories/${snacks.id}`).set(admin.auth);
    expect(res.status).toBe(409);
  });

  test('IT-50 deletes an empty category', async () => {
    const list = await api().get('/api/categories').set(admin.auth);
    const beverages = list.body.find((category) => category.name === 'Beverages');
    const res = await api().delete(`/api/categories/${beverages.id}`).set(admin.auth);
    expect(res.status).toBe(204);
  });
});
