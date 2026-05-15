import * as v from 'valibot';

export const stockAdjustmentSchema = v.pipe(
  v.object({
    partNumber: v.pipe(v.string(), v.minLength(1, 'Part number is required')),
    type: v.picklist(['add', 'remove'] as const, 'Select Add or Remove'),
    quantity: v.pipe(
      v.number('Quantity must be a number'),
      v.minValue(1, 'Quantity must be at least 1'),
      v.integer('Quantity must be a whole number'),
    ),
    reasonCode: v.picklist(
      ['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'] as const,
      'Select a reason',
    ),
    notes: v.optional(v.nullable(v.string())),
  }),
  v.check(
    (input) =>
      input.reasonCode !== 'OTHER' ||
      (typeof input.notes === 'string' && input.notes.trim().length > 0),
    'Notes are required when reason is Other',
  ),
);

export type StockAdjustmentFormValues = v.InferOutput<typeof stockAdjustmentSchema>;
