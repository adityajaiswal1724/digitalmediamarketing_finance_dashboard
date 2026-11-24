import { D, currencyDigits, roundAmount } from '@demo/finance';
import { financialYearStart, invoiceEditDeadline, invoiceTotals, type Invoice } from './model';

export type CreditNoteMode = 'percentage' | 'amount' | 'reversal';

export interface CreditNote {
  version?: number;
  id: string;
  invoiceId: string;
  date: string;
  mode: CreditNoteMode;
  value: number;
  currency: string;
  base: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  campaignRows?: CreditNoteCampaignRow[];
  editDeadline?: string;
  invoiceSnapshot?: Invoice;
}

export interface CreditNoteCampaignRow {
  description: string;
  amount: number;
}

export function creditNoteCampaignRows(
  invoice: Invoice,
  mode: CreditNoteMode,
  value: number,
  credits: CreditNote[] = [],
): CreditNoteCampaignRow[] {
  const currency = invoice.currency || 'INR';
  const round = (value: import('decimal.js').default.Value) => roundAmount(value, currency);
  const invoiceRows = invoice.campaigns.map((campaign) => ({
    description: campaign.name,
    amount:
      campaign.baseAmount ??
      round(
        new D(campaign.units)
          .times(campaign.rate)
          .times(
            invoice.client.country === 'India' && campaign.exchangeRateEnabled
              ? campaign.exchangeRate || 0
              : 1,
          ),
      ),
  }));
  if (mode === 'percentage')
    return invoiceRows.map((row) => ({
      description: row.description,
      amount: round(new D(row.amount).times(value).div(100)),
    }));
  const rowSignature = JSON.stringify(invoiceRows.map((row) => [row.description, row.amount]));
  const sameRows = credits.every(
    (note) =>
      !note.invoiceSnapshot ||
      JSON.stringify(note.invoiceSnapshot.campaigns.map((row) => [row.name, row.baseAmount])) ===
        rowSignature,
  );
  const remainingBase = round(
    new D(invoiceTotals(invoice).base).minus(
      credits.reduce((sum, note) => sum.plus(note.base), new D(0)),
    ),
  );
  const redistributed =
    !sameRows && remainingBase > 0
      ? creditNoteCampaignRows(invoice, 'amount', remainingBase)
      : null;
  const available = invoiceRows.map((row, index) => ({
    ...row,
    amount: redistributed
      ? redistributed[index].amount
      : round(
          new D(row.amount).minus(
            credits.reduce(
              (sum, note) => sum.plus(note.campaignRows?.[index]?.amount ?? 0),
              new D(0),
            ),
          ),
        ),
  }));
  if (mode === 'reversal') return available;
  const base = available.reduce((sum, row) => sum.plus(row.amount), new D(0));
  if (base.lte(0)) return available.map((row) => ({ ...row, amount: 0 }));
  const unit = 10 ** currencyDigits(currency);
  const target = round(value);
  const allocations = available.map((row, index) => {
    const exact = new D(row.amount).times(target).div(base).times(unit);
    return { index, cents: exact.floor().toNumber(), remainder: exact.minus(exact.floor()) };
  });
  const remaining = new D(target)
    .times(unit)
    .minus(allocations.reduce((sum, row) => sum + row.cents, 0))
    .toNumber();
  const ranked = [...allocations].sort((a, b) => b.remainder.cmp(a.remainder) || a.index - b.index);
  for (let i = 0; i < remaining && i < ranked.length; i++) ranked[i].cents++;
  return available.map((row, index) => ({
    description: row.description,
    amount: round(new D(allocations[index].cents).div(unit)),
  }));
}

export function creditNoteAmounts(
  invoice: Invoice,
  mode: CreditNoteMode,
  value: number,
  credits: CreditNote[] = [],
) {
  const original = invoiceTotals(invoice);
  const currency = invoice.currency || 'INR';
  const round = (value: import('decimal.js').default.Value) => roundAmount(value, currency);
  const campaignRows = creditNoteCampaignRows(invoice, mode, value, credits);
  const base = round(campaignRows.reduce((sum, row) => sum.plus(row.amount), new D(0)));
  const remainingBase = new D(original.base).minus(
    credits.reduce((sum, note) => sum.plus(note.base), new D(0)),
  );
  const tax = (key: 'cgst' | 'sgst' | 'igst') => {
    const available = new D(original[key]).minus(
      credits.reduce((sum, note) => sum.plus(note[key]), new D(0)),
    );
    return round(
      remainingBase.eq(base)
        ? available
        : D.min(
            available,
            original.base > 0 ? new D(original[key]).times(base).div(original.base) : 0,
          ),
    );
  };
  const cgst = tax('cgst'),
    sgst = tax('sgst'),
    igst = tax('igst');
  return { base, cgst, sgst, igst, total: round(new D(base).plus(cgst).plus(sgst).plus(igst)) };
}

export function nextCreditNoteId(creditNotes: CreditNote[], date: string) {
  const start = financialYearStart(date);
  const financialYear = `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
  const prefix = `DCN/${financialYear}/`;
  const numbers = creditNotes
    .filter((note) => note.id.startsWith(prefix))
    .map((note) => Number(note.id.slice(prefix.length)))
    .filter(Number.isFinite);
  return `${prefix}${String(Math.max(0, ...numbers) + 1).padStart(3, '0')}`;
}

export function migrateCreditNoteIds(creditNotes: CreditNote[]) {
  const migrated: CreditNote[] = creditNotes.filter((note) =>
    /^DCN\/\d{2}-\d{2}\/\d{3}$/.test(note.id),
  );
  return creditNotes.map((note) => {
    if (/^DCN\/\d{2}-\d{2}\/\d{3}$/.test(note.id)) return note;
    const updated = {
      ...note,
      id: nextCreditNoteId(migrated, note.date),
    };
    migrated.push(updated);
    return updated;
  });
}

export function creditNoteEditDeadline(date: string) {
  return invoiceEditDeadline(date);
}

export function canEditCreditNote(creditNote: CreditNote, today: string) {
  return today <= (creditNote.editDeadline || creditNoteEditDeadline(creditNote.date));
}

export function validateCreditNote(
  invoice: Invoice | undefined,
  date: string,
  mode: CreditNoteMode,
  value: number,
) {
  if (!invoice) return 'Select an original invoice.';
  if (!date) return 'Select a credit note date.';
  if (date < invoice.date) return 'A credit note cannot predate its original invoice.';
  if (!Number.isFinite(value) || value <= 0)
    return mode === 'percentage'
      ? 'Enter a percentage greater than zero.'
      : 'Enter a base amount greater than zero.';
  const originalBase = invoiceTotals(invoice).base;
  if (mode === 'percentage' && value > 100) return 'The percentage cannot exceed 100%.';
  if (mode === 'amount' && value > originalBase)
    return 'The credit note base amount cannot exceed the invoice base amount.';
  return '';
}

export function matchesCreditNotePeriod(
  creditNote: CreditNote,
  {
    startDate = '',
    endDate = '',
    financialYear = '',
    month = '',
  }: {
    startDate?: string;
    endDate?: string;
    financialYear?: string;
    month?: string;
  },
) {
  return (
    (!startDate || creditNote.date >= startDate) &&
    (!endDate || creditNote.date <= endDate) &&
    (!financialYear || financialYearStart(creditNote.date) === Number(financialYear)) &&
    (!month || creditNote.date.slice(0, 7) === month)
  );
}
