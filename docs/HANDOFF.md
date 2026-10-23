# Handoff — 2026-10-23

Where the app stands, for whoever picks it up next. Setup, running and releasing are in the [README](../README.md).

## State

- **Version:** 0.1.9, build 4, tag `v0.1.9`. APK at `~/Downloads/expense-tracker-0.1.9.apk`.
- **Build numbers** count releases: v0.1.0 = 1, v0.1.5 = 2, v0.1.8 = 3, v0.1.9 = 4. The v0.1.0 and v0.1.5 commits still carry 4 and 5 from before the reset, and the owner's phone had a build 6, so a phone with any of those must uninstall (losing its data) before installing 0.1.9.
- **Tests:** 97 pass (`npm test -- --watch=false`); the production build is clean.
- **Checked on the owner's phone** (Samsung Galaxy A15, Android 16, real SMS), up to 0.1.8: dashboard, detail and payee cards, the original SMS by id, re-read after parser fixes, Settings.
- **Checked only in the browser:** adding by hand, the 0.1.9 Settings layout and CSV export. Saving the CSV to Downloads on Android hasn't been tried on a device.
- **Repo:** private, <https://github.com/yinebebt/expense-tracker>. The signing key and `android/keystore.properties` stay on the owner's Mac.

## Features

- **Dashboard:** one day at a time (Today by default; tap a bar for another day) with its total, an eye toggle that masks it, the week chart and that day's expenses. Below: the month by category, own-account moves, the review count.
- **Transactions:** search, grouped by day with day totals. A row whose SMS names no one reads "Money out" / "Money in", never the bank.
- **Detail card** (tap a row): amount, payee, category dropdown, date, reference and the original SMS, read from the inbox by id when opened.
- **Add by hand** (+ button): one form with type (money out or in), amount, payee, category, account, date (defaults to now) and reference. Reference is required, and so is the payee for money out. These rows can be deleted from their detail card; SMS rows can't.
- **Payees:** grouped by name, own accounts listed apart. A payee's card sets one category for all their transactions and new ones.
- **Settings:** SMS access and sync, supported banks, find a missing bank, export CSV, delete all, version.
- **Export:** CSV of every transaction to `Download/expense-tracker-<date>.csv` (Android 10+; older versions get the share sheet), UTF-8 with a byte-order mark for Amharic names.
- **Sources:** 8 banks (CBE, Awash, Dashen, BOA, Coopbank, Zemen, Enat, Amhara Bank) and 6 wallets (telebirr, M-PESA, CBE Birr, HelloCash, Kacha, e-Birr). Hibret was dropped from the list although it sent one SMS on the owner's phone.

## Known gaps (most important first)

1. **Parsers have seen few real SMS.** Real formats covered:
   - telebirr: package, airtime recharge, "paid … to X; note", "received … from a bank to your telebirr Account";
   - CBE: "transferred … to account 1***9 (Name)", "received … from account 1***9 (Name)", "credited by X with ETB …", and "debit transaction of" / branch "credited with", which name no one;
   - BOA: Amharic ብር … ወጪ/ገቢ ተደርጓል (spelled more than one way), English maintenance fee;
   - M-PESA, Amharic: received (ከ X … ተቀብለዋል), bought airtime or a package (ገዝተዋል), sent to a number (ልከዋል), cashback; Errif loan notices are ignored;
   - e-Birr: "ETB… Received from X", "has been paid to merchant X".

   Across the owner's 412 bank SMS from the last 90 days, 37 CBE and 10 BOA rows have no payee because the SMS names no one. Sender IDs other than CBE, telebirr (`127`), BOA, M-PESA and e-Birr are guesses.

2. **Fees are ignored;** only the principal is recorded.
3. **Review rows can't be fixed by hand;** a parser fix and a re-read is the only way.
4. **Nothing runs in the background;** SMS are read when the app opens.
5. **Own-transfer guesses can misfire:** two same-amount transactions on two accounts within 10 minutes are paired, and a payee named "…Bank" counts as a transfer. Both can be overridden per payee.
6. **Changing `payeeKey()` doesn't re-apply payee rules** to rows that newly merge into a ruled payee.
7. **The eye toggle masks only the day's total.**
8. **Not done:** Ethiopian calendar, a proper app name, deleting Capacitor's example tests in `android/app/src/test` and `androidTest`.

## Decisions worth keeping

- **One parser, in TypeScript.** The Kotlin plugin only reads and filters, so every rule is testable with Vitest.
- **The inbox is the queue.** Syncs read from the last message seen; raw SMS aren't stored.
- **Re-read repairs old rows:** it refreshes payee and category (keeping hand-set categories), replaces review rows that now parse and removes ones that turned out to be ads.
- **Ads are dropped only on ad-only signals** ("download … app", app-store links, "up to Birr", win/prize words) and only when no transaction pattern matched, so an unknown real transaction lands in review instead of vanishing.
- **Amharic amounts** ("ብር 1,250.00", "1,250.00 ብር") become "ETB 1,250.00" before matching.
- **The dedup key includes the type,** so a reversal quoting the original reference isn't dropped. Hand-added rows use `manual|<id>`.
- **Money is integer santim.**
- **Version and build number live only in `package.json`;** `build.gradle` reads them and `npm version` bumps both.
- **sql.js is pinned to 1.12.0.** The browser SQLite (jeep-sqlite) embeds that version's JavaScript; a newer `sql-wasm.wasm` fails to load and the browser build shows nothing.
- **Release builds have no `INTERNET` permission;** only debug builds add it, for live reload.
- **Charts are hand-built SVG** with fixed, contrast-checked category colours (see `src/styles.scss`).

## Ideas for later

- Use a payment reason typed into a transfer, if banks include it, to pick the category.
- Out of scope so far: budgets, savings goals, cloud sync, AI categorisation, reports.
