import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import {
  By, buildDriver, openFresh, waitForText, find, field, type, click, button, placeholder,
  signIn, signOut, createAccount, screenshot,
} from '../helpers/driver.js';

describe('Selenium: sign-up, sign-in and password recovery', () => {
  let driver;
  const email = `ui.${Date.now()}@stockit.test`;
  const password = 'Stock@1234';

  beforeAll(async () => { driver = await buildDriver(); });
  afterAll(async () => { await driver?.quit(); });

  test('ST-01 the app opens on the sign-in page', async () => {
    await openFresh(driver);
    await waitForText(driver, 'Good to see you again.');
    expect(await driver.getTitle()).toMatch(/StockIt/i);
    await screenshot(driver, 'ST-01-login-page');
  });

  test('ST-02 a weak password keeps the "Create workspace" button disabled', async () => {
    await click(driver, button('Create account'));
    await waitForText(driver, 'Set up your workspace.');
    await type(driver, placeholder('Your full name'), 'Asha Rao');
    await type(driver, placeholder('you@company.com'), email);
    await type(driver, placeholder('Create a password'), 'weakpass');
    await type(driver, placeholder('Repeat your password'), 'weakpass');

    const submit = await find(driver, button('Create workspace'));
    expect(await submit.isEnabled()).toBe(false);

    const failedRules = await driver.findElements(By.css('.password-rules .is-invalid'));
    expect(failedRules.length).toBe(3); // capital letter, number, special character
    await screenshot(driver, 'ST-02-weak-password');
  });

  test('ST-03 a mismatched confirmation shows "Passwords do not match"', async () => {
    await type(driver, placeholder('Create a password'), password);
    await type(driver, placeholder('Repeat your password'), 'Stock@9999');
    await waitForText(driver, 'Passwords do not match');
    expect(await (await find(driver, button('Create workspace'))).isEnabled()).toBe(false);
  });

  test('ST-04 a valid registration opens the dashboard', async () => {
    await type(driver, placeholder('Repeat your password'), password);
    await waitForText(driver, 'Passwords match');
    await type(driver, placeholder('Your answer'), 'Hyderabad');
    await click(driver, By.css('label.terms input[type="checkbox"]'));
    await click(driver, button('Create workspace'));

    await find(driver, By.css('nav[aria-label="Main navigation"]'));
    await waitForText(driver, 'Asha Rao');
    await screenshot(driver, 'ST-04-dashboard-after-register');
  });

  test('ST-05 the session survives a page refresh', async () => {
    await driver.navigate().refresh();
    await find(driver, By.css('nav[aria-label="Main navigation"]'));
  });

  test('ST-06 logging out returns to the sign-in page', async () => {
    await signOut(driver);
    await waitForText(driver, 'Good to see you again.');
    expect(await driver.executeScript('return window.localStorage.getItem("stockit_token");')).toBeNull();
  });

  test('ST-07 a wrong password shows an error and stays on the sign-in page', async () => {
    await signIn(driver, email, 'Wrong@1234');
    await waitForText(driver, 'Invalid email or password');
    await screenshot(driver, 'ST-07-invalid-login');
  });

  test('ST-08 the correct password signs the user in', async () => {
    await signIn(driver, email, password);
    await find(driver, By.css('nav[aria-label="Main navigation"]'));
    await signOut(driver);
  });

  test('ST-09 registering an email that already exists shows an error', async () => {
    await click(driver, button('Create account'));
    await type(driver, placeholder('Your full name'), 'Someone Else');
    await type(driver, placeholder('you@company.com'), email);
    await type(driver, placeholder('Create a password'), password);
    await type(driver, placeholder('Repeat your password'), password);
    await type(driver, placeholder('Your answer'), 'Chennai');
    await click(driver, By.css('label.terms input[type="checkbox"]'));
    await click(driver, button('Create workspace'));
    await waitForText(driver, 'Email is already registered');
  });

  test('ST-10 a forgotten password can be reset with the security question', async () => {
    const account = await createAccount();
    await openFresh(driver);
    await click(driver, button('Forgot password?'));
    await type(driver, placeholder('you@company.com'), account.email);
    await click(driver, button('Continue'));

    await waitForText(driver, account.securityQuestion);
    await type(driver, placeholder('Your answer'), 'wrong answer');
    await type(driver, placeholder('Create a new password'), 'Fresh@12345');
    await type(driver, placeholder('Repeat your new password'), 'Fresh@12345');
    await click(driver, button('Reset password'));
    await waitForText(driver, 'Security answer is incorrect');

    await type(driver, placeholder('Your answer'), 'HYDERABAD');
    await click(driver, button('Reset password'));
    await waitForText(driver, 'You can now sign in with your new password.');
    await screenshot(driver, 'ST-10-password-reset');

    await click(driver, button('Sign in'));
    await signIn(driver, account.email, 'Fresh@12345');
    await find(driver, By.css('nav[aria-label="Main navigation"]'));
  });
});
