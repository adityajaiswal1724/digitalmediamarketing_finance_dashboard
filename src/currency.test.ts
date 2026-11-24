import { describe, it, expect } from 'vitest';
import { countries } from './countries';
import { defaultCurrencyForCountry } from './currency';

describe('country currency defaults', () => {
  it('uses the country currency and handles CLDR country labels', () => {
    expect(defaultCurrencyForCountry('India')).toBe('INR');
    expect(defaultCurrencyForCountry('United States')).toBe('USD');
    expect(defaultCurrencyForCountry('France')).toBe('EUR');
    expect(defaultCurrencyForCountry('United Kingdom')).toBe('GBP');
    expect(defaultCurrencyForCountry('United Arab Emirates')).toBe('AED');
    expect(defaultCurrencyForCountry('Côte d’Ivoire')).toBe('XOF');
  });
  it('provides a format-ready default for every selectable country', () => {
    for (const country of countries) {
      const currency = defaultCurrencyForCountry(country);
      expect(currency).toMatch(/^[A-Z]{3}$/);
      expect(() =>
        new Intl.NumberFormat('en', { style: 'currency', currency }).format(100),
      ).not.toThrow();
    }
  });
});
