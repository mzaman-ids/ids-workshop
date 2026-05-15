import {safeParse} from 'valibot';
import {describe, expect, it} from 'vitest';
import {partCreateSchema, partUpdateSchema} from '../../app/pages/parts/schemas/partSchema';

describe('partCreateSchema', () => {
  const validVendor = {
    vendorNumber: 'V001',
    vendorName: 'Acme',
    vendorPartNumber: '',
    cost: '',
    isPrimary: true,
  };

  const validCreate = {
    partNumber: 'PART-001',
    description: 'Test part',
    status: 'active',
    comments: '',
    listPrice: '10.00',
    priceGroup: '',
    glGroup: '',
    taxCode: '',
    bypassPriceUpdate: false,
    promptForSerialNumber: false,
    sellUom: 'EA',
    purchaseUom: 'EA',
    salePurchaseRatio: '1',
    shippingWeight: '',
    shippingUnit: '',
    caseQty: '',
    minQty: '',
    maxQty: '',
    minDays: '',
    minOrder: '',
    vendors: [validVendor],
    bins: [],
  };

  it('accepts a valid create payload', () => {
    const result = safeParse(partCreateSchema, validCreate);
    expect(result.success).toBe(true);
  });

  it('rejects empty partNumber', () => {
    const result = safeParse(partCreateSchema, {...validCreate, partNumber: ''});
    expect(result.success).toBe(false);
  });

  it('rejects partNumber with spaces', () => {
    const result = safeParse(partCreateSchema, {...validCreate, partNumber: 'PART 001'});
    expect(result.success).toBe(false);
  });

  it('rejects partNumber over 50 chars', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      partNumber: 'A'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = safeParse(partCreateSchema, {...validCreate, description: ''});
    expect(result.success).toBe(false);
  });

  it('rejects zero vendors', () => {
    const result = safeParse(partCreateSchema, {...validCreate, vendors: []});
    expect(result.success).toBe(false);
  });

  it('rejects vendors with no primary', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      vendors: [{...validVendor, isPrimary: false}],
    });
    expect(result.success).toBe(false);
  });

  it('rejects maxQty less than minQty', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      minQty: '10',
      maxQty: '5',
    });
    expect(result.success).toBe(false);
  });

  it('accepts maxQty equal to minQty', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      minQty: '10',
      maxQty: '10',
    });
    expect(result.success).toBe(true);
  });

  it('rejects shippingWeight > 0 without shippingUnit', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      shippingWeight: '5',
      shippingUnit: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts shippingWeight > 0 with shippingUnit', () => {
    const result = safeParse(partCreateSchema, {
      ...validCreate,
      shippingWeight: '5',
      shippingUnit: 'LB',
    });
    expect(result.success).toBe(true);
  });
});

describe('partUpdateSchema', () => {
  const validUpdate = {
    description: 'Updated description',
    status: 'active',
    comments: '',
    listPrice: '',
    priceGroup: '',
    glGroup: '',
    taxCode: '',
    bypassPriceUpdate: false,
    promptForSerialNumber: false,
    sellUom: 'EA',
    purchaseUom: 'EA',
    salePurchaseRatio: '1',
    shippingWeight: '',
    shippingUnit: '',
    caseQty: '',
    minQty: '',
    maxQty: '',
    minDays: '',
    minOrder: '',
    vendors: [
      {vendorNumber: 'V001', vendorName: 'Acme', vendorPartNumber: '', cost: '', isPrimary: true},
    ],
    bins: [],
  };

  it('accepts a valid update payload (no partNumber required)', () => {
    const result = safeParse(partUpdateSchema, validUpdate);
    expect(result.success).toBe(true);
  });

  it('rejects empty description', () => {
    const result = safeParse(partUpdateSchema, {...validUpdate, description: ''});
    expect(result.success).toBe(false);
  });
});
