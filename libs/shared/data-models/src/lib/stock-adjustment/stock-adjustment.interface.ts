export type AdjustmentType = 'add' | 'remove';

export type AdjustmentReasonCode =
  | 'CYCLE_COUNT'
  | 'DAMAGE'
  | 'THEFT'
  | 'FOUND'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'OTHER';

export type DbStockAdjustment = {
  id: string;
  adjustmentNumber: string;
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: AdjustmentType;
  quantity: number;
  quantityDelta: number;
  reasonCode: AdjustmentReasonCode;
  notes?: string | null;
  createdDate: string;
  createdBy?: string;
  updatedDate: string;
  isDeleted: boolean;
};

export type DbStockAdjustmentListItem = {
  id: string;
  adjustmentNumber: string;
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: AdjustmentType;
  quantity: number;
  quantityDelta: number;
  reasonCode: AdjustmentReasonCode;
  notes?: string | null;
  createdDate: string;
  createdBy?: string;
};

export type DbStockAdjustmentListResponse = {
  data: DbStockAdjustmentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type DbStockAdjustmentSearchCriteria = {
  locationId: string;
  partNumber?: string;
  searchTerm?: string;
  type?: AdjustmentType;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
  token: string;
};

export type CreateStockAdjustmentInput = {
  locationId: string;
  partNumber: string;
  type: AdjustmentType;
  quantity: number;
  reasonCode: AdjustmentReasonCode;
  notes?: string | null;
};
