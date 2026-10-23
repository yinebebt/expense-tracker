# Expense Tracker

Android app that reads bank and mobile-money SMS, stores the transactions in SQLite on the phone, and shows spending by day, week, month, category and payee. Transactions can also be added by hand and exported as CSV.

No backend, no account, no analytics. Release builds have no internet permission.

Angular 22 · Ionic 9 · Capacitor 8 · SQLite · a small Kotlin plugin for the SMS inbox. Android only: iOS doesn't let apps read SMS.

## Setup

- Node 24, JDK 21 (`brew install openjdk@21`), Android SDK 36 with `adb` on the PATH
- `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`

```bash
npm install
npm test -- --watch=false
```

## Run

```bash
npm start              # browser at http://localhost:4200 (no SMS; add transactions by hand)
npm run android        # build and install on the USB-connected phone
```

**Live reload on a phone:** run `npm start`, then `npm run android:live` in a second terminal. Saving a file reloads the app. Keep the USB cable in; DevTools are at `chrome://inspect`. A live-reload build is blank without the Mac, so install a release build when you're done.

With several devices connected, add `-- --target <id>` and set `ANDROID_SERIAL=<id>`. Plugin results aren't logged (`loggingBehavior: 'none'` in `capacitor.config.ts` keeps transactions out of logcat); set it to `'debug'` while debugging the bridge.

## Release

The version lives only in `package.json`: `version` (shown in the app) and `versionCode` (Android build number, +1 per release). Android installs an update only when `versionCode` is higher.

```bash
npm version 0.1.9 --no-git-tag-version   # sets the version and bumps versionCode
npm run apk:release                      # → android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Then commit and tag `v0.1.9`.

- **Signing key:** `~/.android/expense-tracker-release.jks`, password in `android/keystore.properties`. Both are git-ignored; back them up, since no update installs over existing copies without them. Debug builds use the same key, so they install over a release without losing data.
- **Testers:** installing over USB avoids Play Protect warnings and Android's "restricted settings" block on SMS access.
- **Icon:** edit `resources/icon.svg` and `icon-foreground.svg`, then run `./resources/render-icons.sh` (needs `rsvg-convert` and ImageMagick).

## Adding a bank format

1. Put a sample SMS, with made-up names and numbers, in `src/app/parsing/fixtures/fictional-sms.ts` along with the expected result.
2. Adjust `src/app/parsing/rules.ts` until `npm test` passes.
3. Install the new build, then run Settings → Re-read last 90 days. Stored rows are re-parsed; categories you set by hand are kept.

## Code map

```text
src/app/
  parsing/     SMS → transaction: rules.ts (patterns, senders), sms-parser.ts, categorize.ts, transfers.ts
  summary/     totals, payee grouping, CSV export
  services/    database, import pipeline, SMS sync, native plugin wrapper
  components/  rows, charts, detail and add dialogs
  pages/       Dashboard, Transactions, Payees, Settings
android/app/src/main/java/com/yinebebt/expenses/SmsInboxPlugin.kt
               reads the inbox (known senders only), saves the CSV export
```

## How it behaves

- **Privacy:** the only permission is `READ_SMS`. The native side passes on messages from known banks and wallets only, and nothing leaves the phone.
- **Sync:** the first run reads 90 days of SMS; after that the app reads new messages on launch, on resume and on pull-to-refresh. Nothing runs while the app is closed.
- **Not counted:** messages the parser can't read go to review, and moves between your own accounts are shown separately. Ads are dropped.
- **Payees:** a category set on a payee applies to all their transactions and to new ones.

Design decisions, known gaps and real-SMS formats covered: [docs/HANDOFF.md](docs/HANDOFF.md).
