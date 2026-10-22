import { formatMinor, parseAmountMinor } from './money';

describe('money', () => {
  it('parses amounts into minor units without float error', () => {
    expect(parseAmountMinor('1,250.00')).toBe(125000);
    expect(parseAmountMinor('0.1')).toBe(10);
    expect(parseAmountMinor('19.99')).toBe(1999);
    expect(parseAmountMinor('1,000,000')).toBe(100000000);
    expect(parseAmountMinor('1,250,')).toBe(125000);
  });

  it('rejects malformed amounts', () => {
    for (const s of ['', '.', '1.234', 'abc', '-5', '1e5']) expect(parseAmountMinor(s)).toBeNull();
  });

  it('formats minor units', () => {
    expect(formatMinor(125000)).toBe('ETB 1,250.00');
    expect(formatMinor(5)).toBe('ETB 0.05');
    expect(formatMinor(-1999)).toBe('-ETB 19.99');
  });
});
