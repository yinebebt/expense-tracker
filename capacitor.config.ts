import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yinebebt.expenses',
  appName: 'Expense Tracker',
  webDir: 'dist/expense-tracker/browser',
  // The bridge otherwise logs every plugin result, including stored transactions, to logcat.
  loggingBehavior: 'none',
};

export default config;
