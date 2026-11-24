// Shared by the API, form previews and PDF renderer. No browser or database dependencies.
import Decimal from 'decimal.js';
const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const supportedCurrencies = new Set(Intl.supportedValuesOf('currency'));
function currencyDigits(currency = 'INR') {
  if (!supportedCurrencies.has(currency)) throw new RangeError('Choose a supported currency.');
  // The approved display/calculation policy caps monetary precision at two places.
  return Math.min(
    2,
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits,
  );
}
function roundAmount(value, currency = 'INR') {
  return new D(value).toDecimalPlaces(currencyDigits(currency)).toNumber();
}
function appliedUnitRate(rate, exchangeRate = 1) {
  return new D(rate).times(exchangeRate).toNumber();
}
function lineAmount(units, rate, exchangeRate = 1, currency = 'INR') {
  return roundAmount(new D(units).times(rate).times(exchangeRate), currency);
}
function deductionRate(gst) {
  const type = gst.trim().toUpperCase().charAt(5);
  return type === 'P' ? 0.01 : type === 'C' || type === 'F' ? 0.02 : 0;
}
function sameState(state, stateCode, sellerGst = '07-DEMO-GST') {
  const code = stateCode || ({ delhi: '07', haryana: '06' }[state.trim().toLowerCase()] ?? '');
  return code.padStart(2, '0') === sellerGst.slice(0, 2);
}
const small = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function numberWords(value, indian = false) {
  if (value < 20) return small[value];
  if (value < 100)
    return tens[Math.floor(value / 10)] + (value % 10 ? `-${small[value % 10]}` : '');
  const scales = indian
    ? [
        [10000000, 'Crore'],
        [100000, 'Lakh'],
        [1000, 'Thousand'],
        [100, 'Hundred'],
      ]
    : [
        [1000000000000, 'Trillion'],
        [1000000000, 'Billion'],
        [1000000, 'Million'],
        [1000, 'Thousand'],
        [100, 'Hundred'],
      ];
  for (const [scale, name] of scales) {
    if (value >= scale)
      return (
        `${numberWords(Math.floor(value / scale), indian)} ${name}` +
        (value % scale ? ` ${numberWords(value % scale, indian)}` : '')
      );
  }
  return '';
}
function amountInWords(value, currency = 'INR') {
  const rounded = new D(value).toDecimalPlaces(currencyDigits(currency));
  const absolute = rounded.abs();
  const [whole, fraction = ''] = absolute.toFixed(currencyDigits(currency)).split('.');
  const major = numberWords(Number(whole), currency === 'INR');
  const units = {
    INR: ['Rupees', 'Paise'],
    USD: ['US Dollars', 'Cents'],
    EUR: ['Euros', 'Cents'],
    GBP: ['Pounds', 'Pence'],
    AED: ['Dirhams', 'Fils'],
    AUD: ['Australian Dollars', 'Cents'],
    CAD: ['Canadian Dollars', 'Cents'],
    SGD: ['Singapore Dollars', 'Cents'],
    NZD: ['New Zealand Dollars', 'Cents'],
    CHF: ['Swiss Francs', 'Rappen'],
    JPY: ['Yen', ''],
    CNY: ['Yuan', 'Fen'],
    HKD: ['Hong Kong Dollars', 'Cents'],
  };
  const minor = Number(fraction);
  let words;
  if (units[currency]) {
    const [majorName, minorName] = units[currency];
    words = `${major} ${majorName}${minor ? ` and ${numberWords(minor)} ${minorName}` : ''}`;
  } else {
    // Decimal-digit wording is unambiguous for every currency, including three-place
    // minor units; never incorrectly call an unknown currency's fraction "cents".
    words = `${major}${
      minor
        ? ` Point ${fraction
            .split('')
            .map((n) => small[Number(n)])
            .join(' ')}`
        : ''
    } ${currency}`;
  }
  return `${rounded.isNegative() ? 'Minus ' : ''}${words} Only`;
}
export {
  D,
  supportedCurrencies,
  currencyDigits,
  roundAmount,
  appliedUnitRate,
  lineAmount,
  deductionRate,
  sameState,
  numberWords,
  amountInWords,
};
