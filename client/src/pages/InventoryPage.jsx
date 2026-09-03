import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, Check, Search, X } from 'lucide-react';

function getStockStatus(product) {
  const stock = Number(product.stockPresent) || 0;
  const threshold = Number(product.thresholdStock) || 0;
  if (stock === 0) return { label: 'Out of stock', className: 'out' };
  if (stock <= threshold) return { label: 'Low stock', className: 'low' };
  return { label: 'In stock', className: 'healthy' };
}

function InventoryPage({ products, onAdjustStock }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustmentType, setAdjustmentType] = useState('add');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');

  const stockStats = useMemo(() => ({
    totalUnits: products.reduce((total, product) => total + (Number(product.stockPresent) || 0), 0),
    low: products.filter((product) => getStockStatus(product).className === 'low').length,
    out: products.filter((product) => getStockStatus(product).className === 'out').length,
    healthy: products.filter((product) => getStockStatus(product).className === 'healthy').length,
  }), [products]);

  const visibleProducts = products.filter((product) => {
    const matchesSearch = `${product.itemName} ${product.hsn} ${product.itemCategory}`.toLowerCase().includes(searchTerm.toLowerCase());
    const status = getStockStatus(product).label;
    return matchesSearch && (statusFilter === 'All' || status === statusFilter);
  });

  const openAdjustment = (product, type) => {
    setSelectedProduct(product);
    setAdjustmentType(type);
    setQuantity('');
    setReason('');
  };

  const submitAdjustment = (event) => {
    event.preventDefault();
    const amount = Number(quantity);
    if (!selectedProduct || !Number.isInteger(amount) || amount <= 0) return;
    const currentStock = Number(selectedProduct.stockPresent) || 0;
    const nextStock = adjustmentType === 'remove' ? currentStock - amount : amount + currentStock;
    if (nextStock < 0) return;
    onAdjustStock(selectedProduct.id, nextStock);
    setSelectedProduct(null);
  };

  return (
    <div className="inventory-page dashboard-main">
      <div className="product-intro"><div><p className="eyebrow">Stock control</p><h1>Inventory</h1><p>Track availability and keep your stock levels healthy.</p></div><span className="inventory-live"><i /> Live inventory</span></div>
      <div className="inventory-summary"><div className="inventory-stat"><span className="summary-icon blue"><Boxes size={17} /></span><div><small>Total stock units</small><strong>{stockStats.totalUnits.toLocaleString()}</strong></div></div><div className="inventory-stat"><span className="summary-icon green"><Check size={17} /></span><div><small>Healthy stock</small><strong>{stockStats.healthy}</strong></div></div><div className="inventory-stat"><span className="summary-icon orange"><AlertTriangle size={17} /></span><div><small>Low stock</small><strong>{stockStats.low}</strong></div></div><div className="inventory-stat"><span className="summary-icon red"><X size={17} /></span><div><small>Out of stock</small><strong>{stockStats.out}</strong></div></div></div>
      <section className="inventory-section"><div className="inventory-toolbar"><div><p className="eyebrow">Stock overview</p><h2>Current inventory</h2></div><div className="inventory-filters"><label className="product-search"><Search size={16} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search inventory" aria-label="Search inventory" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by stock status"><option>All</option><option>In stock</option><option>Low stock</option><option>Out of stock</option></select></div></div><div className="product-table-wrap"><table className="product-table inventory-table"><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Threshold</th><th>Status</th><th>Last updated</th><th aria-label="Actions" /></tr></thead><tbody>{visibleProducts.length ? visibleProducts.map((product) => { const status = getStockStatus(product); return <tr key={product.id}><td><strong>{product.itemName}</strong><small className="table-subtext">HSN {product.hsn}</small></td><td>{product.itemCategory || '—'}</td><td><strong>{product.stockPresent || '0'}</strong></td><td>{product.thresholdStock || '0'}</td><td><span className={`stock-status ${status.className}`}><i />{status.label}</span></td><td>{product.stockUpdatedDate || 'Not updated'}</td><td className="stock-actions"><button className="stock-action add" onClick={() => openAdjustment(product, 'add')} aria-label={`Add stock to ${product.itemName}`}><ArrowDownToLine size={14} /></button><button className="stock-action remove" onClick={() => openAdjustment(product, 'remove')} aria-label={`Remove stock from ${product.itemName}`}><ArrowUpFromLine size={14} /></button></td></tr>; }) : <tr><td className="empty-products" colSpan="7">No inventory items match your filters.</td></tr>}</tbody></table></div></section>
      {selectedProduct && <div className="modal-backdrop" onMouseDown={() => setSelectedProduct(null)}><section className="adjust-modal panel" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">Stock control</p><h2>{adjustmentType === 'add' ? 'Add stock' : 'Remove stock'}</h2></div><button className="icon-button" onClick={() => setSelectedProduct(null)} aria-label="Close stock adjustment">×</button></div><p className="adjust-product">{selectedProduct.itemName} <span>Current stock: {selectedProduct.stockPresent || 0}</span></p><form onSubmit={submitAdjustment}><label className="field"><span>Quantity</span><input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Enter quantity" required /></label><label className="field"><span>Reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. New delivery, damaged item" /></label><button className="submit-button" type="submit">Confirm adjustment</button></form></section></div>}
    </div>
  );
}

export { InventoryPage };
