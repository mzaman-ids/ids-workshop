export type DbVendor = {
  id: string;
  code: string;
  name: string;
  terms: string | null;
};

export type CreateVendorInput = {
  code: string;
  name: string;
  terms?: string | null;
};

export type UpdateVendorInput = {
  name?: string;
  terms?: string | null;
};

export type VendorListResponse = {
  items: DbVendor[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type VendorSearchCriteria = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  signal?: AbortSignal;
  token: string;
};
