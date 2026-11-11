import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import {
  By, buildDriver, openFresh, waitForText, textIsAbsent, find, field, type, click, choose, textOf, button, placeholder,
  openModule, signIn, createAccount, screenshot,
} from '../helpers/driver.js';

// Reads the "Current stock" cell for a product on the Inventory page.
async function currentStock(driver, productName) {
  return Number(await textOf(driver, By.xpath(`//table[contains(@class,"inventory-table")]//tr[td/strong[normalize-space()="${productName}"]]/td[3]/strong`)));
}

describe('Selenium: product, inventory and sales workflow', () => {
  let driver;

  beforeAll(async () => {
    const account = await createAccount({ fullName: 'Store Owner' });
    driver = await buildDriver();
    await openFresh(driver);
    await signIn(driver, account.email, account.password);
    await find(driver, By.css('nav[aria-label="Main navigation"]'));
  });
  afterAll(async () => { await driver?.quit(); });

  test('ST-11 a new account starts with an empty product list', async () => {
    await openModule(driver, 'Products');
    await waitForText(driver, 'No products yet. Add your first inventory item.');
  });

  test('ST-12 adding a product shows it in the products table', async () => {
    await openModule(driver, 'Add Product');
    await waitForText(driver, 'Product details');
    const form = '(//form[contains(@class,"product-form")])[1]';
    await type(driver, await field(driver, 'HSN', form), '1905');
    await type(driver, await field(driver, 'Item name', form), 'Marie Biscuits');
    await type(driver, await field(driver, 'Item price', form), '25');
    await type(driver, await field(driver, 'Item category', form), 'Grocery');
    await type(driver, await field(driver, 'GST%', form), '5');
    await type(driver, await field(driver, 'Stock present now', form), '40');
    await type(driver, await field(driver, 'Threshold stock', form), '10');
    await click(driver, By.css('button.product-submit'));

    await waitForText(driver, 'View products');
    const rowText = await textOf(driver, By.xpath('//table[contains(@class,"product-table")]//tr[td/strong[normalize-space()="Marie Biscuits"]]'));
    expect(rowText).toContain('1905');
    expect(rowText).toContain('Grocery');
    await screenshot(driver, 'ST-12-product-added');
  });

  test('ST-13 a duplicate HSN is rejected with a clear message', async () => {
    await openModule(driver, 'Add Product');
    const form = '(//form[contains(@class,"product-form")])[1]';
    await type(driver, await field(driver, 'HSN', form), '1905');
    await type(driver, await field(driver, 'Item name', form), 'Copycat');
    await type(driver, await field(driver, 'Item price', form), '10');
    await click(driver, By.css('button.product-submit'));
    await waitForText(driver, 'A product with this HSN already exists');
    await screenshot(driver, 'ST-13-duplicate-hsn');
  });

  test('ST-14 the product search filters the table', async () => {
    await openModule(driver, 'Products');
    await type(driver, placeholder('Search products'), 'zzz');
    await driver.wait(async () => textIsAbsent(driver, 'Marie Biscuits'), 5000, 'Row should be filtered out');
    await type(driver, placeholder('Search products'), 'marie');
    await waitForText(driver, 'Marie Biscuits');
  });

  test('ST-15 the category typed on the product form now exists under Categories', async () => {
    await openModule(driver, 'Categories');
    await find(driver, By.xpath('//table//td[contains(normalize-space(.), "Grocery")]'));
  });

  test('ST-16 adding stock on the Inventory page updates the current stock', async () => {
    await openModule(driver, 'Inventory');
    expect(await currentStock(driver, 'Marie Biscuits')).toBe(40);

    await click(driver, By.css('button[aria-label="Add stock to Marie Biscuits"]'));
    await type(driver, placeholder('Enter quantity'), '15');
    await type(driver, placeholder('e.g. New delivery, damaged item'), 'New delivery');
    await click(driver, button('Confirm adjustment'));

    await driver.wait(async () => (await currentStock(driver, 'Marie Biscuits')) === 55, 5000, 'Stock should become 55');
    await screenshot(driver, 'ST-16-stock-adjusted');
  });

  test('ST-17 recording a sale removes the sold quantity from stock', async () => {
    await openModule(driver, 'Sales');
    await waitForText(driver, 'Create sales order');
    await choose(driver, await field(driver, 'Product'), 'Marie Biscuits');
    await type(driver, await field(driver, 'Quantity'), '5');
    await type(driver, await field(driver, 'Unit price'), '30');
    await type(driver, placeholder('e.g. Invoice number'), 'INV-001');
    await click(driver, button('Save sales order'));

    await waitForText(driver, 'Sales order recorded and stock updated');
    await screenshot(driver, 'ST-17-sale-recorded');

    await openModule(driver, 'Inventory');
    await driver.wait(async () => (await currentStock(driver, 'Marie Biscuits')) === 50, 5000, 'Stock should become 50');
  });

  test('ST-18 selling more than is in stock is refused', async () => {
    await openModule(driver, 'Sales');
    await waitForText(driver, 'Create sales order');
    await choose(driver, await field(driver, 'Product'), 'Marie Biscuits');
    await type(driver, await field(driver, 'Quantity'), '500');
    await type(driver, await field(driver, 'Unit price'), '30');
    await click(driver, button('Save sales order'));

    await waitForText(driver, 'Not enough stock for Marie Biscuits: 50 available, 500 requested');
    await screenshot(driver, 'ST-18-oversell-blocked');
  });

  test('ST-19 the stock movements ledger lists the adjustment and the sale', async () => {
    await openModule(driver, 'Stock Movements');
    await waitForText(driver, 'Stock movements');
    const rows = await driver.wait(async () => {
      const found = await driver.findElements(By.xpath('//table//tbody/tr[td[contains(normalize-space(.), "Marie Biscuits")]]'));
      return found.length >= 2 ? found : null;
    }, 5000, 'Expected two ledger rows for Marie Biscuits');
    const ledgerText = (await Promise.all(rows.map((row) => row.getText()))).join('\n');
    expect(ledgerText).toMatch(/\+\s?15/);
    expect(ledgerText).toMatch(/[-−]\s?5/);
    await screenshot(driver, 'ST-19-stock-movements');
  });

  test('ST-20 the dashboard summary reflects the catalogue', async () => {
    await openModule(driver, 'Dashboard');
    await waitForText(driver, 'Stock units');
    await screenshot(driver, 'ST-20-dashboard');
  });
});
