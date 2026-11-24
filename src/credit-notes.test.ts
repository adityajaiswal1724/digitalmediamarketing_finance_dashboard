import { describe, expect, it } from 'vitest';
import {
  canEditCreditNote,
  creditNoteAmounts,
  creditNoteCampaignRows,
  matchesCreditNotePeriod,
  migrateCreditNoteIds,
  nextCreditNoteId,
  validateCreditNote,
  type CreditNote,
} from './credit-notes';
import { initialInvoices } from './model';

const invoice = initialInvoices[0];

describe('credit notes', () => {
  it('uses a separate three-digit sequence for each financial year', () => {
    expect(nextCreditNoteId([], '2025-04-01')).toBe('DCN/25-26/001');
    expect(nextCreditNoteId([{ id: 'DCN/25-26/001' } as CreditNote], '2026-03-31')).toBe(
      'DCN/25-26/002',
    );
    expect(nextCreditNoteId([{ id: 'DCN/25-26/009' } as CreditNote], '2026-04-01')).toBe(
      'DCN/26-27/001',
    );
  });

  it('migrates legacy credit-note ids without colliding with existing FY records', () => {
    expect(
      migrateCreditNoteIds([
        { id: 'CN/101', date: '2025-06-01' } as CreditNote,
        { id: 'DCN/25-26/003', date: '2025-07-01' } as CreditNote,
      ]).map((note) => note.id),
    ).toEqual(['DCN/25-26/004', 'DCN/25-26/003']);
  });

  it('raises proportional base and tax values by percentage', () => {
    expect(creditNoteAmounts(invoice, 'percentage', 20)).toEqual({
      base: 200,
      cgst: 0,
      sgst: 0,
      igst: 36,
      total: 236,
    });
  });

  it('uses the original tax proportions for an entered base amount', () => {
    expect(creditNoteAmounts(invoice, 'amount', 1000)).toEqual({
      base: 1000,
      cgst: 0,
      sgst: 0,
      igst: 180,
      total: 1180,
    });
  });

  it('calculates percentage credits separately for every campaign row', () => {
    const multiCampaignInvoice = {
      ...invoice,
      campaigns: [
        { division: 'CPL' as const, month: '2026-04', name: 'Campaign A', units: 1, rate: 0.05 },
        { division: 'CPL' as const, month: '2026-05', name: 'Campaign B', units: 1, rate: 0.05 },
      ],
      taxOverride: undefined,
    };
    expect(creditNoteCampaignRows(multiCampaignInvoice, 'percentage', 10)).toEqual([
      { description: 'Campaign A', amount: 0.01 },
      { description: 'Campaign B', amount: 0.01 },
    ]);
    expect(creditNoteAmounts(multiCampaignInvoice, 'percentage', 10).base).toBe(0.02);
  });

  it('locks after the fifth of the following month', () => {
    const note = { date: '2026-09-01' } as CreditNote;
    expect(canEditCreditNote(note, '2026-10-05')).toBe(true);
    expect(canEditCreditNote(note, '2026-10-06')).toBe(false);
  });

  it('allows prior-year dates and validates the requested value', () => {
    expect(validateCreditNote({...invoice,date:'2022-04-01'}, '2022-04-01', 'amount', 100)).toBe('');
    expect(validateCreditNote(invoice, '2026-09-20', 'percentage', 101)).toBe(
      'The percentage cannot exceed 100%.',
    );
  });

  it('filters by credit-note date using April-to-March financial years', () => {
    const note = { date: '2024-03-31' } as CreditNote;
    expect(matchesCreditNotePeriod(note, { financialYear: '2023' })).toBe(true);
    expect(matchesCreditNotePeriod(note, { month: '2024-04' })).toBe(false);
  });
});
