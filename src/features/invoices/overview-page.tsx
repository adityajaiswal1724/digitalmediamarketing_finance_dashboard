import { invoiceGstState } from '../../model';
import { lineAmount } from '@demo/finance';
import { PaymentModal } from './payment-modal';
import * as api from '../../api';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Download,
  FileText,
  IndianRupee,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { invoiceCreatorName, type ManagedAccount } from '../../access';
import { Button } from '../../components/ui/button';
import { dateLabel, monthLabel } from '../../lib/format';
import {
  canEditInvoice,
  financialYearLabel,
  financialYearMonths,
  financialYearOptions,
  financialYearStart,
  invoiceEditDeadline,
  invoiceTotals,
  latestDate,
  localDate,
  matchesInvoicePeriod,
  money,
  paymentDue,
  type Division,
  type Invoice,
} from '../../model';

export function Overview({
  invoices,
  employees,
  onCreate,
  onPreview,
  onEdit,
  onPaymentStatus,
  onPayments,
}: {
  invoices: Invoice[];
  employees: ManagedAccount[];
  onCreate: () => void;
  onPreview: (i: Invoice) => void;
  onEdit: (i: Invoice) => void;
  onPaymentStatus: (invoiceId: string, status: 'Y' | 'N') => void;
  onPayments: (invoice: Invoice, received: number) => Promise<void>;
}) {
  const [query, setQuery] = useState(''),
    [division, setDivision] = useState('All divisions'),
    [page, setPage] = useState(1),
    [startDate, setStartDate] = useState(''),
    [endDate, setEndDate] = useState(''),
    [financialYear, setFinancialYear] = useState(''),
    [invoiceMonth, setInvoiceMonth] = useState(''),
    [paymentStatus, setPaymentStatus] = useState(''),
    [gstState, setGstState] = useState(''),
    [dashboardFinancialYear, setDashboardFinancialYear] = useState(() =>
      String(financialYearStart(localDate())),
    );
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [exportError, setExportError] = useState('');
  const inrInvoices = useMemo(
    () => invoices.filter((i) => (i.currency || 'INR') === 'INR'),
    [invoices],
  );
  const selectedDashboardYear = Number(dashboardFinancialYear);
  const dashboardInvoices = useMemo(
    () => invoices.filter((invoice) => financialYearStart(invoice.date) === selectedDashboardYear),
    [invoices, selectedDashboardYear],
  );
  const dashboardInrInvoices = useMemo(
    () => dashboardInvoices.filter((invoice) => (invoice.currency || 'INR') === 'INR'),
    [dashboardInvoices],
  );
  const allTotal = dashboardInrInvoices.reduce((s, i) => s + invoiceTotals(i).total, 0),
    base = dashboardInrInvoices.reduce((s, i) => s + invoiceTotals(i).base, 0);
  const financialYears = financialYearOptions(
    invoices.flatMap((invoice) => [
      invoice.date,
      ...invoice.campaigns.map((campaign) => `${campaign.month}-01`),
    ]),
  );
  const creatorName = (invoice: Invoice) => invoiceCreatorName(invoice, employees);
  const filtered = [...invoices].reverse().filter(
    (i) =>
      (division === 'All divisions' || i.campaigns.some((c) => c.division === division)) &&
      (
        i.client.name +
        ' ' +
        (i.client.entityName || '') +
        ' ' +
        i.id +
        ' ' +
        i.client.gst +
        ' ' +
        creatorName(i) +
        ' ' +
        invoiceGstState(i)
      )
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      matchesInvoicePeriod(i, {
        startDate,
        endDate,
        financialYear,
        month: invoiceMonth,
      }) &&
      (!paymentStatus || (i.paymentStatus || 'N') === paymentStatus) &&
      (!gstState || invoiceGstState(i) === gstState),
  );
  const hasFilters = Boolean(
    query ||
    division !== 'All divisions' ||
    startDate ||
    endDate ||
    financialYear ||
    invoiceMonth ||
    paymentStatus ||
    gstState,
  );
  const filteredTotals = filtered.reduce<
    Record<
      string,
      { base: number; cgst: number; sgst: number; igst: number; total: number; payment: number }
    >
  >((byCurrency, invoice) => {
    const currency = invoice.currency || 'INR';
    const amount = invoiceTotals(invoice);
    const current = byCurrency[currency] || {
      base: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 0,
      payment: 0,
    };
    byCurrency[currency] = {
      base: current.base + amount.base,
      cgst: current.cgst + amount.cgst,
      sgst: current.sgst + amount.sgst,
      igst: current.igst + amount.igst,
      total: current.total + amount.total,
      payment: current.payment + paymentDue(invoice),
    };
    return byCurrency;
  }, {});
  const formatFilteredTotal = (key: 'base' | 'cgst' | 'sgst' | 'igst' | 'total' | 'payment') =>
    Object.entries(filteredTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => money(amount[key], currency))
      .join(' + ');
  function clearFilters() {
    setQuery('');
    setDivision('All divisions');
    setStartDate('');
    setEndDate('');
    setFinancialYear('');
    setInvoiceMonth('');
    setPaymentStatus('');
    setGstState('');
    setPage(1);
  }
  async function exportFilteredCsv() {
    if (api.apiEnabled) {
      try {
        const blob = await api.exportInvoiceCsv({
          startDate,
          endDate,
          financialYear,
          month: invoiceMonth,
          paymentStatus,
          gstState,
          query,
          division: division === 'All divisions' ? '' : division,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'demo-invoices-filtered.csv';
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
      }
      return;
    }
    const headers = [
      'Client Name',
      'Entity Name',
      'Division',
      'Invoice Number',
      'GST State',
      'Edit Status',
      'Invoice Date',
      'Activity Month',
      'Client POC',
      'GST Number',
      'State Code',
      'State',
      'Base Amount',
      'CGST',
      'SGST',
      'IGST',
      'Grand Total',
      'Payment to be received',
      'Payment Status',
      'Currency',
      'Created By',
    ];
    const body = filtered.map((invoice) => {
      const amount = invoiceTotals(invoice);
      return [
        invoice.client.name,
        invoice.client.entityName || invoice.client.name,
        [...new Set(invoice.campaigns.map((c) => c.division))].join(' / '),
        invoice.id,
        invoiceGstState(invoice),
        canEditInvoice(invoice) ? 'Editable' : 'Locked',
        invoice.date,
        [...new Set(invoice.campaigns.map((c) => monthLabel(c.month)))].join(' / '),
        invoice.client.poc,
        invoice.client.gst,
        invoice.client.stateCode,
        invoice.client.state,
        amount.base,
        amount.cgst,
        amount.sgst,
        amount.igst,
        amount.total,
        paymentDue(invoice),
        invoice.paymentStatus || 'N',
        invoice.currency || 'INR',
        creatorName(invoice),
      ];
    });
    const csv = [headers, ...body]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(typeof value === 'string' && /^[\s]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`,
          )
          .join(','),
      )
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'demo-invoices-filtered.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
  const maxPage = Math.max(1, Math.ceil(filtered.length / 7));
  const currentPage = Math.min(page, maxPage);
  const chart = useMemo(() => {
    return financialYearMonths(selectedDashboardYear).map((month) => ({
      month: monthLabel(month).split(' ')[0],
      revenue: inrInvoices.reduce(
        (sum, i) =>
          sum +
          i.campaigns
            .filter((c) => c.month === month)
            .reduce(
              (s, c) =>
                s +
                (c.baseAmount ??
                  lineAmount(
                    c.units,
                    c.rate,
                    i.client.country === 'India' && c.exchangeRateEnabled ? c.exchangeRate || 0 : 1,
                    i.currency || 'INR',
                  )),
              0,
            ),
        0,
      ),
    }));
  }, [inrInvoices, selectedDashboardYear]);
  const chartBase = chart.reduce((sum, month) => sum + month.revenue, 0);
  const divisionData = (['Mobile', 'CPS', 'CPL'] as Division[]).map((d) => ({
    name: d,
    amount: inrInvoices.reduce(
      (sum, i) =>
        sum +
        i.campaigns
          .filter(
            (c) =>
              c.division === d && financialYearStart(`${c.month}-01`) === selectedDashboardYear,
          )
          .reduce(
            (s, c) =>
              s +
              (c.baseAmount ??
                lineAmount(
                  c.units,
                  c.rate,
                  i.client.country === 'India' && c.exchangeRateEnabled ? c.exchangeRate || 0 : 1,
                  i.currency || 'INR',
                )),
            0,
          ),
      0,
    ),
  }));
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSave={onPayments}
        />
      )}

      <div className="page-heading">
        <div>
          <div className="eyebrow">FINANCE AT A GLANCE</div>
          <h1>
            Overview<span className="heading-dot">.</span>
          </h1>
          <p>Track your revenue, manage invoices, and keep business moving.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={18} />
          Create invoice
        </Button>
      </div>
      <div className="overview-note">
        <span>
          <span className="status-dot" />
          Workspace up to date
        </span>
        <label className="overview-year-select">
          <CalendarDays size={15} />
          <select
            aria-label="Financial year for dashboard overview"
            value={dashboardFinancialYear}
            onChange={(event) => setDashboardFinancialYear(event.target.value)}
          >
            {financialYears.map((year) => (
              <option key={year} value={year}>
                {financialYearLabel(year)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-grid overview-stats-grid">
        <Stat
          title="Total invoiced (INR)"
          value={money(allTotal)}
          icon={<Wallet size={19} />}
          caption={`${dashboardInrInvoices.length} INR invoices across all divisions`}
          green
        />
        <Stat
          title="Taxable revenue (INR)"
          value={money(base)}
          icon={<IndianRupee size={19} />}
          caption="Before GST · INR invoices"
        />
        <Stat
          title="Total invoices"
          value={String(dashboardInvoices.length).padStart(2, '0')}
          icon={<FileText size={19} />}
          caption={
            dashboardInvoices.length
              ? `Latest · ${dateLabel(latestDate(dashboardInvoices))}`
              : 'No invoices in this financial year'
          }
        />
      </div>
      <div className="analytics-grid">
        {exportError && (
          <p role="alert" className="error">
            {exportError}
          </p>
        )}
        <section className="panel revenue-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue at a glance</h2>
              <p>INR taxable revenue by activity month</p>
            </div>
            <span className="chart-legend">
              <span className="status-dot" />
              Revenue
            </span>
          </div>
          <div className="revenue-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 15, right: 15, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="brandFade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#275da6" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#275da6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e8edf5" strokeDasharray="4 5" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#7b8ba3' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#7b8ba3' }}
                  tickFormatter={(n) => `₹${Math.round(n / 1000)}k`}
                  width={53}
                />
                <Tooltip
                  formatter={(v) => money(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e9f3',
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#275da6"
                  strokeWidth={2.5}
                  fill="url(#brandFade)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel division-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue by division</h2>
              <p>INR revenue contribution</p>
            </div>
            <Layers size={18} color="#8798ae" />
          </div>
          <div className="division-total">
            {money(chartBase)}
            <span>{financialYearLabel(selectedDashboardYear)} taxable revenue</span>
          </div>
          <div className="stacked-bar">
            {divisionData.map((d, i) => (
              <div
                key={d.name}
                style={{
                  width: (chartBase ? (d.amount / chartBase) * 100 : 0) + '%',
                  background: ['#275da6', '#1395a1', '#f47421'][i],
                }}
              />
            ))}
          </div>
          <div className="division-list">
            {divisionData.map((d, i) => (
              <div key={d.name}>
                <span>
                  <i style={{ background: ['#275da6', '#1395a1', '#f47421'][i] }} />
                  {d.name}
                </span>
                <strong>{money(d.amount)}</strong>
                <small>{chartBase ? Math.round((d.amount / chartBase) * 100) : 0}%</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="panel history-panel">
        <div className="history-heading">
          <div>
            <h2>
              Invoice history{' '}
              <span className="count-badge">
                {filtered.length}/{invoices.length}
              </span>
            </h2>
            <p>Admin edits are available through the 5th of the following month.</p>
          </div>
        </div>
        <div className="table-controls invoice-filter-controls">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search invoices"
              placeholder="Search clients or invoice number…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            aria-label="Filter by division"
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              setPage(1);
            }}
          >
            {['All divisions', 'CPL', 'CPS', 'Mobile'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <label className="filter-field">
            <span>Financial year</span>
            <select
              aria-label="Filter by financial year"
              value={financialYear}
              onChange={(e) => {
                setFinancialYear(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All financial years</option>
              {financialYears.map((year) => (
                <option key={year} value={year}>
                  {financialYearLabel(year)}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>Invoice month</span>
            <input
              type="month"
              aria-label="Filter by invoice month"
              value={invoiceMonth}
              onChange={(e) => {
                setInvoiceMonth(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>From date</span>
            <input
              type="date"
              aria-label="Invoice date range start"
              max={endDate || undefined}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>To date</span>
            <input
              type="date"
              aria-label="Invoice date range end"
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>GST State</span>
            <select
              aria-label="Filter by GST State"
              value={gstState}
              onChange={(e) => {
                setGstState(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All GST states</option>
              <option>Delhi</option>
              <option>Haryana</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Payment status</span>
            <select
              aria-label="Filter by payment status"
              value={paymentStatus}
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All payments</option>
              <option value="Y">Received (Y)</option>
              <option value="N">Not received (N)</option>
            </select>
          </label>
          <button
            type="button"
            className="clear-filter-button"
            disabled={!hasFilters}
            onClick={clearFilters}
          >
            <X size={14} /> Clear
          </button>
          {hasFilters && (
            <Button
              type="button"
              variant="outline"
              className="filter-export-button"
              title={exportError || undefined}
              onClick={exportFilteredCsv}
            >
              <Download size={14} /> Export CSV ({filtered.length})
            </Button>
          )}
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  'Client name',
                  'Entity name',
                  'Division',
                  'Invoice number',
                  'GST State',
                  'Edit status',
                  'Invoice date',
                  'Activity month',
                  'Client POC',
                  'GST number',
                  'State code',
                  'State',
                  'Base amount',
                  'CGST',
                  'SGST',
                  'IGST',
                  'Grand total',
                  'Payment to be received',
                  'Payment Status',
                  'Currency',
                  'Created by',
                ].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage - 1) * 7, currentPage * 7).map((i) => {
                const t = invoiceTotals(i);
                return (
                  <tr
                    key={i.id}
                    className={(i.paymentStatus || 'N') === 'Y' ? 'payment-received-row' : ''}
                  >
                    <td>
                      <div className="table-client">
                        <span className="client-avatar">
                          {i.client.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span title={i.client.name}>{i.client.name}</span>
                      </div>
                    </td>
                    <td className="entity-name-cell">{i.client.entityName || i.client.name}</td>
                    <td>
                      <div className="badges">
                        {[...new Set(i.campaigns.map((c) => c.division))].map((d) => (
                          <span key={d} className={`division-badge ${d.toLowerCase()}`}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button className="invoice-link" onClick={() => onPreview(i)}>
                        {i.id}
                      </button>
                    </td>
                    <td>{invoiceGstState(i)}</td>
                    <td className="invoice-edit-cell">
                      {canEditInvoice(i) ? (
                        <>
                          <button type="button" onClick={() => onEdit(i)}>
                            Edit
                          </button>
                          <small>
                            Until {dateLabel(i.editDeadline || invoiceEditDeadline(i.date))}
                          </small>
                        </>
                      ) : (
                        <span className="invoice-locked">
                          Locked
                          <small>
                            {`After ${dateLabel(i.editDeadline || invoiceEditDeadline(i.date))}`}
                          </small>
                        </span>
                      )}
                    </td>
                    <td>{dateLabel(i.date)}</td>
                    <td>{[...new Set(i.campaigns.map((c) => monthLabel(c.month)))].join(', ')}</td>
                    <td>{i.client.poc}</td>
                    <td>{i.client.gst}</td>
                    <td>{i.client.stateCode}</td>
                    <td>{i.client.state}</td>
                    <td className="numeric">{money(t.base, i.currency || 'INR')}</td>
                    <td>{money(t.cgst, i.currency || 'INR')}</td>
                    <td>{money(t.sgst, i.currency || 'INR')}</td>
                    <td>{money(t.igst, i.currency || 'INR')}</td>
                    <td className="numeric total-cell">{money(t.total, i.currency || 'INR')}</td>
                    <td className="numeric payment-due-cell">
                      {money(paymentDue(i), i.currency || 'INR')}
                      <button
                        type="button"
                        className="invoice-link"
                        style={{ display: 'block' }}
                        onClick={() => setPaymentInvoice(i)}
                      >
                        Record payment
                      </button>
                    </td>
                    <td>
                      <div
                        className="payment-status-toggle"
                        role="group"
                        aria-label={`Payment status for ${i.id}`}
                      >
                        {(['Y', 'N'] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={(i.paymentStatus || 'N') === status ? 'active' : ''}
                            aria-pressed={(i.paymentStatus || 'N') === status}
                            title={
                              status === 'Y'
                                ? 'Record full net payment'
                                : 'Reset received payments to zero'
                            }
                            onClick={() => onPaymentStatus(i.id, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>{i.currency || 'INR'}</td>
                    <td className="created-by-cell">{creatorName(i)}</td>
                  </tr>
                );
              })}
            </tbody>
            {hasFilters && filtered.length > 0 && (
              <tfoot>
                <tr className="filtered-total-row">
                  <td colSpan={12}>Filtered totals · {filtered.length} invoices</td>
                  <td className="numeric">{formatFilteredTotal('base')}</td>
                  <td className="numeric">{formatFilteredTotal('cgst')}</td>
                  <td className="numeric">{formatFilteredTotal('sgst')}</td>
                  <td className="numeric">{formatFilteredTotal('igst')}</td>
                  <td className="numeric total-cell">{formatFilteredTotal('total')}</td>
                  <td className="numeric payment-due-cell">{formatFilteredTotal('payment')}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
          {!filtered.length && (
            <div className="empty">
              <Search size={25} />
              <h3>No invoices found</h3>
              <p>Adjust or clear the invoice filters.</p>
            </div>
          )}
        </div>
        <div className="table-footer">
          <span>
            Showing {filtered.length ? (currentPage - 1) * 7 + 1 : 0}–
            {Math.min(currentPage * 7, filtered.length)} of {filtered.length} invoices{' '}
            <small>Scroll horizontally for all invoice details →</small>
          </span>
          <div>
            <Button
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </Button>
            <span className="page-number">{currentPage}</span>
            <Button
              variant="outline"
              disabled={currentPage === maxPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>
      <div className="bottom-note">
        <ShieldCheck size={15} />
        <span>
          Ready for your next invoice? Client details and taxes are filled in automatically.
        </span>
        <button onClick={onCreate}>
          Let’s create one <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export function Stat({
  title,
  value,
  icon,
  caption,
  green = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  caption: string;
  green?: boolean;
}) {
  return (
    <section className={`stat-card ${green ? 'highlight' : ''}`}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <h2>{value}</h2>
      <p>
        {green ? <ArrowUpRight size={14} /> : <span className="tiny-dot" />}
        {caption}
      </p>
    </section>
  );
}
