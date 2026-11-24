import { useState, type FormEvent } from 'react';
import * as api from '../../api';
import { Logo } from '../../components/logo';
import { Button } from '../../components/ui/button';

export function ChangePassword({
  onChanged,
  onLogout,
}: {
  onChanged: (user: api.ApiUser) => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      onChanged((await api.changePassword(currentPassword, newPassword)).user);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="password-change-page">
      <section className="password-change-card">
        <Logo />
        <span className="eyebrow">SECURE YOUR ACCOUNT</span>
        <h1>Choose your own password</h1>
        <p>Replace your temporary password to access the workspace. Use at least 12 characters.</p>
        <form onSubmit={submit}>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
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
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <Button disabled={saving}>{saving ? 'Saving…' : 'Save password and continue'}</Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={onLogout}>
            Log out
          </Button>
        </form>
      </section>
    </main>
  );
}
