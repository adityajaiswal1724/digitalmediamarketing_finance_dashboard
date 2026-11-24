import { describe, it, expect } from 'vitest';
import {
  campaignRate,
  totals,
  validInvoice,
  nextInvoiceId,
  initialInvoices,
  invoiceTotals,
  latestDate,
  invoiceEditDeadline,
  canEditInvoice,
  money,
  financialYearStart,
  financialYearLabel,
  financialYearMonths,
  financialYearOptions,
  matchesInvoicePeriod,
  paymentDeductionRate,
  paymentDue,
  normalizeGst,
  panFromGst,
  demoGstRegistration,
  type Campaign,
} from './model';
const campaigns: Campaign[] = [
  { division: 'Mobile', month: '2026-07', name: 'Sample campaign', units: 6406, rate: 12 },
];
describe('Invoice rules', () => {
  it('normalizes GSTIN and derives PAN from its middle ten characters', () => {
    expect(normalizeGst('27democ0000x0z0')).toBe('27DEMOC0000X0Z0');
    expect(panFromGst('27democ0000x0z0')).toBe('DEMOC0000X');
    expect(panFromGst('27DEMO')).toBe('');
  });
  it('resolves the selected Demo Company GST registration and defaults legacy invoices to Delhi', () => {
    expect(demoGstRegistration().gst).toBe('07-DEMO-GST');
    const haryana = demoGstRegistration('06-DEMO-GST');
    expect(haryana.address).toContain('Sample Square');
    expect(haryana.address).toContain('PIN 000000');
  });
  it('deducts 2% for C/F GST entities and 1% for P entities', () => {
    expect(paymentDeductionRate('27DEMCO0000X0Z0')).toBe(0.02);
    expect(paymentDeductionRate('27DEMFO0000X0Z0')).toBe(0.02);
    expect(paymentDeductionRate('27DEMPO0000X0Z0')).toBe(0.01);
    expect(paymentDeductionRate('')).toBe(0);
    const sample = {
      ...initialInvoices[0],
      client: { ...initialInvoices[0].client, gst: '27DEMCO0000X0Z0' },
      campaigns: [
        { division: 'CPL' as const, month: '2026-04', name: 'Campaign', units: 10, rate: 100 },
      ],
      taxOverride: { cgst: 0, sgst: 0, igst: 180 },
    };
    expect(paymentDue(sample)).toBe(1160);
  });
  it('applies Delhi split taxes', () =>
    expect(totals(campaigns, 'Delhi')).toEqual({
      base: 76872,
      cgst: 6918.48,
      sgst: 6918.48,
      igst: 0,
      total: 90708.96,
    }));
  it('applies IGST to other states', () =>
    expect(totals(campaigns, 'Maharashtra')).toEqual({
      base: 76872,
      cgst: 0,
      sgst: 0,
      igst: 13836.96,
      total: 90708.96,
    }));
  it('keeps international invoice amounts in the selected currency without conversion', () => {
    const euroCampaign: Campaign[] = [
      {
        division: 'CPS',
        month: '2026-10',
        name: 'International campaign',
        units: 100,
        rate: 1,
      },
    ];
    expect(totals(euroCampaign, '', 'France')).toEqual({
      base: 100,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total: 100,
    });
    expect(money(100, 'EUR')).toBe('€100.00');
  });
  it('applies an enabled exchange rate to an Indian campaign and keeps the result in INR', () => {
    const converted: Campaign = {
      division: 'CPS',
      month: '2026-10',
      name: 'International campaign',
      units: 100,
      rate: 1,
      exchangeRateEnabled: true,
      exchangeRate: 95,
    };
    expect(campaignRate(converted, 'India')).toBe(95);
    expect(totals([converted], 'Maharashtra', 'India')).toEqual({
      base: 9500,
      cgst: 0,
      sgst: 0,
      igst: 1710,
      total: 11210,
    });
    expect(campaignRate(converted, 'France')).toBe(1);
  });
  it('ignores exchange rate fields until the option is enabled', () => {
    const normal: Campaign = {
      division: 'CPS',
      month: '2026-10',
      name: 'Normal campaign',
      units: 100,
      rate: 1,
      exchangeRate: 95,
    };
    expect(totals([normal], 'Maharashtra', 'India').base).toBe(100);
    expect(
      validInvoice('2026-09-20', initialInvoices, [
        { ...normal, exchangeRateEnabled: true, exchangeRate: 0 },
      ]),
    ).toContain('positive exchange rate');
  });
  it('combines campaigns before calculating the grand total', () =>
    expect(totals([...campaigns, { ...campaigns[0], units: 100, rate: 10 }], 'Delhi').total).toBe(
      91888.96,
    ));
  it('rejects earlier invoice dates but permits the same date', () => {
    expect(validInvoice('2026-09-19', initialInvoices, campaigns)).toBeTruthy();
    expect(validInvoice('2026-09-20', initialInvoices, campaigns)).toBe('');
    expect(validInvoice('2026-09-21', initialInvoices, campaigns)).toBe('');
  });
  it('rejects a missing invoice date', () => {
    expect(validInvoice('', initialInvoices, campaigns)).toBeTruthy();
  });
  it('uses the latest generated date rather than the live date', () => {
    const future = {
      ...initialInvoices[0],
      id: 'DEMO/26-27/100',
      date: '2026-12-01',
      historical: false,
    };
    expect(latestDate([...initialInvoices, future])).toBe('2026-12-01');
    expect(validInvoice('2026-11-30', [...initialInvoices, future], campaigns)).toBeTruthy();
  });
  it('uses approved FY openings and increments persisted invoices', () => {
    expect(nextInvoiceId(initialInvoices, '2026-09-20')).toBe('DEMO/26-27/103');
    const created = {
      ...initialInvoices[0],
      id: 'DEMO/26-27/171',
      historical: false,
    };
    expect(nextInvoiceId([...initialInvoices, created], '2026-09-20')).toBe('DEMO/26-27/172');
    expect(nextInvoiceId([...initialInvoices, created], '2027-04-01')).toBe('DEMO/27-28/101');
  });
  it('rejects missing campaigns and invalid numeric values', () => {
    expect(validInvoice('2026-09-20', initialInvoices, [])).toBeTruthy();
    expect(
      validInvoice('2026-09-20', initialInvoices, [{ ...campaigns[0], rate: NaN }]),
    ).toBeTruthy();
  });
  it('allows edits through the fifth of the following month regardless of issue day', () => {
    for (const date of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-22']) {
      const invoice = { ...initialInvoices[0], date };
      expect(invoiceEditDeadline(date)).toBe('2026-10-05');
      expect(canEditInvoice(invoice, '2026-10-05')).toBe(true);
      expect(canEditInvoice(invoice, '2026-10-06')).toBe(false);
    }
  });
  it('handles December rollover and keeps the original cutoff after an edit', () => {
    expect(invoiceEditDeadline('2026-12-31')).toBe('2027-01-05');
    const edited = {
      ...initialInvoices[0],
      date: '2026-10-01',
      editDeadline: '2026-10-05',
    };
    expect(canEditInvoice(edited, '2026-10-06')).toBe(false);
  });
  it('uses an April-to-March financial year and combines invoice period filters', () => {
    expect(financialYearStart('2026-03-31')).toBe(2025);
    expect(financialYearStart('2026-04-01')).toBe(2026);
    expect(financialYearLabel(2026)).toBe('FY 2026–27');
    const invoice = { ...initialInvoices[0], date: '2026-09-22' };
    expect(
      matchesInvoicePeriod(invoice, {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        financialYear: '2026',
        month: '2026-09',
      }),
    ).toBe(true);
    expect(matchesInvoicePeriod(invoice, { month: '2026-10' })).toBe(false);
    expect(matchesInvoicePeriod(invoice, { financialYear: '2025' })).toBe(false);
  });
  it('builds dynamic financial-year graph options and April-to-March month order', () => {
    expect(financialYearMonths(2026)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ]);
    expect(financialYearOptions(['2024-06-01'], '2026-04-01')).toEqual([2026, 2025, 2024]);
    expect(financialYearOptions([], '2027-04-01')).toEqual([2027]);
  });
});
