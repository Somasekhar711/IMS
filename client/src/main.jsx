import { StrictMode, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Package, UserRound } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const switchMode = (registering) => {
    setIsRegistering(registering);
    setShowPassword(false);
  };

  return (
    <main className="auth-page">
      <section className="brand-panel" aria-label="Stockroom overview">
        <div className="brand-panel__topline">
          <div className="brand-mark" aria-hidden="true"><Package size={19} strokeWidth={2.4} /></div>
          <span>stockroom</span>
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
          <div className="mobile-brand"><div className="brand-mark"><Package size={18} /></div><span>stockroom</span></div>
          <div className="mode-switch" role="tablist" aria-label="Authentication mode">
            <button className={!isRegistering ? 'is-active' : ''} onClick={() => switchMode(false)} role="tab" aria-selected={!isRegistering}>Sign in</button>
            <button className={isRegistering ? 'is-active' : ''} onClick={() => switchMode(true)} role="tab" aria-selected={isRegistering}>Create account</button>
          </div>

          <div className="form-heading">
            <p className="eyebrow">{isRegistering ? 'Start in minutes' : 'Welcome back'}</p>
            <h2>{isRegistering ? 'Set up your workspace.' : 'Good to see you again.'}</h2>
            <p>{isRegistering ? 'Create an account to bring your inventory into focus.' : 'Sign in to pick up where your inventory left off.'}</p>
          </div>

          <form onSubmit={(event) => event.preventDefault()}>
            {isRegistering && <label className="field"><span>Full name</span><div className="input-wrap"><UserRound size={18} /><input type="text" placeholder="Alex Morgan" autoComplete="name" /></div></label>}
            <label className="field"><span>Work email</span><div className="input-wrap"><Mail size={18} /><input type="email" placeholder="you@company.com" autoComplete="email" /></div></label>
            <label className="field"><span>Password</span><div className="input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete={isRegistering ? 'new-password' : 'current-password'} /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            {isRegistering ? <label className="terms"><input type="checkbox" /><span>I agree to the <a href="#terms">terms of service</a> and <a href="#privacy">privacy policy</a>.</span></label> : <div className="form-options"><label className="remember"><input type="checkbox" /> <span>Remember me</span></label><a href="#forgot">Forgot password?</a></div>}
            <button className="submit-button" type="submit">{isRegistering ? 'Create workspace' : 'Enter workspace'} <ArrowRight size={18} /></button>
          </form>

          <p className="mode-prompt">{isRegistering ? 'Already have an account?' : 'New to Stockroom?'} <button onClick={() => switchMode(!isRegistering)}>{isRegistering ? 'Sign in' : 'Create an account'}</button></p>
          <p className="security-note"><LockKeyhole size={14} /> Your data is encrypted and private.</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
