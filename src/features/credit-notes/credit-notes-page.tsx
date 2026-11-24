import { Download, Plus, ReceiptText, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import {
  canEditCreditNote,
  creditNoteEditDeadline,
  matchesCreditNotePeriod,
  type CreditNote,
} from '../../credit-notes';
import { dateLabel } from '../../lib/format';
import {
  financialYearLabel,
  financialYearStart,
  invoiceTotals,
  localDate,
  money,
  type Invoice,
} from '../../model';

export function CreditNotesPage({
  creditNotes,
  invoices,
  onCreate,
  onPreview,
  onEdit,
}: {
  creditNotes: CreditNote[];
  invoices: Invoice[];
  onCreate: () => void;
  onPreview: (creditNote: CreditNote) => void;
  onEdit: (creditNote: CreditNote) => void;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [financialYear, setFinancialYear] = useState('');
  const [creditMonth, setCreditMonth] = useState('');
  const invoiceById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );
  const yearStarts = creditNotes.map((note) => financialYearStart(note.date));
  const earliestYear = Math.min(...yearStarts);
  const latestYear = Math.max(financialYearStart(localDate()), earliestYear, ...yearStarts);
  const financialYears = Array.from(
    { length: latestYear - earliestYear + 1 },
    (_, index) => latestYear - index,
  );
  const filtered = [...creditNotes].reverse().filter((creditNote) => {
    const invoice = invoiceById.get(creditNote.invoiceId);
    const searchable = `${creditNote.id} ${creditNote.invoiceId} ${invoice?.client.name || ''}`;
    return (
      searchable.toLowerCase().includes(query.toLowerCase()) &&
      matchesCreditNotePeriod(creditNote, {
        startDate,
        endDate,
        financialYear,
        month: creditMonth,
      })
    );
  });
  const hasFilters = Boolean(query || startDate || endDate || financialYear || creditMonth);
  const maxPage = Math.max(1, Math.ceil(filtered.length / 7));
  const currentPage = Math.min(page, maxPage);

  function clearFilters() {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setFinancialYear('');
    setCreditMonth('');
    setPage(1);
  }

  function exportFilteredCsv() {
    const rows = filtered.map((creditNote) => {
      const invoice = invoiceById.get(creditNote.invoiceId);
      const original = invoice ? invoiceTotals(invoice) : undefined;
      return [
        creditNote.invoiceId,
        invoice?.date || '',
        original?.base || 0,
        original ? original.cgst + original.sgst + original.igst : 0,
        original?.total || 0,
        creditNote.id,
        creditNote.date,
        creditNote.base,
        creditNote.cgst + creditNote.sgst + creditNote.igst,
        creditNote.total,
      ];
    });
    const headers = [
      'Invoice Number',
      'Invoice Date',
      'Invoice Base Amount',
      'Invoice GST',
      'Invoice Grand Total',
      'Credit Note Number',
      'Credit Note Date',
      'Credit Note Base Amount',
      'Credit Note GST',
      'Credit Note Grand Total',
    ];
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'demo-credit-notes-filtered.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADJUSTMENTS & REVERSALS</div>
          <h1>
            Credit Notes<span className="heading-dot">.</span>
          </h1>
          <p>Raise, review, and compare every credit against its invoice.</p>
        </div>
        <Button onClick={onCreate}>
          <Plus size={18} /> Create Credit Note
        </Button>
      </div>

      <section className="panel history-panel credit-notes-panel">
        <div className="history-heading">
          <div>
            <h2>
              Credit note history{' '}
              <span className="count-badge">
                {filtered.length}/{creditNotes.length}
              </span>
            </h2>
            <p>Credit notes remain editable through the 5th of the following month.</p>
          </div>
        </div>
        <div className="table-controls invoice-filter-controls">
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search credit notes"
              placeholder="Search credit note, invoice, or client…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button aria-label="Clear credit note search" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <label className="filter-field">
            <span>Financial year</span>
            <select
              aria-label="Filter credit notes by financial year"
              value={financialYear}
              onChange={(event) => {
                setFinancialYear(event.target.value);
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
            <span>Credit note month</span>
            <input
              type="month"
              aria-label="Filter by credit note month"
              value={creditMonth}
              onChange={(event) => {
                setCreditMonth(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>From date</span>
            <input
              type="date"
              aria-label="Credit note date range start"
              max={endDate || undefined}
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="filter-field">
            <span>To date</span>
            <input
              type="date"
              aria-label="Credit note date range end"
              min={startDate || undefined}
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
            />
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
              onClick={exportFilteredCsv}
            >
              <Download size={14} /> Export CSV ({filtered.length})
            </Button>
          )}
        </div>
        <div className="table-scroll">
          <table className="data-table credit-notes-table">
            <thead>
              <tr>
                {[
                  'Invoice Number',
                  'Invoice Date',
                  'Invoice Base Amount',
                  'Invoice GST',
                  'Invoice Grand Total',
                  'Credit Note Number',
                  'Credit Note Date',
                  'Credit Note Base Amount',
                  'Credit Note GST',
                  'Credit Note Grand Total',
                  'Edit status',
                ].map((heading, index) => (
                  <th key={index}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice((currentPage - 1) * 7, currentPage * 7).map((creditNote) => {
                const invoice = invoiceById.get(creditNote.invoiceId);
                if (!invoice) return null;
                const original = invoiceTotals(invoice);
                const currency = creditNote.currency || 'INR';
                const editable = canEditCreditNote(creditNote, localDate());
                return (
                  <tr key={creditNote.id}>
                    <td>
                      <button className="invoice-link" onClick={() => onPreview(creditNote)}>
                        {invoice.id}
                      </button>
                    </td>
                    <td>{dateLabel(invoice.date)}</td>
                    <td className="numeric">{money(original.base, currency)}</td>
                    <td>{money(original.cgst + original.sgst + original.igst, currency)}</td>
                    <td className="numeric total-cell">{money(original.total, currency)}</td>
                    <td>
                      <button
                        className="invoice-link credit-note-number"
                        onClick={() => onPreview(creditNote)}
                      >
                        {creditNote.id}
                      </button>
                    </td>
                    <td>{dateLabel(creditNote.date)}</td>
                    <td className="numeric">{money(creditNote.base, currency)}</td>
                    <td>{money(creditNote.cgst + creditNote.sgst + creditNote.igst, currency)}</td>
                    <td className="numeric total-cell">{money(creditNote.total, currency)}</td>
                    <td>
                      <div className="credit-note-actions">
                        {editable ? (
                          <button
                            type="button"
                            className="credit-edit-button"
                            onClick={() => onEdit(creditNote)}
                          >
                            Edit
                          </button>
                        ) : (
                          <span
                            title={`Locked after ${dateLabel(creditNote.editDeadline || creditNoteEditDeadline(creditNote.date))}`}
                          >
                            Locked
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty">
              <ReceiptText size={27} />
              <h3>{creditNotes.length ? 'No credit notes found' : 'No credit notes yet'}</h3>
              <p>
                {creditNotes.length
                  ? 'Adjust or clear the credit note filters.'
                  : 'Create the first credit note from an existing invoice.'}
              </p>
            </div>
          )}
        </div>
        <div className="table-footer">
          <span>
            Showing {filtered.length ? (currentPage - 1) * 7 + 1 : 0}–
            {Math.min(currentPage * 7, filtered.length)} of {filtered.length} credit notes
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
    </motion.div>
  );
}
