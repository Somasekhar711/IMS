import { useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import { updateEmployeePassword } from '../api';

function EmployeeAccountPage({ user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }

    try {
      await updateEmployeePassword(currentPassword, newPassword);
      setPasswordMessage('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error.message || 'Unable to update password');
    }
  };

  return (
    <div className="product-page dashboard-main">
      <div className="product-intro">
        <div>
          <p className="eyebrow">Account</p>
          <h1>My Account</h1>
          <p>Employee ID {user?.empId} · Warehouse {user?.warehouseId}</p>
        </div>
      </div>

      <div className="settings-grid">
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
      </div>
    </div>
  );
}

export { EmployeeAccountPage };
