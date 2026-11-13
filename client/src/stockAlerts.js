// One set of stock and expiry rules, shared by the Dashboard (badge, cards,
// notifications) and the Inventory page, so their counts always agree.

export const EXPIRY_WARNING_DAYS = 30;

export function getStockStatus(product) {
  const stock = Number(product.stockPresent) || 0;
  const threshold = Number(product.thresholdStock) || 0;
  if (stock === 0) return { label: 'Out of stock', className: 'out' };
  if (stock <= threshold) return { label: 'Low stock', className: 'low' };
  return { label: 'In stock', className: 'healthy' };
}

// Whole days from today until the expiry date (negative once expired), or null.
export function daysUntilExpiry(product, today = new Date()) {
  if (!product.expiryDate) return null;
  const [year, month, day] = String(product.expiryDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  const expiry = Date.UTC(year, month - 1, day);
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((expiry - start) / 86400000);
}

// Already expired, or expiring within the warning window.
export function getExpiryAlert(product, today = new Date()) {
  const days = daysUntilExpiry(product, today);
  if (days === null || days > EXPIRY_WARNING_DAYS) return null;
  if (days < 0) return { label: `Expired ${-days} day${days === -1 ? '' : 's'} ago`, className: 'expired', days };
  if (days === 0) return { label: 'Expires today', className: 'expiring', days };
  return { label: `Expires in ${days} day${days === 1 ? '' : 's'}`, className: 'expiring', days };
}

export function summariseAlerts(products, today = new Date()) {
  const outOfStock = products.filter((product) => getStockStatus(product).className === 'out');
  const lowStock = products.filter((product) => getStockStatus(product).className === 'low');
  const expiring = products.filter((product) => getExpiryAlert(product, today));
  return { outOfStock, lowStock, expiring, total: outOfStock.length + lowStock.length + expiring.length };
}
