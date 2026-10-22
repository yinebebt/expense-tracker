import { categorize, categorizeMerchant } from './categorize';

describe('categorize', () => {
  it('maps merchants by keyword', () => {
    expect(categorizeMerchant('Kaldis Coffee Bole')).toBe('food');
    expect(categorizeMerchant('Getfam Hotel')).toBe('food');
    expect(categorizeMerchant('Ethio Fuel Station')).toBe('transport');
    expect(categorizeMerchant('Shoa Supermarket')).toBe('household');
    expect(categorizeMerchant('Bethel Pharmacy')).toBe('health');
    expect(categorizeMerchant('Ethio Telecom')).toBe('bills');
    expect(categorizeMerchant('Edna Mall Boutique')).toBe('shopping');
    expect(categorizeMerchant('Kebede Alemu')).toBeNull();
    expect(categorizeMerchant(null)).toBeNull();
  });

  it('treats a bank or wallet as the other side as an own-account transfer', () => {
    expect(categorize('credit', 'Commercial Bank of Ethiopia')).toBe('transfers');
    expect(categorize('debit', 'telebirr')).toBe('transfers');
    expect(categorize('debit', 'Awash Bank Bole')).toBe('transfers');
    expect(categorize('debit', 'Ethio Telecom')).toBe('bills');
  });

  it('keeps income separate from spending categories', () => {
    expect(categorize('credit', 'Kaldis Coffee')).toBe('income');
    expect(categorize('debit', 'Kebede Alemu')).toBe('other');
    expect(categorize('unknown', 'Kaldis Coffee')).toBeNull();
  });
});
