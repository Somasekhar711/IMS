import { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronDown, DollarSign, Package, ShoppingCart, TrendingUp, X } from 'lucide-react';
import { getReportsSummary } from '../api';
import { useSettings } from '../settingsContext';

const ranges = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

function ReportsPage() {
  const { currencySymbol } = useSettings();
  const [range, setRange] = useState('30');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      setSummary(await getReportsSummary(range));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const rangeLabel = ranges.find((entry) => entry.value === range)?.label || 'Last 30 days';
  const money = (value) => `${currencySymbol}${(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const statCards = summary ? [
    { label: 'Sales revenue', value: money(summary.salesTotal), detail: `${summary.salesCount} order${summary.salesCount === 1 ? '' : 's'}`, icon: TrendingUp, tone: 'green' },
    { label: 'Purchases cost', value: money(summary.purchasesTotal), detail: `${summary.purchasesCount} order${summary.purchasesCount === 1 ? '' : 's'}`, icon: ShoppingCart, tone: 'blue' },
    { label: 'Low stock', value: summary.lowStockCount, detail: `of ${summary.totalProducts} products`, icon: AlertTriangle, tone: 'orange' },
    { label: 'Out of stock', value: summary.outOfStockCount, detail: `of ${summary.totalProducts} products`, icon: Package, tone: 'red' },
  ] : [];

  return (
    <div className="product-page dashboard-main">
      <div className="dashboard-intro">
        <div><p className="eyebrow">Performance</p><h1>Reports</h1><p>Sales, purchases, and stock health at a glance.</p></div>
        <div className="filter-menu">
          <button className="date-filter" onClick={() => setIsFilterOpen(!isFilterOpen)} aria-expanded={isFilterOpen} aria-haspopup="menu">{rangeLabel} <ChevronDown size={14} /></button>
          {isFilterOpen && (
            <div className="filter-options" role="menu">
              {ranges.map((entry) => (
                <button key={entry.value} onClick={() => { setRange(entry.value); setIsFilterOpen(false); }}>{entry.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="empty-products">Loading report…</p>
      ) : summary && (
        <>
          <div className="summary-grid">
            {statCards.map(({ label, value, detail, icon: Icon, tone }) => (
              <div className="summary-card" key={label}>
                <div className={`summary-icon ${tone}`}><Icon size={17} /></div>
                <div className="summary-card__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
              </div>
            ))}
          </div>

          <section className="product-list-section">
            <div className="product-list-heading">
              <div><p className="eyebrow">Best sellers</p><h2>Top products by quantity sold</h2></div>
              <BarChart3 size={18} color="#63866f" />
            </div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {summary.topProducts.length ? summary.topProducts.map((product) => (
                    <tr key={product.id}>
                      <td><strong>{product.itemName}</strong></td>
                      <td>{product.quantity}</td>
                      <td>{money(product.revenue)}</td>
                    </tr>
                  )) : (
                    <tr><td className="empty-products" colSpan="3">No sales recorded in this period yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="pulse-legend" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #eef0eb' }}>
            <span><DollarSign size={13} /> {summary.movementsCount} stock movement{summary.movementsCount === 1 ? '' : 's'} in this period</span>
          </div>
        </>
      )}

      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

export { ReportsPage };
