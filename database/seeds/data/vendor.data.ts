export type VendorSeedData = {
  id?: string;
  code: string;
  name: string;
  terms?: string;
  isDeleted?: boolean;
  createdBy?: string;
  updatedBy?: string;
};

export const vendorSeedData: VendorSeedData[] = [
  {
    id: '4e0d0001-0000-4000-8000-000000000001',
    code: 'STAR-OFFICE',
    name: 'Star Office Supply Co.',
    terms: 'Net 30',
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    id: '4e0d0001-0000-4000-8000-000000000002',
    code: 'CLINCHTECH',
    name: 'ClinchTech Systems Inc.',
    terms: 'Net 45',
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    id: '4e0d0001-0000-4000-8000-000000000003',
    code: 'GREENLIGHT',
    name: 'GreenLight Energy Solutions',
    terms: 'Due on Receipt',
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    id: '4e0d0001-0000-4000-8000-000000000004',
    code: 'RELIABLE-FL',
    name: 'Reliable Freight & Logistics',
    terms: 'Net 15',
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  },
  {
    id: '4e0d0001-0000-4000-8000-000000000005',
    code: 'PRO-SERVICES',
    name: 'Professional Services Group LLC',
    terms: 'Net 30',
    isDeleted: false,
    createdBy: 'system',
    updatedBy: 'system',
  },
];
