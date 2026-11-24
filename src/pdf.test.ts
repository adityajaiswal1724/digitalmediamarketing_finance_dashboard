import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { makePdf, makeCreditNotePdf } from './pdf';
import { createDemoData } from './demo-data';

beforeAll(() => {
  vi.stubGlobal('fetch', async (url: string) => new Response(await readFile(`public${url}`)));
});
afterAll(() => vi.unstubAllGlobals());
describe('sample PDFs', () => {
  it('generates domestic, international, credit and multipage documents with sample branding on every page', async () => {
    const data = createDemoData('2026-11-23');
    await mkdir('output/pdf', {recursive:true});
    const domestic = data.invoices.at(-12)!;
    const international = data.invoices.at(-6)!;
    const note = data.creditNotes.at(-1)!;
    const original = data.invoices.find(i=>i.id===note.invoiceId)!;
    const docs = [
      ['sample-invoice', await makePdf(domestic)],
      ['sample-international-invoice', await makePdf(international)],
      ['sample-credit-note', await makeCreditNotePdf(note, original)],
      ['sample-multipage-invoice', await makePdf({...domestic,campaigns:Array.from({length:48},(_,n)=>({...domestic.campaigns[0],name:`Sample campaign ${n+1} with detailed demonstration activity`}))})],
    ] as const;
    for(const [name, doc] of docs) {
      expect(doc.getNumberOfPages()).toBeGreaterThan(0);
      expect(doc.output()).toContain('Sample document');
      await writeFile(`output/pdf/${name}.pdf`,Buffer.from(doc.output('arraybuffer')));
    }
    expect(docs[3][1].getNumberOfPages()).toBeGreaterThan(1);
  });
});
