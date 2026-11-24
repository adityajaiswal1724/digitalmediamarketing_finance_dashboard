import { describe, expect, it } from 'vitest';
import { accountingReport, demoAccountingCsv } from './accounting-report';
import { initialInvoices, invoiceGstState } from '../../model';
import type { CreditNote } from '../../credit-notes';

const juneInvoice = {
  ...initialInvoices[0],
  id: 'DEMO/26-27/171',
  date: '2026-06-30',
  billFromGst: '06-DEMO-GST' as const,
};
const julyInvoice = { ...juneInvoice, id: 'DEMO/26-27/172', date: '2026-07-01' };
const julyCredit: CreditNote = {
  id: 'DCN/26-27/002',
  date: '2026-07-01',
  invoiceId: juneInvoice.id,
  mode: 'percentage',
  value: 10,
  base: 10,
  cgst: 0,
  sgst: 0,
  igst: 1.8,
  total: 11.8,
  currency: 'INR',
  invoiceSnapshot: juneInvoice,
};

describe('accounting periods and export', () => {
  it('includes a July credit independently of its June invoice and counts both series', () => {
    const report = accountingReport([juneInvoice, julyInvoice], [julyCredit], '2026', '2026-07');
    expect(report.invoiceRows.map((r) => r.id)).toEqual([julyInvoice.id]);
    expect(report.creditRows.map((r) => r.id)).toEqual([julyCredit.id]);
    expect(report.trends).toEqual([
      { month: '2026-07', label: 'Jul 26', Invoices: 1, 'Credit notes': 1 },
    ]);
    const [invoices, credits] = demoAccountingCsv(report).split('"Credit Note Data"');
    expect(invoices).not.toContain(juneInvoice.id);
    expect(credits).toContain(juneInvoice.id);
  });
  it('omits the credit section when empty and escapes spreadsheet formulas', () => {
    const report = accountingReport(
      [{ ...juneInvoice, client: { ...juneInvoice.client, name: '=1+1' } }],
      [julyCredit],
      '2026',
      '2026-06',
    );
    expect(demoAccountingCsv(report)).not.toContain('Credit Note Data');
    expect(demoAccountingCsv(report)).toContain("'=1+1");
  });
  it('uses April–March financial years and seller GST registration', () => {
    const report = accountingReport(
      [juneInvoice, { ...julyInvoice, date: '2027-04-01' }],
      [julyCredit],
      '2026',
      '',
    );
    expect(report.invoiceRows).toHaveLength(1);
    expect(report.months[0]).toBe('2026-04');
    expect(report.months.at(-1)).toBe('2027-03');
    expect(report.trends.reduce((sum, m) => sum + m['Credit notes'], 0)).toBe(1);
    expect(invoiceGstState(juneInvoice)).toBe('Haryana');
    expect(invoiceGstState({})).toBe('Delhi');
  });
});
