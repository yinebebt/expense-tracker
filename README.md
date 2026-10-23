# Expense Tracker

Android app that reads Ethiopian bank and mobile-money SMS, stores the transactions in SQLite on the phone, and shows spending by day, week, month, category and payee. Transactions can also be added by hand and exported as CSV.

No backend, no account, no analytics. Release builds have no internet permission.

Angular 22 · Ionic 9 · Capacitor 8 · SQLite · a small Kotlin plugin for the SMS inbox. Android only: iOS doesn't let apps read SMS.

## Install

1. Download `expense-tracker-<version>.apk` from the [latest release](https://github.com/yinebebt/expense-tracker/releases/latest) on the phone and open it. Android asks to allow installs from your browser or file manager.
2. Open the app and tap **Allow SMS access**. Android blocks SMS access for apps installed outside the Play Store: if SMS is greyed out, open the app's settings, tap ⋮ at the top right, choose **Allow restricted settings**, then allow SMS.

Updates install over the previous version and keep your data. Each release lists a `SHA256SUMS` file, and every APK is signed with the certificate whose SHA-256 is `deac7052 58b67b5e a17504c5 4a590e26 f4b0aa2b 2c077be3 ee9ada92 675965c1` (`apksigner verify --print-certs` shows it).

## What it does with your SMS

- **Permissions:** `READ_SMS` only. The native side passes on messages from known bank and wallet senders; other SMS never reach the app, and nothing leaves the phone.
- **Sync:** the first run reads 90 days of SMS. After that the app reads new messages on launch, on resume, when one arrives while it's open, and on pull-to-refresh. Nothing runs while the app is closed.
- **Not counted:** messages the parser can't read go to review, and moves between your own accounts are shown separately. Ads are dropped.
- **Payees:** a category set on a payee applies to all their transactions and to new ones.
- **Balances:** each account's latest balance comes from its SMS ("current balance is …") or is typed in.

**Supported:** CBE, Awash, Dashen, BOA, Coopbank, Zemen, Enat and Amhara Bank; telebirr, M-PESA, CBE Birr, HelloCash, Kacha and e-Birr. Formats are learned from real messages, so some of these have only been seen in a few shapes.

## Limitations

- Fees are ignored; only the principal is recorded.
- Rows in review can't be fixed by hand; a parser fix and Settings → Re-read is the only way.
- Some bank SMS name no one (e.g. CBE "debit transaction of"), so those rows have no payee.
- Own-account transfers are guessed: two same-amount transactions on two accounts within 10 minutes are paired, and a payee named "…Bank" counts as a transfer. Both can be overridden per payee.
- One balance per bank: with two CBE accounts, whichever reported last is shown.
- Gregorian calendar only.

## Missing your bank?

Open an issue with one example SMS per kind of transaction (money out, money in, transfer), with names, account numbers, phone numbers and references replaced by made-up ones, and the sender name the SMS comes from.

## Development

- Node 24, JDK 21, Android SDK 36 with `adb` on the PATH
- macOS with Homebrew: `brew install openjdk@21`, then `export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`

```bash
npm install
npm test -- --watch=false
npm start              # browser at http://localhost:4200 (no SMS; add transactions by hand)
npm run android        # build and install on the USB-connected phone
```

**Live reload on a phone:** run `npm start`, then `npm run android:live` in a second terminal. Saving a file reloads the app. Keep the USB cable in; DevTools are at `chrome://inspect`. A live-reload build is blank without the computer, so install a release build when you're done.

With several devices connected, add `-- --target <id>` and set `ANDROID_SERIAL=<id>`. Plugin results aren't logged (`loggingBehavior: 'none'` in `capacitor.config.ts` keeps transactions out of logcat); set it to `'debug'` while debugging the bridge.

Debug builds add `INTERNET` for live reload and are debuggable; don't share them.

### Adding a bank format

1. Put a sample SMS, with made-up names and numbers, in `src/app/parsing/fixtures/fictional-sms.ts` along with the expected result.
2. Adjust `src/app/parsing/rules.ts` until `npm test` passes.
3. Install the new build, then run Settings → Re-read. Stored rows are re-parsed; categories set by hand are kept.

### Code map

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

Design notes:

- **One parser, in TypeScript.** The Kotlin plugin only reads and filters, so every rule is testable with Vitest.
- **The inbox is the queue.** Syncs read from the last message seen; raw SMS aren't stored. The detail card reads the original SMS from the inbox by id.
- **Money is integer santim.** Amharic amounts ("ብር 1,250.00") are normalised to "ETB 1,250.00" before matching.
- **The dedup key includes the type,** so a reversal quoting the original reference isn't dropped.
- **Ads are dropped only on ad-only signals** and only when no transaction pattern matched, so an unknown real transaction lands in review instead of vanishing.
- **sql.js is pinned to 1.12.0.** The browser SQLite (jeep-sqlite) embeds that version's JavaScript; a newer `sql-wasm.wasm` fails to load.

## Releasing

The version lives only in `package.json`: `version` (shown in the app) and `versionCode` (Android build number, +1 per release). Android installs an update only when `versionCode` is higher.

```bash
npm version 0.2.0 --no-git-tag-version   # sets the version and bumps versionCode
git commit -am "…"
git tag v0.2.0
git push && git push origin v0.2.0
```

The tag starts the [Release workflow](.github/workflows/release.yml): it runs the tests, checks the tag matches `package.json`, builds the APK, checks it's signed with the release key and publishes it with `SHA256SUMS` as a GitHub release. Running the workflow by hand builds the APK as a run artifact without publishing.

**Signing key:** the release keystore and `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) stay out of git; back them up, since no update installs over existing copies without them. Locally, both debug and release builds are signed with it when the file exists, so a debug build installs over a release without losing data. CI gets the same key from four repository secrets: `KEYSTORE_BASE64` (the keystore, base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS` and `KEY_PASSWORD`.

To build a release APK locally instead: `npm run apk:release` → `android/app/build/outputs/apk/release/app-release.apk`.

**Icon:** edit `resources/icon.svg` and `icon-foreground.svg`, then run `./resources/render-icons.sh` (needs `rsvg-convert` and ImageMagick).

## License

[MIT](LICENSE)
