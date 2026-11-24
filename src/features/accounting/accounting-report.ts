import { D, roundAmount } from '@demo/finance';
import type { CreditNote } from '../../credit-notes';
import {
  financialYearStart,
  invoiceGstState,
  invoiceTotals,
  matchesInvoicePeriod,
  paymentDue,
  paymentDeductionRate,
  type Invoice,
} from '../../model';
import { invoiceCreatorName } from '../../access';

export type ReportRow = { id: string; cells: (string | number)[] };
export const invoiceHeaders = [
  'Client Name',
  'Entity Name',
  'Division',
  'Invoice Number',
  'GST State',
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
  'Payment Deduction',
  'Total Credit Notes',
  'Payments Received',
  'Payment to be received',
  'Payment Status',
  'Currency',
  'Created By',
];
export const creditHeaders = [
  'Credit Note Number',
  'Credit Note Date',
  'Original Invoice Number',
  'Original Invoice Date',
  'Client Name',
  'Entity Name',
  'GST State',
  'Seller GST Number',
  'Client GST Number',
  'Campaigns',
  'Mode',
  'Value',
  'Base Amount',
  'CGST',
  'SGST',
  'IGST',
  'Grand Total',
  'Currency',
];

export function accountingReport(
  invoices: Invoice[],
  notes: CreditNote[],
  financialYear: string,
  month: string,
) {
  const period = { financialYear, month };
  const selectedInvoices = invoices.filter((i) => matchesInvoicePeriod(i, period));
  // A credit note is included by its own date, independently of its invoice's date.
  const selectedCredits = notes.filter((n) => matchesInvoicePeriod({ date: n.date }, period));
  const invoiceRows: ReportRow[] = selectedInvoices.map((i) => {
    const t = invoiceTotals(i);
    return {
      id: i.id,
      cells: [
        i.client.name,
        i.client.entityName || i.client.name,
        [...new Set(i.campaigns.map((c) => c.division))].join(' / '),
        i.id,
        invoiceGstState(i),
        i.date,
        [...new Set(i.campaigns.map((c) => c.month))].join(' / '),
        i.client.poc,
        i.client.gst,
        i.client.stateCode,
        i.client.state,
        t.base,
        t.cgst,
        t.sgst,
        t.igst,
        t.total,
        i.financials?.deductionAmount ??
          roundAmount(new D(t.base).times(paymentDeductionRate(i.client.gst)), i.currency || 'INR'),
        i.financials?.creditTotal ?? i.creditTotal ?? 0,
        i.financials?.paymentsReceived ?? i.paymentsReceived ?? 0,
        paymentDue(i),
        i.paymentStatus || 'N',
        i.currency || 'INR',
        invoiceCreatorName(i, []),
      ],
    };
  });
  const creditRows: ReportRow[] = selectedCredits.map((n) => {
    const original = n.invoiceSnapshot || invoices.find((i) => i.id === n.invoiceId);
    return {
      id: n.id,
      cells: [
        n.id,
        n.date,
        n.invoiceId,
        original?.date || '',
        original?.client.name || '',
        original?.client.entityName || original?.client.name || '',
        original ? invoiceGstState(original) : '',
        original?.billFromGst || '07-DEMO-GST',
        original?.client.gst || '',
        n.campaignRows?.map((row) => row.description).join(' / ') || '',
        n.mode,
        n.value,
        n.base,
        n.cgst,
        n.sgst,
        n.igst,
        n.total,
        n.currency,
      ],
    };
  });
  const months = Array.from({ length: 12 }, (_, index) => {
    const year = Number(financialYear) + (index >= 9 ? 1 : 0);
    return `${year}-${String(((index + 3) % 12) + 1).padStart(2, '0')}`;
  });
  const trends = months
    .filter((m) => !month || month === m)
    .map((m) => ({
      month: m,
      label: new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', {
        month: 'short',
        year: '2-digit',
        timeZone: 'UTC',
      }),
      Invoices: selectedInvoices.filter((i) => i.date.startsWith(m)).length,
      'Credit notes': selectedCredits.filter((n) => n.date.startsWith(m)).length,
    }));
  return { invoiceRows, creditRows, months, trends };
}

export function accountingYears(invoices: Invoice[], notes: CreditNote[], today: string) {
  const years = [
    financialYearStart(today),
    ...invoices.map((i) => financialYearStart(i.date)),
    ...notes.map((n) => financialYearStart(n.date)),
  ];
  return Array.from(
    { length: Math.max(...years) - Math.min(...years) + 1 },
    (_, i) => Math.max(...years) - i,
  );
}

export function demoAccountingCsv(report: ReturnType<typeof accountingReport>) {
  const rows: (string | number)[][] = [
    ['Invoice Data'],
    invoiceHeaders,
    ...report.invoiceRows.map((r) => r.cells),
  ];
  if (report.creditRows.length)
    rows.push(
      [],
      [],
      ['Credit Note Data'],
      creditHeaders,
      ...report.creditRows.map((r) => r.cells),
    );
  return (
    '\ufeff' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text =
              typeof value === 'string' && /^\s*[=+@-]/.test(value) ? `'${value}` : String(value);
            return `"${text.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}
