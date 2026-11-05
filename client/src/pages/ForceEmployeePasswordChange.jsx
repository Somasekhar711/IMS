import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, X } from 'lucide-react';
import { updateEmployeePassword } from '../api';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'One capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function ForceEmployeePasswordChange({ tempPassword, onChanged }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPasswordValid = passwordRules.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setError('');
    setIsSubmitting(true);
    try {
      await updateEmployeePassword(tempPassword, password);
      onChanged();
    } catch (submitError) {
      setError(submitError.message || 'Unable to update password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-heading">
        <p className="eyebrow">First sign in</p>
        <h2>Set a new password.</h2>
        <p>Your admin gave you a temporary password. Choose your own before continuing.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>New password</span>
          <div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Create a password" autoComplete="new-password" required autoFocus /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </label>
        <div className="password-rules" aria-live="polite">
          {passwordRules.map((rule) => {
            const isValid = rule.test(password);
            return <span className={isValid ? 'is-valid' : 'is-invalid'} key={rule.label}>{isValid ? <Check size={13} /> : <X size={13} />}{rule.label}</span>;
          })}
        </div>
        <label className="field">
          <span>Confirm password</span>
          <div className={`input-wrap ${confirmPassword && !passwordsMatch ? 'has-error' : ''}`}><LockKeyhole size={18} /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat your password" autoComplete="new-password" aria-invalid={confirmPassword.length > 0 && !passwordsMatch} required /><button className="input-action" type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {confirmPassword && <small className={passwordsMatch ? 'match-message' : 'error-message'}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</small>}
        </label>
        <button className="submit-button" type="submit" disabled={!isPasswordValid || !passwordsMatch || isSubmitting}>{isSubmitting ? 'Saving...' : 'Continue'} <ArrowRight size={18} /></button>
      </form>
    </>
  );
}
