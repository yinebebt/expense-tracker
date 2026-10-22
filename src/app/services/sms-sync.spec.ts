import { IMPORT_WINDOW_DAYS, syncStart } from './sms-sync.service';

describe('syncStart', () => {
  it('first sync reads the import window; later syncs start at the last message', () => {
    const now = new Date(2026, 9, 22).getTime();
    expect(syncStart(null, now)).toBe(now - IMPORT_WINDOW_DAYS * 86_400_000);
    expect(syncStart(1_000, now)).toBe(1_000);
  });
});
