import { StrictMode, useState } from 'react';
import { LockKeyhole, Package } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { EmployeeLoginPage } from './pages/EmployeeLoginPage';
import { ForceEmployeePasswordChange } from './pages/ForceEmployeePasswordChange';
import { DashboardPage } from './pages/DashboardPage';
import { login, register, employeeLogin } from './api';
import './styles.css';

// Who is signing in: the account owner (admin) or a team member, by role.
const authTabs = [
  { view: 'login', label: 'Admin' },
  { view: 'manager', label: 'Manager' },
  { view: 'employee', label: 'Employee' },
  { view: 'register', label: 'Create account' },
];

function App() {
  const [authView, setAuthView] = useState('login');
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('stockit_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('stockit_user') || 'null');
    } catch {
      return null;
    }
  });
  const [pendingEmployeeChange, setPendingEmployeeChange] = useState(null);
  const [authError, setAuthError] = useState('');

  const switchMode = (nextView) => {
    setAuthView(nextView);
    setAuthError('');
  };

  const persistSession = (user) => {
    localStorage.setItem('stockit_token', user.token);
    localStorage.setItem('stockit_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogin = async (email, password) => {
    try {
      const user = await login(email, password);
      persistSession(user);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    }
  };

  const handleRegister = async (fullName, email, password, securityQuestion, securityAnswer) => {
    try {
      const user = await register(fullName, email, password, securityQuestion, securityAnswer);
      persistSession(user);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Registration failed');
    }
  };

  const handleEmployeeLogin = async (warehouseId, empId, password, portal) => {
    try {
      const user = await employeeLogin(warehouseId, empId, password, portal);
      persistSession(user);
      setAuthError('');
      if (user.mustChangePassword) {
        setPendingEmployeeChange({ tempPassword: password });
      } else {
        setIsLoggedIn(true);
      }
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    }
  };

  const handleEmployeePasswordChanged = () => {
    setCurrentUser((current) => {
      const next = { ...current, mustChangePassword: false };
      localStorage.setItem('stockit_user', JSON.stringify(next));
      return next;
    });
    setPendingEmployeeChange(null);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('stockit_token');
    localStorage.removeItem('stockit_user');
    setCurrentUser(null);
    setIsLoggedIn(false);
  };

  const handleProfileUpdated = (updatedUser) => {
    setCurrentUser((current) => {
      const next = { ...current, ...updatedUser };
      localStorage.setItem('stockit_user', JSON.stringify(next));
      return next;
    });
  };

  if (isLoggedIn) {
    return <DashboardPage user={currentUser} onLogout={handleLogout} onProfileUpdated={handleProfileUpdated} />;
  }

  return (
    <main className="auth-page">
      <section className="brand-panel" aria-label="StockIt overview">
        <div className="brand-panel__topline">
          <div className="brand-mark" aria-hidden="true"><Package size={19} strokeWidth={2.4} /></div>
          <span>StockIt</span>
        </div>

        <div className="brand-panel__content">
          <p className="eyebrow">Inventory, in rhythm</p>
          <h1>Know what is moving before it moves.</h1>
          <p className="brand-panel__copy">A calmer command center for the products, people, and decisions behind your business.</p>

          <div className="inventory-card">
            <div className="inventory-card__header">
              <span>Warehouse pulse</span>
              <span className="live-indicator"><i /> Live</span>
            </div>
            <div className="inventory-card__visual">
              <div className="pulse-bars" aria-hidden="true">
                <span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span />
              </div>
              <div className="inventory-card__total"><strong>84.6%</strong><span>stock health</span></div>
            </div>
            <div className="inventory-card__footer"><span>+12.4% this month</span><span>Updated just now</span></div>
          </div>
        </div>


      </section>

      <section className="form-panel">
        <div className="form-panel__inner">
          <div className="mobile-brand"><div className="brand-mark"><Package size={18} /></div><span>StockIt</span></div>

          {pendingEmployeeChange ? (
            <ForceEmployeePasswordChange tempPassword={pendingEmployeeChange.tempPassword} onChanged={handleEmployeePasswordChanged} />
          ) : authView === 'forgot' ? (
            <ForgotPasswordPage onBackToLogin={() => switchMode('login')} />
          ) : (
            <>
              <div className="mode-switch" role="tablist" aria-label="Sign in as">
                {authTabs.map(({ view, label }) => (
                  <button key={view} className={authView === view ? 'is-active' : ''} onClick={() => switchMode(view)} role="tab" aria-selected={authView === view}>{label}</button>
                ))}
              </div>

              {authView === 'register' ? (
                <RegisterPage onRegister={handleRegister} error={authError} />
              ) : authView === 'manager' || authView === 'employee' ? (
                <EmployeeLoginPage key={authView} portal={authView} onLogin={handleEmployeeLogin} error={authError} />
              ) : (
                <LoginPage onLogin={handleLogin} error={authError} onForgotPassword={() => switchMode('forgot')} />
              )}

              {authView === 'login' && <p className="mode-prompt">New to StockIt? <button onClick={() => switchMode('register')}>Create an account</button></p>}
              {authView === 'register' && <p className="mode-prompt">Already have an account? <button onClick={() => switchMode('login')}>Sign in</button></p>}
            </>
          )}

          <p className="security-note"><LockKeyhole size={14} /> Your data is encrypted and private.</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
