import { describe, expect, test, beforeAll } from '@jest/globals';
import { api, registerAdmin, createProduct, getProduct } from '../helpers/api.js';

describe('API: purchase orders (stock in)', () => {
  let admin;
  let product;
  let supplier;
  let orderId;
  beforeAll(async () => {
    admin = await registerAdmin();
    product = await createProduct(admin.auth, { stockPresent: 5 });
    supplier = (await api().post('/api/suppliers').set(admin.auth).send({ name: 'Acme Traders', phone: '9000000001', productIds: [product.id] })).body;
  });

  test('IT-51 creates a supplier linked to a product', async () => {
    expect(supplier.name).toBe('Acme Traders');
    const list = await api().get('/api/suppliers').set(admin.auth);
    expect(list.body[0].products.map((item) => String(item.id))).toContain(String(product.id));
  });

  test('IT-52 rejects a duplicate supplier name', async () => {
    const res = await api().post('/api/suppliers').set(admin.auth).send({ name: 'Acme Traders' });
    expect(res.status).toBe(409);
  });

  test('IT-53 a purchase order adds its quantity to stock and totals the lines', async () => {
    const res = await api().post('/api/purchase-orders').set(admin.auth).send({
      supplierId: supplier.id, reference: 'PO-001', items: [{ productId: product.id, quantity: 20, unitCost: 12.5 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(250);
    expect(res.body.supplierName).toBe('Acme Traders');
    orderId = res.body.id;

    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(25);
  });

  test('IT-54 the purchase is recorded in the stock movement ledger', async () => {
    const res = await api().get('/api/inventory-movements').query({ type: 'purchase' }).set(admin.auth);
    expect(res.body[0]).toMatchObject({ movementType: 'purchase', quantityChange: 20, stockAfter: 25, note: 'PO-001' });
  });

  test.each([
    ['no items', []],
    ['zero quantity', [{ productId: 1, quantity: 0, unitCost: 1 }]],
    ['fractional quantity', [{ productId: 1, quantity: 1.5, unitCost: 1 }]],
    ['negative cost', [{ productId: 1, quantity: 1, unitCost: -1 }]],
  ])('IT-55 rejects an invalid purchase order (%s)', async (_label, items) => {
    const res = await api().post('/api/purchase-orders').set(admin.auth).send({ items });
    expect(res.status).toBe(400);
  });

  test('IT-56 rejects a purchase order for another account\'s product', async () => {
    const other = await registerAdmin();
    const res = await api().post('/api/purchase-orders').set(other.auth).send({ items: [{ productId: product.id, quantity: 1, unitCost: 1 }] });
    expect(res.status).toBe(400);
  });

  test('IT-57 deleting a purchase order reverses its stock', async () => {
    const res = await api().delete(`/api/purchase-orders/${orderId}`).set(admin.auth);
    expect(res.status).toBe(204);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(5);
  });
});

describe('API: sales orders (stock out)', () => {
  let admin;
  let product;
  let customer;
  let orderId;
  beforeAll(async () => {
    admin = await registerAdmin();
    product = await createProduct(admin.auth, { stockPresent: 10, itemName: 'Notebook' });
    customer = (await api().post('/api/customers').set(admin.auth).send({ name: 'Ravi Stores' })).body;
  });

  test('IT-58 a sales order removes its quantity from stock', async () => {
    const res = await api().post('/api/sales-orders').set(admin.auth).send({
      customerId: customer.id, reference: 'SO-001', items: [{ productId: product.id, quantity: 4, unitPrice: 50 }],
    });
    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(200);
    expect(res.body.customerName).toBe('Ravi Stores');
    orderId = res.body.id;

    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(6);
  });

  test('IT-59 overselling is rejected and stock is left untouched (boundary: 7 requested, 6 available)', async () => {
    const res = await api().post('/api/sales-orders').set(admin.auth).send({ items: [{ productId: product.id, quantity: 7, unitPrice: 50 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Not enough stock for Notebook: 6 available, 7 requested/);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(6);
  });

  test('IT-60 two lines for the same product are added up before the stock check', async () => {
    const res = await api().post('/api/sales-orders').set(admin.auth).send({
      items: [{ productId: product.id, quantity: 4, unitPrice: 50 }, { productId: product.id, quantity: 4, unitPrice: 50 }],
    });
    expect(res.status).toBe(400);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(6);
  });

  test('IT-61 selling exactly the remaining stock is allowed (boundary: 6 of 6)', async () => {
    const res = await api().post('/api/sales-orders').set(admin.auth).send({ items: [{ productId: product.id, quantity: 6, unitPrice: 50 }] });
    expect(res.status).toBe(201);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(0);
  });

  test('IT-62 a failed order is rolled back completely (atomic transaction)', async () => {
    const second = await createProduct(admin.auth, { stockPresent: 3 });
    const res = await api().post('/api/sales-orders').set(admin.auth).send({
      items: [{ productId: second.id, quantity: 2, unitPrice: 10 }, { productId: product.id, quantity: 1, unitPrice: 10 }],
    });
    expect(res.status).toBe(400);
    expect((await getProduct(admin.auth, second.id)).stockPresent).toBe(3);
  });

  test('IT-63 deleting a sales order returns its stock', async () => {
    const res = await api().delete(`/api/sales-orders/${orderId}`).set(admin.auth);
    expect(res.status).toBe(204);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(4);
  });

  test('IT-64 a customer with orders cannot be deleted', async () => {
    await api().post('/api/sales-orders').set(admin.auth).send({ customerId: customer.id, items: [{ productId: product.id, quantity: 1, unitPrice: 50 }] });
    const res = await api().delete(`/api/customers/${customer.id}`).set(admin.auth);
    expect(res.status).toBe(409);
  });
});

describe('API: purchase then sale (end-to-end stock flow)', () => {
  let admin;
  let product;
  let purchaseId;
  beforeAll(async () => {
    admin = await registerAdmin();
    product = await createProduct(admin.auth, { stockPresent: 0, itemName: 'Pen' });
  });

  test('IT-65 stock received by purchase can then be sold', async () => {
    const purchase = await api().post('/api/purchase-orders').set(admin.auth).send({ items: [{ productId: product.id, quantity: 10, unitCost: 4 }] });
    purchaseId = purchase.body.id;
    const sale = await api().post('/api/sales-orders').set(admin.auth).send({ items: [{ productId: product.id, quantity: 8, unitPrice: 10 }] });
    expect(sale.status).toBe(201);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(2);
  });

  test('IT-66 a purchase order cannot be deleted once its stock has been sold', async () => {
    const res = await api().delete(`/api/purchase-orders/${purchaseId}`).set(admin.auth);
    expect(res.status).toBe(409);
    expect((await getProduct(admin.auth, product.id)).stockPresent).toBe(2);
  });

  test('IT-67 the report summary matches the orders that were placed', async () => {
    const res = await api().get('/api/reports/summary').query({ range: '30' }).set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      salesTotal: 80, salesCount: 1, purchasesTotal: 40, purchasesCount: 1,
      totalProducts: 1, outOfStockCount: 0, movementsCount: 2,
    });
    expect(res.body.topProducts[0]).toMatchObject({ itemName: 'Pen', quantity: 8, revenue: 80 });
  });

  test('IT-68 the report counts low-stock products (stock at or below threshold)', async () => {
    await api().patch(`/api/products/${product.id}/stock`).set(admin.auth).send({ stockPresent: 2 });
    const res = await api().get('/api/reports/summary').set(admin.auth);
    expect(res.body.lowStockCount).toBe(1);
  });
});

describe('API: report lists the products behind the stock counts', () => {
  let admin;
  beforeAll(async () => {
    admin = await registerAdmin();
    await createProduct(admin.auth, { itemName: 'Healthy Item', stockPresent: 50, thresholdStock: 10 });
    await createProduct(admin.auth, { itemName: 'Low Item', stockPresent: 3, thresholdStock: 10, itemCategory: 'Dairy' });
    await createProduct(admin.auth, { itemName: 'Edge Item', stockPresent: 10, thresholdStock: 10 });
    await createProduct(admin.auth, { itemName: 'Empty Item', stockPresent: 0, thresholdStock: 5 });
  });

  test('IT-90 low stock lists items above zero and at or below their threshold (boundary: 10 of 10)', async () => {
    const res = await api().get('/api/reports/summary').set(admin.auth);
    expect(res.body.lowStockItems.map((item) => item.itemName)).toEqual(['Low Item', 'Edge Item']);
    expect(res.body.lowStockItems[0]).toMatchObject({ itemCategory: 'Dairy', stockPresent: 3, thresholdStock: 10 });
    expect(res.body.lowStockItems).toHaveLength(res.body.lowStockCount);
  });

  test('IT-91 out of stock lists only items with zero stock, matching the count', async () => {
    const res = await api().get('/api/reports/summary').set(admin.auth);
    expect(res.body.outOfStockItems.map((item) => item.itemName)).toEqual(['Empty Item']);
    expect(res.body.outOfStockItems).toHaveLength(res.body.outOfStockCount);
  });
});
