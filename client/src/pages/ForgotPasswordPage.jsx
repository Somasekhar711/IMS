import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, X } from 'lucide-react';
import { forgotPassword, resetPassword } from '../api';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'One capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function ForgotPasswordPage({ onBackToLogin }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const isPasswordValid = passwordRules.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleRequestCode = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setStep('reset');
    } catch (submitError) {
      setError(submitError.message || 'Unable to send reset code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setNotice('');
    try {
      await forgotPassword(email.trim());
      setNotice('A new code has been sent.');
    } catch (resendError) {
      setError(resendError.message || 'Unable to resend code');
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setError('');
    setIsSubmitting(true);
    try {
      await resetPassword(email.trim(), otp.trim(), password);
      setStep('done');
    } catch (submitError) {
      setError(submitError.message || 'Unable to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <>
        <div className="form-heading">
          <p className="eyebrow">Account recovery</p>
          <h2>Password reset.</h2>
          <p>Your password has been updated.</p>
        </div>
        <div className="auth-success"><Check size={16} /> You can now sign in with your new password.</div>
        <button className="submit-button" type="button" onClick={onBackToLogin} style={{ marginTop: 19 }}>Sign in <ArrowRight size={18} /></button>
      </>
    );
  }

  if (step === 'reset') {
    return (
      <>
        <div className="form-heading">
          <p className="eyebrow">Account recovery</p>
          <h2>Enter your code.</h2>
          <p>We sent a 6-digit code to <strong>{email}</strong>. It expires in 10 minutes.</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-success"><Check size={16} /> {notice}</div>}

        <form onSubmit={handleResetSubmit}>
          <label className="field">
            <span>Verification code</span>
            <div className="input-wrap"><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></div>
          </label>
          <label className="field">
            <span>New password</span>
            <div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Create a new password" autoComplete="new-password" required /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          </label>
          <div className="password-rules" aria-live="polite">
            {passwordRules.map((rule) => {
              const isValid = rule.test(password);
              return <span className={isValid ? 'is-valid' : 'is-invalid'} key={rule.label}>{isValid ? <Check size={13} /> : <X size={13} />}{rule.label}</span>;
            })}
          </div>
          <label className="field">
            <span>Confirm new password</span>
            <div className={`input-wrap ${confirmPassword && !passwordsMatch ? 'has-error' : ''}`}><LockKeyhole size={18} /><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat your new password" autoComplete="new-password" aria-invalid={confirmPassword.length > 0 && !passwordsMatch} required /><button className="input-action" type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            {confirmPassword && <small className={passwordsMatch ? 'match-message' : 'error-message'}>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</small>}
          </label>
          <button className="submit-button" type="submit" disabled={!isPasswordValid || !passwordsMatch || isSubmitting}>{isSubmitting ? 'Resetting...' : 'Reset password'} <ArrowRight size={18} /></button>
        </form>

        <p className="mode-prompt"><button type="button" className="link-button" onClick={handleResendCode}>Resend code</button> · <button type="button" onClick={() => setStep('email')}>Use a different email</button></p>
      </>
    );
  }

  return (
    <>
      <div className="form-heading">
        <p className="eyebrow">Account recovery</p>
        <h2>Reset your password.</h2>
        <p>Enter the email on your account and we will send a 6-digit code to reset your password.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleRequestCode}>
        <label className="field">
          <span>Work email</span>
          <div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
        </label>
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send code'} <ArrowRight size={18} /></button>
      </form>

      <p className="mode-prompt"><button type="button" onClick={onBackToLogin}><ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to sign in</button></p>
    </>
  );
}
