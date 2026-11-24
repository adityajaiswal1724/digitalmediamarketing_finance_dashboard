import { useState, type FormEvent } from 'react';
import { D, currencyDigits, roundAmount } from '@demo/finance';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { invoiceTotals, money, paymentDeductionRate, type Invoice } from '../../model';

export function PaymentModal({
  invoice,
  onClose,
  onSave,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSave: (invoice: Invoice, received: number) => Promise<void>;
}) {
  const currency = invoice.currency || 'INR';
  const [received, setReceived] = useState(
    String(invoice.financials?.paymentsReceived ?? invoice.paymentsReceived ?? 0),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const totals = invoiceTotals(invoice);
  const deduction =
    invoice.financials?.deductionAmount ??
    roundAmount(new D(totals.base).times(paymentDeductionRate(invoice.client.gst)), currency);
  const credits = invoice.financials?.creditTotal ?? invoice.creditTotal ?? 0;
  const valid =
    received.trim() !== '' && Number.isFinite(Number(received)) && Number(received) >= 0;
  const balance = roundAmount(
    new D(totals.total)
      .minus(deduction)
      .minus(credits)
      .minus(valid ? Number(received) : 0),
    currency,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) {
      setError('Enter a valid non-negative payment amount.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(invoice, Number(received));
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      title="Record payment"
      description={`${invoice.id} · ${invoice.client.name}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="credit-original-summary">
          <div>
            <span>Invoice grand total</span>
            <strong>{money(totals.total, currency)}</strong>
          </div>
          <div>
            <span>Payment deduction</span>
            <strong>{money(deduction, currency)}</strong>
          </div>
          <div>
            <span>Total credit notes</span>
            <strong>{money(credits, currency)}</strong>
          </div>
          <div>
            <span>Payment to be received</span>
            <strong>{money(balance, currency)}</strong>
          </div>
        </div>
        <label>
          Total payments already received ({currency})
          <input
            type="number"
            required
            min="0"
            max="1000000000000"
            step={currencyDigits(currency) === 0 ? '1' : '0.01'}
            value={received}
            onChange={(event) => setReceived(event.target.value)}
          />
        </label>
        <p className="field-hint">
          Enter the cumulative amount received for this invoice, including previous payments. Saving
          replaces the recorded total in this browser.
        </p>
        {balance < 0 && (
          <p className="field-hint">
            The negative balance represents an amount to refund or adjust. No refund is sent
            automatically.
          </p>
        )}
        <p className="field-hint">
          The Y shortcut records full net payment. N resets the recorded payment total to zero.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save payment'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
