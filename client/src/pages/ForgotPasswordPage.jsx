import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, X } from 'lucide-react';
import { getSecurityQuestionForEmail, resetPasswordWithSecurityAnswer } from '../api';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: 'One capital letter', test: (value) => /[A-Z]/.test(value) },
  { label: 'One number', test: (value) => /\d/.test(value) },
  { label: 'One special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export function ForgotPasswordPage({ onBackToLogin }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isPasswordValid = passwordRules.every((rule) => rule.test(password));
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleFindAccount = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await getSecurityQuestionForEmail(email.trim());
      setSecurityQuestion(result.securityQuestion);
      setStep('reset');
    } catch (submitError) {
      setError(submitError.message || 'Unable to find an account for that email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (event) => {
    event.preventDefault();
    if (!isPasswordValid || !passwordsMatch) return;
    setError('');
    setIsSubmitting(true);
    try {
      await resetPasswordWithSecurityAnswer(email.trim(), securityAnswer, password);
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
        <div className="update-message is-success"><Check size={14} /> You can now sign in with your new password.</div>
        <button className="submit-button" type="button" onClick={onBackToLogin} style={{ marginTop: 19 }}>Sign in <ArrowRight size={18} /></button>
      </>
    );
  }

  if (step === 'reset') {
    return (
      <>
        <div className="form-heading">
          <p className="eyebrow">Account recovery</p>
          <h2>Answer your security question.</h2>
          <p>{securityQuestion}</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleResetSubmit}>
          <label className="field">
            <span>Your answer</span>
            <div className="input-wrap"><input value={securityAnswer} onChange={(event) => setSecurityAnswer(event.target.value)} placeholder="Your answer" autoComplete="off" required /></div>
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

        <p className="mode-prompt"><button type="button" onClick={() => setStep('email')}>Use a different email</button></p>
      </>
    );
  }

  return (
    <>
      <div className="form-heading">
        <p className="eyebrow">Account recovery</p>
        <h2>Reset your password.</h2>
        <p>Enter the email on your account to answer your security question.</p>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleFindAccount}>
        <label className="field">
          <span>Work email</span>
          <div className="input-wrap"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
        </label>
        <button className="submit-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Checking...' : 'Continue'} <ArrowRight size={18} /></button>
      </form>

      <p className="mode-prompt"><button type="button" onClick={onBackToLogin}><ArrowLeft size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Back to sign in</button></p>
    </>
  );
}
