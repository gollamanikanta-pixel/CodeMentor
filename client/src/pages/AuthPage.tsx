import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { resetPassword, requestPasswordReset } from '../api/client';
import { safeReturnPath } from '../routeManifest';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const COPY: Record<AuthMode, { eyebrow: string; title: string; blurb: string; submit: string }> = {
  login: {
    eyebrow: 'CODEMENTOR AI ACCOUNT',
    title: 'Welcome back',
    blurb: 'Log in to continue your learning workspace and sync your projects.',
    submit: 'Log In to CodeMentor AI',
  },
  register: {
    eyebrow: 'START LEARNING',
    title: 'Create your learning space',
    blurb: 'Local learning always works. An account connects your multi-file projects to your progress.',
    submit: 'Create My Account',
  },
  forgot: {
    eyebrow: 'ACCOUNT RECOVERY',
    title: 'Reset your password',
    blurb: 'We will provide safe next steps if the account exists — we never reveal whether it does.',
    submit: 'Send Reset Instructions',
  },
  reset: {
    eyebrow: 'CHOOSE A NEW PASSWORD',
    title: 'Set a new password',
    blurb: 'Use at least 8 characters for your new password.',
    submit: 'Reset Password',
  },
};

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({
    remember: true,
    acceptedTerms: false,
  });

  const copy = COPY[mode];
  const value = (key: string) => (form[key] as string) ?? '';
  const update = (key: string, next: string | boolean) => setForm((current) => ({ ...current, [key]: next }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const result = await login({ email: value('email'), password: value('password'), remember: form.remember !== false });
        if (!result.ok) throw new Error(result.message || 'Login failed.');
        navigate(safeReturnPath(params.get('next')), { replace: true });
      } else if (mode === 'register') {
        const result = await register({
          fullName: value('fullName'),
          email: value('email'),
          password: value('password'),
          confirmPassword: value('confirmPassword'),
          acceptedTerms: Boolean(form.acceptedTerms),
        });
        if (!result.ok) throw new Error(result.message || 'Registration failed.');
        navigate(safeReturnPath(params.get('next')), { replace: true });
      } else if (mode === 'forgot') {
        const { data } = await requestPasswordReset({ email: value('email') });
        setMessage(data.message || 'If an account exists for that email, password reset instructions have been prepared.');
      } else {
        const { ok, data } = await resetPassword({
          token: params.get('token') || '',
          password: value('password'),
          confirmPassword: value('confirmPassword'),
        });
        if (!ok) throw new Error(data.message || 'Reset failed.');
        setMessage(data.message || 'Password reset successfully. You can now log in.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Request could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <Logo />
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p className="auth-blurb">{copy.blurb}</p>

        {message ? (
          <div className="auth-notice" role="status">
            <Check size={18} aria-hidden="true" />
            <span>{message}</span>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' ? (
              <label>
                Full Name
                <input required minLength={2} value={value('fullName')} onChange={(e) => update('fullName', e.target.value)} autoComplete="name" />
              </label>
            ) : null}

            {mode !== 'reset' ? (
              <label>
                Email Address
                <input required type="email" value={value('email')} onChange={(e) => update('email', e.target.value)} autoComplete="email" />
              </label>
            ) : null}

            {mode !== 'forgot' ? (
              <>
                <label>
                  {mode === 'reset' ? 'New Password' : 'Password'}
                  <span className="password-field">
                    <input
                      required
                      minLength={8}
                      type={show ? 'text' : 'password'}
                      value={value('password')}
                      onChange={(e) => update('password', e.target.value)}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </span>
                </label>
                {mode === 'register' || mode === 'reset' ? (
                  <label>
                    Confirm Password
                    <input
                      required
                      minLength={8}
                      type={show ? 'text' : 'password'}
                      value={value('confirmPassword')}
                      onChange={(e) => update('confirmPassword', e.target.value)}
                      autoComplete="new-password"
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {mode === 'login' ? (
              <label className="check-row">
                <input type="checkbox" checked={form.remember !== false} onChange={(e) => update('remember', e.target.checked)} />
                Remember me
              </label>
            ) : null}

            {mode === 'register' ? (
              <label className="check-row">
                <input
                  required
                  type="checkbox"
                  checked={Boolean(form.acceptedTerms)}
                  onChange={(e) => update('acceptedTerms', e.target.checked)}
                />
                I accept the Terms and Privacy Policy.
              </label>
            ) : null}

            {error ? (
              <p className="auth-error" role="alert">
                <AlertCircle size={15} aria-hidden="true" /> {error}
              </p>
            ) : null}

            <Button type="submit" disabled={busy}>
              {busy ? 'Please wait…' : copy.submit}
            </Button>
          </form>
        )}

        <div className="auth-links">
          {mode === 'login' ? (
            <>
              <Link to="/register">Create an account</Link>
              <Link to="/forgot-password">Forgot password?</Link>
            </>
          ) : (
            <Link to="/login">Back to Login</Link>
          )}
          <Link to="/">Back to home</Link>
        </div>

        <p className="auth-footnote">
          <ShieldCheck size={14} aria-hidden="true" /> Local-first: your editor and analysis work with or without an account.
        </p>
      </div>
    </div>
  );
}
