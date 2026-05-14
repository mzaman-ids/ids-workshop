import type {IdsBaseEntity} from '../common/index.js';

/**
 * Database Vendor Interface
 * Shared type definition for database-backed Vendor entity
 */
export interface DbVendor extends IdsBaseEntity {
  code: string;
  name: string;
  terms?: string | null;
}

/**
 * Database vendor list item for table displays
 */
export interface DbVendorListItem {
  id: string;
  code: string;
  name: string;
  terms?: string | null;
}

/**
 * Database vendor list response with pagination
 */
export interface DbVendorListResponse {
  data: DbVendorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Database vendor search criteria
 */
export interface DbVendorSearchCriteria {
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}
