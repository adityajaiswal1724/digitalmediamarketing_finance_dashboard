import { describe, expect, it } from 'vitest';
import {
  amountInWords,
  currencyDigits,
  lineAmount,
  roundAmount,
  supportedCurrencies,
} from '@demo/finance';
import {
  campaignRate,
  totals,
  canEditInvoice,
  initialInvoices,
  invoiceTotals,
  paymentDue,
} from './model';
import { creditNoteAmounts, creditNoteCampaignRows, type CreditNote } from './credit-notes';

describe('approved financial policy shared by previews and PDFs', () => {
  const campaign = {
    division: 'CPS' as const,
    month: '2026-10',
    name: 'Precision',
    units: 100,
    rate: 1.2345,
  };
  it('preserves entered and converted rates until the line amount is calculated', () => {
    expect(campaignRate(campaign)).toBe(1.2345);
    expect(lineAmount(100, 1.2345)).toBe(123.45);
    expect(totals([campaign], 'Delhi').base).toBe(123.45);
    expect(lineAmount(100, 1.2345, 95.123456)).toBe(11742.99);
    expect(lineAmount(3, 0.335)).toBe(1.01);
  });
  it('selects GST from the seller registration and client state', () => {
    expect(totals([campaign], 'Haryana', 'India', '06-DEMO-GST')).toMatchObject({
      cgst: 11.11,
      sgst: 11.11,
      igst: 0,
    });
    expect(totals([campaign], 'Delhi', 'India', '06-DEMO-GST')).toMatchObject({
      cgst: 0,
      sgst: 0,
      igst: 22.22,
    });
  });
  it('uses currency precision and words matching the rounded numeric amount', () => {
    expect(amountInWords(123.45, 'INR')).toBe(
      'One Hundred Twenty-Three Rupees and Forty-Five Paise Only',
    );
    expect(amountInWords(123.45, 'USD')).toBe(
      'One Hundred Twenty-Three US Dollars and Forty-Five Cents Only',
    );
    expect(amountInWords(1.999, 'USD')).toBe('Two US Dollars Only');
    expect(lineAmount(1, 123.45, 1, 'JPY')).toBe(123);
    expect(amountInWords(123.45, 'JPY')).toBe('One Hundred Twenty-Three Yen Only');
    expect(amountInWords(1.23, 'BHD')).toBe('One Point Two Three BHD Only');
    expect(amountInWords(1000000, 'USD')).toBe('One Million US Dollars Only');
    for (const currency of supportedCurrencies) {
      expect(currencyDigits(currency)).toBeLessThanOrEqual(2);
      expect(amountInWords(roundAmount(123.456, currency), currency)).not.toMatch(/undefined|NaN/);
    }
  });
  it('allows credited invoices to be edited only through their own deadline', () => {
    const invoice = {
      ...initialInvoices[0],
      date: '2026-10-01',
      editDeadline: '2026-11-05',
      creditTotal: 10,
    };
    expect(canEditInvoice(invoice, '2026-11-05')).toBe(true);
    expect(canEditInvoice(invoice, '2026-11-06')).toBe(false);
    const original = invoiceTotals(invoice);
    expect(paymentDue({ ...invoice, paymentsReceived: 100 })).toBe(
      roundAmount(original.total - 10 - 100),
    );
  });
  it('credits stored row values and reverses the remaining base and exact tax', () => {
    const invoice = {
      ...initialInvoices[0],
      taxOverride: undefined,
      campaigns: [campaign],
      financials: {
        base: 123.45,
        cgst: 11.11,
        sgst: 11.11,
        igst: 0,
        total: 145.67,
        paymentDue: 143.2,
      },
    };
    const amounts = creditNoteAmounts(invoice, 'percentage', 10);
    const rows = creditNoteCampaignRows(invoice, 'percentage', 10);
    const credit = { ...amounts, campaignRows: rows } as CreditNote;
    expect(amounts).toEqual({ base: 12.35, cgst: 1.11, sgst: 1.11, igst: 0, total: 14.57 });
    const reversal = creditNoteAmounts(invoice, 'reversal', 100, [credit]);
    expect(reversal).toEqual({ base: 111.1, cgst: 10, sgst: 10, igst: 0, total: 131.1 });
  });
});
