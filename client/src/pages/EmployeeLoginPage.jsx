import { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Hash, KeyRound, LockKeyhole } from 'lucide-react';
import { employeeLogin } from '../api';

export function EmployeeLoginPage({ onLogin, onBackToLogin, error }) {
  const [warehouseId, setWarehouseId] = useState('');
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onLogin(warehouseId.trim(), empId.trim(), password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-heading">
        <p className="eyebrow">Team access</p>
        <h2>Employee sign in.</h2>
        <p>Enter the warehouse ID and employee ID your admin gave you.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Warehouse ID</span>
          <div className="input-wrap"><Hash size={18} /><input type="text" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} placeholder="WH-XXXXXX" autoComplete="off" required /></div>
        </label>
        <label className="field">
          <span>Employee ID</span>
          <div className="input-wrap"><KeyRound size={18} /><input type="text" value={empId} onChange={(event) => setEmpId(event.target.value)} placeholder="EMP001" autoComplete="off" required /></div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </label>
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'} <ArrowRight size={18} /></button>
      </form>

      <p className="mode-prompt"><button type="button" onClick={onBackToLogin}><ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to sign in</button></p>
    </>
  );
}
