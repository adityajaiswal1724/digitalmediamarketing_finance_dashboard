import { describe, expect, it } from 'vitest';
import { createDemoData } from './demo-data';
import { initialClients, invoiceTotals, financialYearStart, paymentDue, latestDate, validInvoice } from './model';
import { creditNoteAmounts, validateCreditNote } from './credit-notes';
import { initialAccounts, authenticate, employeeInvoiceHistory, type Employee } from './access';
import { validateInvoiceEdit, reconcileInvoice } from './demo-state';
const data = createDemoData('2026-11-23');
describe('portfolio sample dataset', () => {
  it('contains three financial years, 12 fictional clients, 384 invoices and 96 linked credits', () => {
    expect(initialClients).toHaveLength(12); expect(data.invoices).toHaveLength(384); expect(data.creditNotes).toHaveLength(96);
    expect(new Set(data.invoices.map(i => financialYearStart(i.date)))).toEqual(new Set([2024,2025,2026]));
    expect(new Set(data.invoices.map(i => i.id)).size).toBe(data.invoices.length);
    expect(new Set(data.creditNotes.map(i => i.id)).size).toBe(data.creditNotes.length);
    expect(data.invoices.every(i => i.date <= '2026-11-23')).toBe(true);
  });
  it('reconciles every payment and credit, including zero remaining balances', () => {
    for (const invoice of data.invoices) {
      const t=invoiceTotals(invoice), notes=data.creditNotes.filter(n=>n.invoiceId===invoice.id);
      expect(t.total).toBeCloseTo(t.base+t.cgst+t.sgst+t.igst,2);
      expect(invoice.creditTotal||0).toBeCloseTo(notes.reduce((s,n)=>s+n.total,0),2);
      expect(paymentDue(invoice)).toBeGreaterThanOrEqual(0);
      expect(invoice.paymentStatus).toBe(paymentDue(invoice)===0?'Y':'N');
      for(const note of notes) {
        expect(note.invoiceSnapshot?.id).toBe(invoice.id);
        expect(note.date >= invoice.date).toBe(true);
        expect(note).toMatchObject(creditNoteAmounts(invoice,note.mode,note.value));
        expect(note.base).toBeLessThanOrEqual(t.base);
        expect(note.campaignRows!.reduce((s,r)=>s+r.amount,0)).toBeCloseTo(note.base,2);
      }
    }
  });
  it('includes local GST, interstate GST and international zero-tax records', () => {
    expect(data.invoices.some(i=>invoiceTotals(i).cgst>0)).toBe(true);
    expect(data.invoices.some(i=>invoiceTotals(i).igst>0)).toBe(true);
    for(const i of data.invoices.filter(i=>i.client.country!=='India')) expect(invoiceTotals(i)).toMatchObject({cgst:0,sgst:0,igst:0});
    expect(new Set(data.invoices.map(i=>i.currency)).size).toBe(7);
    expect(initialClients.every(c=>c.email.endsWith('@example.com') && c.address.includes('000000') && (!c.gst||c.gst.includes('DEMO')))).toBe(true);
  });
  it('provides working role credentials and populated employee-specific histories', () => {
    expect(authenticate('admin','admin@1234',initialAccounts)).toEqual({role:'admin'});
    expect(authenticate('ca1','ca@1234',initialAccounts)).toEqual({role:'ca',accountId:'ca1'});
    for(const e of initialAccounts.filter((e):e is Employee=>e.role!=='ca')) {
      const history=employeeInvoiceHistory(data.invoices,e);expect(history.length).toBeGreaterThan(0);
      expect(history.every(i=>i.createdByEmployeeId===e.id&&i.campaigns.every(c=>c.division===e.department))).toBe(true);
    }
  });
  it('enforces global chronology independently of personal history',()=>{
    const date=latestDate(data.invoices);expect(validInvoice(date,data.invoices,data.invoices[0].campaigns)).toBe('');
    expect(validInvoice('2026-11-01',data.invoices,data.invoices[0].campaigns)).toContain('earlier');
  });
  it('handles FY rollover and seeds without future records on the first day',()=>{
    const april=createDemoData('2027-04-01');expect(new Set(april.invoices.map(i=>financialYearStart(i.date)))).toEqual(new Set([2025,2026,2027]));
    expect(april.invoices.every(i=>i.date<='2027-04-01')).toBe(true);
  });
  it('rejects credits dated before their invoice and protects credited invoice edits',()=>{
    const note=data.creditNotes[0], original=data.invoices.find(i=>i.id===note.invoiceId)!;
    expect(validateCreditNote(original,'2020-01-01','amount',10)).toContain('predate');
    expect(validateInvoiceEdit(original,{...original,currency:'USD'},data.creditNotes)).toContain('currency');
    expect(validateInvoiceEdit(original,{...original,campaigns:original.campaigns.map(c=>({...c,rate:0.01}))},data.creditNotes)).toContain('credited');
    expect(validateInvoiceEdit(original,original,data.creditNotes)).toBe('');
    expect(reconcileInvoice(original,data.creditNotes).creditTotal).toBe(original.creditTotal);
  });
});
