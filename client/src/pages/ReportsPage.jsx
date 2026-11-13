import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, ChevronDown, Coins, Package, Receipt, ShoppingCart, TrendingUp, Warehouse, X } from 'lucide-react';
import { getReportsSummary } from '../api';
import { useSettings } from '../settingsContext';

const ranges = [
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
  { label: 'All time', value: 'all' },
];

// The stock cards open a list of the products behind their number.
const stockLists = {
  low: { title: 'Low stock items', eyebrow: 'Needs reordering', key: 'lowStockItems', empty: 'No products are running low right now.' },
  out: { title: 'Out of stock items', eyebrow: 'Needs replenishment', key: 'outOfStockItems', empty: 'Nothing is out of stock right now.' },
  expiring: { title: 'Expired or expiring items', eyebrow: 'Sell or clear soon', key: 'expiringItems', empty: 'Nothing expires in the next 30 days.' },
};

// Fills in the days (or months) with no sales so the chart has no gaps.
function trendPoints(trend) {
  if (!trend?.points?.length) return [];
  const byPeriod = Object.fromEntries(trend.points.map((point) => [point.period, point]));
  const points = [];
  const cursor = new Date(`${trend.interval === 'day' && trend.startDate ? trend.startDate : trend.points[0].period}T00:00:00Z`);
  const end = new Date(`${trend.points[trend.points.length - 1].period}T00:00:00Z`);
  const today = new Date();
  const last = trend.interval === 'day' ? new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) : end;
  while (cursor <= last && points.length < 400) {
    const period = cursor.toISOString().slice(0, 10);
    points.push(byPeriod[period] || { period, revenue: 0, profit: 0 });
    if (trend.interval === 'day') cursor.setUTCDate(cursor.getUTCDate() + 1);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return points;
}

function ReportsPage() {
  const { currencySymbol } = useSettings();
  const [range, setRange] = useState('30');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [stockView, setStockView] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    if (stockView) listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stockView]);

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
  const money = (value) => `${value < 0 ? '−' : ''}${currencySymbol}${Math.abs(Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const moneyOrDash = (value) => (value === null || value === undefined ? '—' : money(value));
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

  const salesCards = summary ? [
    { label: 'Sales revenue', value: money(summary.salesTotal), detail: `${plural(summary.salesCount, 'order')} · ${plural(summary.unitsSold, 'unit')}`, icon: TrendingUp, tone: 'green' },
    { label: 'Gross profit', value: money(summary.grossProfit), detail: summary.grossMarginPercent === null ? 'No costed sales yet' : `${summary.grossMarginPercent}% margin · cost ${money(summary.costOfGoodsSold)}`, icon: Coins, tone: 'gold' },
    { label: 'Purchases cost', value: money(summary.purchasesTotal), detail: plural(summary.purchasesCount, 'order'), icon: ShoppingCart, tone: 'blue' },
    { label: 'Average order', value: money(summary.averageOrderValue), detail: 'Revenue per sales order', icon: Receipt, tone: 'purple' },
  ] : [];

  const stockCards = summary ? [
    { label: 'Low stock', value: summary.lowStockCount, detail: `of ${summary.totalProducts} products · view list`, icon: AlertTriangle, tone: 'orange', list: 'low' },
    { label: 'Out of stock', value: summary.outOfStockCount, detail: `of ${summary.totalProducts} products · view list`, icon: Package, tone: 'red', list: 'out' },
    { label: 'Expired / expiring', value: summary.expiringItems.length, detail: 'Within 30 days · view list', icon: CalendarClock, tone: 'pink', list: 'expiring' },
    { label: 'Stock value', value: money(summary.inventoryValueAtCost), detail: `at cost · ${money(summary.inventoryValueAtPrice)} at selling price`, icon: Warehouse, tone: 'green' },
  ] : [];

  const openList = stockView ? stockLists[stockView] : null;
  const openItems = openList ? (summary?.[openList.key] || []) : [];
  const points = trendPoints(summary?.salesTrend);
  const maxRevenue = Math.max(1, ...points.map((point) => point.revenue));

  const renderCard = ({ label, value, detail, icon: Icon, tone, list }) => {
    const content = (
      <>
        <div className={`summary-icon ${tone}`}><Icon size={17} /></div>
        <div className="summary-card__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      </>
    );
    return list ? (
      <button type="button" className={`summary-card ${stockView === list ? 'is-active' : ''}`} key={label} onClick={() => setStockView((current) => (current === list ? null : list))} aria-expanded={stockView === list} aria-controls="report-stock-list">
        {content}
        <span className="card-arrow">{stockView === list ? '×' : '↘'}</span>
      </button>
    ) : (
      <div className="summary-card is-static" key={label}>{content}</div>
    );
  };

  return (
    <div className="product-page dashboard-main">
      <div className="dashboard-intro">
        <div><p className="eyebrow">Performance</p><h1>Reports</h1><p>Sales, profit, purchases, and stock health at a glance.</p></div>
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
          <div className="summary-grid">{salesCards.map(renderCard)}</div>
          {summary.uncostedRevenue > 0 && (
            <p className="report-note">{money(summary.uncostedRevenue)} of sales came from products without a cost price, so it is not counted in gross profit. Add a cost price to those products (or record a purchase) to include them.</p>
          )}
          <div className="summary-grid report-stock-cards">{stockCards.map(renderCard)}</div>

          {openList && (
            <section className="product-list-section report-stock-list" id="report-stock-list" ref={listRef}>
              <div className="product-list-heading">
                <div><p className="eyebrow">{openList.eyebrow}</p><h2>{`${openList.title} (${openItems.length})`}</h2></div>
                <button type="button" className="icon-button" onClick={() => setStockView(null)} aria-label={`Close ${openList.title.toLowerCase()}`}><X size={16} /></button>
              </div>
              <div className="product-table-wrap">
                <table className="product-table">
                  <thead>
                    {stockView === 'expiring'
                      ? <tr><th>Product</th><th>HSN</th><th>Category</th><th>In stock</th><th>Expiry date</th><th>Status</th><th>Value at risk</th></tr>
                      : <tr><th>Product</th><th>HSN</th><th>Category</th><th>In stock</th><th>Threshold</th><th>{stockView === 'out' ? 'Status' : 'Short by'}</th></tr>}
                  </thead>
                  <tbody>
                    {openItems.length ? openItems.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.itemName}</strong></td>
                        <td>{item.hsn}</td>
                        <td>{item.itemCategory || '—'}</td>
                        <td><span className={item.stockPresent === 0 ? 'stock-status out' : stockView === 'low' ? 'stock-status low' : 'stock-status healthy'}><i />{item.stockPresent}</span></td>
                        {stockView === 'expiring' ? (
                          <>
                            <td>{item.expiryDate}</td>
                            <td><span className={`stock-status ${item.daysLeft < 0 ? 'expired' : 'expiring'}`}><i />{item.daysLeft < 0 ? `Expired ${-item.daysLeft} day${item.daysLeft === -1 ? '' : 's'} ago` : item.daysLeft === 0 ? 'Expires today' : `In ${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'}`}</span></td>
                            <td>{money(item.valueAtRisk)}</td>
                          </>
                        ) : (
                          <>
                            <td>{item.thresholdStock}</td>
                            <td>{stockView === 'out' ? 'Out of stock' : `${Math.max(item.thresholdStock - item.stockPresent, 0)} units`}</td>
                          </>
                        )}
                      </tr>
                    )) : (
                      <tr><td className="empty-products" colSpan="7">{openList.empty}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="product-list-section">
            <div className="product-list-heading">
              <div><p className="eyebrow">Trend</p><h2>{summary.salesTrend.interval === 'day' ? 'Daily sales and profit' : 'Monthly sales and profit'}</h2></div>
              <div className="trend-legend"><span><i className="revenue" /> Revenue</span><span><i className="profit" /> Gross profit</span></div>
            </div>
            {points.length ? (
              <div className="trend-chart" role="img" aria-label={`Sales trend: ${points.length} ${summary.salesTrend.interval}s, highest ${money(maxRevenue)}`}>
                {points.map((point) => (
                  <div className="trend-bar" key={point.period} title={`${point.period}: revenue ${money(point.revenue)}, profit ${moneyOrDash(point.profit)}`}>
                    <span className="revenue" style={{ height: `${(point.revenue / maxRevenue) * 100}%` }} />
                    <span className="profit" style={{ height: `${(Math.max(point.profit || 0, 0) / maxRevenue) * 100}%` }} />
                  </div>
                ))}
              </div>
            ) : <p className="empty-products">No sales recorded in this period yet.</p>}
            {points.length > 0 && <div className="trend-axis"><span>{points[0].period}</span><span>Peak {money(maxRevenue)}</span><span>{points[points.length - 1].period}</span></div>}
          </section>

          <div className="report-columns">
            <section className="product-list-section">
              <div className="product-list-heading">
                <div><p className="eyebrow">Best sellers</p><h2>Top products by quantity sold</h2></div>
                <BarChart3 size={18} color="#63866f" />
              </div>
              <div className="product-table-wrap">
                <table className="product-table">
                  <thead><tr><th>Product</th><th>Units sold</th><th>Revenue</th><th>Gross profit</th></tr></thead>
                  <tbody>
                    {summary.topProducts.length ? summary.topProducts.map((product) => (
                      <tr key={product.id}><td><strong>{product.itemName}</strong></td><td>{product.quantity}</td><td>{money(product.revenue)}</td><td>{moneyOrDash(product.profit)}</td></tr>
                    )) : <tr><td className="empty-products" colSpan="4">No sales recorded in this period yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="product-list-section">
              <div className="product-list-heading"><div><p className="eyebrow">Customers</p><h2>Top customers</h2></div></div>
              <div className="product-table-wrap">
                <table className="product-table">
                  <thead><tr><th>Customer</th><th>Orders</th><th>Revenue</th></tr></thead>
                  <tbody>
                    {summary.topCustomers.length ? summary.topCustomers.map((customer) => (
                      <tr key={customer.customerId || 'walk-in'}><td><strong>{customer.name}</strong></td><td>{customer.orders}</td><td>{money(customer.revenue)}</td></tr>
                    )) : <tr><td className="empty-products" colSpan="3">No sales recorded in this period yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="product-list-section">
            <div className="product-list-heading"><div><p className="eyebrow">Categories</p><h2>Sales and profit by category</h2></div></div>
            <div className="product-table-wrap">
              <table className="product-table">
                <thead><tr><th>Category</th><th>Units sold</th><th>Revenue</th><th>Gross profit</th><th>Margin</th></tr></thead>
                <tbody>
                  {summary.salesByCategory.length ? summary.salesByCategory.map((row) => (
                    <tr key={row.category}>
                      <td><strong>{row.category}</strong></td><td>{row.quantity}</td><td>{money(row.revenue)}</td><td>{moneyOrDash(row.profit)}</td>
                      <td>{row.profit === null || !row.revenue ? '—' : `${Math.round((row.profit / row.revenue) * 1000) / 10}%`}</td>
                    </tr>
                  )) : <tr><td className="empty-products" colSpan="5">No sales recorded in this period yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <p className="report-note">Gross profit = selling price − cost price, using the cost recorded on each sale. Stock value: {money(summary.inventoryValueAtCost)} at cost, {money(summary.inventoryValueAtPrice)} at selling price, so {money(summary.potentialProfit)} potential profit if it all sells.{summary.productsWithoutCost > 0 ? ` ${plural(summary.productsWithoutCost, 'product')} have no cost price yet.` : ''} {plural(summary.movementsCount, 'stock movement')} in this period.</p>
        </>
      )}

      {errorMessage && <div className="supplier-error" role="alert"><X size={15} /> {errorMessage}</div>}
    </div>
  );
}

export { ReportsPage };
