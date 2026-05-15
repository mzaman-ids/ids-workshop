import {describe, expect, it} from 'vitest';
import {
  buildCreateInput,
  buildDefaultValues,
  buildUpdateInput,
} from '../../app/pages/parts/hooks/usePartForm';
import type {PartDetail} from '../../app/pages/parts/types/part';

const mockPart: PartDetail = {
  id: 'Parts/1',
  partNumber: 'PART-001',
  description: 'Test Part',
  status: 'active',
  listPrice: {amount: 1000, currency: 'USD'},
  avgCost: {amount: 500, currency: 'USD'},
  sellUom: 'EA',
  purchaseUom: 'CS',
  salePurchaseRatio: 12,
  totalOnHand: 5,
  totalCommitted: 1,
  totalOnOrder: 2,
  totalBackordered: 0,
  totalAvailable: 4,
  totalSpecialOrderCommitted: 0,
  totalNetAvailable: 4,
  comments: 'A comment',
  shippingWeight: 2.5,
  shippingUnit: 'LB',
  caseQty: 6,
  minQty: 1,
  maxQty: 100,
  minDays: 3,
  minOrder: 2,
  bypassPriceUpdate: true,
  promptForSerialNumber: false,
  priceGroup: 'PG1',
  glGroup: 'GL1',
  taxCode: 'TX1',
  pogNumber: null,
  popCode: null,
  alternatePartNumbers: [],
  lastReceived: null,
  lastSold: null,
  primaryVendorName: 'Acme',
  primaryVendorPartNumber: 'V-PART-1',
  primaryBinNumber: 'A1',
  locationOnHand: 3,
  locationCommitted: 0,
  locationOnOrder: 1,
  createdDate: '2026-01-01',
  updatedDate: '2026-05-01',
  bins: [{binNumber: 'A1', description: 'Shelf A1', isMain: true}],
  vendors: [
    {
      vendorNumber: 'V001',
      vendorName: 'Acme',
      vendorPartNumber: 'V-PART-1',
      cost: {amount: 500, currency: 'USD'},
      isPrimary: true,
    },
  ],
};

describe('buildDefaultValues', () => {
  it('returns empty defaults when called with no arg', () => {
    const values = buildDefaultValues();
    expect(values.partNumber).toBe('');
    expect(values.status).toBe('active');
    expect(values.sellUom).toBe('EA');
    expect(values.purchaseUom).toBe('EA');
    expect(values.salePurchaseRatio).toBe('1');
    expect(values.bypassPriceUpdate).toBe(false);
    expect(values.vendors).toEqual([]);
    expect(values.bins).toEqual([]);
  });

  it('maps scalar fields from PartDetail', () => {
    const values = buildDefaultValues(mockPart);
    expect(values.partNumber).toBe('PART-001');
    expect(values.description).toBe('Test Part');
    expect(values.listPrice).toBe('10'); // 1000 / 100
    expect(values.sellUom).toBe('EA');
    expect(values.purchaseUom).toBe('CS');
    expect(values.salePurchaseRatio).toBe('12');
    expect(values.bypassPriceUpdate).toBe(true);
    expect(values.shippingWeight).toBe('2.5');
  });

  it('maps vendors from PartDetail', () => {
    const values = buildDefaultValues(mockPart);
    expect(values.vendors).toHaveLength(1);
    const vendor = values.vendors[0];
    expect(vendor.vendorNumber).toBe('V001');
    expect(vendor.cost).toBe('5'); // 500 / 100
    expect(vendor.isPrimary).toBe(true);
  });

  it('maps bins from PartDetail', () => {
    const values = buildDefaultValues(mockPart);
    expect(values.bins).toHaveLength(1);
    const bin = values.bins[0];
    expect(bin.binCode).toBe('A1'); // from binNumber
    expect(bin.isMain).toBe(true);
  });
});

describe('buildCreateInput', () => {
  const formValues = buildDefaultValues(mockPart);

  it('converts string numbers to floats', () => {
    const input = buildCreateInput(formValues, 'LOC_HQ');
    expect(input.listPrice).toBe(10);
    expect(input.shippingWeight).toBe(2.5);
  });

  it('maps empty strings to undefined', () => {
    const emptyValues = buildDefaultValues();
    const input = buildCreateInput(emptyValues, 'LOC_HQ');
    expect(input.listPrice).toBeUndefined();
    expect(input.shippingWeight).toBeUndefined();
    expect(input.caseQty).toBeUndefined();
  });

  it('includes locationId', () => {
    const input = buildCreateInput(formValues, 'LOC_HQ');
    expect(input.locationId).toBe('LOC_HQ');
  });

  it('maps vendor cost to float', () => {
    const input = buildCreateInput(formValues, 'LOC_HQ');
    expect(input.vendors[0].cost).toBe(5);
  });

  it('includes partNumber', () => {
    const input = buildCreateInput(formValues, 'LOC_HQ');
    expect(input.partNumber).toBe('PART-001');
  });
});

describe('buildUpdateInput', () => {
  const formValues = buildDefaultValues(mockPart);

  it('does NOT include partNumber field', () => {
    const input = buildUpdateInput(formValues, 'LOC_HQ');
    expect('partNumber' in input).toBe(false);
  });

  it('maps numeric strings to floats', () => {
    const input = buildUpdateInput(formValues, 'LOC_HQ');
    expect(input.listPrice).toBe(10);
    expect(input.shippingWeight).toBe(2.5);
  });

  it('includes locationId', () => {
    const input = buildUpdateInput(formValues, 'LOC_HQ');
    expect(input.locationId).toBe('LOC_HQ');
  });
});
