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
      account: '1*6789',
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
      account: '1*6789',
      counterAccount: null,
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
      account: '12*345',
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
    name: 'telebirr package purchase',
    sms: sms(
      '127',
      new Date(2026, 9, 22, 7, 28, 0),
      'Dear Abebe\nYou have paid ETB 50.00 for package Weekly Internet Package for 500 MB purchase made for 251912345678 on 22/10/2026 07:28:00. Your transaction number is  CJK2NB5Q4T. Your current balance is ETB 1,234.50.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/CJK2NB5Q4T\nThank you for using telebirr\nEthio telecom',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 5000,
      merchant: 'Ethio telecom',
      reference: 'CJK2NB5Q4T',
      category: 'bills',
    },
  },
  {
    name: 'telebirr payment with a note after the payee',
    sms: sms(
      '127',
      new Date(2026, 9, 21, 9, 40, 0),
      'Dear Abebe\nYou have paid ETB 120.00 to Sample Rides PLC; Driver number 251911223344 on 21/10/2026 09:40:00. Your transaction number is CJL3PC6R5U. Your current balance is ETB 1,114.50.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/CJL3PC6R5U\nThank you for using telebirr',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 12000,
      merchant: 'Sample Rides PLC',
      reference: 'CJL3PC6R5U',
    },
  },
  {
    name: 'telebirr airtime recharge',
    sms: sms(
      '127',
      new Date(2026, 9, 4, 21, 10, 38),
      'Dear Abebe\nYou have recharged ETB 100.00 airtime for 912345678 on 04/10/2026 21:10:38. Your transaction number is CJM4QD7S6V. Your current  balance is  ETB 300.00. To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/CJM4QD7S6V\nThank you for using telebirr\nEthio telecom',
    ),
    expect: {
      source: 'telebirr',
      type: 'debit',
      amountMinor: 10000,
      merchant: 'Ethio telecom',
      reference: 'CJM4QD7S6V',
      category: 'bills',
    },
  },
  {
    name: 'CBE debit transaction with fees',
    sms: sms(
      'CBE',
      new Date(2026, 9, 20, 15, 0, 0),
      'Dear Abebe Kebede A debit transaction of ETB 600.0. has occurred on your account 1****6789. Service charge of ETB 10.00 and VAT(15%) of ETB1.50 and Disaster Recovery(5%) of 0.50 with total of ETB612.00 .Your current balance is ETB40.00. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-AbCdEfGhIjKlMnOp  for feedback: https://forms.gle/example',
    ),
    expect: { source: 'CBE', type: 'debit', amountMinor: 60000, merchant: null },
  },
  {
    name: 'BOA debit in Amharic',
    sms: sms(
      'BOA',
      new Date(2026, 9, 20, 10, 0, 0),
      'ውድ ደንበኛችን  ከሂሳብ ቁጥርዎ 1*23 ብር 1,250.00 ወጪ ተደርጓል።ቀሪ ሂሳብዎ: ETB 80.00። ደረሰኝ: https://cs.bankofabyssinia.com/slip/?trx=FT26293ABCD12345\nእባክዎ አስተያየትዎን ይስጡን: https://cs.bankofabyssinia.com/cs/?trx=DFT26293ABCD1 ለተጨማሪ መረጃ በነፃ ስልክ ቁጥር 8397 (24/7) ይደውሉ፡፡አቢሲንያ ባንክ',
    ),
    expect: {
      account: '1*23',
      source: 'BOA',
      type: 'debit',
      amountMinor: 125000,
      reference: 'FT26293ABCD12345',
    },
  },
  {
    name: 'e-Birr received from a business',
    sms: sms(
      'e-Birr',
      new Date(2026, 9, 19, 9, 5, 9),
      '[-EBIRR-KAAFI-] Ref:802641600000 Confirmed. ETB350 Received from Sample Transport PLC (251911000000),Date: 19/10/26 09:05:09, your new A/C balance is ETB420\nhttps://receipt.ebirr.com/kaafimf/AbCdEf',
    ),
    expect: {
      source: 'e-Birr',
      type: 'credit',
      amountMinor: 35000,
      merchant: 'Sample Transport PLC',
      reference: '802641600000',
    },
  },
  {
    name: 'BOA credit in Amharic',
    sms: sms(
      'BOA',
      new Date(2026, 9, 19, 12, 0, 0),
      'ውድ ደንበኛችን  ወደ ሂሳብ ቁጥርዎ 1*23 ከ ALMAZ BEKELE  ብር 750.00 ገቢ ተደርጓዋል።ቀሪ ሂሳብዎ: ETB 830.00። ደረሰኝ: https://cs.bankofabyssinia.com/slip/?trx=FT26292ABCD98765\nእባክዎ አስተያየትዎን ይስጡን: https://cs.bankofabyssinia.com/cs/?trx=CFT26292ABCD ለተጨማሪ መረጃ በነፃ ስልክ ቁጥር 8397 (24/7) ይደውሉ፡፡አቢሲንያ ባንክ',
    ),
    expect: {
      source: 'BOA',
      type: 'credit',
      amountMinor: 75000,
      merchant: 'ALMAZ BEKELE',
      reference: 'FT26292ABCD98765',
      category: 'income',
    },
  },
  {
    name: 'M-PESA received from CBE, in Amharic',
    sms: sms(
      'M-PESA',
      new Date(2026, 7, 31, 20, 36, 0),
      'ውድ Abebe፣ 600.00 ብር ከ Commercial Bank Of Ethiopia-B2C  ፟- ከ Abebe Kebede  በ 31/8/26 በ 8:36 PM ላይ ተቀብለዋል። የገንዘብ ዝውውር መለያ ቁጥር UHV0ABCDEF ነው። የእርስዎ አሁን ያለው የM-PESA ቀሪ ሒሳብ 600.00 ብር ነው። https://m-pesabusiness.safaricom.et/nid/login',
    ),
    expect: {
      source: 'M-PESA',
      type: 'credit',
      amountMinor: 60000,
      merchant: 'Commercial Bank Of Ethiopia-B2C',
      reference: 'UHV0ABCDEF',
      category: 'transfers',
    },
  },
  {
    name: 'e-Birr paid to a merchant',
    sms: sms(
      'e-Birr',
      new Date(2026, 9, 18, 8, 0, 0),
      '[-Kaafi-Ebirr-] ETB 400 has been paid to merchant Sample Taxi.\nhttps://receipt.ebirr.com/kaafimf/AbCdEf',
    ),
    expect: {
      source: 'e-Birr',
      type: 'debit',
      amountMinor: 40000,
      merchant: 'Sample Taxi',
      category: 'transport',
    },
  },
  {
    name: 'CBE credited by a company',
    sms: sms(
      'CBE',
      new Date(2026, 8, 28, 10, 0, 0),
      'Dear Mr Abebe your Account 1****6789 has been credited by SAMPLE INSURANCE COMPANY S.C (SIC) with ETB 1200.00. Your Current Balance is ETB 1250.50. Thank you for Banking with CBE! for Reciept https://apps.cbe.com.et:100/BranchReceipt/FT26271ABCDE&90612345',
    ),
    expect: {
      source: 'CBE',
      type: 'credit',
      amountMinor: 120000,
      merchant: 'SAMPLE INSURANCE COMPANY S.C',
      reference: 'FT26271ABCDE',
      category: 'income',
    },
  },
  {
    name: 'M-PESA Safaricom package in Amharic',
    sms: sms(
      'M-PESA',
      new Date(2026, 9, 6, 17, 31, 0),
      'ውድ Abebe፣ የ1,000.00 ብር የሳፋሪኮም ጥቅል ለ 251711000000 በ6/10/26 በ5:31 PM ላይ ገዝተዋል። የገንዘብ ዝውውር መለያ ቁጥር UJ63ABCDEF ነው። የአገልግሎት ክፍያ 0.00 ብር ነው። አሁን ያለዎት የM-PESA ቀሪ ሒሳብ 250.00 ብር ነው። ደረሰኝዎን በዚህ ያግኙ፡ https://m-pesabusiness.safaricom.et/receipt/UJ63ABCDEF',
    ),
    expect: {
      source: 'M-PESA',
      type: 'debit',
      amountMinor: 100000,
      merchant: 'Safaricom',
      reference: 'UJ63ABCDEF',
      category: 'bills',
    },
  },
  {
    name: 'M-PESA airtime in Amharic, with an ad after it',
    sms: sms(
      'M-PESA',
      new Date(2026, 9, 4, 5, 41, 0),
      'ውድ Abebe፣ የ5.00 ብር የአየር ሰዓት ለራስዎ ስልክ በ4/10/26 5:41 AM ላይ ገዝተዋል። የገንዘብ ዝውውር መለያ ቁጥር UJ43ABCDEF ነው። የአገልግሎት ክፍያ 0.00 ብር ነው። አሁን ያልዎት የM-PESA ቀሪ ሒሳብ 120.00 ብር ነው። በ M-PESA የ 5 ብር እለታዊ 100 ሜ.ባ የኢንተርኔት ጥቅል  ሲገዙ ተጨማሪ 20 ሜ.ባ ያግኙ::  ለመግዛት ማስፈንጠሪያውን ይጫኑ  https://bit.ly/example',
    ),
    expect: {
      source: 'M-PESA',
      type: 'debit',
      amountMinor: 500,
      merchant: 'Safaricom',
      reference: 'UJ43ABCDEF',
      category: 'bills',
    },
  },
  {
    name: 'BOA loan ad in Amharic',
    sms: sms(
      'BOA',
      new Date(2026, 9, 10, 9, 0, 0),
      'ብድር ተገኝቷል!\n\nውድ ደንበኛችን የሞባይል ባንኪንግ መተግበሪያችንን በመጠቀም  ወዲያውኑ  አነስተኛ ብድር ይውሰዱ ። የሂሳብ እንቅስቃሴዎ ሲያድግ እና በተደጋጋሚ ሲበደሩ የመበደር አቅምዎ እስከ ብር 100,000 ያድጋል።\nለአንድሮይድ:\nhttps://play.google.com/store/apps/details?id=com.example',
    ),
    expect: { ignored: 'promo' },
  },
  {
    name: 'digital lending ad',
    sms: sms(
      'CBE',
      new Date(2026, 9, 11, 9, 0, 0),
      'Sample Digital Lending\nFast Money - Easy Access!\nAre you engaged in a business? Then, Download Sample Digital Lending App and access instant, collateral free loans at your fingertips. With repeated use, your limit will grow up to Birr 100,000.\nFor more information, call at 9999',
    ),
    expect: { ignored: 'promo' },
  },
  {
    name: 'CBE transfer naming the account holder in brackets',
    sms: sms(
      'CBE',
      new Date(2026, 9, 20, 11, 0, 0),
      'Dear Abebe Kebede You have successfully transferred ETB1500.00 from account 1********6789 to account 1********4321 (A.a .city.adm.sample Agency). Service charge of ETB 2.00 and VAT(15%) of ETB0.30 and Disaster Recovery(5%) of 0.10 with total of ETB1502.40 .Your current balance is ETB300.00. Thanks for Banking with CBE.',
    ),
    expect: {
      account: '1*6789',
      counterAccount: '1*4321',
      source: 'CBE',
      type: 'debit',
      amountMinor: 150000,
      merchant: 'A.a .city.adm.sample Agency',
    },
  },
  {
    name: 'CBE received naming the account holder in brackets',
    sms: sms(
      'CBE',
      new Date(2026, 9, 20, 12, 0, 0),
      'Dear Abebe Kebede You have received ETB 800.00 from account 1********4321 (Almaz Bekele Tesfaye) to your account 1********6789. Your current balance is ETB1,100.00. Thanks for Banking with CBE.',
    ),
    expect: {
      account: '1*6789',
      counterAccount: '1*4321',
      source: 'CBE',
      type: 'credit',
      amountMinor: 80000,
      merchant: 'Almaz Bekele Tesfaye',
      category: 'income',
    },
  },
  {
    name: 'CBE transfer to another account of your own',
    sms: sms(
      'CBE',
      new Date(2026, 9, 22, 9, 0, 0),
      'Dear Abebe Kebede You have successfully transferred ETB1000.00 from account 1********6789 to account 1********2468 (Abebe Kebede). Your current balance is ETB2,300.00. Thanks for Banking with CBE.',
    ),
    expect: {
      source: 'CBE',
      type: 'debit',
      amountMinor: 100000,
      account: '1*6789',
      counterAccount: '1*2468',
      balanceMinor: 230000,
    },
  },
  {
    name: 'CBE received on your other account',
    sms: sms(
      'CBE',
      new Date(2026, 9, 22, 9, 0, 5),
      'Dear Abebe Kebede You have received ETB 1,000.00 from account 1********6789 (Abebe Kebede) to your account 1********2468. Your current balance is ETB5,000.00. Thanks for Banking with CBE.',
    ),
    expect: {
      source: 'CBE',
      type: 'credit',
      amountMinor: 100000,
      account: '1*2468',
      counterAccount: '1*6789',
      balanceMinor: 500000,
    },
  },
  {
    name: 'telebirr received from a bank into your own telebirr',
    sms: sms(
      '127',
      new Date(2026, 9, 20, 13, 0, 0),
      'You have received  ETB 2,000.00 by transaction number CJP6SF9U8X on 2026-10-20 13:00:00 from Bank of Abyssinia to your telebirr Account 251911223344 - Abebe Kebede. Your current balance is ETB 2,100.00.',
    ),
    expect: {
      account: null,
      source: 'telebirr',
      type: 'credit',
      amountMinor: 200000,
      merchant: 'Bank of Abyssinia',
      category: 'transfers',
    },
  },
  {
    name: 'M-PESA sent to a number, in Amharic',
    sms: sms(
      'M-PESA',
      new Date(2026, 8, 9, 21, 0, 0),
      'ውድ Abebe፣ 50.00 ብር ለ251711000000 በ 9/9/26 በ9:00 PM ላይ ልከዋል። የገንዘብ ዝውውር መለያ ቁጥር UI90ABCDEF ነው። የአገልግሎት ክፍያ 0.00 ብር ነው። አሁን ያልዎት የM-PESA ቀሪ ሒሳብ 100.00 ብር ነው።',
    ),
    expect: { source: 'M-PESA', type: 'debit', amountMinor: 5000, reference: 'UI90ABCDEF' },
  },
  {
    name: 'M-PESA cashback, in Amharic',
    sms: sms(
      'M-PESA',
      new Date(2026, 8, 10, 9, 0, 0),
      'እንኳን ደስ አለዎት፣ በM-PESA በኩል ስለከፈሉ 10.00 ብር ተመላሽ ገንዘብ ተቀብለዋል።',
    ),
    expect: {
      source: 'M-PESA',
      type: 'credit',
      amountMinor: 1000,
      merchant: 'M-PESA cashback',
      category: 'income',
    },
  },
  {
    name: 'M-PESA loan reminder is not a transaction',
    sms: sms(
      'M-PESA',
      new Date(2026, 8, 11, 9, 0, 0),
      'አንድ ቀን ብቻ ነው የቀረው! የ እርፍ/Errif 200.00 ብር ብድርዎን ዛሬ ይክፈሉ እና ምንም አይነት ዕለታዊ የወለድ ክፍያ አያስከፍልዎትም።',
    ),
    expect: { ignored: 'promo' },
  },
  {
    name: 'BOA maintenance fee',
    sms: sms(
      'BOA',
      new Date(2026, 9, 1, 8, 0, 0),
      'Dear Abebe, your account 1*****23 was debited with ETB 5.75 for the Mobile Banking Monthly Maintenance Fee, including 15% VAT and 5% Disaster Fund. Available balance: ETB 90.00. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26274ABCDE12345',
    ),
    expect: {
      source: 'BOA',
      type: 'debit',
      amountMinor: 575,
      merchant: 'Mobile Banking Monthly Maintenance Fee',
      reference: 'FT26274ABCDE12345',
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
      account: '0134*01',
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
      account: '50*12',
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
      account: '10*99',
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
