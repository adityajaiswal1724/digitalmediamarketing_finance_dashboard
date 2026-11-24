import Decimal from 'decimal.js';
export const D: typeof Decimal;
export const supportedCurrencies: Set<string>;
export function currencyDigits(currency?: string): number;
export function roundAmount(value: Decimal.Value, currency?: string): number;
export function appliedUnitRate(rate: Decimal.Value, exchangeRate?: Decimal.Value): number;
export function lineAmount(
  units: Decimal.Value,
  rate: Decimal.Value,
  exchangeRate?: Decimal.Value,
  currency?: string,
): number;
export function deductionRate(gst: string): number;
export function sameState(state: string, stateCode: string, sellerGst?: string): boolean;
export function numberWords(value: number, indian?: boolean): string;
export function amountInWords(value: number, currency?: string): string;
