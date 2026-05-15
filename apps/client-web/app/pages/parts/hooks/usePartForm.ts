import type {PartBinRow, PartFormValues, PartVendorRow} from '../schemas/partSchema';
import type {PartCreateInput, PartDetail, PartUpdateInput, PartVendorInput} from '../types/part';

// ── Private helpers ──────────────────────────────────────────────────────────

function parseOptionalFloat(s: string): number | undefined {
  if (s === '') {
    return undefined;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? undefined : n;
}

// ── buildDefaultValues ───────────────────────────────────────────────────────

export function buildDefaultValues(part?: PartDetail): PartFormValues {
  if (!part) {
    return {
      partNumber: '',
      description: '',
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
      vendors: [],
      bins: [],
    };
  }

  const vendors: PartVendorRow[] = part.vendors.map((v) => ({
    vendorNumber: v.vendorNumber,
    vendorName: v.vendorName,
    vendorPartNumber: v.vendorPartNumber ?? '',
    cost: v.cost ? String(v.cost.amount / 100) : '',
    isPrimary: v.isPrimary,
  }));

  const bins: PartBinRow[] = part.bins.map((b) => ({
    binCode: b.binNumber,
    description: b.description,
    isMain: b.isMain,
  }));

  return {
    partNumber: part.partNumber,
    description: part.description,
    status: part.status,
    comments: part.comments ?? '',
    listPrice: part.listPrice ? String(part.listPrice.amount / 100) : '',
    priceGroup: part.priceGroup ?? '',
    glGroup: part.glGroup ?? '',
    taxCode: part.taxCode ?? '',
    bypassPriceUpdate: part.bypassPriceUpdate,
    promptForSerialNumber: part.promptForSerialNumber,
    sellUom: part.sellUom ?? 'EA',
    purchaseUom: part.purchaseUom ?? 'EA',
    salePurchaseRatio: part.salePurchaseRatio != null ? String(part.salePurchaseRatio) : '1',
    shippingWeight: part.shippingWeight != null ? String(part.shippingWeight) : '',
    shippingUnit: part.shippingUnit ?? '',
    caseQty: part.caseQty != null ? String(part.caseQty) : '',
    minQty: part.minQty != null ? String(part.minQty) : '',
    maxQty: part.maxQty != null ? String(part.maxQty) : '',
    minDays: part.minDays != null ? String(part.minDays) : '',
    minOrder: part.minOrder != null ? String(part.minOrder) : '',
    vendors,
    bins,
  };
}

// ── Shared vendor/bin mappers ────────────────────────────────────────────────

function mapVendors(vendors: PartVendorRow[]): PartVendorInput[] {
  return vendors.map((v) => ({
    vendorNumber: v.vendorNumber,
    vendorPartNumber: v.vendorPartNumber || undefined,
    cost: parseOptionalFloat(v.cost),
    isPrimary: v.isPrimary,
  }));
}

function mapBins(bins: PartBinRow[]): {binCode: string; isMain: boolean}[] {
  return bins.map((b) => ({binCode: b.binCode, isMain: b.isMain}));
}

// ── buildCreateInput ─────────────────────────────────────────────────────────

export function buildCreateInput(values: PartFormValues, locationId: string): PartCreateInput {
  return {
    partNumber: values.partNumber,
    description: values.description,
    locationId,
    status: values.status || undefined,
    comments: values.comments || undefined,
    listPrice: parseOptionalFloat(values.listPrice),
    priceGroup: values.priceGroup || undefined,
    glGroup: values.glGroup || undefined,
    taxCode: values.taxCode || undefined,
    bypassPriceUpdate: values.bypassPriceUpdate,
    serialized: values.promptForSerialNumber,
    sellUom: values.sellUom || undefined,
    purchaseUom: values.purchaseUom || undefined,
    salePurchaseRatio: parseOptionalFloat(values.salePurchaseRatio),
    shippingWeight: parseOptionalFloat(values.shippingWeight),
    shippingUnit: values.shippingUnit || undefined,
    caseQty: parseOptionalFloat(values.caseQty),
    minQty: parseOptionalFloat(values.minQty),
    maxQty: parseOptionalFloat(values.maxQty),
    minDays: parseOptionalFloat(values.minDays),
    minOrder: parseOptionalFloat(values.minOrder),
    vendors: mapVendors(values.vendors),
    bins: mapBins(values.bins),
  };
}

// ── buildUpdateInput ─────────────────────────────────────────────────────────

export function buildUpdateInput(values: PartFormValues, locationId: string): PartUpdateInput {
  return {
    locationId,
    description: values.description,
    status: values.status || undefined,
    comments: values.comments || undefined,
    listPrice: parseOptionalFloat(values.listPrice),
    priceGroup: values.priceGroup || undefined,
    glGroup: values.glGroup || undefined,
    taxCode: values.taxCode || undefined,
    bypassPriceUpdate: values.bypassPriceUpdate,
    serialized: values.promptForSerialNumber,
    sellUom: values.sellUom || undefined,
    purchaseUom: values.purchaseUom || undefined,
    salePurchaseRatio: parseOptionalFloat(values.salePurchaseRatio),
    shippingWeight: parseOptionalFloat(values.shippingWeight),
    shippingUnit: values.shippingUnit || undefined,
    caseQty: parseOptionalFloat(values.caseQty),
    minQty: parseOptionalFloat(values.minQty),
    maxQty: parseOptionalFloat(values.maxQty),
    minDays: parseOptionalFloat(values.minDays),
    minOrder: parseOptionalFloat(values.minOrder),
    vendors: mapVendors(values.vendors),
    bins: mapBins(values.bins),
  };
}
