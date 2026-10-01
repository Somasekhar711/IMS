import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Settings2 } from 'lucide-react';
import { getInventoryMovements } from '../api';

const typeTone = { purchase: 'blue', sale: 'green', adjustment: 'gold' };
const typeIcon = { purchase: ArrowDownToLine, sale: ArrowUpFromLine, adjustment: Settings2 };

function StockMovementsPage({ products = [] }) {
  const [movements, setMovements] = useState([]);
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productFilter, typeFilter]);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await getInventoryMovements({
        productId: productFilter || undefined,
        type: typeFilter === 'All' ? undefined : typeFilter,
        limit: 200,
      });
      setMovements(data);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load stock movements');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => ({
    purchased: movements.filter((m) => m.movementType === 'purchase').reduce((sum, m) => sum + m.quantityChange, 0),
    sold: movements.filter((m) => m.movementType === 'sale').reduce((sum, m) => sum + Math.abs(m.quantityChange), 0),
    adjustments: movements.filter((m) => m.movementType === 'adjustment').length,
  }), [movements]);

  return (
    <div className="inventory-page dashboard-main">
      <div className="product-intro">
        <div><p className="eyebrow">Audit trail</p><h1>Stock movements</h1><p>Every purchase, sale, and manual adjustment that has touched your inventory.</p></div>
        <span className="inventory-live"><i /> Live ledger</span>
      </div>

      <div className="inventory-summary">
        <div className="inventory-stat"><span className="summary-icon blue"><ArrowDownToLine size={17} /></span><div><small>Units received</small><strong>{stats.purchased.toLocaleString()}</strong></div></div>
        <div className="inventory-stat"><span className="summary-icon green"><ArrowUpFromLine size={17} /></span><div><small>Units sold</small><strong>{stats.sold.toLocaleString()}</strong></div></div>
        <div className="inventory-stat"><span className="summary-icon gold"><Settings2 size={17} /></span><div><small>Manual adjustments</small><strong>{stats.adjustments.toLocaleString()}</strong></div></div>
        <div className="inventory-stat"><span className="summary-icon teal"><Settings2 size={17} /></span><div><small>Entries shown</small><strong>{movements.length.toLocaleString()}</strong></div></div>
      </div>

      <section className="inventory-section">
        <div className="inventory-toolbar">
          <div><p className="eyebrow">Ledger</p><h2>Movement history</h2></div>
          <div className="inventory-filters">
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="Filter by product">
              <option value="">All products</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.itemName}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filter by movement type">
              <option>All</option>
              <option value="purchase">Purchase</option>
              <option value="sale">Sale</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
        </div>

        <div className="product-table-wrap">
          <table className="product-table">
            <thead>
              <tr><th>Date</th><th>Product</th><th>Type</th><th>Change</th><th>Stock after</th><th>Note</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td className="empty-products" colSpan="6">Loading movements…</td></tr>
              ) : movements.length ? movements.map((movement) => {
                const Icon = typeIcon[movement.movementType] || Settings2;
                return (
                  <tr key={movement.id}>
                    <td>{new Date(movement.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td><strong>{movement.itemName}</strong><small className="table-subtext">HSN {movement.hsn}</small></td>
                    <td><span className={`badge ${typeTone[movement.movementType] || 'blue'}`}><Icon size={12} /> {movement.movementType}</span></td>
                    <td className={movement.quantityChange >= 0 ? '' : 'stock-low'}>{movement.quantityChange > 0 ? `+${movement.quantityChange}` : movement.quantityChange}</td>
                    <td>{movement.stockAfter}</td>
                    <td>{movement.note || '—'}</td>
                  </tr>
                );
              }) : (
                <tr><td className="empty-products" colSpan="6">No stock movements yet. Purchases, sales, and manual adjustments will appear here.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {errorMessage && <div className="supplier-error" role="alert">{errorMessage}</div>}
    </div>
  );
}

export { StockMovementsPage };
