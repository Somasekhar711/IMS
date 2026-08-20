import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <div className="form-heading">
        <p className="eyebrow">Welcome back</p>
        <h2>Good to see you again.</h2>
        <p>Sign in to pick up where your inventory left off.</p>
      </div>

      <form onSubmit={(event) => event.preventDefault()}>
        <label className="field">
          <span>Work email</span>
          <div className="input-wrap"><Mail size={18} /><input type="email" placeholder="you@company.com" autoComplete="email" /></div>
        </label>
        <label className="field">
          <span>Password</span>
          <div className="input-wrap"><LockKeyhole size={18} /><input type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" /><button className="input-action" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </label>
        <div className="form-options"><label className="remember"><input type="checkbox" /> <span>Remember me</span></label><a href="#forgot">Forgot password?</a></div>
        <button className="submit-button" type="submit">Enter workspace <ArrowRight size={18} /></button>
      </form>
    </>
  );
}
