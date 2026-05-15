import {BadRequestException, NotFoundException} from '@nestjs/common';
import {Test, type TestingModule} from '@nestjs/testing';
import {vi} from 'vitest';
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import {PartStatus} from '../part/entities/part.entity';
import type {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import {StockAdjustmentsService} from './stock-adjustments.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makePart(locationId: string, numOnHand: number): Part {
  const loc: PartLocation = {
    location: {id: locationId, name: 'Test Location'},
    numOnHand,
    numCommitted: 0,
    numSpecialOrderCommitted: 0,
    numOnOrder: 0,
    numBackordered: 0,
    numAvailable: numOnHand,
    bins: [{bin: {id: `${locationId}/BIN-A`, binNumber: 'BIN-A'}, numOnHand, isMain: true}],
  };
  return {
    id: 'parts/TEST-PART',
    partNumber: 'TEST-PART',
    description: 'Test Part Description',
    status: PartStatus.Active,
    totalOnHand: numOnHand,
    totalCommitted: 0,
    totalSpecialOrderCommitted: 0,
    totalOnOrder: 0,
    totalBackordered: 0,
    totalAvailable: numOnHand,
    totalNetAvailable: numOnHand,
    vendors: [],
    locations: [loc],
    createdDate: new Date(),
    createdBy: 'system',
    updatedDate: new Date(),
    updatedBy: 'system',
    version: 1,
    isDeleted: false,
  } as Part;
}

function makeSessionFactory(part: Part | null, existingAdjCount = 0) {
  const session = {
    load: vi.fn(async (id: string) => {
      if (id === 'parts/TEST-PART') {
        return part;
      }
      return null;
    }),
    query: vi.fn(() => ({
      all: vi.fn(async () =>
        Array.from({length: existingAdjCount}, (_, i) => ({
          adjustmentNumber: `ADJ-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;

  async function build(part: Part | null, existingAdjCount = 0) {
    const {factory} = makeSessionFactory(part, existingAdjCount);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAdjustmentsService,
        {provide: RavenSessionFactory, useValue: factory},
        {provide: RavenDocumentStoreProvider, useValue: {getStore: vi.fn()}},
      ],
    }).compile();
    service = module.get(StockAdjustmentsService);
    return factory;
  }

  describe('create — add', () => {
    it('increments part.totalOnHand and PartLocation.numOnHand', async () => {
      const part = makePart('locations/LOC_AAA', 10);
      const factory = await build(part);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'add',
        quantity: 5,
        reasonCode: 'CYCLE_COUNT',
      };

      const result = await service.create(dto, 'user-1');
      // Session is retrieved after create() has called openSession
      const session = (factory.openSession as ReturnType<typeof vi.fn>).mock.results[0]?.value;

      expect(result.quantityDelta).toBe(5);
      expect(part.totalOnHand).toBe(15);
      expect(part.locations[0].numOnHand).toBe(15);
      expect(session.saveChanges).toHaveBeenCalled();
    });

    it('generates ADJ-YYYY-NNNN adjustment number', async () => {
      const part = makePart('locations/LOC_AAA', 10);
      await build(part, 3);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'add',
        quantity: 1,
        reasonCode: 'FOUND',
      };

      const result = await service.create(dto, 'user-1');
      const year = new Date().getFullYear();
      expect(result.adjustmentNumber).toBe(`ADJ-${year}-0004`);
    });
  });

  describe('create — remove', () => {
    it('decrements part.totalOnHand and PartLocation.numOnHand', async () => {
      const part = makePart('locations/LOC_AAA', 10);
      await build(part);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'remove',
        quantity: 3,
        reasonCode: 'DAMAGE',
      };

      const result = await service.create(dto, 'user-1');

      expect(result.quantityDelta).toBe(-3);
      expect(part.totalOnHand).toBe(7);
      expect(part.locations[0].numOnHand).toBe(7);
    });

    it('throws 400 when remove would make totalOnHand negative', async () => {
      const part = makePart('locations/LOC_AAA', 2);
      await build(part);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'remove',
        quantity: 5,
        reasonCode: 'THEFT',
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — error cases', () => {
    it('throws 404 when part is not found', async () => {
      await build(null);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'add',
        quantity: 1,
        reasonCode: 'CYCLE_COUNT',
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws 400 when part not stocked at location', async () => {
      const part = makePart('locations/LOC_AAA', 5);
      await build(part);

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_BBB',
        type: 'add',
        quantity: 1,
        reasonCode: 'CYCLE_COUNT',
      };

      await expect(service.create(dto, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
