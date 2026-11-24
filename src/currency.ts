import { countries, getCountryCode, type TCountryCode } from 'countries-list';

const countryAliases: Record<string, TCountryCode> = {
  'Åland Islands': 'AX',
  'Antigua & Barbuda': 'AG',
  'Bosnia & Herzegovina': 'BA',
  'Canary Islands': 'ES',
  'Caribbean Netherlands': 'BQ',
  'Ceuta & Melilla': 'ES',
  'Clipperton Island': 'FR',
  'Congo - Brazzaville': 'CG',
  'Congo - Kinshasa': 'CD',
  'Côte d’Ivoire': 'CI',
  'Diego Garcia': 'IO',
  'Heard & McDonald Islands': 'HM',
  'Hong Kong SAR China': 'HK',
  'Macao SAR China': 'MO',
  'Palestinian Territories': 'PS',
  Réunion: 'RE',
  'São Tomé & Príncipe': 'ST',
  Sark: 'GG',
  'South Georgia & South Sandwich Islands': 'GS',
  'St. Barthélemy': 'BL',
  'St. Helena': 'SH',
  'St. Kitts & Nevis': 'KN',
  'St. Lucia': 'LC',
  'St. Martin': 'MF',
  'St. Pierre & Miquelon': 'PM',
  'St. Vincent & Grenadines': 'VC',
  'Svalbard & Jan Mayen': 'SJ',
  'Trinidad & Tobago': 'TT',
  'Turks & Caicos Islands': 'TC',
  'U.S. Outlying Islands': 'UM',
  'Wallis & Futuna': 'WF',
};

export function defaultCurrencyForCountry(country: string): string {
  if (!country || country === 'India') return 'INR';
  const code = countryAliases[country] || getCountryCode(country);
  return code ? countries[code].currency[0] || 'USD' : 'USD';
}

const supported =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : [];
export const currencyOptions = [
  ...new Set(['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY', ...supported]),
];
