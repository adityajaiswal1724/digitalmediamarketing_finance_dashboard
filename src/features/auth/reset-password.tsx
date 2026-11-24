import { ArrowLeft, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import * as api from '../../api';
import { Logo } from '../../components/logo';
import { Button } from '../../components/ui/button';

export function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      setMessage((await api.requestPasswordReset(identifier)).message);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'The request could not be sent.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <button className="login-back" onClick={onBack}>
        <ArrowLeft size={15} /> Back to sign in
      </button>
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h2>Forgot your password?</h2>
      <p>Enter your Super Admin ID or authorized email address.</p>
      {message ? (
        <div className="auth-success" role="status">
          <Mail size={22} />
          <p>{message}</p>
          <small>The link expires in 30 minutes and can be used only once.</small>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>
            Admin ID or authorized email
            <input
              autoComplete="username"
              required
              maxLength={254}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="spin" size={17} /> Sending…
              </>
            ) : (
              'Send secure reset link'
            )}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPassword({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setError('The new passwords do not match.');
    setSubmitting(true);
    setError('');
    try {
      await api.resetPassword(token, password);
      window.history.replaceState({}, '', window.location.pathname);
      setComplete(true);
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : 'The password could not be reset.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <span className="eyebrow">SECURE PASSWORD RESET</span>
      <h2>{complete ? 'Password updated' : 'Create a new password'}</h2>
      {complete ? (
        <div className="auth-success" role="status">
          <ShieldCheck size={24} />
          <p>Your password has been reset and all previous sessions have been signed out.</p>
          <Button onClick={onComplete}>Continue to sign in</Button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button disabled={submitting}>{submitting ? 'Saving…' : 'Reset password'}</Button>
        </form>
      )}
    </AuthCard>
  );
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="password-change-page">
      <section className="password-change-card">
        <Logo />
        {children}
      </section>
    </main>
  );
}
