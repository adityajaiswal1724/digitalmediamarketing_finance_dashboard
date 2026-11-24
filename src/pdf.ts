import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { amountInWords, lineAmount } from '@demo/finance';
import { demoGstRegistration, invoiceTotals, type Invoice } from './model';
import { creditNoteCampaignRows, type CreditNote } from './credit-notes';

const green: [number, number, number] = [23, 62, 57];
const muted: [number, number, number] = [91, 111, 106];
async function documentBase(title: string, number: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // Embedded Carlito supports the currency glyphs used by the app.
  for (const weight of ['regular', 'bold']) {
    const response = await fetch(`/fonts/carlito-${weight}.ttf`);
    if (!response.ok) throw new Error('PDF font could not be loaded.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    doc.addFileToVFS(`${weight}.ttf`, btoa(binary));
    doc.addFont(`${weight}.ttf`, 'Demo', weight === 'bold' ? 'bold' : 'normal');
  }
  doc.setProperties({ title: `${title} ${number} | Sample document`, author: 'Demo Company', subject: 'Fictional portfolio demonstration. Not a valid financial document.' });
  return doc;
}
function header(doc: jsPDF, title: string, number: string) {
  doc.setFillColor(...green);doc.roundedRect(15, 14, 16, 16, 4, 4, 'F');
  doc.setTextColor(198, 242, 134);doc.setFont('Demo','bold');doc.setFontSize(15);doc.text('DC',18,24.5);
  doc.setTextColor(...green);doc.setFontSize(18);doc.text('Demo Company',35,21);
  doc.setFont('Demo','normal');doc.setFontSize(9);doc.setTextColor(...muted);doc.text('FINANCE WORKSPACE',35,27);
  doc.setFont('Demo','bold');doc.setFontSize(15);doc.setTextColor(...green);doc.text(title,195,21,{align:'right'});
  doc.setFont('Demo','normal');doc.setFontSize(10);doc.text(number,195,28,{align:'right'});
  doc.setFillColor(240,246,237);doc.roundedRect(15,35,180,9,2,2,'F');doc.setFontSize(9);doc.text('SAMPLE DOCUMENT  •  Fictional data  •  Not valid for payment or tax filing',105,41,{align:'center'});
}
function finish(doc: jsPDF, title: string, number: string) {
  for (let page=1;page<=doc.getNumberOfPages();page++) {
    doc.setPage(page);header(doc,title,number);
    doc.setDrawColor(218,228,222);doc.line(15,281,195,281);
    doc.setFont('Demo','normal');doc.setFontSize(8);doc.setTextColor(...muted);
    doc.text('Demo Company · finance@example.com · Fictional portfolio document',15,287);
    doc.text(`${page} / ${doc.getNumberOfPages()}`,195,287,{align:'right'});
  }
}
function details(doc: jsPDF, invoice: Invoice, date: string, original?: string) {
  const issuer = demoGstRegistration(invoice.billFromGst);
  const client = invoice.client;
  autoTable(doc, {
    startY: 50, margin:{left:15,right:15,top:50,bottom:23},
    theme:'plain',styles:{font:'Demo',fontSize:10,cellPadding:3,textColor:green,overflow:'linebreak'},
    columnStyles:{0:{cellWidth:90},1:{cellWidth:90}},
    body:[
      [{content:'BILL FROM',styles:{fontStyle:'bold'}},{content:'BILL TO',styles:{fontStyle:'bold'}}],
      [`Demo Company\n${issuer.address}\nGST: ${issuer.gst}\nPAN: DEMO-PAN\nfinance@example.com\nPhone: DEMO-PHONE`, `${client.entityName || client.name}\n${client.address}\n${client.country}\n${client.gst ? `GST: ${client.gst}\nPAN: ${client.pan}\n` : ''}${client.poc}\n${client.email || 'Not provided'}`],
      [`Document date: ${date}\nSeller registration: ${issuer.label}`,`Currency: ${invoice.currency || 'INR'}\n${original ? `Original invoice: ${original}\nOriginal date: ${invoice.date}` : `PO / RO: ${invoice.poRoNumber || 'Not provided'}`}`],
    ],
  });
  return (doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY + 7;
}
function ending(doc: jsPDF, total: {base:number;cgst:number;sgst:number;igst:number;total:number}, currency: string, y: number, credit: boolean) {
  const amount=(n:number)=>`${currency} ${n.toLocaleString('en-US',{minimumFractionDigits:currency==='JPY'?0:2,maximumFractionDigits:2})}`;
  autoTable(doc,{startY:y,margin:{left:105,right:15,top:50,bottom:23},theme:'plain',styles:{font:'Demo',fontSize:10,cellPadding:2.5},columnStyles:{1:{halign:'right'}},body:[['Taxable base',amount(total.base)],['CGST (9% when applicable)',amount(total.cgst)],['SGST (9% when applicable)',amount(total.sgst)],['IGST (18% when applicable)',amount(total.igst)],[{content:credit?'Total credit':'Invoice total',styles:{fillColor:green,textColor:255,fontStyle:'bold'}},{content:amount(total.total),styles:{fillColor:green,textColor:255,fontStyle:'bold'}}]]});
  let bottom=(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+8;
  const words=doc.splitTextToSize(amountInWords(total.total,currency),174);
  const needed=words.length*4+46;
  if(bottom+needed>275){doc.addPage();bottom=53;}
  doc.setFont('Demo','normal');doc.setFontSize(10);doc.setTextColor(...green);doc.text(words,18,bottom);bottom+=words.length*4+8;
  doc.setFont('Demo','bold');doc.text(credit?'CREDIT ADJUSTMENT':'DEMO PAYMENT DETAILS',18,bottom);
  doc.setFont('Demo','normal');doc.setFontSize(9);
  const note=credit?'This sample credit reduces the linked invoice. No money is transferred.':'Bank: Demo Bank · Account: DEMO-ACCOUNT · IFSC: DEMO-IFSC\nAccount holder: Demo Company. These details cannot receive payments.';
  doc.text(doc.splitTextToSize(note,174),18,bottom+6);
  doc.setFont('Demo','bold');doc.text('Demo authorised signatory',18,bottom+22);
  doc.setFont('Demo','normal');doc.setFontSize(8);doc.setTextColor(...muted);doc.text('Illustrative approval only — no real signature or company stamp.',18,bottom+27);
}
export async function makePdf(invoice: Invoice) {
  const doc=await documentBase('INVOICE',invoice.id),currency=invoice.currency||'INR';
  const startY=details(doc,invoice,invoice.date);
  autoTable(doc,{startY,margin:{left:15,right:15,top:50,bottom:23},theme:'striped',styles:{font:'Demo',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:green},columnStyles:{0:{cellWidth:70},1:{cellWidth:25},2:{cellWidth:20,halign:'right'},3:{cellWidth:30,halign:'right'},4:{cellWidth:35,halign:'right'}},head:[['Campaign / division','Activity month','Units',`Unit rate (${currency})`,`Amount (${currency})`]],body:invoice.campaigns.map(c=>{
    const exchange=invoice.client.country==='India' && c.exchangeRateEnabled ? c.exchangeRate||1:1;
    return [`${c.name}\n${c.division}${exchange!==1?` · Original rate ${c.rate} × ${exchange}`:''}`,c.month,c.units.toLocaleString('en-US'),(c.rate*exchange).toLocaleString('en-US',{maximumFractionDigits:4}),lineAmount(c.units,c.rate,exchange,currency).toLocaleString('en-US',{minimumFractionDigits:currency==='JPY'?0:2})];
  })});
  ending(doc,invoiceTotals(invoice),currency,(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+5,false);
  finish(doc,'INVOICE',invoice.id);return doc;
}
export async function makeCreditNotePdf(note: CreditNote, invoice: Invoice) {
  const original=note.invoiceSnapshot||invoice;
  const doc=await documentBase('CREDIT NOTE',note.id);
  const startY=details(doc,original,note.date,note.invoiceId);
  const rows=note.campaignRows||creditNoteCampaignRows(original,note.mode,note.value);
  autoTable(doc,{startY,margin:{left:15,right:15,top:50,bottom:23},theme:'striped',styles:{font:'Demo',fontSize:10,cellPadding:3},headStyles:{fillColor:green},columnStyles:{1:{halign:'right'}},head:[[`Campaign credit · ${note.mode}`,`Base credit (${note.currency})`]],body:rows.map(r=>[r.description,r.amount.toLocaleString('en-US',{minimumFractionDigits:note.currency==='JPY'?0:2})])});
  ending(doc,note,note.currency,(doc as jsPDF & {lastAutoTable:{finalY:number}}).lastAutoTable.finalY+5,true);
  finish(doc,'CREDIT NOTE',note.id);return doc;
}
