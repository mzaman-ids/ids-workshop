import type {Money} from '../money/money.js';

export type PoStatus = 'draft' | 'confirmed' | 'received' | 'cancelled';

export type DbPoLine = {
  lineNumber: number;
  partNumber: string;
  partDescriptionSnapshot: string;
  quantity: number;
  unitCost: Money;
  totalCost: Money;
};

export type DbPurchaseOrder = {
  id: string;
  poNumber: string;
  locationId: string;
  vendorId: string;
  vendorSnapshot: {code: string; name: string};
  status: PoStatus;
  lines: DbPoLine[];
  lineCount: number;
  grandTotal: Money;
  notes?: string | null;
  createdDate: string;
  createdBy?: string;
  updatedDate: string;
  isDeleted: boolean;
};

export type DbPurchaseOrderListItem = {
  id: string;
  poNumber: string;
  locationId: string;
  vendorCode: string;
  vendorName: string;
  status: PoStatus;
  lineCount: number;
  grandTotal: Money;
  createdDate: string;
};

export type DbPurchaseOrderListResponse = {
  data: DbPurchaseOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type DbPurchaseOrderDetail = DbPurchaseOrder;

export type DbPurchaseOrderSearchCriteria = {
  locationId: string;
  searchTerm?: string;
  status?: PoStatus;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
  token: string;
};

export type CreatePurchaseOrderInput = {
  vendorId: string;
  lines: {partNumber: string; quantity: number; unitCostDollars: number}[];
  notes?: string | null;
};
