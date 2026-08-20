import { StrictMode, useState } from 'react';
import { LockKeyhole, Package } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import './styles.css';

function App() {
  const [isRegistering, setIsRegistering] = useState(false);
  const switchMode = (registering) => {
    setIsRegistering(registering);
  };

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

        <div className="brand-panel__footer"><span>01</span><span className="footer-line" /><span>Make room for better stock decisions.</span></div>
      </section>

      <section className="form-panel">
        <div className="form-panel__inner">
          <div className="mobile-brand"><div className="brand-mark"><Package size={18} /></div><span>StockIt</span></div>
          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button className={!isRegistering ? 'is-active' : ''} onClick={() => switchMode(false)} role="tab" aria-selected={!isRegistering}>Sign in</button>
            <button className={isRegistering ? 'is-active' : ''} onClick={() => switchMode(true)} role="tab" aria-selected={isRegistering}>Create account</button>
          </div>

          {isRegistering ? <RegisterPage /> : <LoginPage />}

          <p className="mode-prompt">{isRegistering ? 'Already have an account?' : 'New to StockIt?'} <button onClick={() => switchMode(!isRegistering)}>{isRegistering ? 'Sign in' : 'Create an account'}</button></p>
          <p className="security-note"><LockKeyhole size={14} /> Your data is encrypted and private.</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
