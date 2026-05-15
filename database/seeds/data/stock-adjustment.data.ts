export type StockAdjustmentSeedData = {
  adjustmentNumber: string;
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: 'add' | 'remove';
  quantity: number;
  quantityDelta: number;
  reasonCode: string;
  notes?: string | null;
};

export const stockAdjustmentSeedData: StockAdjustmentSeedData[] = [
  {
    adjustmentNumber: 'ADJ-2026-0001',
    locationId: 'locations/LOC_HQ',
    partNumber: 'FILTER-OIL-PH3593A',
    partDescriptionSnapshot: 'Engine Oil Filter PH3593A',
    type: 'remove',
    quantity: 2,
    quantityDelta: -2,
    reasonCode: 'DAMAGE',
    notes: 'Packaging crushed during storage',
  },
  {
    adjustmentNumber: 'ADJ-2026-0002',
    locationId: 'locations/LOC_AAA',
    partNumber: 'FILTER-AIR-CA10171',
    partDescriptionSnapshot: 'Air Filter CA10171',
    type: 'add',
    quantity: 5,
    quantityDelta: 5,
    reasonCode: 'CYCLE_COUNT',
    notes: null,
  },
  {
    adjustmentNumber: 'ADJ-2026-0003',
    locationId: 'locations/LOC_BBB',
    partNumber: 'BRAKE-PAD-FRONT',
    partDescriptionSnapshot: 'Front Brake Pads',
    type: 'remove',
    quantity: 1,
    quantityDelta: -1,
    reasonCode: 'THEFT',
    notes: null,
  },
  {
    adjustmentNumber: 'ADJ-2026-0004',
    locationId: 'locations/LOC_CCC',
    partNumber: 'OIL-5W30-QT',
    partDescriptionSnapshot: 'Motor Oil 5W-30 1 Quart',
    type: 'add',
    quantity: 10,
    quantityDelta: 10,
    reasonCode: 'FOUND',
    notes: null,
  },
];
