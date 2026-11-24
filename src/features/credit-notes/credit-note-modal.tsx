import { PageGuide } from '../../components/demo-guide';
import { ArrowRight, ChevronDown, Loader2, ReceiptText, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import {
  canEditCreditNote,
  creditNoteAmounts,
  creditNoteCampaignRows,
  creditNoteEditDeadline,
  nextCreditNoteId,
  validateCreditNote,
  type CreditNote,
  type CreditNoteMode,
} from '../../credit-notes';
import { dateLabel } from '../../lib/format';
import { invoiceTotals, localDate, money, type Invoice } from '../../model';

export function CreditNoteModal({
  creditNote,
  creditNotes,
  invoices,
  onClose,
  onSave,
}: {
  creditNote?: CreditNote;
  creditNotes: CreditNote[];
  invoices: Invoice[];
  onClose: () => void;
  onSave: (creditNote: CreditNote) => void | Promise<void>;
}) {
  const [invoiceQuery, setInvoiceQuery] = useState(creditNote?.invoiceId || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(creditNote?.invoiceId || '');
  const [date, setDate] = useState(creditNote?.date || localDate());
  const [mode, setMode] = useState<CreditNoteMode>(creditNote?.mode || 'percentage');
  const [value, setValue] = useState(creditNote ? String(creditNote.value) : '');
  const [invoicePickerOpen, setInvoicePickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);
  const original = selectedInvoice ? invoiceTotals(selectedInvoice) : null;
  const numericValue = Number(value);
  const otherCredits = creditNotes.filter(
    (note) => note.invoiceId === selectedInvoiceId && note.id !== creditNote?.id,
  );
  const calculated = selectedInvoice
    ? creditNoteAmounts(selectedInvoice, mode, numericValue || 0, otherCredits)
    : null;
  const suggestions = invoices
    .filter((invoice) => invoice.id.toLowerCase().includes(invoiceQuery.trim().toLowerCase()))
    .sort((a, b) => a.client.name.localeCompare(b.client.name) || b.date.localeCompare(a.date))
    .slice(0, 8);

  function chooseInvoice(invoice: Invoice) {
    setSelectedInvoiceId(invoice.id);
    setInvoiceQuery(invoice.id);
    setInvoicePickerOpen(false);
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (creditNote && !canEditCreditNote(creditNote, localDate())) {
      setError('This credit note is locked after the 5th of the following month.');
      return;
    }
    const validation = validateCreditNote(selectedInvoice, date, mode, numericValue);
    if (validation || !selectedInvoice || !calculated) {
      setError(validation || 'Select an original invoice.');
      return;
    }
    if (
      calculated.base <= 0 ||
      calculated.total <= 0 ||
      calculated.base >
        original!.base - otherCredits.reduce((sum, note) => sum + note.base, 0) + 0.000001
    ) {
      setError(
        'Credit exceeds the available balance, or the invoice is already fully reversed. Review existing credit notes.',
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        version: creditNote?.version,
        id: creditNote?.id || nextCreditNoteId(creditNotes, date),
        invoiceId: selectedInvoice.id,
        invoiceSnapshot: structuredClone(selectedInvoice),
        date,
        mode,
        value: numericValue,
        currency: selectedInvoice.currency || 'INR',
        campaignRows: creditNoteCampaignRows(selectedInvoice, mode, numericValue, otherCredits),
        ...calculated,
        editDeadline: creditNote?.editDeadline || creditNoteEditDeadline(date),
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the credit note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      title={creditNote ? `Edit ${creditNote.id}` : 'Create Credit Note'}
      description={
        creditNote
          ? 'Update the credit while it is within the allowed edit window.'
          : 'Select an invoice and raise a proportional or fixed-base credit.'
      }
      className="credit-note-modal"
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <section className="invoice-section">
          <div className="section-label">
            <span>01</span>
            <div>
              <strong>Original Invoice</strong>
              <small>Search using the complete or partial invoice number.</small>
            </div>
          </div>
          <div className="credit-invoice-picker">
            <label>
              Invoice Number
              <div className="search-field">
                <Search size={16} />
                <input
                  aria-label="Invoice Number"
                  readOnly={Boolean(creditNote)}
                  autoComplete="off"
                  placeholder="Example: DEMO/26-27/154"
                  value={invoiceQuery}
                  onFocus={() => !creditNote && setInvoicePickerOpen(true)}
                  onChange={(event) => {
                    const next = event.target.value;
                    setInvoiceQuery(next);
                    setInvoicePickerOpen(true);
                    if (next !== selectedInvoiceId) setSelectedInvoiceId('');
                  }}
                />
                <ChevronDown
                  size={15}
                  className={`picker-chevron ${invoicePickerOpen ? 'open' : ''}`}
                />
              </div>
              {invoicePickerOpen && invoiceQuery.trim() && (
                <div className="invoice-options">
                  {suggestions.length ? (
                    suggestions.map((invoice) => (
                      <button type="button" key={invoice.id} onClick={() => chooseInvoice(invoice)}>
                        <span>
                          <strong>{invoice.id}</strong>
                          <small>
                            {invoice.client.name} · {dateLabel(invoice.date)}
                          </small>
                        </span>
                        <ArrowRight size={14} />
                      </button>
                    ))
                  ) : (
                    <div className="client-option-empty">No matching invoice found.</div>
                  )}
                </div>
              )}
            </label>
            <label>
              Credit Note Date
              <input
                type="date"
                aria-label="Credit Note Date"
                value={date}
                min={selectedInvoice?.date}
                onChange={(event) => setDate(event.target.value)}
              />
              <small className="field-hint">Use the original invoice date or a later date, including prior financial years.</small>
            </label>
          </div>
          {selectedInvoice && original && (
            <div className="credit-original-summary">
              <div>
                <span>Client Name</span>
                <strong>{selectedInvoice.client.name}</strong>
              </div>
              <div>
                <span>Invoice Base Amount</span>
                <strong>{money(original.base, selectedInvoice.currency || 'INR')}</strong>
              </div>
              <div>
                <span>GST Details</span>
                <strong>
                  {original.cgst
                    ? `CGST ${money(original.cgst)} · SGST ${money(original.sgst)}`
                    : original.igst
                      ? `IGST ${money(original.igst)}`
                      : 'No GST'}
                </strong>
              </div>
              <div>
                <span>Final Invoice Amount</span>
                <strong>{money(original.total, selectedInvoice.currency || 'INR')}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="invoice-section credit-entry-section">
          <div className="section-label">
            <span>02</span>
            <div>
              <strong>Credit Note</strong>
              <small>Choose how the credit should be calculated.</small>
            </div>
          </div>
          <div className="credit-mode-row">
            <label className={mode === 'percentage' ? 'selected' : ''}>
              <input
                type="radio"
                name="credit-mode"
                value="percentage"
                checked={mode === 'percentage'}
                onChange={() => {
                  setMode('percentage');
                  setValue('');
                }}
              />
              Raise by Percentage (%)
            </label>
            <label className={mode === 'amount' ? 'selected' : ''}>
              <input
                type="radio"
                name="credit-mode"
                value="amount"
                checked={mode === 'amount'}
                onChange={() => {
                  setMode('amount');
                  setValue('');
                }}
              />
              Raise by Amount
            </label>
            <label className={mode === 'reversal' ? 'selected' : ''}>
              <input
                type="radio"
                name="credit-mode"
                value="reversal"
                checked={mode === 'reversal'}
                onChange={() => {
                  setMode('reversal');
                  setValue('100');
                }}
              />
              Full reversal (remaining balance)
            </label>
            <label className="credit-value-field">
              {mode === 'amount' ? 'Credit Base Amount' : 'Credit Percentage'}
              <div>
                {mode === 'amount' && <span>{selectedInvoice?.currency || 'INR'}</span>}
                <input
                  type="number"
                  readOnly={mode === 'reversal'}
                  min="0"
                  max={mode === 'amount' ? original?.base : 100}
                  step="0.01"
                  aria-label={mode === 'amount' ? 'Credit Base Amount' : 'Credit Percentage'}
                  placeholder={mode === 'percentage' ? '20' : '10000'}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
                {mode === 'percentage' && <span>%</span>}
              </div>
            </label>
          </div>
          {selectedInvoice && calculated && (
            <div className="invoice-total-grid credit-total-grid">
              <div>
                <span>Credit Base Amount</span>
                <strong>{money(calculated.base, selectedInvoice.currency || 'INR')}</strong>
              </div>
              <div>
                <span>CGST</span>
                <strong>{money(calculated.cgst, selectedInvoice.currency || 'INR')}</strong>
              </div>
              <div>
                <span>SGST</span>
                <strong>{money(calculated.sgst, selectedInvoice.currency || 'INR')}</strong>
              </div>
              <div>
                <span>IGST</span>
                <strong>{money(calculated.igst, selectedInvoice.currency || 'INR')}</strong>
              </div>
              <div className="grand-total">
                <span>Credit Note Grand Total</span>
                <strong>{money(calculated.total, selectedInvoice.currency || 'INR')}</strong>
              </div>
            </div>
          )}
        </section>
        {mode === 'reversal' && (
          <p className="field-hint">
            Reverses the remaining base and GST. Existing credits count toward the 100% reversal and
            are not issued twice. Create the corrected invoice separately with a new number.
          </p>
        )}
        {creditNote && (
          <p className="field-hint">
            This update uses the current invoice details. Other credit notes keep their saved
            amounts.
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!selectedInvoice || !value || saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <ReceiptText size={16} />}
            {saving ? 'Saving…' : creditNote ? 'Save Credit Note' : 'Generate Credit Note'}
          </Button>
        </div>
      <PageGuide kind="credits" /></form>
    </Dialog>
  );
}
