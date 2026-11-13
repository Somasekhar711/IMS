// Shared Selenium WebDriver helpers. Selenium Manager (built into selenium-webdriver)
// downloads the matching browser driver automatically, so nothing is installed by hand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Select, until } from 'selenium-webdriver';
import edge from 'selenium-webdriver/edge.js';
import chrome from 'selenium-webdriver/chrome.js';
import { API_URL, APP_URL } from './stack.js';

export { By, until, API_URL, APP_URL };

const here = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.resolve(here, '../screenshots');
const WAIT_MS = 10000;

// HEADED=1 shows the browser window and slows each step down so the run can be watched.
const HEADED = process.env.HEADED === '1';
const STEP_DELAY_MS = HEADED ? Number(process.env.SLOWMO || 350) : 0;
const pause = () => (STEP_DELAY_MS ? new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS)) : null);

// fakeCamera: path to a .y4m video the browser should use as its camera.
export async function buildDriver({ fakeCamera } = {}) {
  const browser = (process.env.BROWSER || 'edge').toLowerCase();
  const args = ['--window-size=1400,1000', '--disable-gpu'];
  if (!HEADED) args.push('--headless=new');
  if (fakeCamera) args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${fakeCamera}`);

  if (browser === 'chrome') {
    return new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options().addArguments(...args)).build();
  }
  return new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(new edge.Options().addArguments(...args)).build();
}

// Opens the app with a clean browser session (signed out).
export async function openFresh(driver) {
  await driver.get(APP_URL);
  await driver.executeScript('window.localStorage.clear();');
  await driver.get(APP_URL);
}

const quote = (text) => (text.includes('"') ? `'${text}'` : `"${text}"`);

// Matches any element that directly contains the text (in any of its text nodes).
const textLocator = (text) => By.xpath(`//*[not(self::script) and not(self::option)][text()[contains(normalize-space(.), ${quote(text)})]]`);

// Waits until some visible element contains the text, and returns it.
export function waitForText(driver, text, timeout = WAIT_MS) {
  return retryStale(async () => {
    const element = await driver.wait(until.elementLocated(textLocator(text)), timeout, `Expected to see text: ${text}`);
    await driver.wait(until.elementIsVisible(element), timeout, `Text is present but hidden: ${text}`);
    return element;
  });
}

export async function textIsAbsent(driver, text) {
  const matches = await driver.findElements(textLocator(text));
  return matches.length === 0;
}

// React re-renders can replace an element between locating it and using it
// (a "stale element"). Any step wrapped in this simply locates it again.
async function retryStale(action) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      if (error.name !== 'StaleElementReferenceError' || attempt >= 4) throw error;
    }
  }
}

export function find(driver, locator, timeout = WAIT_MS) {
  return retryStale(async () => {
    const element = await driver.wait(until.elementLocated(locator), timeout, `Element not found: ${locator}`);
    await driver.wait(until.elementIsVisible(element), timeout);
    return element;
  });
}

// Finds the input/select that sits inside a <label> whose caption is `label`.
export function field(driver, label, scope = '') {
  return find(driver, By.xpath(`${scope}//label[span[normalize-space()=${quote(label)}]]//*[self::input or self::select]`));
}

export async function type(driver, elementOrLocator, value) {
  await retryStale(async () => {
    const element = elementOrLocator.sendKeys ? elementOrLocator : await find(driver, elementOrLocator);
    await element.clear();
    await element.sendKeys(String(value));
  });
  await pause();
}

export async function click(driver, locator) {
  await retryStale(async () => {
    const element = await find(driver, locator);
    await driver.wait(until.elementIsEnabled(element), WAIT_MS);
    await driver.executeScript('arguments[0].scrollIntoView({ block: "center" });', element);
    await element.click();
  });
  await pause();
}

// Reads an element's text, retrying if React re-renders it mid-read (stale element).
export function textOf(driver, locator) {
  return retryStale(async () => (await find(driver, locator)).getText());
}

// Picks the <option> whose label contains `text` in the given <select>.
export async function choose(driver, selectElement, text) {
  const option = await selectElement.findElement(By.xpath(`.//option[contains(., ${quote(text)})]`));
  await new Select(selectElement).selectByValue(await option.getAttribute('value'));
  await pause();
}

export const button = (label) => By.xpath(`//button[contains(normalize-space(.), ${quote(label)})]`);
export const placeholder = (text) => By.css(`[placeholder="${text}"]`);

// Opens a module from the dashboard sidebar.
export async function openModule(driver, label) {
  await click(driver, By.xpath(`//nav[@aria-label="Main navigation"]//button[span[normalize-space()=${quote(label)}]]`));
}

// Signs in through the login form.
export async function signIn(driver, email, password) {
  await type(driver, placeholder('you@company.com'), email);
  await type(driver, By.css('input[autocomplete="current-password"]'), password);
  await click(driver, button('Enter workspace'));
}

export async function signOut(driver) {
  await click(driver, By.css('button.header-user'));
  await click(driver, button('Logout'));
}

// Creates an admin account directly through the API (test set-up, not the behaviour under test).
let accountCounter = 0;
export async function createAccount(overrides = {}) {
  accountCounter += 1;
  const account = {
    fullName: 'Selenium Tester',
    email: `selenium.${Date.now()}.${accountCounter}@stockit.test`,
    password: 'Stock@1234',
    securityQuestion: 'What city were you born in?',
    securityAnswer: 'Hyderabad',
    ...overrides,
  };
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!response.ok) throw new Error(`Could not create test account: ${response.status}`);
  return { ...account, ...(await response.json()) };
}

// Calls the API directly for test set-up (not the behaviour under test).
export async function apiCall(method, path, body, token) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${data.message || ''}`);
  return data;
}

// Saves a PNG of the current page as evidence for the test report.
export async function screenshot(driver, name) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  fs.writeFileSync(path.join(SCREENSHOT_DIR, `${name}.png`), await driver.takeScreenshot(), 'base64');
}
