import { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  LineChart,
  Menu,
  Package,
  PanelLeftClose,
  Search,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import { ProductPage } from './ProductPage';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Products', icon: Package },
  { label: 'Inventory', icon: Boxes },
  { label: 'Categories', icon: Tags },
  { label: 'Suppliers', icon: Truck, separated: true },
  { label: 'Purchase Orders', icon: ClipboardList },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Stock Movements', icon: LineChart, separated: true },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Users & Roles', icon: UsersRound, separated: true },
  { label: 'Settings', icon: Settings },
];

const summaryCards = [
  { label: 'Products', value: '12,450', detail: '148 added this month', icon: Package, tone: 'green', module: 'Products' },
  { label: 'Stock units', value: '86,320', detail: '84.6% stock health', icon: Boxes, tone: 'blue', module: 'Inventory' },
  { label: 'Inventory value', value: '₹42.6 L', detail: '+12.4% this month', icon: DollarSign, tone: 'gold', module: 'Reports' },
  { label: 'Low stock', value: '126', detail: 'Needs attention', icon: AlertTriangle, tone: 'orange', module: 'Inventory' },
  { label: 'Out of stock', value: '18', detail: 'Across 7 categories', icon: X, tone: 'red', module: 'Inventory' },
  { label: 'Purchases', value: '24', detail: '8 awaiting delivery', icon: ClipboardList, tone: 'purple', module: 'Purchase Orders' },
  { label: 'Sales', value: '₹1,24,500', detail: '+8.2% this week', icon: ShoppingCart, tone: 'teal', module: 'Sales' },
  { label: 'Expiring soon', value: '12', detail: 'Within 30 days', icon: Bell, tone: 'pink', module: 'Inventory' },
];

const activity = [
  { title: 'Purchase order received', detail: 'PO-1048 · 24 items added to stock', time: '12 min ago', type: 'purchase' },
  { title: 'Low stock threshold reached', detail: 'Organic Oats 1kg · 14 units left', time: '34 min ago', type: 'alert' },
  { title: 'Sale completed', detail: 'INV-2381 · ₹8,450 order value', time: '1 hr ago', type: 'sale' },
  { title: 'New product added', detail: 'Stainless Steel Bottle · Kitchen', time: '2 hrs ago', type: 'product' },
];

function DashboardPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState('Dashboard');

  const openModule = (module) => {
    setSelectedModule(module);
    setIsMenuOpen(false);
  };

  return (
    <main className="dashboard-page">
      {isMenuOpen && <button className="drawer-backdrop" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`dashboard-sidebar ${isMenuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><div className="brand-mark"><Package size={18} /></div><span>StockIt</span><button className="drawer-close" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button></div>
        <nav className="dashboard-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, separated }) => <button className={`${selectedModule === label ? 'is-active' : ''} ${separated ? 'is-separated' : ''}`} key={label} onClick={() => openModule(label)}><Icon size={17} /><span>{label}</span>{label === 'Inventory' && <span className="nav-badge">3</span>}</button>)}
        </nav>
        <div className="sidebar-footer"><div className="avatar">AM</div><div><strong>Alex Morgan</strong><span>Administrator</span></div><button aria-label="Open settings" onClick={() => openModule('Settings')}><Settings size={16} /></button></div>
      </aside>

      <section className="dashboard-content">
        <header className="dashboard-header">
          <button className="menu-button" onClick={() => setIsMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="dashboard-title"><span>Inventory Management</span><strong>{selectedModule}</strong></div>
          <div className="header-actions"><button className="search-button" aria-label="Search inventory"><Search size={18} /></button><button className="notification-button" aria-label="View notifications"><Bell size={18} /><i /></button><div className="header-user"><div className="avatar">AM</div><span>Admin</span></div></div>
        </header>

        {selectedModule === 'Products' ? <ProductPage /> : <div className="dashboard-main">
          <div className="dashboard-intro"><div><p className="eyebrow">Thursday, 27 August 2026</p><h1>Good morning, Alex.</h1><p>Here is what is happening across your inventory today.</p></div><button className="date-filter">Last 30 days <span>⌄</span></button></div>

          <div className="summary-grid">
            {summaryCards.map(({ label, value, detail, icon: Icon, tone, module }) => <button className="summary-card" key={label} onClick={() => openModule(module)}><div className={`summary-icon ${tone}`}><Icon size={17} /></div><div className="summary-card__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className="card-arrow">↗</span></button>)}
          </div>

          <div className="dashboard-lower">
            <section className="panel pulse-panel"><div className="panel-heading"><div><p className="eyebrow">Live overview</p><h2>Warehouse pulse</h2></div><span className="status-pill"><i /> Live</span></div><div className="pulse-chart"><div className="chart-labels"><span>100k</span><span>75k</span><span>50k</span><span>25k</span><span>0</span></div><div className="chart-area"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-label="Stock units chart"><defs><linearGradient id="pulseFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#b9e36b" stopOpacity=".28" /><stop offset="100%" stopColor="#b9e36b" stopOpacity="0" /></linearGradient></defs><path d="M0 145 C45 128, 70 137, 108 105 S176 118, 218 82 S278 96, 316 63 S375 80, 420 45 S475 78, 518 40 S565 50, 600 18 V170 H0 Z" fill="url(#pulseFill)" /><path d="M0 145 C45 128, 70 137, 108 105 S176 118, 218 82 S278 96, 316 63 S375 80, 420 45 S475 78, 518 40 S565 50, 600 18" fill="none" stroke="#b9e36b" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-months"><span>Aug 01</span><span>Aug 08</span><span>Aug 15</span><span>Aug 22</span><span>Aug 27</span></div></div></div><div className="pulse-legend"><span><i className="dot-green" /> Available stock <strong>86,320</strong></span><span><i className="dot-orange" /> Reserved <strong>4,280</strong></span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Recent updates</p><h2>Activity</h2></div><button className="text-button" onClick={() => openModule('Stock Movements')}>View all</button></div><div className="activity-list">{activity.map(({ title, detail, time, type }) => <button className="activity-item" key={title} onClick={() => openModule(type === 'purchase' ? 'Purchase Orders' : type === 'sale' ? 'Sales' : type === 'product' ? 'Products' : 'Inventory')}><span className={`activity-icon ${type}`}>{type === 'purchase' ? <Truck size={15} /> : type === 'sale' ? <DollarSign size={15} /> : type === 'product' ? <Package size={15} /> : <AlertTriangle size={15} />}</span><span className="activity-copy"><strong>{title}</strong><small>{detail}</small></span><time>{time}</time></button>)}</div></section>
          </div>
        </div>}
      </section>
    </main>
  );
}

export { DashboardPage };
