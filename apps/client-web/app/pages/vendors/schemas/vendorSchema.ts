import * as v from 'valibot';

export const vendorCreateSchema = v.object({
  code: v.pipe(
    v.string(),
    v.minLength(1, 'Code is required'),
    v.maxLength(50, 'Code must be 50 characters or less'),
  ),
  name: v.pipe(
    v.string(),
    v.minLength(1, 'Name is required'),
    v.maxLength(200, 'Name must be 200 characters or less'),
  ),
  terms: v.optional(v.string()),
});

export const vendorUpdateSchema = v.object({
  code: v.string(),
  name: v.pipe(
    v.string(),
    v.minLength(1, 'Name is required'),
    v.maxLength(200, 'Name must be 200 characters or less'),
  ),
  terms: v.optional(v.string()),
});

export type VendorFormValues = v.InferOutput<typeof vendorCreateSchema>;
