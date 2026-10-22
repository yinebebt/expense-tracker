# Handoff — 2026-10-22

State at the end of the first build session, for whoever picks this up next.

## Where it stands

**Version:** 0.3.0-beta (versionCode 4), installed on the owner's phone (Samsung Galaxy A15, Android 16) as the signed release build. A copy is at `~/Downloads/expense-tracker-0.3.0-beta.apk`.

**Tests:** 67 unit tests pass (`npm test -- --watch=false`). The production build is clean.

**Verified on the emulator (API 36) and the phone:**
- SMS permission flow: allow, deny, blocked → app settings → back.
- 90-day import, plus new SMS picked up while the app is open and on reopen.
- Dedup on re-read, and own-transfer pairing.
- Payee rules applied to old and new SMS.
- Dashboard charts in light and dark mode.
- Release build with no `INTERNET` permission.

**Not in git yet.** `~/labs/expense-tracker` has no repository. Before the next change, `git init` and commit. Check that `android/keystore.properties` and `*.jks` are ignored; `android/.gitignore` already lists them.

## Features

- **Dashboard:**
  - spent this week (hero number), with today, month and received-this-week underneath;
  - a Mon–Sun column chart, a category stacked bar with legend;
  - "Moved between your accounts" and the review count.
- **Transactions:**
  - search, grouped by day;
  - tap a row to change its category; review rows can copy the SMS text;
  - `?q=` filter from other screens.
- **Payees:**
  - grouped by name, with All / 5+ filters;
  - tap to set a category for all their transactions and future ones;
  - own accounts listed separately.
- **Settings:**
  - SMS access state and sync controls, re-read 90 days;
  - supported banks list, unrecognised-sender list;
  - per-bank counts, delete all, version.
- **Sources:**
  - 24 banks, including CBE, Awash, Dashen, BOA, Coopbank and Wegagen;
  - 6 wallets: telebirr, M-PESA, CBE Birr, HelloCash, Kacha, e-Birr.

## Known gaps and risks (most important first)

1. **Parsers have never seen real SMS** except what the owner's phone imported during testing. Sender IDs for everything but CBE and telebirr (`127`) are guesses. Next step: collect redacted real samples per bank, add them to `parsing/fixtures/fictional-sms.ts` (or a new `real-sms.ts`), and adjust `rules.ts` until they pass.
2. **Fees are ignored** (e.g. telebirr's "service fee is ETB 1.00"). Only the principal is recorded.
3. **Review rows can't be turned into a debit or credit.** You can only change their category, and they're never counted.
4. **No background processing.** Nothing is read while the app is closed and nothing notifies. New SMS appear when the app opens.
5. **Own-transfer heuristics can misfire:**
   - two unrelated same-amount transactions on two sources within 10 minutes get paired;
   - a payment to a business whose name contains "Bank" is treated as a transfer.

   In both cases the user can override per payee.
6. **Payee-key changes don't re-apply existing rules.** If `payeeKey()` normalisation changes, rows that newly merge into a ruled payee keep their old category until the rule is set again. A "re-apply all payee rules" step on load would fix it.
7. **Defaults left as they are:** the app icon is Capacitor's placeholder and the name is "Expense Tracker". There's no Ethiopian calendar option.
8. **Unexplained log message:** `Error injecting safe area CSS` from Capacitor at startup. No visible effect on the emulator or the A15.
9. **Leftover template stubs:** `android/app/src/test` and `android/app/src/androidTest` contain Capacitor's example tests in the wrong package. They're safe to delete; deleting them was blocked during the session.

## Ideas the owner raised for later

- **Read a payment reason the user types into the transfer** (if banks include it in the SMS) and use keywords from it to set the category before payee rules apply.
- Budgets, savings goals, cloud sync, AI categorisation and reports were explicitly out of scope for the MVP.

## Resume quickly

```bash
cd ~/labs/expense-tracker
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
npm install && npm test -- --watch=false
npm start                       # terminal 1
npm run android:live            # terminal 2, phone on USB (see README for several devices)
# when done:
npm run apk:release && adb install -r android/app/build/outputs/apk/release/app-release.apk
```

## Decisions worth keeping

- **One parser path in TypeScript.** The Kotlin plugin only filters and reads; it never parses. Keeps all rules testable with Vitest.
- **The inbox is the queue.** No SMS receiver or background job: syncs read from the last seen message date. Avoids storing raw SMS and duplicating parsing natively.
- **Dedup key includes the type**, so a reversal quoting the original reference isn't dropped as a duplicate.
- **Money is integer santim** throughout.
- **Release has no `INTERNET`**, and debug adds it via `src/debug/AndroidManifest.xml`. "Nothing leaves the phone" is enforced by Android, not just promised.
- **Debug builds are signed with the release key on this Mac**, so live reload installs over the beta without wiping data.
- **Charts are hand-built SVG.** Category hues are fixed per category and validated (CVD and contrast) for both surfaces; see the comment in `src/styles.scss`.
