import { D, roundAmount } from '@demo/finance';
import { invoiceTotals, paymentDue, type Invoice } from './model';
import type { CreditNote } from './credit-notes';

export function reconcileInvoice(invoice: Invoice, notes: CreditNote[]): Invoice {
  const creditTotal = roundAmount(notes.filter(n => n.invoiceId === invoice.id).reduce((sum, n) => sum.plus(n.total), new D(0)), invoice.currency || 'INR');
  const updated = { ...invoice, creditTotal };
  return { ...updated, paymentStatus: paymentDue(updated) <= 0 ? 'Y' : 'N' };
}
export function validateInvoiceEdit(original: Invoice, updated: Invoice, notes: CreditNote[]) {
  const credits = notes.filter(n => n.invoiceId === original.id);
  if ((credits.length || (original.paymentsReceived || 0) > 0) &&
      (updated.client.id !== original.client.id || updated.currency !== original.currency || updated.billFromGst !== original.billFromGst || updated.client.stateCode !== original.client.stateCode || updated.client.country !== original.client.country)) {
    return 'An invoice with payments or credits must keep its client, currency and tax registration. Create a new invoice for these changes.';
  }
  if (credits.some(n => n.date < updated.date)) return 'The invoice date cannot be after a linked credit note date.';
  const amounts = invoiceTotals(updated);
  for (const field of ['base', 'cgst', 'sgst', 'igst'] as const) {
    const credited = credits.reduce((sum, n) => sum.plus(n[field]), new D(0));
    if (credited.gt(amounts[field])) return 'The revised base and taxes cannot be smaller than amounts already credited.';
  }
  return '';
}
