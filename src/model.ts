import {
  D,
  currencyDigits,
  roundAmount,
  appliedUnitRate,
  lineAmount,
  sameState,
  deductionRate,
} from '@demo/finance';
export type Division = 'Mobile' | 'CPL' | 'CPS';
export const demoGstRegistrations = [
  { label: 'Delhi demo registration', gst: '07-DEMO-GST', address: '101 Example Avenue, Demo District\nDelhi, India - PIN 000000' },
  { label: 'Haryana demo registration', gst: '06-DEMO-GST', address: '202 Sample Square, Demo District\nHaryana, India - PIN 000000' },
] as const;
export type DemoGstNumber = (typeof demoGstRegistrations)[number]['gst'];
export const defaultDemoGst = demoGstRegistrations[0].gst;
export function demoGstRegistration(gst?: string) {
  return (
    demoGstRegistrations.find((registration) => registration.gst === gst) ||
    demoGstRegistrations[0]
  );
}
export interface Client {
  id: string;
  name: string;
  entityName: string;
  country: string;
  address: string;
  state: string;
  stateCode: string;
  poc: string;
  phone: string;
  email: string;
  pan: string;
  gst: string;
  place: string;
}
export const normalizeGst = (gstNumber: string) => gstNumber.toUpperCase().replace(/\s+/g, '');
export const panFromGst = (gstNumber: string) => {
  const normalized = normalizeGst(gstNumber);
  return normalized.length === 15 ? normalized.slice(2, -3) : '';
};
export interface Campaign {
  baseAmount?: number;
  appliedRate?: number;
  division: Division;
  month: string;
  name: string;
  units: number;
  rate: number;
  exchangeRateEnabled?: boolean;
  exchangeRate?: number;
}
export interface Invoice {
  version?: number;
  creditTotal?: number;
  paymentsReceived?: number;
  issuerSnapshot?: {
    name: string;
    gst: string;
    address: string;
    domesticAddress: string;
    internationalAddress: string;
    contact: string;
    phone: string;
    email: string;
    pan: string;
    sac: string;
  };
  pdfTemplateVersion?: string;
  createdByName?: string;
  financials?: {
    base: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
    paymentDue: number;
    deductionAmount?: number;
    creditTotal?: number;
    paymentsReceived?: number;
  };
  id: string;
  date: string;
  billFromGst?: DemoGstNumber;
  poRoNumber?: string;
  client: Client;
  campaigns: Campaign[];
  currency?: string;
  createdByEmployeeId?: string;
  paymentStatus?: 'Y' | 'N';
  editDeadline?: string;
  historical?: boolean;
  taxOverride?: { cgst: number; sgst: number; igst: number };
}
export const money = (n: number, currency = 'INR') =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: currencyDigits(currency),
    maximumFractionDigits: currencyDigits(currency),
  }).format(n);
const round = roundAmount;
export function campaignRate(campaign: Campaign, country = 'India') {
  if (campaign.appliedRate !== undefined) return campaign.appliedRate;
  return appliedUnitRate(
    campaign.rate,
    country === 'India' && campaign.exchangeRateEnabled ? campaign.exchangeRate || 0 : 1,
  );
}
export function totals(
  campaigns: Campaign[],
  state: string,
  country = 'India',
  billFromGst: string = defaultDemoGst,
  currency = 'INR',
  stateCode = '',
) {
  const base = roundAmount(
    campaigns.reduce(
      (sum, c) =>
        sum.plus(
          c.baseAmount ??
            lineAmount(
              c.units,
              c.rate,
              country === 'India' && c.exchangeRateEnabled ? c.exchangeRate || 0 : 1,
              currency,
            ),
        ),
      new D(0),
    ),
    currency,
  );
  if (country !== 'India') return { base, cgst: 0, sgst: 0, igst: 0, total: base };
  const local = sameState(state, stateCode, billFromGst);
  const cgst = local ? round(new D(base).times('0.09')) : 0;
  const sgst = cgst;
  const igst = local ? 0 : round(new D(base).times('0.18'));
  return { base, cgst, sgst, igst, total: round(new D(base).plus(cgst).plus(sgst).plus(igst)) };
}

export function invoiceTotals(i: Invoice) {
  if (i.financials) return i.financials;
  const t = totals(
    i.campaigns,
    i.client.state,
    i.client.country || 'India',
    i.billFromGst,
    i.currency || 'INR',
    i.client.stateCode,
  );
  return i.taxOverride
    ? {
        ...t,
        ...i.taxOverride,
        total: round(t.base + i.taxOverride.cgst + i.taxOverride.sgst + i.taxOverride.igst),
      }
    : t;
}
export function paymentDeductionRate(gstNumber: string) {
  return deductionRate(gstNumber);
}
export function paymentDue(invoice: Invoice) {
  if (invoice.financials) return invoice.financials.paymentDue;
  const amount = invoiceTotals(invoice);
  const currency = invoice.currency || 'INR';
  const deduction = roundAmount(
    new D(amount.base).times(paymentDeductionRate(invoice.client.gst)),
    currency,
  );
  const received =
    invoice.paymentsReceived ?? (invoice.paymentStatus === 'Y' ? amount.total - deduction : 0);
  return roundAmount(
    new D(amount.total)
      .minus(deduction)
      .minus(invoice.creditTotal || 0)
      .minus(received),
    currency,
  );
}
export const latestDate = (invoices: Invoice[]) =>
  invoices.reduce((date, i) => (i.date > date ? i.date : date), '');
export function invoiceEditDeadline(date: string) {
  const [year, month] = date.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${month === 12 ? year + 1 : year}-${String(nextMonth).padStart(2, '0')}-05`;
}
export function localDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
export function canEditInvoice(invoice: Invoice, today = localDate()) {
  return today <= (invoice.editDeadline || invoiceEditDeadline(invoice.date));
}
export function financialYearStart(date: string) {
  const year = Number(date.slice(0, 4)),
    month = Number(date.slice(5, 7));
  return month >= 4 ? year : year - 1;
}
export function financialYearLabel(start: number) {
  return `FY ${start}–${String(start + 1).slice(-2)}`;
}

export function financialYearMonths(start: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = index + 3;
    const year = start + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

export function financialYearOptions(dates: string[], today = localDate()) {
  const starts = [financialYearStart(today), ...dates.map(financialYearStart)];
  const earliest = Math.min(...starts);
  const latest = Math.max(...starts);
  return Array.from({ length: latest - earliest + 1 }, (_, index) => latest - index);
}
export function matchesInvoicePeriod(
  invoice: Pick<Invoice, 'date'>,
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
    (!startDate || invoice.date >= startDate) &&
    (!endDate || invoice.date <= endDate) &&
    (!financialYear || financialYearStart(invoice.date) === Number(financialYear)) &&
    (!month || invoice.date.slice(0, 7) === month)
  );
}
export function validInvoiceDetails(date: string, campaigns: Campaign[]) {
  if (!date) return 'Enter an invoice date.';
  if (
    !campaigns.length ||
    campaigns.some(
      (c) =>
        !c.name.trim() ||
        !c.month ||
        !Number.isFinite(c.units) ||
        !Number.isFinite(c.rate) ||
        c.units <= 0 ||
        c.rate <= 0,
    )
  )
    return 'Add a campaign name, activity month, and positive units and rate.';
  if (
    campaigns.some(
      (c) =>
        c.exchangeRateEnabled && (!Number.isFinite(c.exchangeRate) || Number(c.exchangeRate) <= 0),
    )
  )
    return 'Enter a positive exchange rate for every enabled campaign.';
  return '';
}
export function validInvoice(date: string, invoices: Invoice[], campaigns: Campaign[]) {
  if (!date || date < latestDate(invoices))
    return 'Invoice date cannot be earlier than the last invoice date.';
  return validInvoiceDetails(date, campaigns);
}
export function nextInvoiceId(invoices: Invoice[], date: string) {
  const y = Number(date.slice(0, 4)),
    start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
  const fy = `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
  const nums = invoices
    .filter((i) => i.id.startsWith(`DEMO/${fy}/`))
    .map((i) => Number(i.id.split('/')[2]));
  return `DEMO/${fy}/${Math.max(100, ...nums) + 1}`;
}
export const initialClients: Client[] = [
  ['India', 'Delhi', '07', 'INR'], ['India', 'Haryana', '06', 'INR'],
  ['India', 'Maharashtra', '27', 'INR'], ['India', 'Karnataka', '29', 'INR'],
  ['India', 'Gujarat', '24', 'INR'], ['India', 'Delhi', '07', 'INR'],
  ['United States', '', '', 'USD'], ['United Kingdom', '', '', 'GBP'],
  ['Germany', '', '', 'EUR'], ['Japan', '', '', 'JPY'],
  ['Singapore', '', '', 'SGD'], ['United Arab Emirates', '', '', 'AED'],
].map(([country, state, stateCode], index) => ({
  id: `demo-client-${index + 1}`, name: `Demo Client ${index + 1}`,
  entityName: `Demo Client ${index + 1} — Sample Business`, country, state, stateCode,
  address: `${index + 1} Example Avenue, Fictional District, ${state || country}, Postal code 000000`,
  poc: `Demo Contact ${index + 1}`, phone: 'DEMO-PHONE', email: `client${index + 1}@example.com`,
  pan: country === 'India' ? `DEMO-PAN-${index + 1}` : '',
  gst: country === 'India' ? `${stateCode}-DEMO-CLIENT-${index + 1}` : '',
  place: state || country,
}));
export const initialInvoices: Invoice[] = [{
 id: 'DEMO/26-27/101', date: '2026-09-20', client: initialClients[2], currency: 'INR',
 campaigns: [{division:'CPS',month:'2026-09',name:'Sample campaign',units:100,rate:10}],
}, {id:'DEMO/26-27/102',date:'2026-09-20',client:initialClients[0],currency:'INR',
 campaigns:[{division:'CPL',month:'2026-09',name:'Sample local campaign',units:50,rate:20}]}];
export const stateCodes: Record<string, string> = {
  Delhi: '07',
  Maharashtra: '27',
  Gujarat: '24',
  Karnataka: '29',
  'Tamil Nadu': '33',
  'Uttar Pradesh': '09',
  Haryana: '06',
  Telangana: '36',
  'West Bengal': '19',
  Rajasthan: '08',
  Kerala: '32',
  Punjab: '03',
  'Madhya Pradesh': '23',
  Bihar: '10',
  'Andhra Pradesh': '37',
  Odisha: '21',
  Assam: '18',
  Goa: '30',
  Jharkhand: '20',
  Chhattisgarh: '22',
  Uttarakhand: '05',
  'Himachal Pradesh': '02',
  'Jammu and Kashmir': '01',
  Ladakh: '38',
  Chandigarh: '04',
  Sikkim: '11',
  'Arunachal Pradesh': '12',
  Nagaland: '13',
  Manipur: '14',
  Mizoram: '15',
  Tripura: '16',
  Meghalaya: '17',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  Lakshadweep: '31',
  Puducherry: '34',
  'Andaman and Nicobar Islands': '35',
};

export function invoiceGstState(invoice: Pick<Invoice, 'billFromGst'>): 'Delhi' | 'Haryana' {
  return invoice.billFromGst === '06-DEMO-GST' ? 'Haryana' : 'Delhi';
}
