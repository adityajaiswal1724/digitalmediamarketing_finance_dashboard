import { PageGuide } from '../../components/demo-guide';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownUp,
  Download,
  FileText,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import * as api from '../../api';
import { Logo } from '../../components/logo';
import { Button } from '../../components/ui/button';
import type { CreditNote } from '../../credit-notes';
import { financialYearLabel, financialYearStart, localDate, type Invoice } from '../../model';
import {
  accountingReport,
  accountingYears,
  creditHeaders,
  demoAccountingCsv,
  invoiceHeaders,
  type ReportRow,
} from './accounting-report';
import './accounting.css';

export function CaWorkspace({
  invoices,
  creditNotes,
  onPreview,
  onCreditPreview,
  onLogout,
  impersonatedBy,
  accountName,
  onReturnToAdministrator,
}: {
  invoices: Invoice[];
  creditNotes: CreditNote[];
  onPreview: (invoice: Invoice) => void;
  onCreditPreview: (note: CreditNote) => void;
  onLogout: () => void;
  impersonatedBy?: api.ApiUser['impersonatedBy'];
  accountName?: string;
  onReturnToAdministrator: () => void;
}) {
  const location = useLocation(),
    navigate = useNavigate();
  const [year, setYear] = useState(String(financialYearStart(localDate())));
  const [month, setMonth] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const report = accountingReport(invoices, creditNotes, year, month);
  const creditView = location.pathname === '/ca/credit-notes';
  const title = creditView ? 'Credit Note History' : 'Invoice History';
  async function exportCsv() {
    setExporting(true);
    setError('');
    try {
      const blob = api.apiEnabled
        ? await api.exportAccountingCsv(year, month)
        : new Blob([demoAccountingCsv(report)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `demo-accounting-${month || year}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export the report.');
    } finally {
      setExporting(false);
    }
  }
  if (!['/ca/invoices', '/ca/credit-notes'].includes(location.pathname))
    return <Navigate to="/ca/invoices" replace />;
  return (
    <div className="app-shell ca-shell">
      <aside className="sidebar">
        <Logo />
        <div className="workspace-switch">
          <ShieldCheck size={20} />
          <div>
            Accounting workspace<small>Read-only access</small>
          </div>
        </div>
        <p className="nav-label">FINANCIAL RECORDS</p>
        <nav aria-label="Accounting navigation">
          <button className={!creditView ? 'active' : ''} onClick={() => navigate('/ca/invoices')}>
            <FileText size={19} />
            Invoice History
          </button>
          <button
            className={creditView ? 'active' : ''}
            onClick={() => navigate('/ca/credit-notes')}
          >
            <ReceiptText size={19} />
            Credit Note History
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button className="profile" onClick={onLogout}>
            <span className="avatar">CA</span>
            <span>
              Chartered Accountant<small>{impersonatedBy ? 'Return to Admin' : 'Log out'}</small>
            </span>
            {impersonatedBy ? <Undo2 size={17} /> : <LogOut size={17} />}
          </button>
        </div>
      </aside>
      <div className="main-shell">
        {impersonatedBy && (
          <div className="impersonation-banner ca-impersonation-banner" role="status">
            <span>
              <ShieldCheck size={17} /> Super Admin view: you are accessing{' '}
              <strong>{accountName || 'this CA account'}</strong> with read-only permissions.
            </span>
            <Button variant="outline" onClick={onReturnToAdministrator}>
              <Undo2 size={16} /> Return to Super Admin
            </Button>
          </div>
        )}
        <header className="topbar">
          <div>
            Accounting <span>/</span> <strong>{title}</strong>
          </div>
          <span className="demo-pill">
            <ShieldCheck size={14} /> Read only
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ACCOUNTING & REPORTING</div>
              <h1>
                {title}
                <span className="heading-dot">.</span>
              </h1>
              <p>A clear view of issued documents, organised by financial period.</p>
            </div>
          </div>
          <section className="panel ca-period" aria-label="Reporting period">
            <label>
              Financial Year
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setMonth('');
                }}
              >
                {accountingYears(invoices, creditNotes, localDate()).map((y) => (
                  <option value={y} key={y}>
                    {financialYearLabel(y)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="">All months</option>
                {report.months.map((m) => (
                  <option key={m} value={m}>
                    {new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', {
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={exportCsv} disabled={exporting}>
              <Download size={16} />
              {exporting ? 'Exporting…' : 'Export combined CSV'}
            </Button>
            <p>Both histories use this period. Credit notes are included by their issue date.</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
          <div className="ca-summary" aria-label="Selected period summary">
            <section className="panel">
              <span>
                <FileText size={18} />
                Invoices
              </span>
              <strong>{report.invoiceRows.length}</strong>
              <small>Issued in the selected period</small>
            </section>
            <section className="panel">
              <span>
                <ReceiptText size={18} />
                Credit notes
              </span>
              <strong>{report.creditRows.length}</strong>
              <small>Raised in the selected period</small>
            </section>
            <section className="panel">
              <span>
                <ShieldCheck size={18} />
                Total documents
              </span>
              <strong>{report.invoiceRows.length + report.creditRows.length}</strong>
              <small>Included in the combined report</small>
            </section>
          </div>
          <section className="panel ca-chart" aria-label="Monthly document counts">
            <h2>Monthly document activity</h2>
            <p>Invoice and credit note counts · {financialYearLabel(Number(year))}</p>
            <div className="ca-chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.trends}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Invoices" fill="#285ba3" radius={[4, 4, 0, 0]} maxBarSize={38} />
                  <Bar
                    dataKey="Credit notes"
                    fill="#ef7827"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
          <HistoryTable
            key={`${creditView}-${year}-${month}`}
            title={title}
            headers={creditView ? creditHeaders : invoiceHeaders}
            rows={creditView ? report.creditRows : report.invoiceRows}
            documentColumn={creditView ? 0 : 3}
            onPreview={(id) => {
              if (creditView) {
                const note = creditNotes.find((n) => n.id === id);
                if (note) onCreditPreview(note);
              } else {
                const invoice = invoices.find((i) => i.id === id);
                if (invoice) onPreview(invoice);
              }
            }}
          />
        <PageGuide kind="accounting" /></main>
      </div>
    </div>
  );
}

function HistoryTable({
  title,
  headers,
  rows,
  documentColumn,
  onPreview,
}: {
  title: string;
  headers: string[];
  rows: ReportRow[];
  documentColumn: number;
  onPreview: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ column: number; ascending: boolean } | null>(null);
  const sorted = [...rows].sort((a, b) => {
    if (!sort) return b.id.localeCompare(a.id, undefined, { numeric: true });
    const x = a.cells[sort.column],
      y = b.cells[sort.column];
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true });
    return sort.ascending ? result : -result;
  });
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return (
    <section className="panel ca-history">
      <div className="history-heading">
        <div>
          <h2>
            {title} <span className="count-badge">{rows.length}</span>
          </h2>
          <p>Amounts are in the currency shown on each row. Select a column to sort.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={header}
                  aria-sort={
                    sort?.column === index ? (sort.ascending ? 'ascending' : 'descending') : 'none'
                  }
                >
                  <button
                    className="ca-sort"
                    onClick={() => {
                      setSort({
                        column: index,
                        ascending: sort?.column === index ? !sort.ascending : true,
                      });
                      setPage(1);
                    }}
                  >
                    {header}
                    <ArrowDownUp size={12} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice((current - 1) * 10, current * 10).map((row) => (
              <tr key={row.id}>
                {row.cells.map((cell, i) => (
                  <td key={i} className={typeof cell === 'number' ? 'numeric' : ''}>
                    {i === documentColumn ? (
                      <button className="invoice-link" onClick={() => onPreview(row.id)}>
                        {cell || '—'}
                      </button>
                    ) : typeof cell === 'number' ? (
                      cell.toLocaleString('en-IN', { maximumFractionDigits: 4 })
                    ) : (
                      cell || '—'
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <div className="empty-state">
          <FileText size={28} />
          <h3>No records in this period</h3>
          <p>Select another month or financial year.</p>
        </div>
      )}
      <div className="ca-pagination">
        <span>
          {rows.length ? (current - 1) * 10 + 1 : 0}–{Math.min(current * 10, rows.length)} of{' '}
          {rows.length} records
        </span>
        <div>
          <Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={current * 10 >= rows.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
