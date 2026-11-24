import { ArrowLeft, ArrowRight, Loader2, ShieldCheck, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import * as api from '../../api';
import { Logo } from '../../components/logo';
import { Button } from '../../components/ui/button';
import { ForgotPassword } from './reset-password';

export function Login({
  onAuthenticate,
}: {
  onAuthenticate: (id: string, password: string, choice: api.LoginChoice) => Promise<boolean>;
}) {
  const [choice, setChoice] = useState<api.LoginChoice | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [id, setId] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [submitting, setSubmitting] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!choice) return;
    setSubmitting(true);
    setError('');
    try {
      const accepted = await onAuthenticate(id.trim(), password, choice);
      if (!accepted)
        setError('The login ID or password is incorrect, or this account is inactive.');
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : 'The login could not be completed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (forgotPassword) return <ForgotPassword onBack={() => setForgotPassword(false)} />;
  return (
    <div className="login">
      <div className="login-story">
        <Logo />
        <div>
          <span className="eyebrow">THE FINANCE WORKSPACE</span>
          <h1>
            Every detail counts.
            <br />
            <em>Make it matter.</em>
          </h1>
          <p>
            One workspace for your clients, campaigns,
            <br />
            and every invoice in between.
          </p>
          <div className="login-illustration">
            <div className="mini-summary">
              <span>YOUR BUSINESS, AT A GLANCE</span>
              <h2>Built for your next milestone.</h2>
              <div className="mini-bars">
                {[30, 48, 40, 65, 58, 85, 73, 100].map((v, i) => (
                  <div key={i} style={{ height: v + '%' }} />
                ))}
              </div>
              <div className="mini-bottom">
                <span>
                  <span className="status-dot" /> Mobile
                </span>
                <span>CPS</span>
                <span>CPL</span>
              </div>
            </div>
            <div className="floating-note">
              <ShieldCheck size={20} />
              <span>
                Connected finance.
                <br />
                <strong>Designed for your team.</strong>
              </span>
            </div>
          </div>
        </div>
        <small>© 2026 Demo Company</small>
      </div>
      <div className="login-form">
        <div className="login-card">
          {!choice ? (
            <>
              <span className="eyebrow">WELCOME TO DEMO COMPANY</span>
              <h2>Choose your login</h2>
              <p>Explore three portals with ready-to-use fictional records. No signup required.</p>
              <div className="login-options">
                <button onClick={() => setChoice('employee')}>
                  <span className="login-option-icon">
                    <Users size={21} />
                  </span>
                  <span>
                    <strong>Employee Login</strong>
                    <small>Add clients and generate invoices</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <button onClick={() => setChoice('admin')}>
                  <span className="login-option-icon">
                    <ShieldCheck size={21} />
                  </span>
                  <span>
                    <strong>Admin Login</strong>
                    <small>Open the full finance dashboard</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
                <button onClick={() => setChoice('ca')}>
                  <span className="login-option-icon">
                    <ShieldCheck size={21} />
                  </span>
                  <span>
                    <strong>CA Login</strong>
                    <small>Chartered Accountant · Read-only reports & PDFs</small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                className="login-back"
                onClick={() => {
                  setChoice(null);
                  setId('');
                  setPassword('');
                  setError('');
                }}
              >
                <ArrowLeft size={15} />
                Back to login options
              </button>
              <span className="eyebrow">WELCOME BACK</span>
              <h2>
                {choice === 'admin'
                  ? 'Sign in to your workspace'
                  : choice === 'ca'
                    ? 'CA login'
                    : 'Employee login'}
              </h2>
              <p>
                {choice === 'admin'
                  ? 'Let’s get your finances in order.'
                  : choice === 'ca'
                    ? 'Your read-only accounting workspace is ready.'
                    : 'Your department workspace is ready.'}
              </p>
              <div className="demo-quick-entry"><Button onClick={async () => { setSubmitting(true); setError(''); try { const ok = await onAuthenticate(choice === 'admin' ? 'admin' : choice === 'ca' ? 'ca1' : 'emp1', choice === 'admin' ? 'admin@1234' : choice === 'ca' ? 'ca@1234' : 'emp@1234', choice); if (!ok) setError('The sample account was changed. Use your updated credentials below.'); } catch { setError('Could not open the demo. Try signing in below.'); } finally { setSubmitting(false); } }} disabled={submitting}>Explore {choice === 'ca' ? 'CA' : choice === 'admin' ? 'Admin' : 'Employee'} demo</Button></div><form onSubmit={submit}>
                <label>
                  {choice === 'admin'
                    ? 'Admin ID'
                    : choice === 'ca'
                      ? 'CA login ID'
                      : 'Employee name'}
                  <input
                    autoComplete="username"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder={
                      choice === 'admin'
                        ? 'Enter your admin ID'
                        : choice === 'ca'
                          ? 'Enter your CA login ID'
                          : 'Enter your employee name'
                    }
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </label>
                {error && (
                  <p role="alert" className="error">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="spin" size={17} /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in <ArrowRight size={17} />
                    </>
                  )}
                </Button>
                {choice === 'admin' && api.apiEnabled && (
                  <button
                    type="button"
                    className="forgot-password-link"
                    onClick={() => setForgotPassword(true)}
                  >
                    Forgot password?
                  </button>
                )}
              </form>
              {!api.apiEnabled && (
                <div className="credentials">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Explore the demo</strong>
                    <p>
                      {choice === 'ca' ? (
                        <>CA ID: ca1 · Password: ca@1234</>
                      ) : choice === 'admin' ? (
                        <>
                          Admin ID: <b>admin</b> · Password: <b>admin@1234</b>
                        </>
                      ) : (
                        <>
                          Employees: <b>emp1</b> · <b>emp2</b> · <b>emp3</b>
                          <br />
                          Password: <b>emp@1234</b>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
          <small className="login-help">Portfolio demonstration · Fictional data · Changes stay in this browser.</small>
        </div>
      </div>
    </div>
  );
}
