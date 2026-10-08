import { StrictMode, useState } from 'react';
import { LockKeyhole, Package } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { login, register } from './api';
import './styles.css';

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
  const [authError, setAuthError] = useState('');

  const switchMode = (nextView) => {
    setAuthView(nextView);
    setAuthError('');
  };

  const handleLogin = async (email, password) => {
    try {
      const user = await login(email, password);
      localStorage.setItem('stockit_token', user.token);
      localStorage.setItem('stockit_user', JSON.stringify(user));
      setCurrentUser(user);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    }
  };

  const handleRegister = async (fullName, email, password, securityQuestion, securityAnswer) => {
    try {
      const user = await register(fullName, email, password, securityQuestion, securityAnswer);
      localStorage.setItem('stockit_token', user.token);
      localStorage.setItem('stockit_user', JSON.stringify(user));
      setCurrentUser(user);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Registration failed');
    }
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

          {authView === 'forgot' ? (
            <ForgotPasswordPage onBackToLogin={() => switchMode('login')} />
          ) : (
            <>
              <div className="mode-switch" role="tablist" aria-label="Authentication mode">
                <button className={authView === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')} role="tab" aria-selected={authView === 'login'}>Sign in</button>
                <button className={authView === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')} role="tab" aria-selected={authView === 'register'}>Create account</button>
              </div>

              {authView === 'register' ? (
                <RegisterPage onRegister={handleRegister} error={authError} />
              ) : (
                <LoginPage onLogin={handleLogin} error={authError} onForgotPassword={() => switchMode('forgot')} />
              )}

              <p className="mode-prompt">{authView === 'register' ? 'Already have an account?' : 'New to StockIt?'} <button onClick={() => switchMode(authView === 'register' ? 'login' : 'register')}>{authView === 'register' ? 'Sign in' : 'Create an account'}</button></p>
            </>
          )}

          <p className="security-note"><LockKeyhole size={14} /> Your data is encrypted and private.</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
