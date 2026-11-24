import { Check, Loader2, LogIn, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { employeeNameAvailable, type ManagedAccount } from '../../access';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { type Division } from '../../model';

export function EmployeesPage({
  employees,
  onSave,
  onToggle,
  onLoginAs,
}: {
  employees: ManagedAccount[];
  onSave: (e: ManagedAccount) => void | Promise<void>;
  onToggle: (id: string) => void | Promise<void>;
  onLoginAs: (employee: ManagedAccount) => Promise<void>;
}) {
  const [selected, setSelected] = useState<ManagedAccount | null>(null);
  const [form, setForm] = useState({
    role: 'employee' as 'employee' | 'ca',
    name: '',
    password: '',
    department: 'CPS' as Division,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState('');
  function open(employee?: ManagedAccount) {
    setSelected(
      employee || {
        id: '',
        name: '',
        password: '',
        department: 'CPS',
        active: true,
      },
    );
    setForm({
      role: employee?.role || 'employee',
      name: employee?.name || '',
      password: '',
      department: employee?.department || 'CPS',
    });
    setError('');
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const name = form.name.trim();
    if (!employeeNameAvailable(name, employees, selected.id || undefined)) {
      setError('Choose a unique employee name. “admin” is reserved.');
      return;
    }
    if (!selected.id && !form.password) {
      setError('Enter a password for the new employee.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        id: selected.id || crypto.randomUUID(),
        name,
        password: form.password || selected.password,
        ...(form.role === 'ca'
          ? { role: 'ca' as const, department: null }
          : { role: 'employee' as const, department: form.department }),
        active: selected.active,
      });
      setNotice(selected.id ? 'Account updated' : 'Account created');
      setSelected(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the employee.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MANAGE YOUR TEAM</div>
          <h1>
            Employees & CA<span className="heading-dot">.</span>
          </h1>
          <p>Manage department access and read-only accounting accounts.</p>
        </div>
        <Button onClick={() => open()}>
          <Plus size={18} />
          Create account
        </Button>
      </div>
      <section className="panel employees-panel">
        <div className="history-heading">
          <div>
            <h2>
              Team access <span className="count-badge">{employees.length}</span>
            </h2>
            <p>
              Employees work within one department. CA accounts can only review and export financial
              histories.
            </p>
          </div>
        </div>
        <div className="employee-list">
          {employees.map((e) => (
            <div className="employee-row" key={e.id}>
              <span className="client-avatar">{e.name.slice(0, 2).toUpperCase()}</span>
              <div className="employee-row-name">
                <strong>{e.name}</strong>
                <small>{e.role === 'ca' ? 'CA login ID' : 'Employee login ID'}</small>
              </div>
              <span className={`division-badge ${(e.department || 'ca').toLowerCase()}`}>
                {e.role === 'ca' ? 'CA · Read only' : e.department}
              </span>
              <span className={`employee-status ${e.active ? 'enabled' : 'disabled'}`}>
                {e.active ? 'Active' : 'Disabled'}
              </span>
              <Button
                variant="outline"
                disabled={!e.active || Boolean(impersonatingId)}
                title={e.active ? `Access the workspace as ${e.name}` : 'Enable this account first'}
                onClick={async () => {
                  setImpersonatingId(e.id);
                  setNotice('');
                  try {
                    await onLoginAs(e);
                  } catch (loginError) {
                    setNotice(
                      loginError instanceof Error
                        ? loginError.message
                        : 'Could not access the selected workspace.',
                    );
                    setImpersonatingId('');
                  }
                }}
              >
                {impersonatingId === e.id ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <LogIn size={15} />
                )}
                {impersonatingId === e.id ? 'Opening…' : 'Login As'}
              </Button>
              <Button variant="outline" onClick={() => open(e)}>
                Edit access
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await onToggle(e.id);
                    setNotice(`${e.name} ${e.active ? 'disabled' : 'enabled'}`);
                  } catch (toggleError) {
                    setNotice(
                      toggleError instanceof Error
                        ? toggleError.message
                        : 'Could not update employee access.',
                    );
                  }
                }}
              >
                {e.active ? 'Disable' : 'Enable'}
              </Button>
            </div>
          ))}
        </div>
      </section>
      {notice && (
        <p role="status" className="employee-notice">
          <Check size={15} />
          {notice}
        </p>
      )}
      {selected && (
        <Dialog
          title={selected.id ? 'Edit account' : 'Create account'}
          description="Account name is the login ID. New credentials require a password change on first login."
          className="employee-modal"
          onClose={() => setSelected(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <label className="span-2">
                Account type
                <select
                  value={form.role}
                  disabled={Boolean(selected.id)}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value as 'employee' | 'ca' }))
                  }
                >
                  <option value="employee">Employee</option>
                  <option value="ca">Chartered Accountant (CA)</option>
                </select>
              </label>
              <label className="span-2">
                Account name
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. emp4"
                  autoComplete="off"
                />
              </label>
              <label className="span-2">
                {selected.id ? 'New password (leave blank to keep current)' : 'Password'}
                <input
                  type="password"
                  required={!selected.id}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={selected.id ? 'Enter a new password' : 'Create a password'}
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              {form.role === 'employee' && (
                <label className="span-2">
                  Assigned department
                  <select
                    value={form.department}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        department: e.target.value as Division,
                      }))
                    }
                  >
                    {(['CPL', 'CPS', 'Mobile'] as Division[]).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <div className="modal-footer">
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                {saving ? 'Saving…' : selected.id ? 'Save changes' : 'Create account'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </motion.div>
  );
}
