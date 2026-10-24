import { daysAgo, localDateValue } from './dates';

describe('dates', () => {
  it('localDateValue drops the time from localInputValue', () => {
    expect(localDateValue(new Date(2026, 9, 24, 13, 45).getTime())).toBe('2026-10-24');
  });

  it('daysAgo is midnight local time, n days back', () => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    expect(daysAgo(0)).toBe(midnight.getTime());
    expect(daysAgo(0) - daysAgo(7)).toBe(7 * 86_400_000);
  });
});
