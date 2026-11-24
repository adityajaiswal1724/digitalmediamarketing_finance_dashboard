import { KeyRound, Mail, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import * as api from '../../api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';

export function ProfileDialog({
  email,
  onClose,
  onUserChanged,
  onLogout,
}: {
  email: string | null;
  onClose: () => void;
  onUserChanged: (user: api.ApiUser) => void;
  onLogout: () => void;
}) {
  const [section, setSection] = useState<'profile' | 'password'>('profile');
  const [authorizedEmail, setAuthorizedEmail] = useState(email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveEmail(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const user = (await api.updateProfileEmail(authorizedEmail, currentPassword)).user;
      onUserChanged(user);
      setCurrentPassword('');
      setMessage('Authorized recovery email updated.');
    });
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) return setError('The new passwords do not match.');
    await run(async () => {
      const user = (await api.changePassword(currentPassword, newPassword)).user;
      onUserChanged(user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage('Password changed. Other signed-in sessions have been closed.');
    });
  }

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The change could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title="Super Admin profile"
      description="Manage recovery and sign-in security"
      onClose={onClose}
      className="profile-dialog"
    >
      <div className="profile-tabs">
        <button
          className={section === 'profile' ? 'active' : ''}
          onClick={() => {
            setSection('profile');
            setError('');
            setMessage('');
          }}
        >
          <Mail size={16} /> Recovery email
        </button>
        <button
          className={section === 'password' ? 'active' : ''}
          onClick={() => {
            setSection('password');
            setError('');
            setMessage('');
          }}
        >
          <KeyRound size={16} /> Change password
        </button>
      </div>
      {section === 'profile' ? (
        <form className="profile-security-form" onSubmit={saveEmail}>
          <label>
            Authorized recovery email
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={authorizedEmail}
              onChange={(event) => setAuthorizedEmail(event.target.value)}
            />
          </label>
          <p className="field-help">Password reset links will be sent only to this address.</p>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <Button disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save recovery email'}
          </Button>
        </form>
      ) : (
        <form className="profile-security-form" onSubmit={savePassword}>
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
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="form-success" role="status">
              {message}
            </p>
          )}
          <Button disabled={saving}>
            <KeyRound size={16} /> {saving ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      )}
      <div className="profile-dialog-footer">
        <Button type="button" variant="ghost" onClick={onLogout}>
          Log out of this account
        </Button>
      </div>
    </Dialog>
  );
}
