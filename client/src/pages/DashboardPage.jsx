import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CircleUserRound,
  ClipboardList,
  ChevronDown,
  Clock,
  Contact,
  DollarSign,
  LayoutDashboard,
  LineChart,
  LogOut,
  Mail,
  Menu,
  Package,
  PanelLeftClose,
  Search,
  Plus,
  Settings as SettingsIcon,
  SlidersHorizontal,
  ShoppingCart,
  Tags,
  Truck,
  User,
  UsersRound,
  X,
} from 'lucide-react';
import { AddProductPage } from './AddProductPage';
import { CategoriesPage } from './CategoriesPage';
import { SuppliersPage } from './SuppliersPage';
import { CustomersPage } from './CustomersPage';
import { PurchaseOrdersPage } from './PurchaseOrdersPage';
import { SalesOrdersPage } from './SalesOrdersPage';
import { StockMovementsPage } from './StockMovementsPage';
import { ReportsPage } from './ReportsPage';
import { UsersRolesPage } from './UsersRolesPage';
import { SettingsPage } from './SettingsPage';
import { ProductsListPage } from './ProductsListPage';
import { InventoryPage } from './InventoryPage';
import { adjustProductStock, createProduct, deleteProduct as deleteProductRequest, getInventoryMovements, getProducts, resendVerificationEmail, updateProduct as updateProductRequest, verifyEmail } from '../api';
import { SettingsProvider, useSettings } from '../settingsContext';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Products', icon: Package },
  { label: 'Add Product', icon: Plus, separated: false },
  { label: 'Inventory', icon: Boxes },
  { label: 'Categories', icon: Tags },
  { label: 'Suppliers', icon: Truck, separated: true },
  { label: 'Customers', icon: Contact },
  { label: 'Purchase Orders', icon: ClipboardList, separated: true },
  { label: 'Sales', icon: ShoppingCart },
  { label: 'Stock Movements', icon: LineChart, separated: true },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Users & Roles', icon: UsersRound, separated: true },
  { label: 'Settings', icon: SettingsIcon },
];

function relativeTime(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function DashboardPage(props) {
  return (
    <SettingsProvider>
      <DashboardContent {...props} />
    </SettingsProvider>
  );
}

function DashboardContent({ user, onLogout, onProfileUpdated }) {
  const { currencySymbol } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productsSearchTerm, setProductsSearchTerm] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dateRange, setDateRange] = useState('Current stock');
  const [selectedModule, setSelectedModule] = useState('Dashboard');
  const [products, setProducts] = useState([]);
  const [productError, setProductError] = useState('');
  const [recentMovements, setRecentMovements] = useState([]);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState('');
  const [verificationOtp, setVerificationOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const productCount = products.length;
  const stockUnits = products.reduce((total, product) => total + (Number(product.stockPresent) || 0), 0);
  const inventoryValue = products.reduce((total, product) => total + ((Number(product.itemPrice) || 0) * (Number(product.stockPresent) || 0)), 0);
  const outOfStockItems = products.filter((product) => Number(product.stockPresent) === 0);
  const lowStockItems = products.filter((product) => Number(product.stockPresent) > 0 && Number(product.stockPresent) <= Number(product.thresholdStock));
  const expiringSoonItems = products.filter((product) => {
    if (!product.expiryDate) return false;
    const daysUntilExpiry = (new Date(product.expiryDate) - new Date()) / 86400000;
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
  });
  const lowStockCount = lowStockItems.length;
  const outOfStockCount = outOfStockItems.length;
  const expiringSoonCount = expiringSoonItems.length;
  const inventoryAlerts = lowStockCount + outOfStockCount + expiringSoonCount;
  const notifications = [
    ...outOfStockItems.map((product) => ({ id: `out-${product.id}`, icon: X, tone: 'red', title: `${product.itemName} is out of stock`, message: 'Replenish stock to avoid missed sales.' })),
    ...lowStockItems.map((product) => ({ id: `low-${product.id}`, icon: AlertTriangle, tone: 'orange', title: `${product.itemName} is running low`, message: `${product.stockPresent} units left (threshold ${product.thresholdStock}).` })),
    ...expiringSoonItems.map((product) => ({ id: `exp-${product.id}`, icon: Clock, tone: 'pink', title: `${product.itemName} expires soon`, message: `Expires on ${product.expiryDate}.` })),
  ];
  const searchResults = searchQuery.trim()
    ? products.filter((item) => `${item.itemName} ${item.hsn} ${item.itemCategory}`.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 6)
    : [];
  const summaryCards = [
    { label: 'Products', value: productCount.toLocaleString(), detail: 'Cataloged products', icon: Package, tone: 'green', module: 'Products' },
    { label: 'Stock units', value: stockUnits.toLocaleString(), detail: 'Current available units', icon: Boxes, tone: 'blue', module: 'Inventory' },
    { label: 'Inventory value', value: `${currencySymbol}${inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, detail: 'Price × current stock', icon: DollarSign, tone: 'gold', module: 'Inventory' },
    { label: 'Low stock', value: lowStockCount.toLocaleString(), detail: 'At or below threshold', icon: AlertTriangle, tone: 'orange', module: 'Inventory' },
    { label: 'Out of stock', value: outOfStockCount.toLocaleString(), detail: 'Requires replenishment', icon: X, tone: 'red', module: 'Inventory' },
    { label: 'Expiring soon', value: expiringSoonCount.toLocaleString(), detail: 'Within the next 30 days', icon: Bell, tone: 'pink', module: 'Inventory' },
  ];
  const displayName = user?.fullName || 'User';
  const initials = displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const refreshProducts = async () => {
    try {
      const nextProducts = await getProducts();
      setProducts(nextProducts);
      setProductError('');
    } catch (error) {
      setProductError(error.message || 'Unable to load products');
    }
  };

  const refreshMovements = async () => {
    try {
      setRecentMovements(await getInventoryMovements({ limit: 50 }));
    } catch {
      // Non-critical for the dashboard home view; the Stock Movements page surfaces its own errors.
    }
  };

  const refreshStockActivity = async () => {
    await Promise.all([refreshProducts(), refreshMovements()]);
  };

  useEffect(() => {
    refreshProducts();
    refreshMovements();
  }, []);

  const openModule = (module) => {
    setSelectedModule(module);
    setIsMenuOpen(false);
  };

  const goToProduct = (product) => {
    setProductsSearchTerm(product.itemName);
    setSearchQuery('');
    setIsSearchOpen(false);
    openModule('Products');
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (searchResults.length) {
      goToProduct(searchResults[0]);
    } else if (searchQuery.trim()) {
      setProductsSearchTerm(searchQuery.trim());
      setSearchQuery('');
      setIsSearchOpen(false);
      openModule('Products');
    }
  };

  const toggleSearch = () => {
    setIsSearchOpen((open) => !open);
    setIsNotificationsOpen(false);
    setIsUserMenuOpen(false);
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen((open) => !open);
    setIsSearchOpen(false);
    setIsUserMenuOpen(false);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen((open) => !open);
    setIsSearchOpen(false);
    setIsNotificationsOpen(false);
  };

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    setVerificationNotice('');
    try {
      const result = await resendVerificationEmail();
      if (result.alreadyVerified) {
        onProfileUpdated?.({ emailVerified: true });
      } else {
        setVerificationNotice('Verification email sent. Check your inbox.');
      }
    } catch (error) {
      setVerificationNotice(error.message || 'Unable to resend verification email');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setIsVerifyingOtp(true);
    setVerificationNotice('');
    try {
      await verifyEmail(verificationOtp.trim());
      setVerificationOtp('');
      onProfileUpdated?.({ emailVerified: true });
    } catch (error) {
      setVerificationNotice(error.message || 'Invalid or expired code');
    } finally {
      setIsVerifyingOtp(false);
    }
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

  const adjustStock = async (id, stockPresent, reason = '') => {
    const updatedStock = await adjustProductStock(id, stockPresent, reason);
    setProducts((current) => current.map((product) => product.id === updatedStock.id ? { ...product, ...updatedStock } : product));
    refreshMovements();
  };

  return (
    <main className="dashboard-page">
      {isMenuOpen && <button className="drawer-backdrop" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" />}
      <aside className={`dashboard-sidebar ${isMenuOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand"><div className="brand-mark"><Package size={18} /></div><span>StockIt</span><button className="drawer-close" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button></div>
        <nav className="dashboard-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, separated }) => (
            <button
              className={`${selectedModule === label ? 'is-active' : ''} ${separated ? 'is-separated' : ''}`}
              key={label}
              onClick={() => openModule(label)}
            >
              <Icon size={17} />
              <span>{label}</span>
              {label === 'Inventory' && inventoryAlerts > 0 && <span className="nav-badge">{inventoryAlerts}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer"><div className="avatar">{initials}</div><div><strong>{displayName}</strong><span>{user?.role || 'Administrator'}</span></div><button aria-label="Open settings" onClick={() => openModule('Settings')}><SettingsIcon size={16} /></button></div>
      </aside>

      <section className="dashboard-content">
        <div className="stock-symbols" aria-hidden="true" />
        <header className="dashboard-header">
          <button className="menu-button" onClick={() => setIsMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="dashboard-title"><span>Inventory Management</span><strong>{selectedModule}</strong></div>
          <div className="header-actions">
            <div className="search-menu">
              <button className="search-button" aria-label="Search inventory" onClick={toggleSearch} aria-expanded={isSearchOpen} aria-haspopup="true"><Search size={18} /></button>
              {isSearchOpen && (
                <div className="search-dropdown" role="search">
                  <form className="search-dropdown__input" onSubmit={handleSearchSubmit}>
                    <Search size={15} />
                    <input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products, HSN, category" aria-label="Search inventory" />
                  </form>
                  {searchQuery.trim() && (
                    searchResults.length ? (
                      <ul className="search-results" role="listbox">
                        {searchResults.map((product) => (
                          <li key={product.id}>
                            <button type="button" onClick={() => goToProduct(product)}>
                              <strong>{product.itemName}</strong>
                              <span>{product.itemCategory || 'Uncategorized'} · {product.stockPresent || 0} in stock</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <div className="search-empty">No products match "{searchQuery}".</div>
                  )}
                </div>
              )}
            </div>
            <div className="notification-menu">
              <button className="notification-button" aria-label="View notifications" onClick={toggleNotifications} aria-expanded={isNotificationsOpen} aria-haspopup="true"><Bell size={18} />{notifications.length > 0 && <i />}</button>
              {isNotificationsOpen && (
                <div className="notification-dropdown" role="menu">
                  <div className="notification-dropdown__heading"><strong>Notifications</strong><span>{notifications.length} alert{notifications.length === 1 ? '' : 's'}</span></div>
                  {notifications.length ? (
                    <ul className="notification-list">
                      {notifications.slice(0, 8).map(({ id, icon: Icon, tone, title, message }) => (
                        <li key={id}>
                          <button type="button" onClick={() => { openModule('Inventory'); setIsNotificationsOpen(false); }}>
                            <span className={`notification-icon ${tone}`}><Icon size={14} /></span>
                            <span className="notification-copy"><strong>{title}</strong><small>{message}</small></span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <div className="notification-empty">You're all caught up. No alerts right now.</div>}
                  {notifications.length > 0 && <button className="text-button notification-view-all" onClick={() => { openModule('Inventory'); setIsNotificationsOpen(false); }}>View all in Inventory</button>}
                </div>
              )}
            </div>
            <div className="user-menu">
              <button className="header-user" onClick={toggleUserMenu} aria-expanded={isUserMenuOpen} aria-haspopup="menu"><CircleUserRound size={28} strokeWidth={1.4} className="header-user__icon" /><span>{user?.role || 'Admin'}</span><ChevronDown size={14} /></button>
              {isUserMenuOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="user-dropdown__identity"><strong>{displayName}</strong><span>{user?.email || 'Account'}</span></div>
                  <button className="user-dropdown__item" onClick={() => { openModule('Settings'); setIsUserMenuOpen(false); }} role="menuitem"><User size={15} /> View profile</button>
                  <button className="user-dropdown__logout" onClick={onLogout} role="menuitem"><LogOut size={15} /> Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

  {user && !user.emailVerified && (
    <div className="verify-banner">
      <span><Mail size={15} /> <strong>Verify your email</strong> — enter the code sent to {user.email}.{verificationNotice ? ` ${verificationNotice}` : ''}</span>
      <form className="verify-banner__form" onSubmit={handleVerifyOtp}>
        <input value={verificationOtp} onChange={(event) => setVerificationOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        <button type="submit" disabled={isVerifyingOtp || verificationOtp.length !== 6}>{isVerifyingOtp ? 'Verifying...' : 'Verify'}</button>
        <button type="button" onClick={handleResendVerification} disabled={isResendingVerification}>{isResendingVerification ? 'Sending...' : 'Resend'}</button>
      </form>
    </div>
  )}
  {productError && <div className="dashboard-error">{productError}</div>}
  {selectedModule === 'Products' ? <ProductsListPage products={products} onUpdateProduct={updateProduct} onDeleteProduct={deleteProduct} onAddProduct={() => openModule('Add Product')} initialSearchTerm={productsSearchTerm} />
    : selectedModule === 'Add Product' ? <AddProductPage products={products} onAddProduct={addProduct} onUpdateProduct={updateProduct} onBack={() => openModule('Products')} />
    : selectedModule === 'Inventory' ? <InventoryPage products={products} onAdjustStock={adjustStock} />
    : selectedModule === 'Categories' ? <CategoriesPage products={products} onCategoryChange={refreshProducts} />
    : selectedModule === 'Suppliers' ? <SuppliersPage products={products} />
    : selectedModule === 'Customers' ? <CustomersPage />
    : selectedModule === 'Purchase Orders' ? <PurchaseOrdersPage products={products} onOrdersChanged={refreshStockActivity} />
    : selectedModule === 'Sales' ? <SalesOrdersPage products={products} onOrdersChanged={refreshStockActivity} />
    : selectedModule === 'Stock Movements' ? <StockMovementsPage products={products} />
    : selectedModule === 'Reports' ? <ReportsPage />
    : selectedModule === 'Users & Roles' ? <UsersRolesPage />
    : selectedModule === 'Settings' ? <SettingsPage user={user} onProfileUpdated={onProfileUpdated} />
    : <div className="dashboard-main">
          <div className="dashboard-intro"><div><p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p><h1>Good morning, {displayName.split(' ')[0]}.</h1><p>Here is what is happening across your inventory today.</p></div><div className="filter-menu"><button className="date-filter" onClick={() => setIsFilterOpen(!isFilterOpen)} aria-expanded={isFilterOpen} aria-haspopup="menu">{dateRange} <ChevronDown size={14} /></button>{isFilterOpen && <div className="filter-options" role="menu"><button onClick={() => { setDateRange('Current stock'); setIsFilterOpen(false); }}>Current stock</button><button onClick={() => { setDateRange('Last 7 days'); setIsFilterOpen(false); }}>Last 7 days</button><button onClick={() => { setDateRange('Last 30 days'); setIsFilterOpen(false); }}>Last 30 days</button></div>}</div></div>

          <div className="summary-grid">
            {summaryCards.map(({ label, value, detail, icon: Icon, tone, module }) => <button className="summary-card" key={label} onClick={() => openModule(module)}><div className={`summary-icon ${tone}`}><Icon size={17} /></div><div className="summary-card__copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><span className="card-arrow">↗</span></button>)}
          </div>

          <div className="dashboard-lower">
            <section className="panel pulse-panel">
              <div className="panel-heading"><div><p className="eyebrow">Live overview</p><h2>Warehouse pulse</h2></div><span className="status-pill"><i /> Live</span></div>
              {recentMovements.length ? (
                <div className="pulse-empty">
                  <Boxes size={28} />
                  <strong>{stockUnits.toLocaleString()} units currently tracked</strong>
                  <span>
                    {(() => {
                      const sevenDaysAgo = Date.now() - 7 * 86400000;
                      const recent = recentMovements.filter((movement) => new Date(movement.createdAt).getTime() >= sevenDaysAgo);
                      const netChange = recent.reduce((total, movement) => total + movement.quantityChange, 0);
                      return `${netChange >= 0 ? '+' : ''}${netChange} units net change across ${recent.length} movement${recent.length === 1 ? '' : 's'} in the last 7 days.`;
                    })()}
                  </span>
                </div>
              ) : (
                <div className="pulse-empty"><Boxes size={28} /><strong>{stockUnits.toLocaleString()} units currently tracked</strong><span>Stock movement history will appear here once purchases, sales, or adjustments are recorded.</span></div>
              )}
              <div className="pulse-legend"><span><i className="dot-green" /> Available stock <strong>{stockUnits.toLocaleString()}</strong></span><span><i className="dot-orange" /> Low stock items <strong>{lowStockCount}</strong></span></div>
            </section>
            <section className="panel activity-panel">
              <div className="panel-heading"><div><p className="eyebrow">Recent updates</p><h2>Activity</h2></div><button className="text-button" onClick={() => openModule('Stock Movements')}>View all</button></div>
              {recentMovements.length ? (
                <div className="activity-list">
                  {recentMovements.slice(0, 6).map((movement) => (
                    <button className="activity-item" key={movement.id} onClick={() => openModule('Stock Movements')}>
                      <div className={`activity-icon ${movement.movementType === 'purchase' ? 'purchase' : movement.movementType === 'sale' ? 'sale' : 'alert'}`}>
                        {movement.movementType === 'purchase' ? <ClipboardList size={14} /> : movement.movementType === 'sale' ? <ShoppingCart size={14} /> : <SlidersHorizontal size={14} />}
                      </div>
                      <div className="activity-copy">
                        <strong>{movement.itemName}</strong>
                        <small>{movement.movementType === 'purchase' ? 'Received' : movement.movementType === 'sale' ? 'Sold' : 'Adjusted'} {Math.abs(movement.quantityChange)} units</small>
                      </div>
                      <time>{relativeTime(movement.createdAt)}</time>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="activity-empty"><Bell size={20} /><strong>No recent activity</strong><span>Activity will appear after stock movements and purchases are recorded.</span></div>
              )}
            </section>
          </div>
        </div>}
      </section>
    </main>
  );
}

export { DashboardPage };
