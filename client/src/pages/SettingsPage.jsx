import { useEffect, useState } from 'react';
import { Check, KeyRound, Save, ShieldQuestion, Sliders, User, X } from 'lucide-react';
import { getSecurityQuestions, updatePassword, updateProfile, updateSecurityQuestion, updateSettings } from '../api';
import { useSettings } from '../settingsContext';

const currencyOptions = ['₹', '$', '€', '£', '¥'];

function SettingsPage({ user, onProfileUpdated }) {
  const { currencySymbol, lowStockAlertEnabled, phone, setSettings } = useSettings();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [preferences, setPreferences] = useState({ phone, currencySymbol, lowStockAlertEnabled });
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [preferencesError, setPreferencesError] = useState('');

  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');

  useEffect(() => {
    getSecurityQuestions().then((questions) => {
      setSecurityQuestions(questions);
      setSecurityQuestion((current) => current || questions[0] || '');
    }).catch(() => {});
  }, []);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage('');
    setProfileError('');
    try {
      const updated = await updateProfile(fullName.trim());
      if (onProfileUpdated) onProfileUpdated(updated);
      setProfileMessage('Profile updated successfully');
    } catch (error) {
      setProfileError(error.message || 'Unable to update profile');
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error.message || 'Unable to update password');
    }
  };

  const handleSecuritySubmit = async (event) => {
    event.preventDefault();
    setSecurityMessage('');
    setSecurityError('');
    try {
      await updateSecurityQuestion(securityPassword, securityQuestion, securityAnswer);
      setSecurityMessage('Security question updated successfully');
      setSecurityPassword('');
      setSecurityAnswer('');
    } catch (error) {
      setSecurityError(error.message || 'Unable to update security question');
    }
  };

  const handlePreferencesSubmit = async (event) => {
    event.preventDefault();
    setPreferencesMessage('');
    setPreferencesError('');
    try {
      const saved = await updateSettings(preferences);
      setSettings((current) => ({ ...current, ...saved }));
      setPreferencesMessage('Preferences saved successfully');
    } catch (error) {
      setPreferencesError(error.message || 'Unable to save preferences');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Settings</h1>
          <p>Manage your profile, password, and how StockIt displays for you.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="product-panel panel settings-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Identity</p><h2>Profile</h2></div>
            <User size={19} color="#63866f" />
          </div>
          <form className="product-form" style={{ gridTemplateColumns: '1fr' }} onSubmit={handleProfileSubmit}>
            <label className="field">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={user?.email || ''} readOnly />
            </label>
            <label className="field">
              <span>Role</span>
              <input value={user?.role || ''} readOnly />
            </label>
            <div className="supplier-form-actions">
              <button className="submit-button product-submit" type="submit"><Save size={15} /> Save profile</button>
            </div>
          </form>
          {profileMessage && <p className="update-message is-success"><Check size={13} /> {profileMessage}</p>}
          {profileError && <p className="update-message is-error"><X size={13} /> {profileError}</p>}
        </section>

        <section className="product-panel panel settings-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Security</p><h2>Password</h2></div>
            <KeyRound size={19} color="#63866f" />
          </div>
          <form className="product-form" style={{ gridTemplateColumns: '1fr' }} onSubmit={handlePasswordSubmit}>
            <label className="field">
              <span>Current password</span>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label className="field">
              <span>New password</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
            </label>
            <div className="supplier-form-actions">
              <button className="submit-button product-submit" type="submit"><KeyRound size={15} /> Update password</button>
            </div>
          </form>
          {passwordMessage && <p className="update-message is-success"><Check size={13} /> {passwordMessage}</p>}
          {passwordError && <p className="update-message is-error"><X size={13} /> {passwordError}</p>}
        </section>

        <section className="product-panel panel settings-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Recovery</p><h2>Security question</h2></div>
            <ShieldQuestion size={19} color="#63866f" />
          </div>
          <form className="product-form" style={{ gridTemplateColumns: '1fr' }} onSubmit={handleSecuritySubmit}>
            <label className="field">
              <span>Current password</span>
              <input type="password" value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} required />
            </label>
            <label className="field">
              <span>Security question</span>
              <select value={securityQuestion} onChange={(event) => setSecurityQuestion(event.target.value)} required>
                {securityQuestions.map((question) => <option value={question} key={question}>{question}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Security answer</span>
              <input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Your answer" autoComplete="off" required />
            </label>
            <div className="supplier-form-actions">
              <button className="submit-button product-submit" type="submit"><ShieldQuestion size={15} /> Update security question</button>
            </div>
          </form>
          {securityMessage && <p className="update-message is-success"><Check size={13} /> {securityMessage}</p>}
          {securityError && <p className="update-message is-error"><X size={13} /> {securityError}</p>}
        </section>

        <section className="product-panel panel settings-card full">
          <div className="panel-heading">
            <div><p className="eyebrow">Preferences</p><h2>Display &amp; alerts</h2></div>
            <Sliders size={19} color="#63866f" />
          </div>
          <form onSubmit={handlePreferencesSubmit}>
            <div className="product-form" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))', marginTop: 20 }}>
              <label className="field">
                <span>Phone</span>
                <input value={preferences.phone} onChange={(event) => setPreferences((current) => ({ ...current, phone: event.target.value }))} placeholder="Business phone number" maxLength={40} />
              </label>
              <label className="field">
                <span>Currency symbol</span>
                <select value={preferences.currencySymbol} onChange={(event) => setPreferences((current) => ({ ...current, currencySymbol: event.target.value }))}>
                  {currencyOptions.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
                </select>
              </label>
            </div>

            <div className="toggle-row">
              <div><strong>Low stock alerts</strong><span>Highlight low and out-of-stock items across the dashboard</span></div>
              <label className="toggle-switch">
                <input type="checkbox" checked={preferences.lowStockAlertEnabled} onChange={(event) => setPreferences((current) => ({ ...current, lowStockAlertEnabled: event.target.checked }))} />
                <span className="toggle-track" />
                <span className="toggle-thumb" />
              </label>
            </div>

            <div className="supplier-form-actions" style={{ marginTop: 16 }}>
              <button className="submit-button product-submit" type="submit"><Save size={15} /> Save preferences</button>
            </div>
          </form>
          {preferencesMessage && <p className="update-message is-success"><Check size={13} /> {preferencesMessage}</p>}
          {preferencesError && <p className="update-message is-error"><X size={13} /> {preferencesError}</p>}
        </section>
      </div>
    </div>
  );
}

export { SettingsPage };
