import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from 'lucide-react';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'One capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function RegisterPage({ onRegister, error }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPasswordValid = passwordRules.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setIsSubmitting(true);
    try {
      await onRegister(fullName, email, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-heading form-heading--register">
        <p className="eyebrow">Start in minutes</p>
        <h2>Set up your workspace.</h2>
        <p>Create an account to bring your inventory into focus.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Full name</span>
          <div className="input-wrap"><UserRound size={18} /><input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" autoComplete="name" required /></div>
        </label>
        <label className="field">
          <span>Work email</span>
          <div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Create a password" autoComplete="new-password" required /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
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
        <label className="terms"><input type="checkbox" required /><span>I agree to the <a href="#terms">terms of service</a> and <a href="#privacy">privacy policy</a>.</span></label>
        <button className="submit-button" type="submit" disabled={!isPasswordValid || !passwordsMatch || isSubmitting}>{isSubmitting ? 'Creating...' : 'Create workspace'} <ArrowRight size={18} /></button>
      </form>
    </>
  );
}
