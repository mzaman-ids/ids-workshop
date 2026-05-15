import * as v from 'valibot';

// ── Vendor row ──────────────────────────────────────────────────────────────

const vendorRowSchema = v.object({
  vendorNumber: v.string(),
  vendorName: v.string(),
  vendorPartNumber: v.string(),
  cost: v.string(),
  isPrimary: v.boolean(),
});

export type PartVendorRow = v.InferOutput<typeof vendorRowSchema>;

// ── Bin row ─────────────────────────────────────────────────────────────────

const binRowSchema = v.object({
  binCode: v.string(),
  description: v.nullable(v.string()),
  isMain: v.boolean(),
});

export type PartBinRow = v.InferOutput<typeof binRowSchema>;

// ── Numeric string helpers ───────────────────────────────────────────────────

const optionalNumericString = v.union([
  v.literal(''),
  v.pipe(
    v.string(),
    v.check((s) => {
      const n = parseFloat(s);
      return !Number.isNaN(n) && n >= 0;
    }, 'Must be >= 0'),
  ),
]);

// ── Shared fields (used by both create and update) ───────────────────────────

const sharedFields = {
  description: v.pipe(v.string(), v.minLength(1, 'Description is required')),
  status: v.string(),
  comments: v.string(),
  listPrice: optionalNumericString,
  priceGroup: v.string(),
  glGroup: v.string(),
  taxCode: v.string(),
  bypassPriceUpdate: v.boolean(),
  promptForSerialNumber: v.boolean(),
  sellUom: v.string(),
  purchaseUom: v.string(),
  salePurchaseRatio: optionalNumericString,
  shippingWeight: optionalNumericString,
  shippingUnit: v.string(),
  caseQty: optionalNumericString,
  minQty: optionalNumericString,
  maxQty: optionalNumericString,
  minDays: optionalNumericString,
  minOrder: optionalNumericString,
  vendors: v.pipe(v.array(vendorRowSchema), v.minLength(1, 'At least one vendor is required')),
  bins: v.array(binRowSchema),
};

// ── Cross-field checks (shared) ──────────────────────────────────────────────

function applySharedChecks<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
  schema: T,
) {
  return v.pipe(
    schema,
    v.check((data) => {
      const d = data as {vendors: PartVendorRow[]};
      return d.vendors.length === 0 || d.vendors.some((v) => v.isPrimary);
    }, 'At least one vendor must be marked as primary'),
    v.check((data) => {
      const d = data as {minQty: string; maxQty: string};
      if (d.minQty !== '' && d.maxQty !== '') {
        return parseFloat(d.maxQty) >= parseFloat(d.minQty);
      }
      return true;
    }, 'Max quantity must be >= min quantity'),
    v.check((data) => {
      const d = data as {shippingWeight: string; shippingUnit: string};
      if (d.shippingWeight !== '' && parseFloat(d.shippingWeight) > 0) {
        return d.shippingUnit !== '';
      }
      return true;
    }, 'Shipping unit is required when shipping weight is set'),
  );
}

// ── partCreateSchema ─────────────────────────────────────────────────────────

export const partCreateSchema = applySharedChecks(
  v.object({
    partNumber: v.pipe(
      v.string(),
      v.minLength(1, 'Part number is required'),
      v.maxLength(50, 'Part number must be 50 characters or fewer'),
      v.regex(
        /^[a-zA-Z0-9\-._]+$/,
        'Part number may only contain letters, digits, hyphens, dots and underscores',
      ),
    ),
    ...sharedFields,
  }),
);

export type PartCreateFormValues = v.InferOutput<typeof partCreateSchema>;

// ── partUpdateSchema ─────────────────────────────────────────────────────────

export const partUpdateSchema = applySharedChecks(
  v.object({
    ...sharedFields,
  }),
);

export type PartUpdateFormValues = v.InferOutput<typeof partUpdateSchema>;

// ── PartFormValues (alias for PartCreateFormValues) ──────────────────────────

export type PartFormValues = PartCreateFormValues;
