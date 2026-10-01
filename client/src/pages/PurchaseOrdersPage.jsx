import { useEffect, useState } from 'react';
import { Check, ClipboardList, Plus, Search, Trash2, X } from 'lucide-react';
import { createPurchaseOrder, deletePurchaseOrder, getPurchaseOrders, getSuppliers } from '../api';
import { useSettings } from '../settingsContext';

const emptyLine = { productId: '', quantity: '', unitCost: '' };
const today = () => new Date().toISOString().slice(0, 10);

function PurchaseOrdersPage({ products = [], onOrdersChanged }) {
  const { currencySymbol } = useSettings();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(today());
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ ...emptyLine }]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!statusMessage && !errorMessage) return undefined;
    const timeoutId = setTimeout(() => {
      setStatusMessage('');
      setErrorMessage('');
    }, 4000);
    return () => clearTimeout(timeoutId);
  }, [statusMessage, errorMessage]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      setOrders(await getPurchaseOrders());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  const visibleOrders = orders.filter((order) => (
    `${order.supplierName} ${order.reference}`.toLowerCase().includes(searchTerm.toLowerCase())
  ));

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line));
  };

  const addLine = () => setLines((current) => [...current, { ...emptyLine }]);
  const removeLine = (index) => setLines((current) => current.length > 1 ? current.filter((_, lineIndex) => lineIndex !== index) : current);

  const runningTotal = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity) || 0;
    const unitCost = Number(line.unitCost) || 0;
    return sum + quantity * unitCost;
  }, 0);

  const resetForm = () => {
    setSupplierId('');
    setOrderDate(today());
    setReference('');
    setNotes('');
    setLines([{ ...emptyLine }]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const items = lines
      .filter((line) => line.productId || line.quantity || line.unitCost)
      .map((line) => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost) }));

    if (items.length === 0) {
      setErrorMessage('Add at least one line item');
      return;
    }
    if (items.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0 || Number.isNaN(item.unitCost) || item.unitCost < 0)) {
      setErrorMessage('Every line needs a product, a whole-number quantity, and a unit cost');
      return;
    }

    try {
      await createPurchaseOrder({ supplierId: supplierId || null, orderDate, reference, notes, items });
      setStatusMessage('Purchase order recorded and stock updated');
      resetForm();
      await loadOrders();
      if (onOrdersChanged) await onOrdersChanged();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save purchase order');
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Delete purchase order ${order.reference || `#${order.id}`}? This will reverse the stock it added.`)) return;

    try {
      await deletePurchaseOrder(order.id);
      setOrders((current) => current.filter((item) => String(item.id) !== String(order.id)));
      setStatusMessage('Purchase order deleted and stock reversed');
      if (onOrdersChanged) await onOrdersChanged();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete purchase order');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Receiving</p>
          <h1>Purchase orders</h1>
          <p>Record stock received from suppliers. Saving adds straight to inventory.</p>
        </div>
        <div className="product-intro-actions">
          <span className="product-count">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>
        </div>
      </div>

      <section className="product-panel panel supplier-form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">New delivery</p>
            <h2>Create purchase order</h2>
          </div>
          <ClipboardList size={19} color="#63866f" />
        </div>

        <form className="product-form supplier-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Supplier</span>
            <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">No supplier selected</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Order date</span>
            <input type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} required />
          </label>
          <label className="field">
            <span>Reference</span>
            <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. Invoice number" maxLength={80} />
          </label>
          <label className="field supplier-notes-field">
            <span>Notes</span>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" />
          </label>

          <fieldset className="order-items">
            <legend>Line items</legend>
            {lines.map((line, index) => {
              const quantity = Number(line.quantity) || 0;
              const unitCost = Number(line.unitCost) || 0;
              return (
                <div className="order-item-row" key={index}>
                  <label className="field">
                    <span>Product</span>
                    <select value={line.productId} onChange={(event) => updateLine(index, 'productId', event.target.value)}>
                      <option value="">Select product</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.itemName}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input type="number" min="1" step="1" value={line.quantity} onChange={(event) => updateLine(index, 'quantity', event.target.value)} placeholder="0" />
                  </label>
                  <label className="field">
                    <span>Unit cost</span>
                    <input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, 'unitCost', event.target.value)} placeholder="0.00" />
                  </label>
                  <div className="order-line-total">
                    <span>Line total</span>
                    <strong>{currencySymbol}{(quantity * unitCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                  </div>
                  <button type="button" className="icon-button danger order-remove-line" onClick={() => removeLine(index)} aria-label="Remove line" disabled={lines.length === 1}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
            <button type="button" className="secondary-action order-add-line" onClick={addLine}><Plus size={14} /> Add line</button>

            <div className="order-summary">
              <span>Order total</span>
              <strong>{currencySymbol}{runningTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
            </div>
          </fieldset>

          <div className="supplier-form-actions">
            <button className="submit-button product-submit" type="submit">
              <Plus size={15} /> Save purchase order
            </button>
          </div>
        </form>
      </section>

      <section className="product-list-section">
        <div className="product-list-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Purchase orders</h2>
          </div>
          <label className="product-search">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by supplier or reference" aria-label="Search purchase orders" />
          </label>
        </div>

        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr><th>Date</th><th>Supplier</th><th>Reference</th><th>Items</th><th>Total</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="6">Loading purchase orders…</td></tr>
              ) : visibleOrders.length ? visibleOrders.map((order) => {
                const expanded = String(expandedOrderId) === String(order.id);
                return (
                  <OrderRows
                    key={order.id}
                    order={order}
                    expanded={expanded}
                    currencySymbol={currencySymbol}
                    counterpartyLabel={order.supplierName || 'No supplier'}
                    onToggle={() => setExpandedOrderId(expanded ? null : order.id)}
                    onDelete={() => handleDelete(order)}
                  />
                );
              }) : (
                <tr><td className="empty-products" colSpan="6">{searchTerm ? 'No purchase orders match your search.' : 'No purchase orders yet. Record your first delivery above.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {statusMessage && <div className="success-toast" role="status"><Check size={16} /> {statusMessage}</div>}
      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

function OrderRows({ order, expanded, currencySymbol, counterpartyLabel, onToggle, onDelete }) {
  return (
    <>
      <tr>
        <td>{order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-IN') : '—'}</td>
        <td><strong>{counterpartyLabel}</strong></td>
        <td>{order.reference || '—'}</td>
        <td>{order.items.length}</td>
        <td><strong>{currencySymbol}{order.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong></td>
        <td className="table-actions supplier-table-actions">
          <button className="secondary-action" type="button" onClick={onToggle}>{expanded ? 'Hide items' : 'View items'}</button>
          <button className="icon-button danger" type="button" onClick={onDelete} aria-label={`Delete order ${order.reference || order.id}`}><Trash2 size={15} /></button>
        </td>
      </tr>
      {expanded && (
        <tr className="order-detail-row">
          <td colSpan="6">
            <div className="order-detail-content">
              {order.notes && <p>{order.notes}</p>}
              <table className="order-line-table">
                <thead><tr><th>Product</th><th>HSN</th><th>Qty</th><th>Unit cost</th><th>Line total</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.itemName}</td>
                      <td>{item.hsn || '—'}</td>
                      <td>{item.quantity}</td>
                      <td>{currencySymbol}{Number(item.unitCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                      <td>{currencySymbol}{Number(item.lineTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export { PurchaseOrdersPage };
