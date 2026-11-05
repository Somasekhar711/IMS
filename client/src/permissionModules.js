export const PERMISSION_MODULES = [
  { key: 'products', label: 'Products' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'categories', label: 'Categories' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'customers', label: 'Customers' },
  { key: 'purchaseOrders', label: 'Purchase Orders' },
  { key: 'salesOrders', label: 'Sales' },
  { key: 'stockMovements', label: 'Stock Movements' },
  { key: 'reports', label: 'Reports' },
];

export function emptyPermissions() {
  return PERMISSION_MODULES.reduce((map, { key }) => ({ ...map, [key]: 'none' }), {});
}
