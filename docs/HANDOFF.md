# Handoff — 2026-10-22

State at the end of the second session, for whoever picks this up next.

## Where it stands

**Version:** 0.1.5 (versionCode 5), tag `v0.1.5`. The release APK is at `~/Downloads/expense-tracker-0.1.5.apk`. Earlier betas were named 0.3.0-beta (versionCode 4, tag `v0.1.0`); 0.1.5 installs over them because only the versionCode has to go up.

**Tests:** 84 unit tests pass (`npm test -- --watch=false`). The production build is clean.

**Verified on the owner's phone** (Samsung Galaxy A15, Android 16, real SMS):

- Dashboard: day heading, chart selection, the day's list, the eye toggle.
- Transaction and payee detail cards, including the original SMS loaded by id.
- Re-read after parser fixes: telebirr package rows renamed, review rows replaced.
- Settings layout and the bottom safe area.

**Repo:** private, <https://github.com/yinebebt/expense-tracker>, branch `main`. The signing key and `android/keystore.properties` are git-ignored and stay on the owner's Mac.

## Features

- **Dashboard:**
  - one day at a time: heading (Today, Yesterday or the weekday), its total with an eye toggle that masks it, the Mon–Sun chart, then that day's expenses. Tapping a bar switches the day; it starts on today;
  - the month: total, received, category stacked bar with legend, "Moved between your accounts";
  - the review count.
- **Transactions:** search, grouped by day with each day's spent total; `?q=` filter from other screens.
- **Transaction detail** (tap any row): a small card with amount, payee, category dropdown, date, reference and the original SMS. The SMS is read from the inbox by id when the card opens (`SmsInbox.get`, known senders only), not stored.
- **Payees:** grouped by name, All / 5+ filters, own accounts listed apart. Tapping one opens a small card with totals, a category dropdown that applies to all their transactions and new ones, and "Show transactions".
- **Settings:** one row per item: SMS access, last check, check now, re-read 90 days, supported banks, find a missing bank, per-bank counts, delete all, version.
- **Sources:** 24 banks and 6 wallets (telebirr, M-PESA, CBE Birr, HelloCash, Kacha, e-Birr).
- **Icon:** a receipt with a bar chart, drawn in `resources/icon.svg`; `resources/render-icons.sh` renders the Android icons, splash images and favicon.

## Known gaps and risks (most important first)

1. **Parsers have seen few real SMS.** Real formats covered so far:
   - telebirr: package purchase, airtime recharge, "paid … to X; note";
   - CBE: "debit transaction of", "credited by X with ETB …";
   - BOA in Amharic: ብር … ወጪ/ገቢ ተደርጓል (debit/credit, spelled more than one way);
   - M-PESA in Amharic: ከ X … ተቀብለዋል (received), airtime/package ገዝተዋል (bought);
   - e-Birr: "ETB… Received from X", "has been paid to merchant X".

   Sender IDs other than CBE, telebirr (`127`), BOA, M-PESA and e-Birr are guesses. The way forward is the same: take a redacted real sample, add it to `parsing/fixtures/fictional-sms.ts`, adjust `rules.ts` until it passes, then re-read on the phone.

2. **Fees are ignored** (telebirr service fee, CBE service charge and VAT). Only the principal is recorded.
3. **Review rows can't be turned into a debit or credit** by hand. They're never counted; a parser fix plus re-read is the only way out.
4. **No background processing.** Nothing is read while the app is closed and nothing notifies.
5. **Own-transfer heuristics can misfire:** two unrelated same-amount transactions on two sources within 10 minutes get paired, and a payee whose name contains "Bank" counts as a transfer. Both can be overridden per payee.
6. **Payee-key changes don't re-apply existing rules.** If `payeeKey()` normalisation changes, rows that newly merge into a ruled payee keep their old category until the rule is set again.
7. **The eye toggle only masks the day's total.** The week total and bar labels below it stay visible.
8. **Not done:** no Ethiopian calendar option; the name is still "Expense Tracker"; Capacitor's example tests in `android/app/src/test` and `androidTest` are still there (safe to delete).

## Ideas the owner raised for later

- Read a payment reason typed into a transfer (if banks include it in the SMS) and use it to set the category before payee rules apply.
- Budgets, savings goals, cloud sync, AI categorisation and reports were out of scope for the MVP.

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
- **The inbox is the queue.** No SMS receiver or background job: syncs read from the last seen message date. Raw SMS aren't stored; the detail card reads one message by id when opened.
- **Re-imports refresh old rows.** A duplicate dedup key updates the stored merchant, and the category unless it was set by hand, so "Re-read last 90 days" applies parser fixes. A review row that a newer parser understands is replaced by the parsed row; a review row whose SMS is now ignored (an ad) is deleted.
- **Ads are dropped only on ad-only signals** ("download … app", app-store links, "up to Birr"/እስከ ብር, win/prize wording), and only when no transaction pattern matched. "Loan" or "download" alone aren't enough: an unparsed real transaction belongs in review, not gone.
- **Amharic amounts** ("ብር 1,250.00" or "1,250.00 ብር") are rewritten to "ETB 1,250.00" before matching, so patterns handle one form.
- **Dedup key includes the type**, so a reversal quoting the original reference isn't dropped as a duplicate.
- **Money is integer santim** throughout.
- **Release has no `INTERNET`**, and debug adds it via `src/debug/AndroidManifest.xml`. "Nothing leaves the phone" is enforced by Android, not just promised.
- **Debug builds are signed with the release key on this Mac**, so live reload installs over the release without wiping data.
- **Charts are hand-built SVG.** Category hues are fixed per category and validated for both surfaces; see the comment in `src/styles.scss`.
