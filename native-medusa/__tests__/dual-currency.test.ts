import {
  formatShopPrice,
  getIndicativeConversion,
  isUsableFxQuote,
  type IndicativeFxQuote,
} from '../app/utils/dual-currency';

const now = new Date('2026-10-23T10:00:00Z');
const quote: IndicativeFxQuote = {
  available: true,
  all_per_eur: 100,
  as_of: '2026-10-23',
  source: 'CI illustrative test only',
  indicative_only: true,
};

describe('ShqipShop indicative ALL/EUR pricing', () => {
  it('formats Albanian lek as the real primary currency, not old lek', () => {
    expect(formatShopPrice(1500, 'all')).toBe('1.500 lekë');
    expect(formatShopPrice(1510, 'ALL')).toBe('1.510 lekë');
  });
  it('formats euro as real primary currency when store is EUR', () => {
    expect(formatShopPrice(15, 'eur')).toBe('€15,00');
  });
  it('adds small, non-binding euro hint for ALL and reciprocal ALL for EUR', () => {
    expect(getIndicativeConversion(1500, 'all', quote, now)).toBe(
      '(≈ €15,00 · orientuese)',
    );
    expect(getIndicativeConversion(15, 'eur', quote, now)).toBe(
      '(≈ 1.500 lekë · orientuese)',
    );
  });
  it('refuses missing, stale, future or invalid rates', () => {
    expect(getIndicativeConversion(1500, 'all', undefined, now)).toBeNull();
    expect(getIndicativeConversion(1500, 'all', { available: false }, now)).toBeNull();
    expect(isUsableFxQuote({ ...quote, as_of: '2026-10-01' }, now)).toBe(false);
    expect(isUsableFxQuote({ ...quote, as_of: '2026-10-24' }, now)).toBe(false);
    expect(isUsableFxQuote({ ...quote, all_per_eur: 0 }, now)).toBe(false);
  });
  it('never exposes a preview for unsupported currencies, invalid amounts or missing quote source', () => {
    expect(getIndicativeConversion(10, 'usd', quote, now)).toBeNull();
    expect(getIndicativeConversion(NaN, 'all', quote, now)).toBeNull();
    expect(getIndicativeConversion(-2, 'all', quote, now)).toBeNull();
    expect(getIndicativeConversion(10, 'all', { ...quote, source: '' }, now)).toBeNull();
  });
});
