import { useEffect, useState } from 'react';
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
  Plus,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  UsersRound,
  X,
} from 'lucide-react';
import { AddProductPage } from './AddProductPage';
import { ProductsListPage } from './ProductsListPage';
import { InventoryPage } from './InventoryPage';
import { adjustProductStock, createProduct, deleteProduct as deleteProductRequest, getProducts, updateProduct as updateProductRequest } from '../api';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Products', icon: Package },
  { label: 'Add Product', icon: Plus, separated: false },
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

function DashboardPage({ user }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState('Dashboard');
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState('');

  const productCount = products.length;
  const stockUnits = products.reduce((total, product) => total + (Number(product.stockPresent) || 0), 0);
  const inventoryValue = products.reduce((total, product) => total + ((Number(product.itemPrice) || 0) * (Number(product.stockPresent) || 0)), 0);
  const lowStockCount = products.filter((product) => Number(product.stockPresent) > 0 && Number(product.stockPresent) <= Number(product.thresholdStock)).length;
  const outOfStockCount = products.filter((product) => Number(product.stockPresent) === 0).length;
  const expiringSoonCount = products.filter((product) => {
    if (!product.expiryDate) return false;
    const daysUntilExpiry = (new Date(product.expiryDate) - new Date()) / 86400000;
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  }).length;
  const summaryCards = [
    { label: 'Products', value: productCount.toLocaleString(), detail: 'Cataloged products', icon: Package, tone: 'green', module: 'Products' },
    { label: 'Stock units', value: stockUnits.toLocaleString(), detail: 'Current available units', icon: Boxes, tone: 'blue', module: 'Inventory' },
    { label: 'Inventory value', value: `₹${inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, detail: 'Price × current stock', icon: DollarSign, tone: 'gold', module: 'Inventory' },
    { label: 'Low stock', value: lowStockCount.toLocaleString(), detail: 'At or below threshold', icon: AlertTriangle, tone: 'orange', module: 'Inventory' },
    { label: 'Out of stock', value: outOfStockCount.toLocaleString(), detail: 'Requires replenishment', icon: X, tone: 'red', module: 'Inventory' },
    { label: 'Expiring soon', value: expiringSoonCount.toLocaleString(), detail: 'Within the next 30 days', icon: Bell, tone: 'pink', module: 'Inventory' },
  ];
  const displayName = user?.fullName || 'User';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    getProducts().then(setProducts).catch((error) => setProductError(error.message || 'Unable to load products'));
  }, []);

  const openModule = (module) => {
    setSelectedModule(module);
    setIsMenuOpen(false);
  };

  const addProduct = async (product) => {
    const createdProduct = await createProduct(product);
    setProducts((current) => [createdProduct, ...current]);
    setSelectedModule('Products');
  };

  const updateProduct = async (updatedProduct) => {
    const savedProduct = await updateProductRequest(updatedProduct.id, updatedProduct);
    setProducts((current) => current.map((product) => product.id === savedProduct.id ? savedProduct : product));
  };

  const deleteProduct = async (id) => {
    await deleteProductRequest(id);
    setProducts((current) => current.filter((product) => product.id !== id));
  };

  const adjustStock = async (id, stockPresent) => {
    const updatedStock = await adjustProductStock(id, stockPresent);
    setProducts((current) => current.map((product) => product.id === updatedStock.id ? { ...product, ...updatedStock } : product));
  };

  return (
    <main className="dashboard-page">
      {isMenuOpen && <button className="drawer-backdrop" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`dashboard-sidebar ${isMenuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><div className="brand-mark"><Package size={18} /></div><span>StockIt</span><button className="drawer-close" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button></div>
        <nav className="dashboard-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, separated }) => <button className={`${selectedModule === label ? 'is-active' : ''} ${separated ? 'is-separated' : ''}`} key={label} onClick={() => openModule(label)}><Icon size={17} /><span>{label}</span>{label === 'Inventory' && <span className="nav-badge">3</span>}</button>)}
        </nav>
        <div className="sidebar-footer"><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>{user?.role || 'Administrator'}</span></div><button aria-label="Open settings" onClick={() => openModule('Settings')}><Settings size={16} /></button></div>
      </aside>

      <section className="dashboard-content">
        <div className="stock-symbols" aria-hidden="true" />
        <header className="dashboard-header">
          <button className="menu-button" onClick={() => setIsMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="dashboard-title"><span>Inventory Management</span><strong>{selectedModule}</strong></div>
          <div className="header-actions"><button className="search-button" aria-label="Search inventory"><Search size={18} /></button><button className="notification-button" aria-label="View notifications"><Bell size={18} /><i /></button><div className="header-user"><div className="avatar">{initials}</div><span>{user?.role || 'Admin'}</span></div></div>
        </header>

  {productError && <div className="dashboard-error">{productError}</div>}
  {selectedModule === 'Products' ? <ProductsListPage products={products} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} onAddProduct={() => openModule('Add Product')} /> : selectedModule === 'Add Product' ? <AddProductPage products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onBack={() => openModule('Products')} /> : selectedModule === 'Inventory' ? <InventoryPage products={products} onAdjustStock={adjustStock} /> : <div className="dashboard-main">
          <div className="dashboard-intro"><div><p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Good morning, {displayName.split(' ')[0]}.</h1><p>Here is what is happening across your inventory today.</p></div><button className="date-filter">Current stock <span>⌄</span></button></div>

          <div className="summary-grid">
            {summaryCards.map(({ label, value, detail, icon: Icon, tone, module }) => <button className="summary-card" key={label} onClick={() => openModule(module)}><div className={`summary-icon ${tone}`}><Icon size={17} /></div><div className="summary-card__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className="card-arrow">↗</span></button>)}
          </div>

          <div className="dashboard-lower">
            <section className="panel pulse-panel"><div className="panel-heading"><div><p className="eyebrow">Live overview</p><h2>Warehouse pulse</h2></div><span className="status-pill"><i /> Live</span></div><div className="pulse-empty"><Boxes size={28} /><strong>{stockUnits.toLocaleString()} units currently tracked</strong><span>Stock movement history will appear here once the inventory API is connected.</span></div><div className="pulse-legend"><span><i className="dot-green" /> Available stock <strong>{stockUnits.toLocaleString()}</strong></span><span><i className="dot-orange" /> Low stock items <strong>{lowStockCount}</strong></span></div></section>
            <section className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">Recent updates</p><h2>Activity</h2></div><button className="text-button" onClick={() => openModule('Stock Movements')}>View all</button></div><div className="activity-empty"><Bell size={20} /><strong>No recent activity</strong><span>Activity will appear after stock movements and purchases are recorded.</span></div></section>
          </div>
        </div>}
      </section>
    </main>
  );
}

export { DashboardPage };
