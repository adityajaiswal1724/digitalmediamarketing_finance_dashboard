import { initialClients, invoiceTotals, invoiceEditDeadline, nextInvoiceId, localDate, financialYearStart, type Invoice, type Division } from './model';
import { creditNoteAmounts, creditNoteCampaignRows, nextCreditNoteId, creditNoteEditDeadline, type CreditNote } from './credit-notes';
import { roundAmount, D } from '@demo/finance';

/** Deterministic fictional records: two completed financial years and the current FY to today. */
export function createDemoData(today = localDate()) {
  const year = financialYearStart(today);
  const invoices: Invoice[] = [], creditNotes: CreditNote[] = [];
  const currencies = ['INR', 'INR', 'INR', 'INR', 'INR', 'INR', 'USD', 'GBP', 'EUR', 'JPY', 'SGD', 'AED'];
  for (let offset = 0; offset < 36; offset++) {
    const date = new Date(Date.UTC(year - 2, 3 + offset, 1));
    const month = date.toISOString().slice(0, 7);
    if (month > today.slice(0, 7)) break;
    for (let c = 0; c < initialClients.length; c++) {
      const day = Math.min(2 + c * 2, month === today.slice(0, 7) ? Number(today.slice(8)) : 28);
      const invoiceDate = `${month}-${String(day).padStart(2, '0')}`;
      const division: Division = (['CPS', 'CPL', 'Mobile'] as const)[c % 3];
      const invoice: Invoice = {
        id: nextInvoiceId(invoices, invoiceDate), date: invoiceDate,
        client: structuredClone(initialClients[c]), currency: currencies[c],
        billFromGst: c % 2 ? '06-DEMO-GST' : '07-DEMO-GST',
        poRoNumber: `DEMO-PO-${offset + 1}-${c + 1}`,
        createdByEmployeeId: c % 4 === 0 ? undefined : `emp${c % 3 + 1}`,
        createdByName: c % 4 === 0 ? 'Demo Admin' : `emp${c % 3 + 1}`,
        editDeadline: invoiceEditDeadline(invoiceDate),
        campaigns: [{ division, month, name: `Sample ${division} campaign ${offset + 1}`, units: 120 + offset * 7 + c * 11, rate: 25 + c * 8,
          ...(c === 5 ? { exchangeRateEnabled: true, exchangeRate: 1.25 } : {}) },
          ...(c % 3 === 0 ? [{ division, month, name: 'Demo seasonal campaign', units: 50 + offset, rate: 18.5 }] : [])],
      };
      invoices.push(invoice);
      if ((offset + c) % 4 === 0) {
        const mode = c % 3 === 0 ? 'amount' : c % 3 === 1 ? 'percentage' : 'reversal';
        const value = mode === 'amount' ? 125 : mode === 'percentage' ? 15 : 100;
        const amounts = creditNoteAmounts(invoice, mode, value);
        const futureDate = new Date(`${invoiceDate}T12:00:00Z`);
        futureDate.setUTCDate(futureDate.getUTCDate() + 5 + c);
        const creditDate = [futureDate.toISOString().slice(0, 10), today].sort()[0];
        const note: CreditNote = {
          id: nextCreditNoteId(creditNotes, creditDate), invoiceId: invoice.id,
          date: creditDate, mode, value, currency: currencies[c], ...amounts,
          campaignRows: creditNoteCampaignRows(invoice, mode, value),
          invoiceSnapshot: structuredClone(invoice), editDeadline: creditNoteEditDeadline(creditDate),
        };
        creditNotes.push(note); invoice.creditTotal = note.total;
      }
      const remaining = roundAmount(new D(invoiceTotals(invoice).total).minus(invoice.creditTotal || 0), currencies[c]);
      invoice.paymentsReceived = c % 3 === 0 ? remaining : c % 3 === 1 ? roundAmount(remaining / 2, currencies[c]) : 0;
      invoice.paymentStatus = (invoice.paymentsReceived || 0) >= remaining ? 'Y' : 'N';
    }
  }
  return { invoices, creditNotes };
}
const data = createDemoData();
export const demoInvoices = data.invoices;
export const demoCreditNotes = data.creditNotes;
