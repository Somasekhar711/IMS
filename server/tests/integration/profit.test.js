import { describe, expect, test, beforeAll } from '@jest/globals';
import { api, registerAdmin, createProduct, getProduct } from '../helpers/api.js';

// YYYY-MM-DD for a day relative to today.
function day(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

describe('API: product cost price and barcode', () => {
  let admin;
  beforeAll(async () => { admin = await registerAdmin(); });

  test('IT-92 a product saves its cost price and barcode, and search finds it by barcode', async () => {
    const product = await createProduct(admin.auth, { itemName: 'Scanned Soap', costPrice: 30.5, barcode: '8901030865278' });
    expect(product).toMatchObject({ costPrice: 30.5, barcode: '8901030865278' });

    const res = await api().get('/api/products').query({ search: '8901030865278' }).set(admin.auth);
    expect(res.body.map((item) => item.itemName)).toEqual(['Scanned Soap']);
  });

  test('IT-93 a barcode is unique within an account, but other accounts and blank barcodes do not clash', async () => {
    const duplicate = await api().post('/api/products').set(admin.auth).send({ hsn: 'DUP-BC', itemName: 'Copy', itemPrice: 1, barcode: '8901030865278' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.message).toMatch(/barcode/);

    const other = await registerAdmin();
    await createProduct(other.auth, { barcode: '8901030865278' });
    await createProduct(admin.auth, { barcode: '' });
    await createProduct(admin.auth, { barcode: '' });
  });

  test.each([
    ['a barcode containing a space', { barcode: '890 103' }],
    ['a negative cost price', { costPrice: -1 }],
  ])('IT-94 rejects %s', async (_label, overrides) => {
    const res = await api().post('/api/products').set(admin.auth).send({ hsn: `BAD${Date.now()}`, itemName: 'Bad', itemPrice: 10, ...overrides });
    expect(res.status).toBe(400);
  });

  test('IT-95 an update that leaves out cost price and barcode keeps them', async () => {
    const product = await createProduct(admin.auth, { costPrice: 12, barcode: 'KEEP-ME-1' });
    const res = await api().put(`/api/products/${product.id}`).set(admin.auth).send({ itemPrice: 20, stockPresent: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ costPrice: 12, barcode: 'KEEP-ME-1', itemPrice: 20 });
  });

  test('IT-96 a purchase order sets the product cost price to the latest purchase cost', async () => {
    const product = await createProduct(admin.auth, { costPrice: 10 });
    await api().post('/api/purchase-orders').set(admin.auth).send({ items: [{ productId: product.id, quantity: 5, unitCost: 14.25 }] });
    expect((await getProduct(admin.auth, product.id)).costPrice).toBe(14.25);
  });
});

describe('API: gross profit in the report', () => {
  let admin;
  let costed;

  beforeAll(async () => {
    admin = await registerAdmin();
    costed = await createProduct(admin.auth, { itemName: 'Costed Tea', itemCategory: 'Beverages', itemPrice: 100, costPrice: 60, stockPresent: 50 });
    const uncosted = await createProduct(admin.auth, { itemName: 'Uncosted Gift', itemCategory: 'Gifts', itemPrice: 50, stockPresent: 10 });
    const customer = (await api().post('/api/customers').set(admin.auth).send({ name: 'Big Buyer' })).body;

    // 4 × 100 sold while the cost was 60 → profit 160.
    await api().post('/api/sales-orders').set(admin.auth).send({ customerId: customer.id, items: [{ productId: costed.id, quantity: 4, unitPrice: 100 }] });
    // New stock bought at 80 → cost price becomes 80; 1 × 100 sold → profit 20.
    await api().post('/api/purchase-orders').set(admin.auth).send({ items: [{ productId: costed.id, quantity: 10, unitCost: 80 }] });
    await api().post('/api/sales-orders').set(admin.auth).send({ items: [{ productId: costed.id, quantity: 1, unitPrice: 100 }] });
    // A product with no cost price: its revenue is reported but not counted in profit.
    await api().post('/api/sales-orders').set(admin.auth).send({ items: [{ productId: uncosted.id, quantity: 2, unitPrice: 50 }] });
  });

  const summary = async () => (await api().get('/api/reports/summary').query({ range: '30' }).set(admin.auth)).body;

  test('IT-97 each sale keeps the cost at the time of sale, so a later cost change does not rewrite past profit', async () => {
    const report = await summary();
    expect(report.grossProfit).toBe(180);          // 160 + 20
    expect(report.costOfGoodsSold).toBe(320);      // 4 × 60 + 1 × 80
    expect(report.grossMarginPercent).toBe(36);    // 180 / 500
  });

  test('IT-98 revenue from products without a cost price is reported separately and left out of profit', async () => {
    const report = await summary();
    expect(report.salesTotal).toBe(600);
    expect(report.uncostedRevenue).toBe(100);
    expect(report.unitsSold).toBe(7);
  });

  test('IT-99 the report breaks sales down by category and customer, with average order value', async () => {
    const report = await summary();
    expect(report.averageOrderValue).toBe(200);    // 600 / 3 orders
    expect(report.salesByCategory).toEqual([
      { category: 'Beverages', quantity: 5, revenue: 500, profit: 180 },
      { category: 'Gifts', quantity: 2, revenue: 100, profit: null },
    ]);
    expect(report.topCustomers[0]).toMatchObject({ name: 'Big Buyer', orders: 1, revenue: 400 });
    expect(report.topCustomers[1]).toMatchObject({ name: 'Walk-in customers', orders: 2, revenue: 200 });
    expect(report.topProducts[0]).toMatchObject({ itemName: 'Costed Tea', quantity: 5, profit: 180 });
  });

  test('IT-100 stock value is reported at cost and at selling price', async () => {
    const report = await summary();
    // Costed Tea: 50 - 5 + 10 = 55 in stock, cost 80, price 100. Uncosted Gift: 8 in stock at 50.
    expect(report.inventoryValueAtCost).toBe(4400);
    expect(report.inventoryValueAtPrice).toBe(5900);
    expect(report.potentialProfit).toBe(1100);     // 55 × (100 - 80)
    expect(report.productsWithoutCost).toBe(1);
  });

  test('IT-101 the sales trend has one point per day with revenue and profit', async () => {
    const report = await summary();
    expect(report.salesTrend.interval).toBe('day');
    expect(report.salesTrend.points).toHaveLength(1);
    expect(report.salesTrend.points[0]).toMatchObject({ revenue: 600, profit: 180 });
  });
});

describe('API: expiring products in the report', () => {
  test('IT-102 lists expired items and items expiring within 30 days, soonest first (boundary: 30 vs 31 days)', async () => {
    const admin = await registerAdmin();
    await createProduct(admin.auth, { itemName: 'Expired Milk', mfd: day(-20), expiryDate: day(-2), stockPresent: 4, itemPrice: 25 });
    await createProduct(admin.auth, { itemName: 'Curd Day 30', mfd: day(-5), expiryDate: day(30) });
    await createProduct(admin.auth, { itemName: 'Butter Day 31', mfd: day(-5), expiryDate: day(31) });
    await createProduct(admin.auth, { itemName: 'No Expiry Pen' });

    const report = (await api().get('/api/reports/summary').set(admin.auth)).body;
    expect(report.expiringItems.map((item) => item.itemName)).toEqual(['Expired Milk', 'Curd Day 30']);
    expect(report.expiringItems[0]).toMatchObject({ daysLeft: -2, valueAtRisk: 100 });
  });
});
