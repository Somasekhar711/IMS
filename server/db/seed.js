// `npm run seed`: fills the database in server/.env with demo data for a showcase.
//
// Everything is created through the real API (not raw INSERTs), so passwords are
// hashed, stock totals match the orders, and the stock ledger and activity log
// are filled in exactly as they would be by real use.
//
// Demo sign-ins created by this script (demo data only, change before real use):
//
//   Admin 1 (main showcase account)   email: admin@stockit.demo     password: Demo@1234
//   Admin 2 (shows data isolation)    email: second@stockit.demo    password: Demo@1234
//   Security answer for both admins:  Hyderabad
//
//   Team of Admin 1 - sign in from the Manager or Employee tab, using the
//   Warehouse ID shown under Settings (also printed when this script finishes):
//     EMP001  Kiran Kumar   password: Staff@1234   Manager tab: write access to stock, orders and partners
//     EMP002  Divya Sharma  password: Staff@1234   Employee tab: sales and customers only
//     EMP003  Arjun Reddy   password: Staff@1234   Employee tab: read-only viewer
//     (Meera Nair is on the roster without a login; Rahul Verma is disabled)
import app from '../app.js';
import pool from '../config/db.js';

const ADMIN = { fullName: 'Aarav Mehta', email: 'admin@stockit.demo', password: 'Demo@1234' };
const SECOND = { fullName: 'Priya Iyer', email: 'second@stockit.demo', password: 'Demo@1234' };
const EMPLOYEE_PASSWORD = 'Staff@1234';
const SECURITY = { securityQuestion: 'What city were you born in?', securityAnswer: 'Hyderabad' };

const server = app.listen(0);
const BASE = `http://localhost:${server.address().port}/api`;

async function call(method, path, body, token) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${data.message || ''}`);
  return data;
}

// YYYY-MM-DD for a day relative to today (negative = in the past).
function day(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

// Small deterministic random generator so every seed run produces the same data.
let seedState = 20261111;
function random() {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

// [hsn, name, category, price, gst, discount, opening stock, threshold, mfd offset, expiry offset]
const PRODUCTS = [
  ['1006', 'Basmati Rice 5kg', 'Staples', 640, 5, 0, 40, 15, -90, 275],
  ['1101', 'Whole Wheat Atta 10kg', 'Staples', 455, 5, 0, 35, 12, -40, 140],
  ['0713', 'Toor Dal 1kg', 'Staples', 168, 5, 0, 60, 20, -60, 300],
  ['1701', 'Sugar 1kg', 'Staples', 48, 5, 0, 80, 25, -30, 500],
  ['1507', 'Sunflower Oil 1L', 'Staples', 155, 5, 2, 50, 18, -50, 310],
  ['2501', 'Iodised Salt 1kg', 'Staples', 24, 0, 0, 70, 20, -120, 600],
  ['1905', 'Marie Biscuits 250g', 'Snacks', 35, 18, 0, 90, 30, -45, 135],
  ['2106', 'Potato Chips 90g', 'Snacks', 30, 12, 0, 120, 40, -20, 100],
  ['1806', 'Milk Chocolate Bar 50g', 'Snacks', 45, 18, 5, 100, 30, -35, 200],
  ['1904', 'Corn Flakes 475g', 'Snacks', 189, 18, 0, 30, 10, -70, 290],
  ['2008', 'Roasted Peanuts 200g', 'Snacks', 60, 12, 0, 45, 15, -25, 155],
  ['2202', 'Cola 750ml', 'Beverages', 40, 28, 0, 110, 36, -30, 150],
  ['2009', 'Mango Juice 1L', 'Beverages', 110, 12, 0, 48, 16, -40, 140],
  ['0902', 'Assam Tea 500g', 'Beverages', 265, 5, 0, 36, 12, -100, 630],
  ['0901', 'Filter Coffee Powder 200g', 'Beverages', 185, 5, 0, 28, 10, -55, 310],
  ['2201', 'Mineral Water 1L', 'Beverages', 20, 18, 0, 150, 48, -15, 165],
  ['0401', 'Toned Milk 500ml', 'Dairy', 27, 0, 0, 60, 24, -2, 5],
  ['0403', 'Curd 400g', 'Dairy', 35, 5, 0, 40, 16, -3, 12],
  ['0405', 'Salted Butter 100g', 'Dairy', 58, 12, 0, 32, 12, -20, 22],
  ['0406', 'Paneer 200g', 'Dairy', 95, 5, 0, 24, 10, -4, 18],
  ['3401', 'Bath Soap 125g', 'Personal Care', 42, 18, 0, 85, 25, -80, 650],
  ['3305', 'Shampoo 340ml', 'Personal Care', 235, 18, 10, 26, 10, -110, 620],
  ['3306', 'Toothpaste 150g', 'Personal Care', 99, 18, 0, 55, 18, -65, 660],
  ['3304', 'Moisturising Lotion 200ml', 'Personal Care', 210, 18, 0, 22, 8, -95, 630],
  ['3402', 'Detergent Powder 1kg', 'Household', 132, 18, 0, 44, 15, -75, null],
  ['3405', 'Dishwash Liquid 500ml', 'Household', 105, 18, 0, 38, 12, -60, 670],
  ['3808', 'Floor Cleaner 1L', 'Household', 178, 18, 0, 25, 10, -85, 640],
  ['4818', 'Tissue Roll 4 pack', 'Household', 140, 12, 0, 30, 12, -130, null],
  ['4820', 'Ruled Notebook 200 pages', 'Stationery', 65, 12, 0, 75, 25, -150, null],
  ['9608', 'Ball Pen (pack of 10)', 'Stationery', 80, 18, 0, 60, 20, -160, null],
  ['8539', 'LED Bulb 9W', 'Electricals', 99, 12, 0, 40, 15, -200, null],
  ['8506', 'AA Batteries (pack of 4)', 'Electricals', 120, 18, 0, 34, 12, -140, 900],
];

const CATEGORY_NOTES = {
  Staples: 'Rice, flour, pulses, oil and other kitchen basics',
  Snacks: 'Biscuits, chips, chocolate and ready-to-eat items',
  Beverages: 'Tea, coffee, juices and soft drinks',
  Dairy: 'Chilled items with a short shelf life',
  'Personal Care': 'Soap, shampoo and grooming',
  Household: 'Cleaning and home supplies',
  Stationery: 'Notebooks, pens and office basics',
  Electricals: 'Bulbs, batteries and small fittings',
};

// [name, contact, phone, email, address, GSTIN, categories supplied]
const SUPPLIERS = [
  ['Sri Lakshmi Traders', 'Venkat Rao', '9848012345', 'orders@srilakshmitraders.example', 'Begum Bazaar, Hyderabad', '36AABCS1429B1Z5', ['Staples']],
  ['Deccan Snacks & Foods', 'Imran Khan', '9885023456', 'sales@deccansnacks.example', 'Balanagar Industrial Area, Hyderabad', '36AAECD5512K1Z2', ['Snacks']],
  ['Godavari Beverages', 'Sunitha Reddy', '9700034567', 'supply@godavaribev.example', 'Rajahmundry Road, Vijayawada', '37AAGCG8841M1Z8', ['Beverages']],
  ['Heritage Dairy Distributors', 'Ramesh Babu', '9966045678', 'dispatch@heritagedairy.example', 'Uppal, Hyderabad', '36AACCH3310P1Z1', ['Dairy']],
  ['CleanHome Wholesale', 'Anjali Gupta', '9123056789', 'orders@cleanhome.example', 'Secunderabad', '36AAHCC7765Q1Z4', ['Personal Care', 'Household']],
  ['Bright Office & Electricals', 'Naveen Joshi', '9000067890', 'hello@brightoffice.example', 'Abids, Hyderabad', '36AAJCB2298R1Z7', ['Stationery', 'Electricals']],
];

// [name, contact, phone, email, address]
const CUSTOMERS = [
  ['Ravi Kirana Stores', 'Ravi Teja', '9848111222', 'ravi.kirana@example.com', 'Kukatpally, Hyderabad'],
  ['Hotel Annapurna', 'Lakshmi Devi', '9885222333', 'purchase@hotelannapurna.example', 'Ameerpet, Hyderabad'],
  ['Green Valley School Canteen', 'Suresh Kumar', '9700333444', 'canteen@greenvalley.example', 'Miyapur, Hyderabad'],
  ['Sai Supermarket', 'Padma Rani', '9966444555', 'sai.supermarket@example.com', 'Dilsukhnagar, Hyderabad'],
  ['Cafe Mocha Corner', 'Farhan Ali', '9123555666', 'orders@cafemocha.example', 'Banjara Hills, Hyderabad'],
  ['TechPark Pantry Services', 'Nisha Menon', '9000666777', 'pantry@techpark.example', 'HITEC City, Hyderabad'],
  ['Annapoorna Mess', 'Gopal Krishna', '9848777888', 'annapoorna.mess@example.com', 'SR Nagar, Hyderabad'],
  ['City Care Hospital Stores', 'Dr. Kavya Rao', '9885888999', 'stores@citycare.example', 'Somajiguda, Hyderabad'],
];

const ALL_WRITE = { products: 'write', inventory: 'write', categories: 'write', suppliers: 'write', customers: 'write', purchaseOrders: 'write', salesOrders: 'write', stockMovements: 'read', reports: 'read' };
const SALES_ONLY = { products: 'read', inventory: 'read', customers: 'write', salesOrders: 'write' };
const READ_ONLY = { products: 'read', inventory: 'read', categories: 'read', suppliers: 'read', customers: 'read', purchaseOrders: 'read', salesOrders: 'read', stockMovements: 'read', reports: 'read' };

async function seedMainAccount() {
  const admin = await call('POST', '/auth/register', { ...ADMIN, ...SECURITY });
  const token = admin.token;
  await call('PUT', '/settings', { phone: '9848000111', currencySymbol: '₹', lowStockAlertEnabled: true }, token);

  for (const [name, description] of Object.entries(CATEGORY_NOTES)) {
    await call('POST', '/categories', { name, description }, token);
  }

  const products = [];
  for (const [hsn, itemName, itemCategory, itemPrice, gst, discount, stock, threshold, mfd, expiry] of PRODUCTS) {
    const created = await call('POST', '/products', {
      hsn, itemName, itemCategory, itemPrice, gst, discount,
      mfd: day(mfd), expiryDate: expiry === null ? '' : day(expiry), stockUpdatedDate: day(-75),
      stockPresent: stock, thresholdStock: threshold,
    }, token);
    products.push({ ...created, category: itemCategory, stock });
  }

  const suppliers = [];
  for (const [name, contactPerson, phone, email, address, taxId, categories] of SUPPLIERS) {
    const supplied = products.filter((product) => categories.includes(product.category));
    const created = await call('POST', '/suppliers', { name, contactPerson, phone, email, address, taxId, productIds: supplied.map((product) => product.id) }, token);
    suppliers.push({ ...created, supplied });
  }

  const customers = [];
  for (const [name, contactPerson, phone, email, address] of CUSTOMERS) {
    customers.push(await call('POST', '/customers', { name, contactPerson, phone, email, address }, token));
  }

  // Team: three employee logins with different permission levels, plus two roster-only entries.
  const employees = [
    { name: 'Kiran Kumar', empId: 'EMP001', role: 'manager', email: 'kiran@stockit.demo', phone: '9848000222', permissions: ALL_WRITE, notes: 'Store manager' },
    { name: 'Divya Sharma', empId: 'EMP002', role: 'staff', email: 'divya@stockit.demo', phone: '9848000333', permissions: SALES_ONLY, notes: 'Billing counter' },
    { name: 'Arjun Reddy', empId: 'EMP003', role: 'staff', email: 'arjun@stockit.demo', phone: '9848000444', permissions: READ_ONLY, notes: 'Accounts, view only' },
  ];
  const employeeTokens = {};
  for (const employee of employees) {
    const member = await call('POST', '/team-members', { ...employee, status: 'active', enableLogin: true }, token);
    const login = await call('POST', '/auth/employee-login', { warehouseId: admin.warehouseId, empId: employee.empId, password: member.tempPassword });
    await call('PUT', '/auth/employee-password', { currentPassword: member.tempPassword, newPassword: EMPLOYEE_PASSWORD }, login.token);
    employeeTokens[employee.empId] = login.token;
  }
  await call('POST', '/team-members', { name: 'Meera Nair', role: 'staff', status: 'active', email: 'meera@stockit.demo', phone: '9848000555', notes: 'Part-time, weekends. No login.' }, token);
  await call('POST', '/team-members', { name: 'Rahul Verma', role: 'staff', status: 'invited', email: 'rahul@stockit.demo', enableLogin: true, empId: 'EMP004', permissions: READ_ONLY, notes: 'Left in October; access disabled.' }, token);

  // Purchase orders: two deliveries from every supplier over the last ten weeks.
  let purchaseCount = 0;
  for (const [index, offset] of [-68, -61, -54, -47, -40, -33, -26, -19, -12, -8, -5, -2].entries()) {
    const supplier = suppliers[index % suppliers.length];
    const lines = supplier.supplied.slice().sort(() => random() - 0.5).slice(0, between(2, 4));
    const items = lines.map((product) => {
      const quantity = between(3, 8) * 10;
      product.stock += quantity;
      return { productId: product.id, quantity, unitCost: Math.round(product.itemPrice * 0.72) };
    });
    purchaseCount += 1;
    // The manager records every third delivery, so the activity log shows employee work too.
    const actor = index % 3 === 2 ? employeeTokens.EMP001 : token;
    await call('POST', '/purchase-orders', { supplierId: supplier.id, orderDate: day(offset), reference: `PO-${String(1000 + purchaseCount)}`, notes: index % 4 === 0 ? 'Delivered in two lots' : '', items }, actor);
  }

  // Sales orders: about one every two days, busier in recent weeks.
  let salesCount = 0;
  for (let offset = -62; offset <= 0; offset += offset > -21 ? 1 : 2) {
    const available = products.filter((product) => product.stock >= 6);
    const lines = available.slice().sort(() => random() - 0.5).slice(0, between(1, 4));
    const items = lines.map((product) => {
      const quantity = Math.min(between(1, 8), product.stock);
      product.stock -= quantity;
      return { productId: product.id, quantity, unitPrice: product.itemPrice };
    });
    salesCount += 1;
    const walkIn = random() < 0.25;
    const actor = salesCount % 3 === 0 ? employeeTokens.EMP002 : token;
    await call('POST', '/sales-orders', { customerId: walkIn ? null : pick(customers).id, orderDate: day(offset), reference: `INV-${String(5000 + salesCount)}`, items }, actor);
  }

  // Manual adjustments so the dashboard shows out-of-stock and low-stock alerts.
  const byName = (name) => products.find((product) => product.itemName === name);
  const adjustments = [
    ['Paneer 200g', 0, 'Expired batch written off'],
    ['Moisturising Lotion 200ml', 0, 'Sold out, awaiting delivery'],
    ['Corn Flakes 475g', 4, 'Damaged cartons removed'],
    ['Filter Coffee Powder 200g', 6, 'Stock count correction'],
    ['Floor Cleaner 1L', 5, 'Leaking bottles discarded'],
    ['Salted Butter 100g', 8, 'Cold storage failure, spoiled units removed'],
    ['AA Batteries (pack of 4)', 9, 'Stock count correction'],
  ];
  for (const [name, stockPresent, reason] of adjustments) {
    await call('PATCH', `/products/${byName(name).id}/stock`, { stockPresent, reason }, employeeTokens.EMP001);
  }

  return { admin, products: products.length, suppliers: suppliers.length, customers: customers.length, purchaseCount, salesCount };
}

// A small second account, to show that each account only ever sees its own data.
async function seedSecondAccount() {
  const second = await call('POST', '/auth/register', { ...SECOND, ...SECURITY });
  const token = second.token;
  const items = [
    ['6109', 'Cotton T-Shirt', 'Apparel', 399, 5, 60, 20],
    ['6203', 'Denim Jeans', 'Apparel', 1299, 12, 35, 10],
    ['6403', 'Running Shoes', 'Footwear', 2199, 18, 18, 6],
    ['4202', 'Laptop Backpack', 'Accessories', 899, 18, 4, 8],
    ['6505', 'Baseball Cap', 'Accessories', 249, 12, 0, 10],
  ];
  const created = [];
  for (const [hsn, itemName, itemCategory, itemPrice, gst, stockPresent, thresholdStock] of items) {
    created.push(await call('POST', '/products', { hsn, itemName, itemCategory, itemPrice, gst, stockPresent, thresholdStock, stockUpdatedDate: day(-10) }, token));
  }
  const customer = await call('POST', '/customers', { name: 'Campus Style Store', phone: '9000111222', address: 'Madhapur, Hyderabad' }, token);
  await call('POST', '/sales-orders', { customerId: customer.id, orderDate: day(-3), reference: 'INV-0001', items: [{ productId: created[0].id, quantity: 6, unitPrice: 399 }, { productId: created[1].id, quantity: 2, unitPrice: 1299 }] }, token);
  return second;
}

// Orders carry their business date, but the ledger and log rows were all written
// "now". Move them back to the day of the order so charts and history look real.
async function backdate(ownerIds) {
  await pool.query(`
    UPDATE inventory_movements m
    SET created_at = o.order_date + TIME '09:30' + (m.id % 480) * INTERVAL '1 minute'
    FROM purchase_orders o
    WHERE m.reference_type = 'purchase_order' AND m.reference_id = o.id AND m.owner_user_id = ANY($1::bigint[])`, [ownerIds]);
  await pool.query(`
    UPDATE inventory_movements m
    SET created_at = LEAST(o.order_date + TIME '10:00' + (m.id % 540) * INTERVAL '1 minute', NOW())
    FROM sales_orders o
    WHERE m.reference_type = 'sales_order' AND m.reference_id = o.id AND m.owner_user_id = ANY($1::bigint[])`, [ownerIds]);
  await pool.query(`UPDATE purchase_orders SET created_at = order_date + TIME '09:30' WHERE owner_user_id = ANY($1::bigint[])`, [ownerIds]);
  await pool.query(`UPDATE sales_orders SET created_at = LEAST(order_date + TIME '10:00', NOW()) WHERE owner_user_id = ANY($1::bigint[])`, [ownerIds]);
  await pool.query(`
    UPDATE activity_logs l
    SET created_at = LEAST(NOW(), NOW() - ((SELECT MAX(id) FROM activity_logs) - l.id) * INTERVAL '11 hours')
    WHERE l.owner_user_id = ANY($1::bigint[])`, [ownerIds]);
}

try {
  const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = ANY($1)', [[ADMIN.email, SECOND.email]]);
  if (existing.rowCount > 0) {
    console.log('Demo accounts already exist in this database - nothing was changed.');
  } else {
    const main = await seedMainAccount();
    const second = await seedSecondAccount();
    await new Promise((resolve) => setTimeout(resolve, 3000)); // let background activity-log writes finish
    await backdate([main.admin.id, second.id]);

    console.log('\nDemo data created:');
    console.log(`  ${main.products} products in ${Object.keys(CATEGORY_NOTES).length} categories, ${main.suppliers} suppliers, ${main.customers} customers`);
    console.log(`  ${main.purchaseCount} purchase orders, ${main.salesCount} sales orders, 5 team members (3 with logins)`);
    console.log(`\nWarehouse ID for employee sign-in: ${main.admin.warehouseId}`);
    console.log('Sign-in details are listed at the top of server/db/seed.js');
  }
} catch (error) {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
} finally {
  server.close();
  await pool.end();
}
