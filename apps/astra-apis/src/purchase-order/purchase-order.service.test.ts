import {BadRequestException, ConflictException, NotFoundException} from '@nestjs/common';
import {Test, type TestingModule} from '@nestjs/testing';
import {vi} from 'vitest';
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import {PartStatus} from '../part/entities/part.entity';
import type {Vendor} from '../vendor/entities/vendor.entity';
import type {PoCreateDto} from './dto/po-create.dto';
import {PurchaseOrderService} from './purchase-order.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeVendor(): Vendor {
  return {
    id: 'vendors/STAR-OFFICE',
    code: 'STAR-OFFICE',
    name: 'Star Office Supply Co.',
    terms: 'Net 30',
    createdDate: new Date(),
    updatedDate: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    version: 1,
    isDeleted: false,
  };
}

function makePart(locationId: string, onOrder = 0, onHand = 10): Part {
  const loc: PartLocation = {
    location: {id: locationId, name: 'Test'},
    numOnHand: onHand,
    numCommitted: 0,
    numSpecialOrderCommitted: 0,
    numOnOrder: onOrder,
    numBackordered: 0,
    numAvailable: onHand,
    bins: [{bin: {id: `${locationId}/BIN-A`, binNumber: 'BIN-A'}, numOnHand: onHand, isMain: true}],
  };
  return {
    id: 'parts/TEST-PART',
    partNumber: 'TEST-PART',
    description: 'Test Part',
    status: PartStatus.Active,
    totalOnHand: onHand,
    totalCommitted: 0,
    totalSpecialOrderCommitted: 0,
    totalOnOrder: onOrder,
    totalBackordered: 0,
    totalAvailable: onHand,
    totalNetAvailable: onHand,
    vendors: [],
    locations: [loc],
    createdDate: new Date(),
    updatedDate: new Date(),
    createdBy: 'system',
    updatedBy: 'system',
    version: 1,
    isDeleted: false,
  } as Part;
}

function makeSession(vendor: Vendor | null, part: Part | null, existingPoCount = 0) {
  const session = {
    load: vi.fn(async (id: string) => {
      if (id === 'vendors/STAR-OFFICE') {
        return vendor;
      }
      if (id === 'parts/TEST-PART') {
        return part;
      }
      if (id.startsWith('purchase-orders/')) {
        if (part) {
          return {
            id,
            poNumber: id.replace('purchase-orders/', ''),
            locationId: 'locations/LOC_AAA',
            vendorId: 'vendors/STAR-OFFICE',
            vendorSnapshot: {code: 'STAR-OFFICE', name: 'Star Office Supply Co.'},
            status: 'confirmed',
            lines: [
              {
                lineNumber: 1,
                partNumber: 'TEST-PART',
                partDescriptionSnapshot: 'Test Part',
                quantity: 5,
                unitCost: {amount: 850, currency: 'CAD'},
                totalCost: {amount: 4250, currency: 'CAD'},
              },
            ],
            lineCount: 1,
            grandTotal: {amount: 4250, currency: 'CAD'},
            notes: null,
            createdDate: new Date(),
            updatedDate: new Date(),
            createdBy: 'system',
            updatedBy: 'system',
            version: 1,
            isDeleted: false,
          };
        }
        return null;
      }
      return null;
    }),
    query: vi.fn(() => ({
      all: vi.fn(async () =>
        Array.from({length: existingPoCount}, (_, i) => ({
          poNumber: `PO-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        })),
      ),
    })),
    store: vi.fn(async () => {}),
    saveChanges: vi.fn(async () => {}),
    [Symbol.dispose]: vi.fn(),
  };
  return {
    factory: {openSession: vi.fn(() => session)} as unknown as RavenSessionFactory,
    session,
  };
}

async function buildService(vendor: Vendor | null, part: Part | null, existingPoCount = 0) {
  const {factory} = makeSession(vendor, part, existingPoCount);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PurchaseOrderService,
      {provide: RavenSessionFactory, useValue: factory},
      {provide: RavenDocumentStoreProvider, useValue: {getStore: vi.fn()}},
    ],
  }).compile();
  return {
    service: module.get(PurchaseOrderService),
    factory,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('PurchaseOrderService', () => {
  const baseDto: PoCreateDto = {
    vendorId: 'vendors/STAR-OFFICE',
    lines: [{partNumber: 'TEST-PART', quantity: 5, unitCostDollars: 8.5}],
    notes: null,
  };

  describe('create', () => {
    it('creates a PO in draft status with correct totals', async () => {
      const {service} = await buildService(makeVendor(), makePart('locations/LOC_AAA'));

      const result = await service.create(baseDto, 'locations/LOC_AAA', 'user-1');

      expect(result.status).toBe('draft');
      expect(result.lineCount).toBe(1);
      expect(result.grandTotal.amount).toBe(4250);
      expect(result.poNumber).toMatch(/^PO-\d{4}-\d{4}$/);
    });

    it('generates PO-YYYY-NNNN number', async () => {
      const {service} = await buildService(makeVendor(), makePart('locations/LOC_AAA'), 2);

      const result = await service.create(baseDto, 'locations/LOC_AAA', 'user-1');
      const year = new Date().getFullYear();
      expect(result.poNumber).toBe(`PO-${year}-0003`);
    });

    it('throws 400 when vendor not found', async () => {
      const {service} = await buildService(null, makePart('locations/LOC_AAA'));
      await expect(service.create(baseDto, 'locations/LOC_AAA', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 400 when part not found', async () => {
      const {service} = await buildService(makeVendor(), null);
      await expect(service.create(baseDto, 'locations/LOC_AAA', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('confirm', () => {
    it('transitions draft→confirmed and increments part.totalOnOrder', async () => {
      const part = makePart('locations/LOC_AAA', 0, 10);
      const {service, factory} = await buildService(makeVendor(), part);

      const created = await service.create(baseDto, 'locations/LOC_AAA', 'user-1');

      const {session} = makeSession(makeVendor(), part);
      session.load = vi.fn(async (id: string) => {
        if (id === created.id) {
          return {
            ...created,
            status: 'draft',
            lines: [
              {
                lineNumber: 1,
                partNumber: 'TEST-PART',
                partDescriptionSnapshot: 'Test Part',
                quantity: 5,
                unitCost: {amount: 850, currency: 'CAD'},
                totalCost: {amount: 4250, currency: 'CAD'},
              },
            ],
          };
        }
        if (id === 'parts/TEST-PART') {
          return part;
        }
        return null;
      });

      const factory2 = {openSession: vi.fn(() => session)} as unknown as RavenSessionFactory;
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          PurchaseOrderService,
          {provide: RavenSessionFactory, useValue: factory2},
          {provide: RavenDocumentStoreProvider, useValue: {getStore: vi.fn()}},
        ],
      }).compile();
      const service2 = module2.get(PurchaseOrderService);

      await service2.confirm(created.id, 'user-1');
      expect(part.totalOnOrder).toBe(5);
    });

    it('throws 409 when confirming a non-draft PO', async () => {
      const part = makePart('locations/LOC_AAA');
      const {session} = makeSession(makeVendor(), part);
      session.load = vi.fn(async (id: string) => {
        if (id === 'purchase-orders/PO-2026-0001') {
          return {id, status: 'confirmed', lines: []};
        }
        return null;
      });
      const factory = {openSession: vi.fn(() => session)} as unknown as RavenSessionFactory;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PurchaseOrderService,
          {provide: RavenSessionFactory, useValue: factory},
          {provide: RavenDocumentStoreProvider, useValue: {getStore: vi.fn()}},
        ],
      }).compile();
      const service = module.get(PurchaseOrderService);

      await expect(service.confirm('purchase-orders/PO-2026-0001', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('receive', () => {
    it('throws 409 when receiving a non-confirmed PO', async () => {
      const {session} = makeSession(makeVendor(), makePart('locations/LOC_AAA'));
      session.load = vi.fn(async (id: string) => {
        if (id.startsWith('purchase-orders/')) {
          return {id, status: 'draft', lines: []};
        }
        return null;
      });
      const factory = {openSession: vi.fn(() => session)} as unknown as RavenSessionFactory;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PurchaseOrderService,
          {provide: RavenSessionFactory, useValue: factory},
          {provide: RavenDocumentStoreProvider, useValue: {getStore: vi.fn()}},
        ],
      }).compile();
      const service = module.get(PurchaseOrderService);

      await expect(service.receive('purchase-orders/PO-2026-0001', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
