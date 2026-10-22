import { RawSms } from '../../models/transaction.model';
import { IgnoreReason, ParsedTx } from '../sms-parser';

// Fictional messages. Names, accounts and references are made up; formats are
// approximations to be replaced with redacted real samples.

export interface Fixture {
  name: string;
  sms: RawSms;
  expect: Partial<ParsedTx> | { ignored: IgnoreReason };
}

let seq = 0;
const sms = (address: string, date: Date, body: string): RawSms => ({
  id: String(++seq),
  address,
  body,
  date: date.getTime(),
});

export const FIXTURES: Fixture[] = [
  {
    name: 'CBE debit to merchant',
    sms: sms(
      'CBE',
      new Date(2026, 9, 14, 9, 12, 44),
      'Dear Abebe your Account 1*****6789 has been debited with ETB 1,250.00 on 14/10/2026 at 09:12:44 to Kaldis Coffee Bole. Ref No FT26287ABC12. Your Current Balance is ETB 8,430.55. Thank you for Banking with CBE!',
    ),
    expect: {
      source: 'CBE',
      type: 'debit',
      amountMinor: 125000,
      merchant: 'Kaldis Coffee Bole',
      reference: 'FT26287ABC12',
      category: 'food',
    },
  },
  {
    name: 'CBE credit',
    sms: sms(
      'CBE',
      new Date(2026, 9, 1, 8, 0, 10),
      'Dear Abebe your Account 1*****6789 has been Credited with ETB 15,000.00 from Selam Trading PLC, on 01/10/2026 at 08:00:10 with Ref No FT26274XYZ98. Your Current Balance is ETB 23,430.55. Thank you for Banking with CBE!',
    ),
    expect: {
      source: 'CBE',
      type: 'credit',
      amountMinor: 1500000,
      merchant: 'Selam Trading PLC',
      reference: 'FT26274XYZ98',
      category: 'income',
    },
  },
  {
    name: 'CBE transfer to telebirr',
    sms: sms(
      'CBE',
      new Date(2026, 9, 12, 18, 30, 0),
      'Dear Abebe You have transfered ETB 2,000.00 to Abebe Kebede (telebirr 2519****5678) on 12/10/2026 at 18:30:00 from your account 1*****6789. Ref No FT26285TLB01. Thank you for Banking with CBE!',
    ),
    expect: {
      source: 'CBE',
      type: 'debit',
      amountMinor: 200000,
      merchant: 'Abebe Kebede',
      reference: 'FT26285TLB01',
    },
  },
  {
    name: 'CBE balance only',
    sms: sms(
      'CBE',
      new Date(2026, 9, 15, 7, 0, 0),
      'Dear Abebe, the balance of your account 1*****6789 is ETB 8,430.55 as of 15/10/2026. Thank you for Banking with CBE!',
    ),
    expect: { ignored: 'balance' },
  },
  {
    name: 'CBE OTP',
    sms: sms(
      'CBE',
      new Date(2026, 9, 15, 7, 5, 0),
      'Your CBE Birr verification code is 482913. Do not share it with anyone.',
    ),
    expect: { ignored: 'otp' },
  },
  {
    name: 'BOA merchant payment',
    sms: sms(
      'BoA',
      new Date(2026, 9, 17, 11, 20, 0),
      'Dear Customer, your account 12****345 has been debited with ETB 780.00 for Merchant Payment to Ethio Fuel Station on 17-Oct-2026 11:20. Ref: 2629011A7Q. Available balance: ETB 4,210.00. -Bank of Abyssinia',
    ),
    expect: {
      source: 'BOA',
      type: 'debit',
      amountMinor: 78000,
      merchant: 'Ethio Fuel Station',
      reference: '2629011A7Q',
      category: 'transport',
    },
  },
  {
    name: 'BOA credit',
    sms: sms(
      'BoA',
      new Date(2026, 9, 18, 9, 2, 0),
      'Dear Customer, your account 12****345 has been credited with ETB 3,500.00 from Hana Girma on 18-Oct-2026 09:02. Ref: 2629102B3K. Available balance: ETB 7,710.00. -Bank of Abyssinia',
    ),
    expect: {
      source: 'BOA',
      type: 'credit',
      amountMinor: 350000,
      merchant: 'Hana Girma',
      reference: '2629102B3K',
      category: 'income',
    },
  },
  {
    name: 'BOA reversal goes to review',
    sms: sms(
      'BoA',
      new Date(2026, 9, 17, 15, 0, 0),
      'Dear Customer, ETB 780.00 has been reversed to your account 12****345 for transaction Ref: 2629011A7Q. Available balance: ETB 4,990.00. -Bank of Abyssinia',
    ),
    expect: {
      source: 'BOA',
      type: 'unknown',
      amountMinor: 78000,
      reference: '2629011A7Q',
      needsReview: true,
      category: null,
    },
  },
  {
    name: 'BOA promo',
    sms: sms(
      'BoA',
      new Date(2026, 9, 10, 10, 0, 0),
      'Win up to ETB 100,000 in the BoA Apollo savings lottery! Open an account today. -Bank of Abyssinia',
    ),
    expect: { ignored: 'promo' },
  },
  {
    name: 'telebirr payment',
    sms: sms(
      '127',
      new Date(2026, 9, 15, 13, 5, 22),
      'Dear Abebe, You have paid ETB 350.00 to Shoa Supermarket on 15/10/2026 13:05:22. Your transaction number is CJF7KX2M1Q. Your current E-Money Account balance is ETB 1,120.40. Thank you for using telebirr.',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 35000,
      merchant: 'Shoa Supermarket',
      reference: 'CJF7KX2M1Q',
      category: 'household',
    },
  },
  {
    name: 'telebirr transfer to a person',
    sms: sms(
      '127',
      new Date(2026, 9, 16, 20, 11, 5),
      'Dear Abebe, You have transferred ETB 500.00 to Kebede Alemu (2519****4321) on 16/10/2026 20:11:05. Your transaction number is CJG8LY3N2R. The service fee is ETB 1.00 and VAT ETB 0.15. Your current E-Money Account balance is ETB 618.25.',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 50000,
      merchant: 'Kebede Alemu',
      reference: 'CJG8LY3N2R',
      category: 'other',
    },
  },
  {
    name: 'telebirr airtime',
    sms: sms(
      '127',
      new Date(2026, 9, 16, 8, 0, 0),
      'Dear Abebe, You have bought airtime of ETB 100.00 for 2519****1234 on 16/10/2026 08:00:00. Your transaction number is CJH9MZ4P3S. Your current E-Money Account balance is ETB 1,020.40.',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 10000,
      reference: 'CJH9MZ4P3S',
      category: 'bills',
    },
  },
  {
    name: 'telebirr received from CBE',
    sms: sms(
      '127',
      new Date(2026, 9, 12, 18, 30, 41),
      'Dear Abebe, You have received ETB 2,000.00 from Commercial Bank of Ethiopia (1*****6789) on 12/10/2026 18:30:41. Your transaction number is CJE6JW1L0P. Your current E-Money Account balance is ETB 2,738.40.',
    ),
    expect: {
      source: 'telebirr',
      type: 'credit',
      amountMinor: 200000,
      merchant: 'Commercial Bank of Ethiopia',
      reference: 'CJE6JW1L0P',
      category: 'transfers',
    },
  },
  {
    name: 'telebirr balance only',
    sms: sms(
      '127',
      new Date(2026, 9, 16, 9, 0, 0),
      'Your telebirr E-Money Account balance is ETB 1,020.40.',
    ),
    expect: { ignored: 'balance' },
  },
  {
    name: 'telebirr deduction with the amount first',
    sms: sms(
      '127',
      new Date(2026, 9, 19, 12, 0, 0),
      'Dear Abebe, ETB 45.00 was deducted for your monthly service subscription on 19/10/2026. Your transaction number is CJK1NA5Q4T.',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 4500,
      reference: 'CJK1NA5Q4T',
      merchant: null,
      category: 'other',
    },
  },
  {
    name: 'unrecognized format with an amount goes to review',
    sms: sms(
      '127',
      new Date(2026, 9, 19, 12, 5, 0),
      'Dear Abebe, a request of ETB 45.00 is being processed. Your transaction number is CJK1NA5Q5U.',
    ),
    expect: {
      source: 'telebirr',
      type: 'unknown',
      amountMinor: 4500,
      reference: 'CJK1NA5Q5U',
      needsReview: true,
    },
  },
  {
    name: 'Awash debit with the currency after the amount',
    sms: sms(
      'AwashBank',
      new Date(2026, 9, 20, 10, 0, 0),
      'Dear customer, your account 0134****01 has been debited with 2,300.00 ETB to Getfam Hotel on 20/10/2026. Ref: AWB26293X1. Balance: 9,700.00 ETB',
    ),
    expect: {
      source: 'Awash',
      type: 'debit',
      amountMinor: 230000,
      merchant: 'Getfam Hotel',
      reference: 'AWB26293X1',
    },
  },
  {
    name: 'Dashen amount-first credit',
    sms: sms(
      'DashenBank',
      new Date(2026, 9, 20, 11, 0, 0),
      'ETB 8,000.00 has been credited to your account 50***12 from Liya Bekele on 20-10-2026. Reference No. DB2629311Q. Thank you for banking with Dashen.',
    ),
    expect: {
      source: 'Dashen',
      type: 'credit',
      amountMinor: 800000,
      merchant: 'Liya Bekele',
      reference: 'DB2629311Q',
      category: 'income',
    },
  },
  {
    name: 'Coopbank ATM withdrawal',
    sms: sms(
      'Coopbank',
      new Date(2026, 9, 21, 18, 0, 0),
      'Dear Member, ETB 1,000.00 has been withdrawn from your account 10***99 at ATM Piassa on 21/10/2026. Ref: CO2629477A. Available Balance ETB 4,000.00',
    ),
    expect: {
      source: 'Coopbank',
      type: 'debit',
      amountMinor: 100000,
      reference: 'CO2629477A',
      merchant: null,
    },
  },
  {
    name: 'M-PESA money sent',
    sms: sms(
      'M-PESA',
      new Date(2026, 9, 21, 19, 0, 0),
      'TJK7HG21PQ Confirmed. ETB 150.00 sent to Abel Tesfaye 2517****8812 on 21/10/26 at 7:00 PM. New M-PESA balance is ETB 350.00. Transaction cost, ETB 0.00.',
    ),
    expect: {
      source: 'M-PESA',
      type: 'debit',
      amountMinor: 15000,
      merchant: 'Abel Tesfaye',
    },
  },
  {
    name: 'CBE Birr received',
    sms: sms(
      'CBE Birr',
      new Date(2026, 9, 21, 20, 0, 0),
      'You have received ETB 600.00 from Meron Haile (0911****45) on 21/10/2026 20:00. Txn ID: CB26294K7M. Your CBE Birr balance is ETB 900.00.',
    ),
    expect: {
      source: 'CBE Birr',
      type: 'credit',
      amountMinor: 60000,
      merchant: 'Meron Haile',
      reference: 'CB26294K7M',
    },
  },
  {
    name: 'unknown sender',
    sms: sms(
      '+251911000000',
      new Date(2026, 9, 19, 12, 0, 0),
      'You have paid ETB 50.00 to Someone.',
    ),
    expect: { ignored: 'unsupported-sender' },
  },
];
