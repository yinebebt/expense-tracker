# Expense Tracker

Personal Android app that reads bank and mobile-money SMS, stores the transactions in SQLite on the phone, and shows where the money goes: spending today, this week and this month, by category and by payee.

No backend, no account, no analytics. Release builds have no internet permission.

Angular 22 (standalone, zoneless, signals) · Ionic 9 · Capacitor 8 · `@capacitor-community/sqlite` · a small Kotlin plugin for the SMS inbox. Android only: iOS doesn't let apps read SMS.

## Setup

- Node 24 and npm
- JDK 21: `brew install openjdk@21`, with `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`
- Android SDK with platform 36 (`ANDROID_HOME` set; `adb` on the PATH)

```bash
npm install
npm test -- --watch=false     # unit tests (Vitest)
```

## Run

| Where    | How                                                                                           |
| -------- | --------------------------------------------------------------------------------------------- |
| Browser  | `npm start` → <http://localhost:4200>. UI and SQLite work (jeep-sqlite); SMS reading doesn't. |
| Emulator | `$ANDROID_HOME/emulator/emulator -avd expense_pixel &`, then `npm run android`                |
| Phone    | USB debugging on, plug in, accept the prompt, then `npm run android`                          |

`adb devices` shows what's connected. With more than one device, pass `-- --target <id>` and set `ANDROID_SERIAL=<id>` so the `adb` calls hit the right one.

## Live debugging on a device

```bash
npm start                                   # terminal 1: dev server
npm run android:live                        # terminal 2: installs a debug build that loads from the dev server
# with several devices:
ANDROID_SERIAL=<id> npm run android:live -- --target <id>
```

Saving a file reloads the app on the device within seconds. The phone reaches the dev server through `adb reverse` over USB, so keep the cable in. For DevTools (console, network, elements), open `chrome://inspect` in desktop Chrome while a debug build runs.

- **"Webpage not available":** the dev server isn't running or the port isn't forwarded. Start `npm start`, run `adb reverse tcp:4200 tcp:4200`, reopen the app.
- **A few seconds of white screen** on launch is normal in live-reload mode.
- **Leaving live reload:** a live-reload build is blank without the Mac. When done, install a release build on the phone (below).
- **Plugin results aren't logged:** `loggingBehavior: 'none'` in `capacitor.config.ts` keeps transaction data out of logcat. Switch it to `'debug'` temporarily when debugging the bridge.

Fake bank SMS on the emulator, for parser work:

```bash
adb emu sms send CBE "Dear Abebe your Account 1*****6789 has been debited with ETB 120.00 to Kaldis Coffee. Ref No FT26287ABC12."
```

## Builds

```bash
npm run apk                 # debug   → android/app/build/outputs/apk/debug/app-debug.apk
npm run apk:release         # release → android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Both are signed with the release key when `android/keystore.properties` exists, so a debug build installs over the beta and back without an uninstall (an uninstall wipes the app's data). Debug builds add `INTERNET` (`android/app/src/debug/AndroidManifest.xml`) for live reload, are debuggable, and must never be shared.

### Releasing a beta

The version lives in `package.json` only: `version` (shown to people) and `versionCode` (the Android build number, one per release tag: v0.1.8 is 3). `android/app/build.gradle` reads both. Android only installs over an existing copy when `versionCode` is higher.

1. `npm version <x.y.z> --no-git-tag-version` sets the version and adds 1 to `versionCode` (`scripts/bump-build.mjs`).
2. `npm run apk:release`, then copy the APK somewhere shareable, e.g. `~/Downloads/expense-tracker-<x.y.z>.apk`.
3. Commit and tag `v<x.y.z>`.
4. Testers install over the previous version and keep their data.

**Icon:** edit `resources/icon.svg` and `resources/icon-foreground.svg`, then `./resources/render-icons.sh` (needs `rsvg-convert` and ImageMagick).

**Signing key:** `~/.android/expense-tracker-release.jks`, password in `android/keystore.properties`; both git-ignored. Back them up. Without the key, no update can be installed over existing copies.

Testers may hit Play Protect ("More details → Install anyway", or temporarily turn off scanning) and, on Android 13+, restricted settings for SMS (App info → ⋮ → Allow restricted settings). Installing over USB with `adb install` avoids both.

## Code map

```text
src/app/
  models/            Transaction, RawSms, categories, money (integer santim)
  parsing/           pure functions, no Angular
    rules.ts           shared patterns, reference rule, sender IDs per bank and wallet
    sms-parser.ts      RawSms → transaction | ignored | needs review
    categorize.ts      merchant keywords; bank/wallet names → Own transfers
    dedup.ts           dedup key (source|type|reference, or amount+second)
    transfers.ts       pairs a debit and a credit across sources as one own-account move
    fixtures/          fictional SMS the tests run against
  summary/           day / week (Mon–Sun) / month totals, daily series, payee grouping and rules
  services/
    database.service.ts    SQLite: transactions, meta (sync position), payee_rules
    transaction.service.ts import pipeline, payee rules, signals the pages read
    sms-reader.service.ts  SmsReader interface + Android implementation of the native plugin
    sms-sync.service.ts    when and from where to read the inbox
  components/        transaction row, week chart, category bar, transaction and payee detail cards
  pages/             tabs (Dashboard, Transactions, Payees), Settings
android/app/src/main/java/com/yinebebt/expenses/
  SmsInboxPlugin.kt  inbox query and get-by-id, both limited to known senders; unrecognised-sender list; change observer; app settings
resources/           icon source SVGs and render-icons.sh
```

## How it behaves

- **Permissions:** only `READ_SMS`. The native side filters by sender, so other SMS never reach the app code. Android backup is off.
- **Sync:** the first sync reads the last 90 days. Later syncs read from the newest message already seen. Syncs run on launch, on resume, when the SMS store changes while the app is open, on pull-to-refresh, and from Settings. Nothing runs while the app is closed.
- **Unclear messages:** reversals, refunds and unrecognised formats with an amount are stored for review and never counted. Only those rows keep the SMS text; for other rows the detail card reads the original SMS from the inbox by id. Either can be copied from the card.
- **Ads:** dropped only on signals real transactions don't carry ("download … app", app-store links, "up to Birr", win/prize wording), and only when no transaction pattern matched.
- **Re-read:** "Re-read last 90 days" refreshes stored rows with the current parser, keeps categories set by hand, replaces review rows that now parse and removes those that are now ads.
- **Own transfers:** moves between the user's own accounts are left out of spending, income and Payees, and shown once on the Dashboard ("Moved between your accounts"). They're detected three ways:
  - a debit and a same-amount credit on two different sources within 10 minutes;
  - a counterparty that is a bank or wallet by name;
  - a payee the user marked as Own transfers.
- **Payees:** transactions are grouped by counterparty name, ignoring case and a trailing masked number. A category set on a payee goes into `payee_rules`; it updates their existing transactions and applies to new SMS. Rules survive "Delete all transactions".
- **Charts:** inline SVG/HTML, no chart library. Category colors are fixed per category in `styles.scss`, validated for light and dark surfaces. The category legend doubles as the table, and the week chart has a List view. Tapping a day shows that day's expenses under it.
- **Parsing:** English and Amharic wording; Amharic "ብር" amounts are rewritten to "ETB" first. Sender IDs and formats for most banks are guesses until checked against real SMS. Settings → "Find a missing bank" lists unrecognised business senders, names only.
