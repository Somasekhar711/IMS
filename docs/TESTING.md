# StockIt — Software Testing Report

This document is the test plan, test-case catalogue and test report for StockIt, the inventory management system in this repository (React client, Express API, PostgreSQL).

**Summary:** 166 automated tests across four levels, all passing. Testing found five defects in the server, all fixed and re-tested.

| Level | Tool | Test cases | Test runs | Result |
|---|---|---|---|---|
| Unit | Jest | 27 | 27 | All pass |
| Integration (API) | Jest + Supertest | 91 | 108 | All pass |
| System (browser) | Selenium WebDriver | 22 | 22 | All pass |
| Black-box API | JUnit 5 | 9 | 9 | All pass |
| **Total** | | **149** | **166** | **All pass** |

A test case that is run with several inputs (for example IT-31, five kinds of invalid product data) counts as one case and several runs.

## 1. Objectives and scope

The tests check that StockIt:

- accepts valid input and rejects invalid input with a clear message
- keeps stock correct through purchases, sales, adjustments and deletions
- never lets one account read or change another account's data
- enforces employee permissions (none / read / write per module) on the server
- works end to end for a real user in a real browser

In scope: the whole Express API (`server/`), and the main user journeys of the React client (`client/`).

Not covered by automated tests: React components in isolation, performance and load, and browsers other than Microsoft Edge (the Selenium suite can also run on Chrome with `BROWSER=chrome`).

## 2. Test levels

| Level | Type | What is tested | How |
|---|---|---|---|
| Unit | White-box | One function at a time: password policy, permission normalisation, temporary-password generator, security-answer normalisation, auth and role middleware | Jest calls the function directly; middleware gets mock `req` / `res` objects |
| Integration | Grey-box | Every API route together with the real database | Supertest sends HTTP requests into the Express app; data lands in a real PostgreSQL |
| System | Black-box | Complete user journeys through the user interface | Selenium WebDriver drives Microsoft Edge against the running client and API |
| Black-box API | Black-box | The running system from an independent client | JUnit 5 tests written in Java speak HTTP to the API |

## 3. Tools

| Tool | Version | Purpose |
|---|---|---|
| Jest | 29 | Test runner and assertion library for the server. It is to JavaScript what JUnit is to Java: `describe` = test class, `test` = test method, `expect` = assertion, `beforeAll` / `afterAll` = set-up and tear-down |
| Supertest | 7 | Sends HTTP requests to the Express app inside the test process |
| Selenium WebDriver | 4 | Browser automation. Selenium Manager (built in) downloads the matching Edge driver automatically |
| JUnit 5 | 5.10 (console launcher 1.10.2) | Java test framework for the black-box API tests |
| embedded-postgres | 18 | Starts a throwaway PostgreSQL server for each run, so the tests need no installed database, account or password |
| Jest coverage (Istanbul) | built in | Line, branch and function coverage of the server code |

## 4. Test environment

- Windows 11, Node.js 24, Java 21 (OpenJDK), Microsoft Edge 157
- Each run starts a new, empty PostgreSQL on port 54329 and applies all 19 migrations from `server/db/`
- Selenium and JUnit runs also start the API on port 3100 and the client on port 5174, so they never touch a development server or its data
- Every test registers its own fresh account, so tests do not depend on each other's data

## 5. How to run

Install once:

```bash
cd server && npm install
cd ../client && npm install
cd ../e2e && npm install
```

| Folder | Command | What it runs |
|---|---|---|
| `server` | `npm test` | All 135 Jest tests (unit + integration) |
| `server` | `npm run test:unit` | Unit tests only |
| `server` | `npm run test:api` | Integration tests only |
| `server` | `npm run test:coverage` | All Jest tests plus a coverage report (`server/tests/coverage/index.html`) |
| `e2e` | `npm test` | 22 Selenium tests, browser hidden (headless) |
| `e2e` | `npm run test:headed` | The same tests with the browser window visible and slowed down, for a demo |
| `e2e` | `npm run test:junit` | Compiles and runs the 9 JUnit 5 tests |
| `e2e` | `npm run stack` | Starts the whole app on an empty database at http://localhost:5174 for manual testing |

Notes:

- The first Selenium run needs an internet connection once, to download the Edge driver. The first JUnit run downloads one jar from Maven Central.
- Selenium saves a screenshot of each key step to `e2e/screenshots/`.

## 6. Test design techniques

| Technique | Where it is used |
|---|---|
| Equivalence partitioning | Login: valid credentials, wrong password, unknown email, missing field (IT-13 to IT-17) |
| Boundary value analysis | Password length 7 vs 8 (UT-23, IT-07, IT-08); selling 7 of 6 vs 6 of 6 (IT-59, IT-61); stock set to 0 (IT-41) |
| Negative testing | Negative price, GST above 100%, expiry before manufacture (IT-31); malformed JSON (IT-03); invalid order lines (IT-55) |
| Security testing | Missing and tampered tokens (IT-19, IT-20, UT-14 to UT-17); SQL-injection input (IT-18); cross-account access (IT-42, IT-43, IT-56); password hashes never returned (IT-05, IT-72) |
| State-based testing | Purchase, then sale, then delete, with stock checked after each step (IT-53, IT-57, IT-65, IT-66) |
| Transaction testing | A failing line rolls back the whole order (IT-62) |
| Role-based testing | The same request as admin and as an employee with none / read / write permission (IT-75 to IT-83); Manager and Employee sign-in tabs (IT-85 to IT-89, ST-22) |
| Regression testing | The whole suite is re-run after every fix |

## 7. Detailed sample test cases

| ID | Objective | Preconditions | Steps | Test data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|---|
| IT-15 | Wrong password is rejected | A registered account | POST `/api/auth/login` | Correct email, password `Wrong@1234` | 401, message "Invalid email or password" | As expected | Pass |
| IT-24 | Password reset by security question | A registered account with answer "Hyderabad" | POST `/api/auth/reset-password`, then log in with the old and the new password | Answer `"  HYDERABAD "`, new password `NewPass@123` | Reset succeeds (answer is not case-sensitive); old password gives 401; new password gives 200 | As expected | Pass |
| IT-31 | Invalid product data is rejected cleanly | Signed-in admin | POST `/api/products` | Price `-5` | 400 with a reason, not 500 | As expected (after fix D1) | Pass |
| IT-43 | Accounts are isolated | Accounts A and B; A owns a product | As B: PUT and DELETE A's product | A's product id | 404 for both; the product still exists for A | As expected | Pass |
| IT-59 | Overselling is refused | Product with 6 in stock | POST `/api/sales-orders` | Quantity 7 | 400, "Not enough stock for Notebook: 6 available, 7 requested"; stock stays 6 | As expected | Pass |
| IT-62 | Orders are atomic | Product X with 3 in stock, product Y with 0 | POST a sales order with a valid line for X and an invalid line for Y | X × 2, Y × 1 | 400; X still has 3 (nothing was saved) | As expected | Pass |
| IT-66 | Sold stock cannot be "un-received" | Purchase of 10, then sale of 8 | DELETE the purchase order | — | 409; stock stays 2 | As expected | Pass |
| IT-76 | Read-only employee cannot write | Employee with `products: read` | As the employee: POST `/api/products` | Any valid product | 403 | As expected | Pass |
| IT-83 | Disabled employee is locked out | Employee holding a valid token | Admin sets status to "invited"; employee calls GET `/api/products` and tries to log in | — | 403 for both, although the token has not expired | As expected | Pass |
| ST-04 | Registration through the UI | App open on the sign-in page | Open "Create account", fill the form, tick the terms box, submit | Name, email, `Stock@1234`, answer "Hyderabad" | Dashboard opens and shows the user's name | As expected | Pass |
| ST-10 | Password reset through the UI | A registered account | "Forgot password?", enter email, answer wrongly, then correctly, sign in | Wrong answer, then `HYDERABAD`, new password `Fresh@12345` | Error for the wrong answer; success message; sign-in works with the new password | As expected | Pass |
| ST-17 | Sale through the UI | Product "Marie Biscuits" with 55 in stock | Open Sales, pick the product, enter quantity and price, save, open Inventory | Quantity 5, price 30 | Success message; Inventory shows 50 | As expected | Pass |
| ST-18 | Overselling through the UI | "Marie Biscuits" with 50 in stock | Open Sales, pick the product, enter quantity 500, save | Quantity 500 | Error "Not enough stock for Marie Biscuits: 50 available, 500 requested" | As expected | Pass |
| JU-08 | Stock rule from an outside client | Product with 10 in stock | POST a sale of 4, then a sale of 7, then GET products | — | 201, then 400 "6 available, 7 requested"; stock is 6 | As expected | Pass |

## 8. Results

### Execution summary

| Suite | Runs | Passed | Failed | Time |
|---|---|---|---|---|
| Jest (unit + integration) | 135 | 135 | 0 | about 12 s |
| Selenium WebDriver | 22 | 22 | 0 | about 26 s |
| JUnit 5 | 9 | 9 | 0 | about 1 s (plus start-up) |

### Coverage of the server code (Jest)

| Metric | Coverage |
|---|---|
| Statements | 68.99% |
| Branches | 67.46% |
| Functions | 85.98% |
| Lines | 70.08% |

Middleware and config are above 93%. The lowest files are `routes/suppliers.js` (43% of lines) and `routes/customers.js` (46%), because their update and delete routes have few tests; most other uncovered lines are `catch` blocks for database failures.

### Defects found and fixed

The first full run had 14 failing test runs. They traced to five defects:

| No. | Defect | Found by | Severity | Behaviour before | Fix |
|---|---|---|---|---|---|
| D1 | Invalid product values (negative price or stock, GST or discount above 100%, expiry before manufacture date) reached the database and failed its CHECK constraints | IT-31 | Medium | 500 "Server error" | `productProblem()` in `server/routes/products.js` validates first and answers 400 with the reason |
| D2 | A non-numeric id in the URL (for example `DELETE /api/products/abc`) failed PostgreSQL's bigint cast | IT-36 | Low | 500 "Server error" | `server/middleware/validateId.js`, attached to all seven routers with `:id` routes, answers 404 |
| D3 | A malformed JSON body fell through to Express's default error page | IT-03 | Medium | HTML page containing a stack trace and server file paths | Error handler in `server/app.js` answers a short JSON 400 |
| D4 | Password strength rules (capital letter, number, special character) existed only in the browser | IT-09 | High | The API accepted `password` as a password | `server/config/passwordPolicy.js`, used for registration, reset and both password-change routes |
| D5 | Emails were compared case-sensitively | IT-12, IT-14 | Medium | `A@x.com` and `a@x.com` could both register; login failed if the case differed | Emails are stored in lower case and compared with `LOWER(email)` |

After the fixes the full suite was re-run and passed. The suite has since grown to 166 tests (role-specific sign-in tabs and report stock lists), all passing.

## 9. Test-case catalogue

Every automated test carries its ID in its name, so this list, the test code and the test output match one to one.

### Unit tests (Jest)

| ID | Area | Test case (expected behaviour) | File | Result |
|---|---|---|---|---|
| UT-01 | security answer normalisation | Trims surrounding whitespace | `securityQuestions.test.js` | Pass |
| UT-02 | security answer normalisation | Lowercases so answers are not case-sensitive | `securityQuestions.test.js` | Pass |
| UT-03 | security answer normalisation | Treats null / undefined as an empty answer | `securityQuestions.test.js` | Pass |
| UT-04 | security answer normalisation | Converts non-string input to a string | `securityQuestions.test.js` | Pass |
| UT-05 | security answer normalisation | Offers a fixed, non-empty, duplicate-free question list | `securityQuestions.test.js` | Pass |
| UT-06 | employee permission normalisation | Keeps valid levels | `permissionModules.test.js` | Pass |
| UT-07 | employee permission normalisation | Defaults every missing module to "none" (least privilege) | `permissionModules.test.js` | Pass |
| UT-08 | employee permission normalisation | Rejects unknown levels such as "admin" | `permissionModules.test.js` | Pass |
| UT-09 | employee permission normalisation | Drops modules that do not exist | `permissionModules.test.js` | Pass |
| UT-10 | employee permission normalisation | Copes with null / undefined input | `permissionModules.test.js` | Pass |
| UT-11 | temporary password generator | Produces a 10-character password | `permissionModules.test.js` | Pass |
| UT-12 | temporary password generator | Avoids look-alike characters (0, O, 1, l, I) | `permissionModules.test.js` | Pass |
| UT-13 | temporary password generator | Does not repeat across 500 generations | `permissionModules.test.js` | Pass |
| UT-14 | authRequired middleware | Rejects a request with no Authorization header | `middleware.test.js` | Pass |
| UT-15 | authRequired middleware | Rejects a header that is not a Bearer token | `middleware.test.js` | Pass |
| UT-16 | authRequired middleware | Rejects a token signed with the wrong secret | `middleware.test.js` | Pass |
| UT-17 | authRequired middleware | Rejects an expired token | `middleware.test.js` | Pass |
| UT-18 | authRequired middleware | Accepts a valid token and attaches the decoded user | `middleware.test.js` | Pass |
| UT-19 | role middleware | RequireAdmin lets an admin through | `middleware.test.js` | Pass |
| UT-20 | role middleware | RequireAdmin blocks an employee with 403 | `middleware.test.js` | Pass |
| UT-21 | role middleware | RequirePermission never restricts the admin (no database lookup) | `middleware.test.js` | Pass |
| UT-22 | password policy | Accepts a password that meets all four rules | `passwordPolicy.test.js` | Pass |
| UT-23 | password policy | Boundary: 7 characters is rejected, 8 is accepted | `passwordPolicy.test.js` | Pass |
| UT-24 | password policy | Requires a capital letter | `passwordPolicy.test.js` | Pass |
| UT-25 | password policy | Requires a number | `passwordPolicy.test.js` | Pass |
| UT-26 | password policy | Requires a special character | `passwordPolicy.test.js` | Pass |
| UT-27 | password policy | Rejects values that are not strings | `passwordPolicy.test.js` | Pass |

### API integration tests (Jest + Supertest)

| ID | Area | Test case (expected behaviour) | File | Result |
|---|---|---|---|---|
| IT-01 | server basics | Health check responds with status ok | `auth.test.js` | Pass |
| IT-02 | server basics | Unknown route returns a JSON 404 | `auth.test.js` | Pass |
| IT-03 | server basics | Malformed JSON body returns a clean 400 (no stack trace) | `auth.test.js` | Pass |
| IT-04 | registration | Registers a new admin and returns a token + warehouse ID | `auth.test.js` | Pass |
| IT-05 | registration | Never returns the password or its hash | `auth.test.js` | Pass |
| IT-06 | registration | Rejects registration when each required field is missing | `auth.test.js` | Pass |
| IT-07 | registration | Rejects a password shorter than 8 characters (boundary: 7) | `auth.test.js` | Pass |
| IT-08 | registration | Accepts a password of exactly 8 characters (boundary: 8) | `auth.test.js` | Pass |
| IT-09 | registration | Rejects a weak password on the server too (several inputs) | `auth.test.js` | Pass |
| IT-10 | registration | Rejects a security question that is not on the list | `auth.test.js` | Pass |
| IT-11 | registration | Rejects a duplicate email with 409 | `auth.test.js` | Pass |
| IT-12 | registration | Treats emails as case-insensitive when checking duplicates | `auth.test.js` | Pass |
| IT-13 | login | Logs in with correct credentials | `auth.test.js` | Pass |
| IT-14 | login | Login works regardless of email letter case | `auth.test.js` | Pass |
| IT-15 | login | Rejects a wrong password with 401 | `auth.test.js` | Pass |
| IT-16 | login | Rejects an unknown email with the same message (no account enumeration) | `auth.test.js` | Pass |
| IT-17 | login | Rejects a login with missing fields | `auth.test.js` | Pass |
| IT-18 | login | SQL-injection style input does not bypass login | `auth.test.js` | Pass |
| IT-19 | protected routes | Rejects a request with no token | `auth.test.js` | Pass |
| IT-20 | protected routes | Rejects a tampered token | `auth.test.js` | Pass |
| IT-21 | password recovery by security question | Returns the account security question for a known email | `auth.test.js` | Pass |
| IT-22 | password recovery by security question | Returns 404 for an unknown email | `auth.test.js` | Pass |
| IT-23 | password recovery by security question | Rejects a reset with the wrong answer | `auth.test.js` | Pass |
| IT-24 | password recovery by security question | Resets the password when the answer matches (case-insensitive) and the old password stops working | `auth.test.js` | Pass |
| IT-25 | account settings | Updates the profile name | `auth.test.js` | Pass |
| IT-26 | account settings | Refuses a password change when the current password is wrong | `auth.test.js` | Pass |
| IT-27 | account settings | Saves preferences and falls back to the default currency symbol | `auth.test.js` | Pass |
| IT-28 | products | Creates a product and returns it | `products.test.js` | Pass |
| IT-29 | products | Rejects a product without each required field | `products.test.js` | Pass |
| IT-30 | products | Rejects a duplicate HSN within the same account | `products.test.js` | Pass |
| IT-31 | products | Rejects invalid product data with 400, not a server error (several inputs) | `products.test.js` | Pass |
| IT-32 | products | Keeps DATE fields as plain YYYY-MM-DD (no timezone shift) | `products.test.js` | Pass |
| IT-33 | products | Searches by name, HSN, and category (case-insensitive) | `products.test.js` | Pass |
| IT-34 | products | Updates price and stock of an existing product | `products.test.js` | Pass |
| IT-35 | products | Returns 404 when updating a product that does not exist | `products.test.js` | Pass |
| IT-36 | products | Returns 404 (not a server error) for a non-numeric product id | `products.test.js` | Pass |
| IT-37 | products | Deletes a product, and a second delete returns 404 | `products.test.js` | Pass |
| IT-38 | stock adjustments | Adjusting stock updates the product and writes a ledger entry | `products.test.js` | Pass |
| IT-39 | stock adjustments | An adjustment that changes nothing writes no ledger entry | `products.test.js` | Pass |
| IT-40 | stock adjustments | Rejects an invalid stock value (several inputs) | `products.test.js` | Pass |
| IT-41 | stock adjustments | Stock can be set to exactly zero (boundary) | `products.test.js` | Pass |
| IT-42 | data isolation between accounts | One account cannot see another account's products | `products.test.js` | Pass |
| IT-43 | data isolation between accounts | One account cannot update or delete another account's product | `products.test.js` | Pass |
| IT-44 | data isolation between accounts | Two accounts may reuse the same HSN | `products.test.js` | Pass |
| IT-45 | categories | Creates a category | `products.test.js` | Pass |
| IT-46 | categories | Rejects a blank category name | `products.test.js` | Pass |
| IT-47 | categories | Rejects a duplicate name ignoring letter case | `products.test.js` | Pass |
| IT-48 | categories | Adding a product with a new category creates that category automatically | `products.test.js` | Pass |
| IT-49 | categories | Refuses to delete a category that still has products | `products.test.js` | Pass |
| IT-50 | categories | Deletes an empty category | `products.test.js` | Pass |
| IT-51 | purchase orders (stock in) | Creates a supplier linked to a product | `orders.test.js` | Pass |
| IT-52 | purchase orders (stock in) | Rejects a duplicate supplier name | `orders.test.js` | Pass |
| IT-53 | purchase orders (stock in) | A purchase order adds its quantity to stock and totals the lines | `orders.test.js` | Pass |
| IT-54 | purchase orders (stock in) | The purchase is recorded in the stock movement ledger | `orders.test.js` | Pass |
| IT-55 | purchase orders (stock in) | Rejects an invalid purchase order (several inputs) | `orders.test.js` | Pass |
| IT-56 | purchase orders (stock in) | Rejects a purchase order for another account's product | `orders.test.js` | Pass |
| IT-57 | purchase orders (stock in) | Deleting a purchase order reverses its stock | `orders.test.js` | Pass |
| IT-58 | sales orders (stock out) | A sales order removes its quantity from stock | `orders.test.js` | Pass |
| IT-59 | sales orders (stock out) | Overselling is rejected and stock is left untouched (boundary: 7 requested, 6 available) | `orders.test.js` | Pass |
| IT-60 | sales orders (stock out) | Two lines for the same product are added up before the stock check | `orders.test.js` | Pass |
| IT-61 | sales orders (stock out) | Selling exactly the remaining stock is allowed (boundary: 6 of 6) | `orders.test.js` | Pass |
| IT-62 | sales orders (stock out) | A failed order is rolled back completely (atomic transaction) | `orders.test.js` | Pass |
| IT-63 | sales orders (stock out) | Deleting a sales order returns its stock | `orders.test.js` | Pass |
| IT-64 | sales orders (stock out) | A customer with orders cannot be deleted | `orders.test.js` | Pass |
| IT-65 | purchase then sale (end-to-end stock flow) | Stock received by purchase can then be sold | `orders.test.js` | Pass |
| IT-66 | purchase then sale (end-to-end stock flow) | A purchase order cannot be deleted once its stock has been sold | `orders.test.js` | Pass |
| IT-67 | purchase then sale (end-to-end stock flow) | The report summary matches the orders that were placed | `orders.test.js` | Pass |
| IT-68 | purchase then sale (end-to-end stock flow) | The report counts low-stock products (stock at or below threshold) | `orders.test.js` | Pass |
| IT-69 | employee accounts and per-module permissions | Admin creates an employee login and receives a one-time temporary password | `employees.test.js` | Pass |
| IT-70 | employee accounts and per-module permissions | Login access requires an employee ID | `employees.test.js` | Pass |
| IT-71 | employee accounts and per-module permissions | A duplicate employee ID is rejected | `employees.test.js` | Pass |
| IT-72 | employee accounts and per-module permissions | The team list never exposes password hashes | `employees.test.js` | Pass |
| IT-73 | employee accounts and per-module permissions | Employee logs in with warehouse ID + employee ID + temporary password | `employees.test.js` | Pass |
| IT-74 | employee accounts and per-module permissions | Employee login fails with a wrong password or wrong warehouse | `employees.test.js` | Pass |
| IT-75 | employee accounts and per-module permissions | "read" permission lets the employee view products | `employees.test.js` | Pass |
| IT-76 | employee accounts and per-module permissions | "read" permission does not allow creating products | `employees.test.js` | Pass |
| IT-77 | employee accounts and per-module permissions | "none" permission blocks the module entirely | `employees.test.js` | Pass |
| IT-78 | employee accounts and per-module permissions | "write" permission on inventory allows stock adjustments | `employees.test.js` | Pass |
| IT-79 | employee accounts and per-module permissions | Employees cannot reach admin-only areas (team, activity log, profile) | `employees.test.js` | Pass |
| IT-80 | employee accounts and per-module permissions | The activity log records the employee as the actor | `employees.test.js` | Pass |
| IT-81 | employee accounts and per-module permissions | Employee replaces the temporary password and the flag is cleared | `employees.test.js` | Pass |
| IT-82 | employee accounts and per-module permissions | Permission changes by the admin apply immediately to an existing session | `employees.test.js` | Pass |
| IT-83 | employee accounts and per-module permissions | A disabled employee is locked out, even with a still-valid token | `employees.test.js` | Pass |
| IT-84 | employee accounts and per-module permissions | An employee of one warehouse cannot log into another warehouse | `employees.test.js` | Pass |
| IT-85 | role-specific sign-in tabs (Manager / Employee) | A manager signs in from the Manager tab and the response says "manager" | `employees.test.js` | Pass |
| IT-86 | role-specific sign-in tabs (Manager / Employee) | Staff cannot sign in from the Manager tab | `employees.test.js` | Pass |
| IT-87 | role-specific sign-in tabs (Manager / Employee) | A manager is pointed to the Manager tab when using the Employee tab | `employees.test.js` | Pass |
| IT-88 | role-specific sign-in tabs (Manager / Employee) | A wrong password on the wrong tab still says only "invalid" (no role is revealed) | `employees.test.js` | Pass |
| IT-89 | role-specific sign-in tabs (Manager / Employee) | An unknown tab value is rejected | `employees.test.js` | Pass |
| IT-90 | report lists the products behind the stock counts | Low stock lists items above zero and at or below their threshold (boundary: 10 of 10) | `orders.test.js` | Pass |
| IT-91 | report lists the products behind the stock counts | Out of stock lists only items with zero stock, matching the count | `orders.test.js` | Pass |

### System tests (Selenium WebDriver)

| ID | Area | Test case (expected behaviour) | File | Result |
|---|---|---|---|---|
| ST-01 | sign-up, sign-in and password recovery | The app opens on the sign-in page | `auth.e2e.test.js` | Pass |
| ST-02 | sign-up, sign-in and password recovery | A weak password keeps the "Create workspace" button disabled | `auth.e2e.test.js` | Pass |
| ST-03 | sign-up, sign-in and password recovery | A mismatched confirmation shows "Passwords do not match" | `auth.e2e.test.js` | Pass |
| ST-04 | sign-up, sign-in and password recovery | A valid registration opens the dashboard | `auth.e2e.test.js` | Pass |
| ST-05 | sign-up, sign-in and password recovery | The session survives a page refresh | `auth.e2e.test.js` | Pass |
| ST-06 | sign-up, sign-in and password recovery | Logging out returns to the sign-in page | `auth.e2e.test.js` | Pass |
| ST-07 | sign-up, sign-in and password recovery | A wrong password shows an error and stays on the sign-in page | `auth.e2e.test.js` | Pass |
| ST-08 | sign-up, sign-in and password recovery | The correct password signs the user in | `auth.e2e.test.js` | Pass |
| ST-09 | sign-up, sign-in and password recovery | Registering an email that already exists shows an error | `auth.e2e.test.js` | Pass |
| ST-10 | sign-up, sign-in and password recovery | A forgotten password can be reset with the security question | `auth.e2e.test.js` | Pass |
| ST-11 | product, inventory and sales workflow | A new account starts with an empty product list | `inventory.e2e.test.js` | Pass |
| ST-12 | product, inventory and sales workflow | Adding a product shows it in the products table | `inventory.e2e.test.js` | Pass |
| ST-13 | product, inventory and sales workflow | A duplicate HSN is rejected with a clear message | `inventory.e2e.test.js` | Pass |
| ST-14 | product, inventory and sales workflow | The product search filters the table | `inventory.e2e.test.js` | Pass |
| ST-15 | product, inventory and sales workflow | The category typed on the product form now exists under Categories | `inventory.e2e.test.js` | Pass |
| ST-16 | product, inventory and sales workflow | Adding stock on the Inventory page updates the current stock | `inventory.e2e.test.js` | Pass |
| ST-17 | product, inventory and sales workflow | Recording a sale removes the sold quantity from stock | `inventory.e2e.test.js` | Pass |
| ST-18 | product, inventory and sales workflow | Selling more than is in stock is refused | `inventory.e2e.test.js` | Pass |
| ST-19 | product, inventory and sales workflow | The stock movements ledger lists the adjustment and the sale | `inventory.e2e.test.js` | Pass |
| ST-20 | product, inventory and sales workflow | The dashboard summary reflects the catalogue | `inventory.e2e.test.js` | Pass |
| ST-21 | product, inventory and sales workflow | Clicking the Low stock and Out of stock report cards lists those products | `inventory.e2e.test.js` | Pass |
| ST-22 | sign-up, sign-in and password recovery | A manager signs in from the Manager tab at the top; staff are sent to the Employee tab | `auth.e2e.test.js` | Pass |

### Black-box API tests (JUnit 5)

| ID | Test case (expected behaviour) | File | Result |
|---|---|---|---|
| JU-01 | Health endpoint reports the API is up | `StockItApiTest.java` | Pass |
| JU-02 | Registering the same email twice is rejected with 409 | `StockItApiTest.java` | Pass |
| JU-03 | A weak password is rejected with 400 | `StockItApiTest.java` | Pass |
| JU-04 | Login succeeds with the right password and fails with a wrong one | `StockItApiTest.java` | Pass |
| JU-05 | Protected endpoints refuse requests without a token | `StockItApiTest.java` | Pass |
| JU-06 | A created product appears in the product list | `StockItApiTest.java` | Pass |
| JU-07 | A negative price is rejected with 400 | `StockItApiTest.java` | Pass |
| JU-08 | A sale reduces stock, and overselling is refused | `StockItApiTest.java` | Pass |
| JU-09 | The report summary totals the sale | `StockItApiTest.java` | Pass |
