import { reconcileInvoice, validateInvoiceEdit } from './demo-state';
import { demoInvoices, demoCreditNotes } from './demo-data';
import { PageGuide, DemoIntroduction, DemoSettings } from './components/demo-guide';
import { D, roundAmount } from '@demo/finance';
import { ChangePassword } from './features/auth/change-password';
import {
  Check,
  ChevronDown,
  Download,
  LayoutDashboard,
  Loader2,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Undo2,
  UserRoundCog,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  authenticate as authenticateDemo,
  employeeInvoiceHistory,
  initialAccounts,
  type Employee,
  type ManagedAccount,
  type Session,
} from './access';
import * as api from './api';
import { Logo } from './components/logo';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import { canEditCreditNote, migrateCreditNoteIds, type CreditNote } from './credit-notes';
import { Login } from './features/auth/login';
import { ResetPassword } from './features/auth/reset-password';
import { ClientModal } from './features/clients/client-modal';
import { Clients } from './features/clients/clients-page';
import { CreditNoteModal } from './features/credit-notes/credit-note-modal';
import { CreditNotesPage } from './features/credit-notes/credit-notes-page';
import { EmployeeWorkspace } from './features/employees/employee-workspace';
import { EmployeesPage } from './features/employees/employees-page';
import { InvoiceModal } from './features/invoices/invoice-modal';
import { CaWorkspace } from './features/accounting/ca-workspace';
import { Overview } from './features/invoices/overview-page';
import {
  canEditInvoice,
  initialClients,

  localDate,
  paymentDue,
  invoiceTotals,
  latestDate,
  paymentDeductionRate,
  type Client,
  type Invoice,
} from './model';
// The server owns document generation in the release. Keep the local renderer
// behind a compile-time branch so it and its private asset URLs are not shipped.
async function makePdf(invoice: Invoice) {
  if (!api.apiEnabled) return (await import('./pdf')).makePdf(invoice);
  throw new Error('Use the authenticated PDF endpoint.');
}
async function makeCreditNotePdf(note: CreditNote, invoice: Invoice) {
  if (!api.apiEnabled)
    return (await import('./pdf')).makeCreditNotePdf(note, invoice);
  throw new Error('Use the authenticated PDF endpoint.');
}

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

const emptyClient: Client = {
  id: '',
  name: '',
  entityName: '',
  country: '',
  address: '',
  state: '',
  stateCode: '',
  poc: '',
  phone: '',
  email: '',
  pan: '',
  gst: '',
  place: '',
};

export default function App() {
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string>();
  const [authorizedEmail, setAuthorizedEmail] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [resetToken, setResetToken] = useState(() =>
    new URLSearchParams(window.location.hash.slice(1)).get('resetToken'),
  );
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [impersonatedBy, setImpersonatedBy] = useState<api.ApiUser['impersonatedBy']>(() => {
    if (api.apiEnabled) return undefined;
    try {
      return JSON.parse(sessionStorage.getItem('demo-impersonator') || 'null') || undefined;
    } catch {
      return undefined;
    }
  });
  const [session, setSession] = useState<Session | null>(() => {
    if (api.apiEnabled) return null;
    try {
      return JSON.parse(sessionStorage.getItem('demo-session') || 'null');
    } catch {
      return null;
    }
  });
  const [employees, setEmployees] = useState<ManagedAccount[]>(() =>
    api.apiEnabled ? [] : read('demo-employees-v1', initialAccounts),
  );
  const [clients, setClients] = useState<Client[]>(() =>
    api.apiEnabled
      ? []
      : read('demo-clients-v1', initialClients).map((c: Client) => ({
          ...c,
          country: c.country || 'India',
          entityName: c.entityName || c.name,
        })),
  );
  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    api.apiEnabled ? [] : read('demo-invoices-v1', demoInvoices),
  );
  const [invoiceMinimumDate, setInvoiceMinimumDate] = useState('');
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>(() =>
    api.apiEnabled ? [] : migrateCreditNoteIds(read('demo-credit-notes-v1', demoCreditNotes)),
  );
  const [clientModal, setClientModal] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const [editingCreditNote, setEditingCreditNote] = useState<CreditNote | null>(null);
  const [preview, setPreview] = useState<{
    invoice: Invoice;
    url: string;
  } | null>(null);
  const [creditPreview, setCreditPreview] = useState<{
    creditNote: CreditNote;
    invoice: Invoice;
    invoiceUrl: string;
    creditNoteUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [authChecking, setAuthChecking] = useState(api.apiEnabled);
  const [dataLoading, setDataLoading] = useState(api.apiEnabled);
  const [dataError, setDataError] = useState('');
  const [reloadData, setReloadData] = useState(0);
  const [toast, setToast] = useState('');
  const navigate = useNavigate(),
    location = useLocation();
  const currentEmployee =
    session?.role === 'employee'
      ? employees.find(
          (e): e is Employee => e.role !== 'ca' && e.id === session.employeeId && e.active,
        )
      : undefined;
  const activeSession =
    session?.role === 'admin' ||
    currentEmployee ||
    (session?.role === 'ca' &&
      (api.apiEnabled ||
        employees.some((e) => e.id === session.accountId && e.role === 'ca' && e.active)))
      ? session
      : null;
  const isClients = location.pathname === '/clients',
    isEmployees = location.pathname === '/employees',
    isCreditNotes = location.pathname === '/credit-notes';
  useEffect(() => {
    if (api.apiEnabled) return;
    localStorage.setItem('demo-clients-v1', JSON.stringify(clients));
  }, [clients]);
  useEffect(() => {
    if (api.apiEnabled) return;
    localStorage.setItem('demo-invoices-v1', JSON.stringify(invoices));
  }, [invoices]);
  useEffect(() => {
    if (api.apiEnabled) return;
    localStorage.setItem('demo-credit-notes-v1', JSON.stringify(creditNotes));
  }, [creditNotes]);
  useEffect(() => {
    if (api.apiEnabled) return;
    localStorage.setItem('demo-employees-v1', JSON.stringify(employees));
  }, [employees]);
  useEffect(() => {
    if (!api.apiEnabled) return;
    let active = true;
    api
      .getSession()
      .then(({ user }) => {
        if (!active) return;
        const employee = api.employeeFromUser(user);
        if (employee) setEmployees([employee]);
        setPasswordChangeRequired(user.passwordChangeRequired);
        setAuthorizedEmail(user.email);
        setSessionExpiresAt(user.sessionExpiresAt);
        setImpersonatedBy(user.impersonatedBy);
        setSession(api.sessionFromUser(user));
      })
      .catch(() => {
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!api.apiEnabled || !activeSession || passwordChangeRequired) return;
    let active = true;
    setDataLoading(true);
    setDataError('');
    Promise.all([
      activeSession.role !== 'ca' ? api.listClients() : Promise.resolve([]),
      activeSession.role === 'admin' ? api.listEmployees() : Promise.resolve(null),
      api.listInvoices(),
      activeSession.role !== 'employee' ? api.listCreditNotes() : Promise.resolve(null),
      activeSession.role !== 'ca'
        ? api.getInvoiceChronology()
        : Promise.resolve({ minimumDate: '' }),
    ])
      .then(([savedClients, savedEmployees, savedInvoices, savedCreditNotes, savedChronology]) => {
        if (!active) return;
        setClients(savedClients);
        if (savedEmployees) setEmployees(savedEmployees);
        setInvoices(savedInvoices);
        if (savedCreditNotes) setCreditNotes(savedCreditNotes);
        setInvoiceMinimumDate(savedChronology.minimumDate);
      })
      .catch((error: unknown) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Could not load workspace data.';
          setDataError(message);
          setToast(message);
        }
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeSession, passwordChangeRequired, reloadData]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  useEffect(
    () => () => {
      if (creditPreview) {
        URL.revokeObjectURL(creditPreview.invoiceUrl);
        URL.revokeObjectURL(creditPreview.creditNoteUrl);
      }
    },
    [creditPreview],
  );
  function login(next: Session) {
    if (!api.apiEnabled) {
      sessionStorage.setItem('demo-session', JSON.stringify(next));
      sessionStorage.removeItem('demo-auth');
    }
    setSession(next);
    navigate(next.role === 'admin' ? '/' : next.role === 'ca' ? '/ca/invoices' : '/employee');
  }
  async function authenticateUser(id: string, password: string, choice: api.LoginChoice) {
    if (!api.apiEnabled) {
      const found = authenticateDemo(id, password, employees);
      if (!found || found.role !== choice) return false;
      setImpersonatedBy(undefined);
      sessionStorage.removeItem('demo-impersonator');
      login(found);
      return true;
    }

    const { user } = await api.login(id, password);
    if (user.role !== choice) {
      await api.logout();
      return false;
    }
    const employee = api.employeeFromUser(user);
    if (employee) setEmployees([employee]);
    setPasswordChangeRequired(user.passwordChangeRequired);
    setAuthorizedEmail(user.email);
    setSessionExpiresAt(user.sessionExpiresAt);
    setImpersonatedBy(user.impersonatedBy);
    login(api.sessionFromUser(user));
    return true;
  }
  async function impersonateAccount(account: ManagedAccount) {
    if (!account.active) {
      throw new Error('Only active Employee and CA accounts can be accessed.');
    }
    if (!api.apiEnabled) {
      const administrator = { id: 'admin', username: 'admin', displayName: 'Admin' };
      setImpersonatedBy(administrator);
      sessionStorage.setItem('demo-impersonator', JSON.stringify(administrator));
      login(
        account.role === 'ca'
          ? { role: 'ca', accountId: account.id }
          : { role: 'employee', employeeId: account.id },
      );
      return;
    }
    const { user } = await api.impersonateAccount(account.id);
    if (!user.impersonatedBy || !['employee', 'ca'].includes(user.role))
      throw new Error('The account session could not be opened.');
    const currentEmployee = api.employeeFromUser(user);
    setEmployees(
      currentEmployee
        ? [currentEmployee]
        : [
            {
              id: user.id,
              name: user.username,
              password: '',
              role: 'ca',
              department: null,
              active: true,
            },
          ],
    );
    setPasswordChangeRequired(false);
    setSessionExpiresAt(user.sessionExpiresAt);
    setImpersonatedBy(user.impersonatedBy);
    login(api.sessionFromUser(user));
  }
  async function returnToAdministrator() {
    if (!impersonatedBy) return;
    if (!api.apiEnabled) {
      setImpersonatedBy(undefined);
      sessionStorage.removeItem('demo-impersonator');
      login({ role: 'admin' });
      return;
    }
    try {
      const { user } = await api.stopImpersonation();
      setImpersonatedBy(undefined);
      setPasswordChangeRequired(user.passwordChangeRequired);
      setAuthorizedEmail(user.email);
      setSessionExpiresAt(user.sessionExpiresAt);
      setEmployees([]);
      setReloadData((value) => value + 1);
      login(api.sessionFromUser(user));
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not return to the Admin workspace.');
    }
  }
  async function logout() {
    if (api.apiEnabled) {
      try {
        await api.logout();
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Could not log out. Please try again.');
        if (!(error instanceof api.ApiError && error.status === 401)) return;
      }
      setClients([]);
      setInvoices([]);
      setCreditNotes([]);
      setEmployees([]);
    }
    sessionStorage.removeItem('demo-session');
    sessionStorage.removeItem('demo-auth');
    sessionStorage.removeItem('demo-impersonator');
    setImpersonatedBy(undefined);
    setAuthorizedEmail(null);
    setProfileOpen(false);
    setSession(null);
    setClientModal(null);
    setCreating(false);
    setEditingInvoice(null);
    setPreview(null);
    setCreatingCreditNote(false);
    setEditingCreditNote(null);
    setCreditPreview(null);
    navigate('/');
  }
  useEffect(() => {
    if (!api.apiEnabled) return;
    const expire = () => {
      setSession(null);
      setPasswordChangeRequired(false);
      setImpersonatedBy(undefined);
      setClients([]);
      setInvoices([]);
      setCreditNotes([]);
      setEmployees([]);
      setClientModal(null);
      setCreating(false);
      setEditingInvoice(null);
      setPreview(null);
      setCreatingCreditNote(false);
      setEditingCreditNote(null);
      setCreditPreview(null);
      setToast('Your session ended. Please log in again.');
    };
    window.addEventListener('demo-session-expired', expire);
    return () => window.removeEventListener('demo-session-expired', expire);
  }, []);
  useEffect(() => {
    if (!api.apiEnabled || !activeSession || !sessionExpiresAt) return;
    const timer = window.setTimeout(
      () => window.dispatchEvent(new Event('demo-session-expired')),
      Math.max(0, Date.parse(sessionExpiresAt) - Date.now()),
    );
    const verify = () => {
      void api.getSession().catch(() => {
        /* 401 is handled by the API event. */
      });
    };
    window.addEventListener('focus', verify);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', verify);
    };
  }, [activeSession, sessionExpiresAt]);
  function addClient() {
    setClientModal({ ...emptyClient });
    setEditing(true);
  }
  async function showPdf(invoice: Invoice) {
    setBusy(true);
    try {
      const blob = api.apiEnabled
        ? await api.getInvoicePdf(invoice.id)
        : (await makePdf(invoice)).output('blob');
      setPreview({ invoice, url: URL.createObjectURL(blob) });
    } catch {
      setToast('Could not generate the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  async function showCreditNote(creditNote: CreditNote) {
    const invoice =
      creditNote.invoiceSnapshot || invoices.find((item) => item.id === creditNote.invoiceId);
    if (!invoice) {
      setToast('The original invoice could not be found.');
      return;
    }
    setBusy(true);
    try {
      const [invoiceBlob, creditNoteBlob] = await Promise.all([
        api.apiEnabled
          ? api.getCreditNotePdf(creditNote.id, true)
          : makePdf(invoice).then((doc) => doc.output('blob')),
        api.apiEnabled
          ? api.getCreditNotePdf(creditNote.id)
          : makeCreditNotePdf(creditNote, invoice).then((doc) => doc.output('blob')),
      ]);
      setCreditPreview({
        creditNote,
        invoice,
        invoiceUrl: URL.createObjectURL(invoiceBlob),
        creditNoteUrl: URL.createObjectURL(creditNoteBlob),
      });
    } catch {
      setToast('Could not prepare the credit note comparison.');
    } finally {
      setBusy(false);
    }
  }
  const dialogs = (
    <>
      {activeSession?.role !== 'ca' && clientModal && (
        <ClientModal
          client={clientModal}
          editing={editing}
          onEdit={() => setEditing(true)}
          onClose={() => setClientModal(null)}
          onSave={async (c) => {
            const existing = Boolean(c.id);
            try {
              const saved = api.apiEnabled
                ? existing
                  ? await api.updateClient(c)
                  : await api.createClient(c)
                : existing
                  ? c
                  : { ...c, id: crypto.randomUUID() };
              setClients((prev) =>
                existing ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved],
              );
              setClientModal(null);
              setToast(existing ? 'Client details updated' : 'New client added');
            } catch (error) {
              setToast(error instanceof Error ? error.message : 'Could not save the client.');
              throw error;
            }
          }}
        />
      )}
      {activeSession?.role !== 'ca' && creating && (
        <InvoiceModal
          clients={clients}
          invoices={invoices}
          minimumDate={api.apiEnabled ? invoiceMinimumDate : latestDate(invoices)}
          fixedDivision={currentEmployee?.department}
          onClose={() => setCreating(false)}
          onCreate={async (i) => {
            const draft = currentEmployee ? { ...i, createdByEmployeeId: currentEmployee.id } : i;
            const saved = api.apiEnabled ? await api.createInvoice(draft) : draft;
            setInvoices((prev) => [...prev.filter((invoice) => invoice.id !== saved.id), saved]);
            setInvoiceMinimumDate((current) =>
              !current || saved.date > current ? saved.date : current,
            );
            setCreating(false);
            setToast('Invoice created successfully');
            await showPdf(saved);
          }}
        />
      )}
      {activeSession?.role === 'admin' && editingInvoice && (
        <InvoiceModal
          key={editingInvoice.id}
          invoice={editingInvoice}
          clients={clients}
          invoices={invoices}
          onClose={() => setEditingInvoice(null)}
          onCreate={async (updated) => {
            const original = invoices.find((i) => i.id === editingInvoice.id);
            if (!original || !canEditInvoice(original)) {
              setEditingInvoice(null);
              setToast('This invoice is locked after the 5th of the following month.');
              return;
            }
            const issue = validateInvoiceEdit(original, updated, creditNotes);
            if (issue) throw new Error(issue);
            const saved = api.apiEnabled ? await api.updateInvoice(updated) : reconcileInvoice(updated, creditNotes);
            setInvoices((prev) => prev.map((i) => (i.id === original.id ? saved : i)));
            setEditingInvoice(null);
            setToast('Invoice updated successfully');
            await showPdf(saved);
          }}
        />
      )}
      {activeSession?.role === 'admin' && (creatingCreditNote || editingCreditNote) && (
        <CreditNoteModal
          key={editingCreditNote?.id || 'new-credit-note'}
          creditNote={editingCreditNote || undefined}
          creditNotes={creditNotes}
          invoices={invoices}
          onClose={() => {
            setCreatingCreditNote(false);
            setEditingCreditNote(null);
          }}
          onSave={async (creditNote) => {
            const saved = api.apiEnabled
              ? editingCreditNote
                ? await api.updateCreditNote(creditNote)
                : await api.createCreditNote(creditNote)
              : creditNote;
            setCreditNotes((previous) =>
              editingCreditNote
                ? previous.map((item) => (item.id === editingCreditNote.id ? saved : item))
                : [...previous.filter((note) => note.id !== saved.id), saved],
            );
            setCreatingCreditNote(false);
            setEditingCreditNote(null);
            setToast(
              editingCreditNote
                ? 'Credit note updated successfully'
                : 'Credit note generated successfully',
            );
            if (api.apiEnabled) setInvoices(await api.listInvoices());
            else setInvoices(previous => previous.map(invoice => reconcileInvoice(invoice, [...creditNotes.filter(n => n.id !== saved.id), saved])));
            await showCreditNote(saved);
          }}
        />
      )}
      {preview && (
        <Dialog
          title="Invoice preview"
          description={`${preview.invoice.id} · ${preview.invoice.client.name}`}
          wide
          onClose={() => setPreview(null)}
        >
          <div className="pdf-toolbar">
            <span>
              <Check size={16} /> PDF ready
            </span>
            <a
              className="button primary"
              href={preview.url}
              download={`${preview.invoice.id.replaceAll('/', '-')}.pdf`}
            >
              <Download size={16} />
              Download PDF
            </a>
          </div>
          <iframe title="Generated invoice PDF" src={preview.url} className="pdf-preview" />
          <p className="pdf-fallback">
            If your browser does not display the preview,{' '}
            <a href={preview.url} target="_blank" rel="noreferrer">
              open the PDF in a new tab
            </a>
            .
          </p>
        </Dialog>
      )}
      {creditPreview && (
        <Dialog
          title="Credit note comparison"
          description={`${creditPreview.invoice.id} and ${creditPreview.creditNote.id}`}
          wide
          className="credit-comparison-modal"
          onClose={() => setCreditPreview(null)}
        >
          <div className="comparison-toolbar">
            <span>
              <Check size={16} /> Both PDFs are ready
            </span>
            <div>
              <a
                className="button secondary"
                href={creditPreview.invoiceUrl}
                download={`${creditPreview.invoice.id.replaceAll('/', '-')}.pdf`}
              >
                <Download size={15} /> Invoice
              </a>
              <a
                className="button primary"
                href={creditPreview.creditNoteUrl}
                download={`${creditPreview.creditNote.id.replaceAll('/', '-')}.pdf`}
              >
                <Download size={15} /> Credit note
              </a>
            </div>
          </div>
          <div className="pdf-comparison-grid">
            <section>
              <span>Original invoice</span>
              <iframe
                title="Original invoice PDF"
                src={creditPreview.invoiceUrl}
                className="pdf-preview"
              />
            </section>
            <section>
              <span>Credit note</span>
              <iframe
                title="Generated credit note PDF"
                src={creditPreview.creditNoteUrl}
                className="pdf-preview"
              />
            </section>
          </div>
        </Dialog>
      )}
      {busy && (
        <div className="toast">
          <Loader2 className="spin" size={18} />
          Preparing your PDF…
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
  if (authChecking)
    return (
      <div className="auth-loading" role="status">
        <Logo />
        <Loader2 className="spin" size={24} />
        <span>Opening your finance workspace…</span>
      </div>
    );
  if (activeSession && passwordChangeRequired)
    return (
      <ChangePassword
        onLogout={logout}
        onChanged={(user) => {
          setPasswordChangeRequired(user.passwordChangeRequired);
          setAuthorizedEmail(user.email);
          setSessionExpiresAt(user.sessionExpiresAt);
          setImpersonatedBy(user.impersonatedBy);
          login(api.sessionFromUser(user));
        }}
      />
    );
  if (!activeSession && resetToken)
    return <ResetPassword token={resetToken} onComplete={() => setResetToken(null)} />;
  if (!activeSession) return <Login onAuthenticate={authenticateUser} />;
  if (activeSession.role === 'ca' && (dataLoading || dataError))
    return (
      <div className="auth-loading" role={dataError ? 'alert' : 'status'}>
        <Logo />
        {dataError ? (
          <>
            <p>{dataError}</p>
            <Button onClick={() => setReloadData((v) => v + 1)}>Retry loading records</Button>
          </>
        ) : (
          <>
            <Loader2 className="spin" size={24} />
            <p>Loading accounting records…</p>
          </>
        )}
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </div>
    );
  if (activeSession.role === 'ca')
    return (
      <>
        <CaWorkspace
          invoices={invoices}
          creditNotes={creditNotes}
          onPreview={showPdf}
          onCreditPreview={showCreditNote}
          impersonatedBy={impersonatedBy}
          accountName={employees.find((account) => account.id === activeSession.accountId)?.name}
          onLogout={impersonatedBy ? returnToAdministrator : logout}
          onReturnToAdministrator={returnToAdministrator}
        />
        {dialogs}
      </>
    );
  if (activeSession.role === 'employee' && currentEmployee)
    return (
      <div className="employee-shell">
        {impersonatedBy && (
          <div className="impersonation-banner" role="status">
            <span>
              <ShieldCheck size={17} /> Super Admin view: you are accessing{' '}
              <strong>{currentEmployee.name}</strong> with {currentEmployee.department} permissions.
            </span>
            <Button variant="outline" onClick={returnToAdministrator}>
              <Undo2 size={16} /> Return to Super Admin
            </Button>
          </div>
        )}
        <header className="employee-topbar">
          <Logo />
          <div>
            <span className="department-pill">{currentEmployee.department} department</span>
            <span className="employee-identity">{currentEmployee.name}</span>
            <Button variant="outline" onClick={impersonatedBy ? returnToAdministrator : logout}>
              {impersonatedBy ? <Undo2 size={16} /> : <LogOut size={16} />}
              {impersonatedBy ? 'Return to Admin' : 'Log out'}
            </Button>
          </div>
        </header>
        <main className="employee-main">
          <Routes>
            <Route
              path="/employee"
              element={
                <EmployeeWorkspace
                  employee={currentEmployee}
                  invoices={employeeInvoiceHistory(invoices, currentEmployee)}
                  onAddClient={addClient}
                  onInvoice={() => setCreating(true)}
                  onPreview={showPdf}
                />
              }
            />
            <Route path="*" element={<Navigate to="/employee" replace />} />
          </Routes>
          <PageGuide kind="employee" />
        </main>
        {dialogs}
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace-switch">
          <div className="company-icon">
            <Wallet size={17} />
          </div>
          <div>
            Demo Company<small>Finance workspace</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          <button
            className={location.pathname === '/' ? 'active' : ''}
            onClick={() => navigate('/')}
          >
            <LayoutDashboard size={19} />
            Overview
          </button>
          <button
            className={isCreditNotes ? 'active' : ''}
            onClick={() => navigate('/credit-notes')}
          >
            <ReceiptText size={19} />
            Credit Notes
          </button>
          <button className={isClients ? 'active' : ''} onClick={() => navigate('/clients')}>
            <Users size={19} />
            Clients
          </button>
          <button className={isEmployees ? 'active' : ''} onClick={() => navigate('/employees')}>
            <UserRoundCog size={19} />
            Team & CA accounts
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" aria-label="Demo settings" title="Demo settings and logout" onClick={() => setProfileOpen(true)}>
            <span className="avatar">AD</span>
            <span>
              Admin<small>Demo settings & logout</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <span>/</span>{' '}
            <strong>
              {isClients
                ? 'Clients'
                : isEmployees
                  ? 'Employees'
                  : isCreditNotes
                    ? 'Credit Notes'
                    : 'Overview'}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="workspace-date">
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="demo-pill">Fictional data · Portfolio demo</span><span className="avatar small">AD</span>
          </div>
        </header>
        <main>
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  invoices={invoices}
                  employees={employees}
                  onCreate={() => setCreating(true)}
                  onPreview={showPdf}
                  onEdit={(invoice) => {
                    if (canEditInvoice(invoice)) setEditingInvoice(invoice);
                  }}
                  onPayments={async (invoice, received) => {
                    const saved = api.apiEnabled
                      ? await api.setInvoicePayments(invoice, received)
                      : {
                          ...invoice,
                          paymentsReceived: received,
                          paymentStatus:
                            received > 0 &&
                            paymentDue({ ...invoice, paymentsReceived: received }) <= 0
                              ? ('Y' as const)
                              : ('N' as const),
                        };
                    setInvoices((previous) =>
                      previous.map((item) => (item.id === saved.id ? saved : item)),
                    );
                    setToast('Payment recorded successfully');
                  }}
                  onPaymentStatus={async (invoiceId, paymentStatus) => {
                    try {
                      const current = invoices.find((invoice) => invoice.id === invoiceId);
                      const saved = api.apiEnabled
                        ? await api.setInvoicePaymentStatus(
                            invoiceId,
                            paymentStatus,
                            current?.version,
                          )
                        : current
                          ? {
                              ...current,
                              paymentStatus,
                              paymentsReceived:
                                paymentStatus === 'N'
                                  ? 0
                                  : Math.max(
                                      current.paymentsReceived || 0,
                                      roundAmount(
                                        new D(invoiceTotals(current).total)
                                          .minus(
                                            roundAmount(
                                              new D(invoiceTotals(current).base).times(
                                                paymentDeductionRate(current.client.gst),
                                              ),
                                              current.currency || 'INR',
                                            ),
                                          )
                                          .minus(current.creditTotal || 0),
                                        current.currency || 'INR',
                                      ),
                                      0,
                                    ),
                            }
                          : null;
                      if (saved)
                        setInvoices((previous) =>
                          previous.map((invoice) => (invoice.id === invoiceId ? saved : invoice)),
                        );
                    } catch (statusError) {
                      setToast(
                        statusError instanceof Error
                          ? statusError.message
                          : 'Could not update payment status.',
                      );
                    }
                  }}
                />
              }
            />
            <Route
              path="/clients"
              element={
                <Clients
                  clients={clients}
                  onAdd={addClient}
                  onView={(c) => {
                    setClientModal({ ...c });
                    setEditing(false);
                  }}
                />
              }
            />
            <Route
              path="/employees"
              element={
                <EmployeesPage
                  employees={employees}
                  onSave={async (employee) => {
                    const exists = employees.some((item) => item.id === employee.id);
                    const saved = api.apiEnabled
                      ? exists
                        ? await api.updateEmployee(employee)
                        : await api.createEmployee(employee)
                      : employee;
                    setEmployees((prev) =>
                      exists
                        ? prev.map((item) => (item.id === saved.id ? saved : item))
                        : [...prev, saved],
                    );
                  }}
                  onToggle={async (id) => {
                    const employee = employees.find((item) => item.id === id);
                    if (!employee) return;
                    const saved = api.apiEnabled
                      ? await api.setEmployeeActive(employee, !employee.active)
                      : { ...employee, active: !employee.active };
                    setEmployees((prev) =>
                      prev.map((item) => (item.id === saved.id ? saved : item)),
                    );
                  }}
                  onLoginAs={impersonateAccount}
                />
              }
            />
            <Route
              path="/credit-notes"
              element={
                <CreditNotesPage
                  creditNotes={creditNotes}
                  invoices={invoices}
                  onCreate={() => setCreatingCreditNote(true)}
                  onPreview={showCreditNote}
                  onEdit={(creditNote) => {
                    if (canEditCreditNote(creditNote, localDate()))
                      setEditingCreditNote(creditNote);
                  }}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <PageGuide kind={isClients ? "clients" : isEmployees ? "employees" : isCreditNotes ? "credits" : "overview"} />
          <footer>
            © 2026 Demo Company{' '}
            <span>
              <ShieldCheck size={13} /> Your finance, in one place.
            </span>
          </footer>
        </main>
      </div>
      {dialogs}
      {profileOpen && <DemoSettings onClose={() => setProfileOpen(false)} onLogout={logout} />}
      <DemoIntroduction />
    </div>
  );
}
