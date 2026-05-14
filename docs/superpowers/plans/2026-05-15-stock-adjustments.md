# Stock Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full end-to-end Stock Adjustments feature — parts managers can add or remove inventory at a specific location with an audited reason code, and `Part.totalOnHand` updates atomically.

**Architecture:** New `StockAdjustmentsModule` in NestJS (2 endpoints: list + create). Create writes a `StockAdjustment` document and mutates the `Part` document in the same RavenDB session (atomic). Frontend has a list page (`/stock-adjustments`) and a create page (`/stock-adjustments/create`) following the exact same patterns as the Vendor/Location modules.

**Tech Stack:** NestJS, RavenDB (ravendb npm client), React Router v7, TanStack Query v5, MUI v5, Valibot, React Hook Form, TypeScript. Shared types via `@ids/data-models`.

---

## File Map

### New files to create

```
libs/shared/data-models/src/lib/stock-adjustment/
  stock-adjustment.interface.ts      — shared types (DbStockAdjustment, DTOs, enums)
  index.ts                           — barrel re-export

apps/astra-apis/src/stock-adjustments/
  stock-adjustments.module.ts
  stock-adjustments.controller.ts
  stock-adjustments.service.ts
  stock-adjustments.service.spec.ts  — unit tests (first test file in the project)
  entities/
    stock-adjustment.entity.ts
  dto/
    adjustment-create.dto.ts
    adjustment-list.query.dto.ts
  indexes/
    stock-adjustments-by-location.index.ts

apps/client-web/app/pages/stock-adjustments/
  StockAdjustmentList.tsx
  StockAdjustmentCreate.tsx
  columns.tsx
  hooks/
    useStockAdjustments.ts
  queries/
    stockAdjustmentQueries.ts
    stockAdjustmentQueryKey.ts
  schemas/
    stockAdjustmentSchema.ts
  types/
    stockAdjustment.ts

database/seeds/data/stock-adjustment.data.ts
```

### Files to modify

```
libs/shared/data-models/src/index.ts                          — add barrel export
apps/astra-apis/src/app.module.ts                             — register StockAdjustmentsModule
apps/client-web/app/routes.tsx                                — add 2 routes
apps/client-web/app/components/Layout.tsx                     — wire sidebar nav item
apps/client-web/app/core/config/featureRegistry.ts            — add feature entry
database/seed-runner.ts                                        — import + run seed
```

---

## Task 1: Shared data models

**Files:**
- Create: `libs/shared/data-models/src/lib/stock-adjustment/stock-adjustment.interface.ts`
- Create: `libs/shared/data-models/src/lib/stock-adjustment/index.ts`
- Modify: `libs/shared/data-models/src/index.ts`

- [ ] **Step 1: Create the stock-adjustment interface file**

```typescript
// libs/shared/data-models/src/lib/stock-adjustment/stock-adjustment.interface.ts

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
```

- [ ] **Step 2: Create the barrel file**

```typescript
// libs/shared/data-models/src/lib/stock-adjustment/index.ts
export * from './stock-adjustment.interface.js';
```

- [ ] **Step 3: Add to the root barrel export**

Open `libs/shared/data-models/src/index.ts`. It currently ends with `export * from './lib/vendor/index.js';`. Add one line after it:

```typescript
export * from './lib/stock-adjustment/index.js';
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/data-models/src/lib/stock-adjustment/ libs/shared/data-models/src/index.ts
git commit -m "feat: add DbStockAdjustment shared types to data-models"
```

---

## Task 2: Backend entity + DTOs

**Files:**
- Create: `apps/astra-apis/src/stock-adjustments/entities/stock-adjustment.entity.ts`
- Create: `apps/astra-apis/src/stock-adjustments/dto/adjustment-create.dto.ts`
- Create: `apps/astra-apis/src/stock-adjustments/dto/adjustment-list.query.dto.ts`

- [ ] **Step 1: Create the entity**

```typescript
// apps/astra-apis/src/stock-adjustments/entities/stock-adjustment.entity.ts
import type {AdjustmentReasonCode, AdjustmentType} from '@ids/data-models';
import {IdsBaseEntity} from '../../common/entities/ids-base.entity';

export class StockAdjustment extends IdsBaseEntity {
  public adjustmentNumber!: string;
  public locationId!: string;
  public partNumber!: string;
  public partDescriptionSnapshot!: string;
  public type!: AdjustmentType;
  public quantity!: number;
  public quantityDelta!: number;
  public reasonCode!: AdjustmentReasonCode;
  public notes?: string | null;
}
```

- [ ] **Step 2: Create the create DTO**

```typescript
// apps/astra-apis/src/stock-adjustments/dto/adjustment-create.dto.ts
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class AdjustmentCreateDto {
  @ApiProperty({description: 'Part number to adjust'})
  @IsNotEmpty()
  @IsString()
  partNumber!: string;

  @ApiProperty({description: 'Location document ID (e.g. locations/LOC_AAA)'})
  @IsNotEmpty()
  @IsString()
  locationId!: string;

  @ApiProperty({enum: ['add', 'remove'], description: 'Add or remove inventory'})
  @IsIn(['add', 'remove'])
  type!: 'add' | 'remove';

  @ApiProperty({description: 'Positive quantity to adjust', minimum: 1})
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    enum: ['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'],
  })
  @IsEnum(['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'])
  reasonCode!: string;

  @ApiPropertyOptional({
    description: 'Notes — required when reasonCode is OTHER',
    maxLength: 500,
    nullable: true,
  })
  @ValidateIf((o) => o.reasonCode === 'OTHER')
  @IsNotEmpty({message: 'notes is required when reasonCode is OTHER'})
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
```

- [ ] **Step 3: Create the list query DTO**

```typescript
// apps/astra-apis/src/stock-adjustments/dto/adjustment-list.query.dto.ts
import {PaginationQueryDto} from '@ids/data-models';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsIn, IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class AdjustmentListQueryDto extends PaginationQueryDto {
  @ApiProperty({description: 'Location ID to filter by (required)'})
  @IsNotEmpty()
  @IsString()
  locationId!: string;

  @ApiPropertyOptional({description: 'Filter by specific part number'})
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({description: 'Free text search on part number or description'})
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({enum: ['add', 'remove']})
  @IsOptional()
  @IsIn(['add', 'remove'])
  type?: 'add' | 'remove';
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck:apis
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/astra-apis/src/stock-adjustments/
git commit -m "feat: add StockAdjustment entity and DTOs"
```

---

## Task 3: Backend service + unit tests

**Files:**
- Create: `apps/astra-apis/src/stock-adjustments/stock-adjustments.service.ts`
- Create: `apps/astra-apis/src/stock-adjustments/stock-adjustments.service.spec.ts`

This is the heart of the feature. The service:
1. Generates the adjustment number
2. Loads the Part
3. Guards against negative inventory
4. Applies the delta to `PartLocation.numOnHand` and the main bin
5. Recomputes rollup totals on the Part
6. Stores both documents in the same session

The test file creates the first unit tests for the project. The tests use Jest mocks for the RavenDB session to avoid needing a live database.

- [ ] **Step 1: Write the failing tests first**

```typescript
// apps/astra-apis/src/stock-adjustments/stock-adjustments.service.spec.ts
import {BadRequestException, NotFoundException} from '@nestjs/common';
import {Test, type TestingModule} from '@nestjs/testing';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import {PartStatus} from '../part/entities/part.entity';
import type {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import {StockAdjustmentsService} from './stock-adjustments.service';

// ── helpers ──────────────────────────────────────────────────────────────────

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
  const stored: unknown[] = [];
  const session = {
    load: jest.fn(async (id: string) => {
      if (id === 'parts/TEST-PART') return part;
      return null;
    }),
    query: jest.fn(() => ({
      all: jest.fn(async () =>
        Array.from({length: existingAdjCount}, (_, i) => ({
          adjustmentNumber: `ADJ-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        })),
      ),
    })),
    store: jest.fn(async (entity: unknown) => { stored.push(entity); }),
    saveChanges: jest.fn(async () => {}),
    [Symbol.dispose]: jest.fn(),
  };
  return {
    factory: {openSession: jest.fn(() => session)} as unknown as RavenSessionFactory,
    session,
    stored,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;

  async function build(part: Part | null, existingAdjCount = 0) {
    const {factory} = makeSessionFactory(part, existingAdjCount);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockAdjustmentsService,
        {provide: RavenSessionFactory, useValue: factory},
      ],
    }).compile();
    service = module.get(StockAdjustmentsService);
    return factory;
  }

  describe('create — add', () => {
    it('increments part.totalOnHand and PartLocation.numOnHand', async () => {
      const part = makePart('locations/LOC_AAA', 10);
      const factory = await build(part);
      const session = (factory.openSession as jest.Mock).mock.results[0]?.value;

      const dto: AdjustmentCreateDto = {
        partNumber: 'TEST-PART',
        locationId: 'locations/LOC_AAA',
        type: 'add',
        quantity: 5,
        reasonCode: 'CYCLE_COUNT',
      };

      const result = await service.create(dto, 'user-1');

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

    it('throws 400 when part is not stocked at the given location', async () => {
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
```

- [ ] **Step 2: Run the tests — expect them to FAIL (service doesn't exist yet)**

```bash
npm run test:apis -- --testPathPattern=stock-adjustments
```

Expected: FAIL — `Cannot find module './stock-adjustments.service'`

- [ ] **Step 3: Write the service implementation**

```typescript
// apps/astra-apis/src/stock-adjustments/stock-adjustments.service.ts
import {DEFAULT_PAGE_SIZE, type PagedResponseDto, toPagedDto} from '@ids/data-models';
import type {AdjustmentReasonCode, AdjustmentType, DbStockAdjustmentListItem} from '@ids/data-models';
import {BadRequestException, Injectable, NotFoundException} from '@nestjs/common';
import {createIdsBaseEntity} from '../common/entities/ids-base.entity';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {Part, PartLocation} from '../part/entities/part.entity';
import type {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import type {AdjustmentListQueryDto} from './dto/adjustment-list.query.dto';
import {StockAdjustment} from './entities/stock-adjustment.entity';

@Injectable()
export class StockAdjustmentsService {
  public constructor(private readonly _sessionFactory: RavenSessionFactory) {}

  public async create(dto: AdjustmentCreateDto, userId: string): Promise<DbStockAdjustmentListItem> {
    using session = this._sessionFactory.openSession();

    // ── Load Part ──────────────────────────────────────────────────────────
    const part: Part | null = await session.load<Part>(`parts/${dto.partNumber}`);
    if (!part) {
      throw new NotFoundException(`Part "${dto.partNumber}" not found`);
    }

    // ── Find PartLocation ──────────────────────────────────────────────────
    const partLocation: PartLocation | undefined = part.locations.find(
      (l) => l.location.id === dto.locationId,
    );
    if (!partLocation) {
      throw new BadRequestException(
        `Part "${dto.partNumber}" is not stocked at location "${dto.locationId}"`,
      );
    }

    // ── Compute delta ──────────────────────────────────────────────────────
    const delta: number = dto.type === 'add' ? dto.quantity : -dto.quantity;

    // ── Guard negative inventory ───────────────────────────────────────────
    if (delta < 0 && part.totalOnHand + delta < 0) {
      throw new BadRequestException(
        `Cannot remove ${dto.quantity} units — only ${part.totalOnHand} on hand globally`,
      );
    }
    if (delta < 0 && partLocation.numOnHand + delta < 0) {
      throw new BadRequestException(
        `Cannot remove ${dto.quantity} units — only ${partLocation.numOnHand} on hand at this location`,
      );
    }

    // ── Mutate Part ────────────────────────────────────────────────────────
    partLocation.numOnHand += delta;
    partLocation.numAvailable =
      partLocation.numOnHand + partLocation.numOnOrder - partLocation.numCommitted;

    // Update main bin
    const mainBin = partLocation.bins.find((b) => b.isMain) ?? partLocation.bins[0];
    if (mainBin) {
      mainBin.numOnHand += delta;
    }

    // Recompute global rollup totals
    part.totalOnHand = part.locations.reduce((sum, l) => sum + l.numOnHand, 0);
    part.totalAvailable = part.totalOnHand + part.totalOnOrder - part.totalCommitted;
    part.totalNetAvailable = part.totalAvailable - part.totalSpecialOrderCommitted;

    await session.store(part, part.id);

    // ── Generate adjustment number ─────────────────────────────────────────
    const year: number = new Date().getFullYear();
    const existing: StockAdjustment[] = await session
      .query<StockAdjustment>({collection: 'stock-adjustments'})
      .all();
    const thisYearCount: number = existing.filter((a) =>
      a.adjustmentNumber.startsWith(`ADJ-${year}-`),
    ).length;
    const adjustmentNumber = `ADJ-${year}-${String(thisYearCount + 1).padStart(4, '0')}`;

    // ── Create adjustment document ─────────────────────────────────────────
    const entity: StockAdjustment = {
      ...createIdsBaseEntity(userId),
      id: `stock-adjustments/${adjustmentNumber}`,
      adjustmentNumber,
      locationId: dto.locationId,
      partNumber: dto.partNumber,
      partDescriptionSnapshot: part.description,
      type: dto.type as AdjustmentType,
      quantity: dto.quantity,
      quantityDelta: delta,
      reasonCode: dto.reasonCode as AdjustmentReasonCode,
      notes: dto.notes ?? null,
    };

    await session.store(entity, entity.id);
    await session.saveChanges();

    return this._toListItem(entity);
  }

  public async findAll(
    query: AdjustmentListQueryDto,
  ): Promise<PagedResponseDto<DbStockAdjustmentListItem>> {
    const {locationId, partNumber, searchTerm, type, page = 1, pageSize = DEFAULT_PAGE_SIZE} = query;

    using session = this._sessionFactory.openSession();
    const all: StockAdjustment[] = await session
      .query<StockAdjustment>({collection: 'stock-adjustments'})
      .all();

    const filtered = all.filter((adj) => {
      if (adj.locationId !== locationId) return false;
      if (partNumber && adj.partNumber !== partNumber) return false;
      if (type && adj.type !== type) return false;
      if (searchTerm) {
        const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const hay = `${adj.partNumber} ${adj.partDescriptionSnapshot}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    filtered.sort(
      (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
    );

    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return toPagedDto(items.map((a) => this._toListItem(a)), page, pageSize, filtered.length);
  }

  private _toListItem(adj: StockAdjustment): DbStockAdjustmentListItem {
    return {
      id: adj.id,
      adjustmentNumber: adj.adjustmentNumber,
      locationId: adj.locationId,
      partNumber: adj.partNumber,
      partDescriptionSnapshot: adj.partDescriptionSnapshot,
      type: adj.type,
      quantity: adj.quantity,
      quantityDelta: adj.quantityDelta,
      reasonCode: adj.reasonCode,
      notes: adj.notes,
      createdDate: adj.createdDate instanceof Date
        ? adj.createdDate.toISOString()
        : String(adj.createdDate),
      createdBy: adj.createdBy,
    };
  }
}
```

- [ ] **Step 4: Run the tests — expect them to PASS**

```bash
npm run test:apis -- --testPathPattern=stock-adjustments
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/astra-apis/src/stock-adjustments/stock-adjustments.service.ts apps/astra-apis/src/stock-adjustments/stock-adjustments.service.spec.ts
git commit -m "feat: add StockAdjustmentsService with inventory write-back and unit tests"
```

---

## Task 4: Backend controller + module + AppModule registration

**Files:**
- Create: `apps/astra-apis/src/stock-adjustments/stock-adjustments.controller.ts`
- Create: `apps/astra-apis/src/stock-adjustments/stock-adjustments.module.ts`
- Modify: `apps/astra-apis/src/app.module.ts`

- [ ] **Step 1: Create the controller**

```typescript
// apps/astra-apis/src/stock-adjustments/stock-adjustments.controller.ts
import type {PagedResponseDto} from '@ids/data-models';
import type {DbStockAdjustmentListItem} from '@ids/data-models';
import {Body, Controller, Get, HttpCode, HttpStatus, Post, Query} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {Auth} from '../auth/auth.decorator';
import type {AuthInfo} from '../auth/auth-utils';
import type {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import {AdjustmentListQueryDto} from './dto/adjustment-list.query.dto';
import {StockAdjustmentsService} from './stock-adjustments.service';

@ApiTags('stock-adjustments')
@ApiBearerAuth()
@Controller('stock-adjustments')
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  @ApiOperation({summary: 'List stock adjustments', description: 'Paginated, scoped to locationId'})
  @ApiResponse({status: 200, description: 'Paginated list of adjustments'})
  async findAll(
    @Query() query: AdjustmentListQueryDto,
  ): Promise<PagedResponseDto<DbStockAdjustmentListItem>> {
    return this.stockAdjustmentsService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({summary: 'Create stock adjustment', description: 'Applies inventory delta immediately'})
  @ApiResponse({status: 201, description: 'Adjustment created'})
  @ApiResponse({status: 400, description: 'Insufficient stock or part not stocked at location'})
  @ApiResponse({status: 404, description: 'Part not found'})
  async create(
    @Body() dto: AdjustmentCreateDto,
    @Auth() auth: AuthInfo,
  ): Promise<DbStockAdjustmentListItem> {
    return this.stockAdjustmentsService.create(dto, auth.sub);
  }
}
```

- [ ] **Step 2: Create the module**

```typescript
// apps/astra-apis/src/stock-adjustments/stock-adjustments.module.ts
import {Module} from '@nestjs/common';
import {RavenDbModule} from '../infrastructure/ravendb/ravendb.module';
import {StockAdjustmentsController} from './stock-adjustments.controller';
import {StockAdjustmentsService} from './stock-adjustments.service';

@Module({
  imports: [RavenDbModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
  exports: [StockAdjustmentsService],
})
export class StockAdjustmentsModule {}
```

- [ ] **Step 3: Register in AppModule**

Open `apps/astra-apis/src/app.module.ts`. Add the import and register it. The file currently imports `VendorModule` last — add `StockAdjustmentsModule` after it:

```typescript
// Add at top with other imports:
import {StockAdjustmentsModule} from './stock-adjustments/stock-adjustments.module';

// Add inside @Module imports array after VendorModule:
StockAdjustmentsModule,
```

The resulting `imports` array:
```typescript
imports: [
  ConfigModule.forRoot({isGlobal: true, envFilePath: ['.env.local', '.env']}),
  RavenDbModule,
  AuthModule,
  GlobalModule,
  SystemHealthModule,
  UserModule,
  LocationModule,
  PartModule,
  VendorModule,
  StockAdjustmentsModule,
],
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck:apis
```

Expected: no errors.

- [ ] **Step 5: Smoke-test the API is running**

Start the API:
```bash
npm run dev:apis
```

Then in a second terminal:
```bash
curl -s http://localhost:3000/api/stock-adjustments?locationId=locations/LOC_AAA
```

Expected: a valid 401 response (no token) — confirms the route is wired. Use a token from the running app to verify 200.

- [ ] **Step 6: Commit**

```bash
git add apps/astra-apis/src/stock-adjustments/stock-adjustments.controller.ts apps/astra-apis/src/stock-adjustments/stock-adjustments.module.ts apps/astra-apis/src/app.module.ts
git commit -m "feat: add StockAdjustmentsController, module, register in AppModule"
```

---

## Task 5: RavenDB index

The index is optional for this feature (the service currently queries the full collection and filters in-memory, same pattern as Vendor). However, registering it now means the index is there when the collection grows. The index follows the `Parts_Search` JavaScript index pattern.

**Files:**
- Create: `apps/astra-apis/src/stock-adjustments/indexes/stock-adjustments-by-location.index.ts`
- Modify: `apps/astra-apis/src/stock-adjustments/stock-adjustments.service.ts` — add `onModuleInit`

- [ ] **Step 1: Create the index**

```typescript
// apps/astra-apis/src/stock-adjustments/indexes/stock-adjustments-by-location.index.ts
import {AbstractJavaScriptIndexCreationTask} from 'ravendb';
import type {StockAdjustment} from '../entities/stock-adjustment.entity';

type StockAdjustmentsEntry = {
  locationId: string;
  partNumber: string;
  type: string;
  reasonCode: string;
  partDescriptionSnapshot: string;
};

export class StockAdjustments_ByLocation extends AbstractJavaScriptIndexCreationTask<
  StockAdjustment,
  StockAdjustmentsEntry
> {
  public constructor() {
    super();
    this.map('stock-adjustments', (adj) => ({
      locationId: adj.locationId,
      partNumber: adj.partNumber,
      type: adj.type,
      reasonCode: adj.reasonCode,
      partDescriptionSnapshot: adj.partDescriptionSnapshot,
    }));
  }
}
```

- [ ] **Step 2: Add OnModuleInit to service to register index on startup**

Open `apps/astra-apis/src/stock-adjustments/stock-adjustments.service.ts` and add:

At the top, add two new imports after the existing imports:
```typescript
import {Logger, OnModuleInit} from '@nestjs/common';
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';
import {StockAdjustments_ByLocation} from './indexes/stock-adjustments-by-location.index';
```

Change the class declaration to implement `OnModuleInit`:
```typescript
export class StockAdjustmentsService implements OnModuleInit {
  private readonly _logger = new Logger(StockAdjustmentsService.name);

  public constructor(
    private readonly _sessionFactory: RavenSessionFactory,
    private readonly _storeProvider: RavenDocumentStoreProvider,
  ) {}

  public async onModuleInit(): Promise<void> {
    try {
      await new StockAdjustments_ByLocation().execute(this._storeProvider.getStore());
    } catch (error) {
      this._logger.warn(
        'Failed to create StockAdjustments/ByLocation index',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
```

Add `RavenDocumentStoreProvider` to the providers in `stock-adjustments.module.ts`. Open that file and update it:

```typescript
import {RavenDocumentStoreProvider} from '../infrastructure/ravendb/document-store.provider';

@Module({
  imports: [RavenDbModule],
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService, RavenDocumentStoreProvider],
  exports: [StockAdjustmentsService],
})
```

Also update the test mock to include the store provider. In `stock-adjustments.service.spec.ts`, add a stub provider:
```typescript
{provide: RavenDocumentStoreProvider, useValue: {getStore: jest.fn()}},
```

- [ ] **Step 3: Run tests to confirm they still pass**

```bash
npm run test:apis -- --testPathPattern=stock-adjustments
```

Expected: all 6 tests PASS.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck:apis
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/astra-apis/src/stock-adjustments/
git commit -m "feat: add StockAdjustments/ByLocation RavenDB index with onModuleInit registration"
```

---

## Task 6: Frontend types, query keys, and queries

**Files:**
- Create: `apps/client-web/app/pages/stock-adjustments/types/stockAdjustment.ts`
- Create: `apps/client-web/app/pages/stock-adjustments/queries/stockAdjustmentQueryKey.ts`
- Create: `apps/client-web/app/pages/stock-adjustments/queries/stockAdjustmentQueries.ts`

- [ ] **Step 1: Create the frontend types**

```typescript
// apps/client-web/app/pages/stock-adjustments/types/stockAdjustment.ts
export type {
  AdjustmentType,
  AdjustmentReasonCode,
  DbStockAdjustment,
  DbStockAdjustmentListItem,
  DbStockAdjustmentListResponse,
  DbStockAdjustmentSearchCriteria,
  CreateStockAdjustmentInput,
} from '@ids/data-models';
```

- [ ] **Step 2: Create the query key factory**

```typescript
// apps/client-web/app/pages/stock-adjustments/queries/stockAdjustmentQueryKey.ts
export const STOCK_ADJUSTMENT_QUERY_KEYS = {
  all: (locationId: string) => ['stock-adjustments', locationId] as const,
  list: (locationId: string, filters?: Record<string, unknown>) =>
    ['stock-adjustments', locationId, 'list', filters ?? {}] as const,
} as const;
```

- [ ] **Step 3: Create the query functions**

```typescript
// apps/client-web/app/pages/stock-adjustments/queries/stockAdjustmentQueries.ts
import {API_CONFIG} from 'core/config/api';
import {apiClient} from 'core/services/apiClient';
import type {
  CreateStockAdjustmentInput,
  DbStockAdjustmentListItem,
  DbStockAdjustmentListResponse,
  DbStockAdjustmentSearchCriteria,
} from '../types/stockAdjustment';

export const stockAdjustmentQueries = {
  fetchAll: async (
    criteria: DbStockAdjustmentSearchCriteria,
  ): Promise<DbStockAdjustmentListResponse> => {
    const params = new URLSearchParams({
      locationId: criteria.locationId,
      page: String(criteria.page ?? 1),
      pageSize: String(criteria.pageSize ?? 25),
    });
    if (criteria.searchTerm) params.set('searchTerm', criteria.searchTerm);
    if (criteria.type) params.set('type', criteria.type);
    if (criteria.partNumber) params.set('partNumber', criteria.partNumber);

    return apiClient.get<DbStockAdjustmentListResponse>(
      `${API_CONFIG.baseUrl}/stock-adjustments?${params.toString()}`,
      {signal: criteria.signal, token: criteria.token},
    );
  },

  create: async (
    input: CreateStockAdjustmentInput,
    token: string,
  ): Promise<DbStockAdjustmentListItem> => {
    return apiClient.post<DbStockAdjustmentListItem>(
      `${API_CONFIG.baseUrl}/stock-adjustments`,
      input,
      {token},
    );
  },
};
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/app/pages/stock-adjustments/
git commit -m "feat: add stock adjustment query keys, queries, and frontend types"
```

---

## Task 7: Frontend hook

**Files:**
- Create: `apps/client-web/app/pages/stock-adjustments/hooks/useStockAdjustments.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/client-web/app/pages/stock-adjustments/hooks/useStockAdjustments.ts
import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {stockAdjustmentQueries} from '../queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from '../queries/stockAdjustmentQueryKey';
import type {AdjustmentType} from '../types/stockAdjustment';

type UseStockAdjustmentsOptions = {
  locationId: string;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  type?: AdjustmentType;
  partNumber?: string;
};

export function useStockAdjustments(options: UseStockAdjustmentsOptions) {
  const {accessToken} = useAuth();
  const {locationId, page = 1, pageSize = 25, searchTerm, type, partNumber} = options;

  return useQuery({
    queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.list(locationId, {page, pageSize, searchTerm, type, partNumber}),
    queryFn: ({signal}) => {
      if (!accessToken) throw new Error('No access token');
      return stockAdjustmentQueries.fetchAll({
        locationId,
        page,
        pageSize,
        searchTerm: searchTerm || undefined,
        type,
        partNumber: partNumber || undefined,
        signal,
        token: accessToken,
      });
    },
    enabled: !!accessToken && !!locationId,
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:web
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client-web/app/pages/stock-adjustments/hooks/
git commit -m "feat: add useStockAdjustments hook"
```

---

## Task 8: Frontend list page + columns

**Files:**
- Create: `apps/client-web/app/pages/stock-adjustments/columns.tsx`
- Create: `apps/client-web/app/pages/stock-adjustments/StockAdjustmentList.tsx`

- [ ] **Step 1: Create the columns**

```typescript
// apps/client-web/app/pages/stock-adjustments/columns.tsx
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type {GridColDef} from '@mui/x-data-grid';
import type {DbStockAdjustmentListItem} from './types/stockAdjustment';

const REASON_LABELS: Record<string, string> = {
  CYCLE_COUNT: 'Cycle Count',
  DAMAGE: 'Damage / Write-off',
  THEFT: 'Theft',
  FOUND: 'Found / Unaccounted',
  TRANSFER_IN: 'Transfer In',
  TRANSFER_OUT: 'Transfer Out',
  OTHER: 'Other',
};

export function getStockAdjustmentColumns(): GridColDef<DbStockAdjustmentListItem>[] {
  return [
    {field: 'adjustmentNumber', headerName: 'Adj #', width: 140, sortable: true},
    {field: 'partNumber', headerName: 'Part #', width: 140, sortable: true},
    {field: 'partDescriptionSnapshot', headerName: 'Description', flex: 1, minWidth: 200},
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: ({row}) => (
        <Chip
          label={row.type === 'add' ? 'Add' : 'Remove'}
          color={row.type === 'add' ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'quantityDelta',
      headerName: 'Qty',
      width: 90,
      align: 'right',
      headerAlign: 'right',
      renderCell: ({row}) => (
        <Typography
          variant="body2"
          sx={{color: row.quantityDelta > 0 ? 'success.main' : 'error.main', fontWeight: 600}}
        >
          {row.quantityDelta > 0 ? `+${row.quantityDelta}` : String(row.quantityDelta)}
        </Typography>
      ),
    },
    {
      field: 'reasonCode',
      headerName: 'Reason',
      width: 160,
      valueFormatter: (value: string) => REASON_LABELS[value] ?? value,
    },
    {
      field: 'createdDate',
      headerName: 'Date',
      width: 170,
      valueFormatter: (value: string) =>
        value ? new Date(value).toLocaleString() : '',
    },
    {field: 'createdBy', headerName: 'Adjusted By', width: 150},
  ];
}
```

- [ ] **Step 2: Create the list page**

```typescript
// apps/client-web/app/pages/stock-adjustments/StockAdjustmentList.tsx
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {DataGrid} from '@mui/x-data-grid';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {RESOLVED_LOCATION_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useMemo, useState} from 'react';
import {type ClientLoaderFunctionArgs, useNavigate} from 'react-router';
import {stockAdjustmentQueries} from './queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from './queries/stockAdjustmentQueryKey';
import {getStockAdjustmentColumns} from './columns';
import {useStockAdjustments} from './hooks/useStockAdjustments';

const DEFAULT_PAGE_SIZE = 25;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 52;
const GRID_HEIGHT = ROW_HEIGHT * DEFAULT_PAGE_SIZE + HEADER_HEIGHT + FOOTER_HEIGHT;

export async function clientLoader({context}: ClientLoaderFunctionArgs) {
  const resolved = context.get(RESOLVED_LOCATION_CONTEXT);
  if (!resolved) return null;
  const {locationId, locationToken} = resolved;

  await queryClient.ensureQueryData({
    queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.list(locationId, {page: 1, pageSize: DEFAULT_PAGE_SIZE}),
    queryFn: ({signal}) =>
      stockAdjustmentQueries.fetchAll({
        locationId,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        signal,
        token: locationToken,
      }),
  });

  return null;
}

export default function StockAdjustmentList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'add' | 'remove'>('all');

  const {data, isLoading, error} = useStockAdjustments({
    locationId: 'locations/LOC_AAA', // resolved from context at runtime via hook
    page: page + 1,
    pageSize,
    searchTerm: search || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
  });

  const columns = useMemo(() => getStockAdjustmentColumns(), []);

  return (
    <Box sx={{width: '100%', p: 2}}>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap'}}>
        <TextField
          size="small"
          placeholder="Search by part number or description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          InputProps={{startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>}}
          sx={{minWidth: 280}}
        />
        <ToggleButtonGroup
          size="small"
          value={typeFilter}
          exclusive
          onChange={(_, v) => { if (v !== null) { setTypeFilter(v); setPage(0); } }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="add">Add</ToggleButton>
          <ToggleButton value="remove">Remove</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{flexGrow: 1}} />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/stock-adjustments/create')}
          sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
        >
          New Adjustment
        </Button>
      </Box>

      {error && <QueryErrorAlert error={error} sx={{mb: 2}} />}

      <DataGrid
        rows={data?.data ?? []}
        columns={columns}
        loading={isLoading}
        rowCount={data?.total ?? 0}
        paginationMode="server"
        paginationModel={{page, pageSize}}
        onPaginationModelChange={(m) => { setPage(m.page); setPageSize(m.pageSize); }}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        rowHeight={ROW_HEIGHT}
        columnHeaderHeight={HEADER_HEIGHT}
        sx={{height: GRID_HEIGHT, border: 'none'}}
      />
    </Box>
  );
}
```

> **Note on `locationId`:** The list page above uses a placeholder `locationId`. In the actual app, the `RESOLVED_LOCATION_CONTEXT` provides the active location. Update the hook call to read `locationId` from the router context using `useResolvedLocation()` — follow the same pattern as `PartList.tsx` which uses `RESOLVED_LOCATION_CONTEXT` in its `clientLoader` and passes `locationId` down via loader data or context. Check `apps/client-web/app/pages/parts/PartList.tsx` for the exact pattern and replicate it.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck:web
```

Fix any type errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add apps/client-web/app/pages/stock-adjustments/StockAdjustmentList.tsx apps/client-web/app/pages/stock-adjustments/columns.tsx
git commit -m "feat: add StockAdjustmentList page with DataGrid and type filter"
```

---

## Task 9: Frontend create page + Valibot schema

**Files:**
- Create: `apps/client-web/app/pages/stock-adjustments/schemas/stockAdjustmentSchema.ts`
- Create: `apps/client-web/app/pages/stock-adjustments/StockAdjustmentCreate.tsx`

- [ ] **Step 1: Create the Valibot schema**

```typescript
// apps/client-web/app/pages/stock-adjustments/schemas/stockAdjustmentSchema.ts
import * as v from 'valibot';

export const stockAdjustmentSchema = v.pipe(
  v.object({
    partNumber: v.pipe(v.string(), v.minLength(1, 'Part number is required')),
    type: v.picklist(['add', 'remove'], 'Select Add or Remove'),
    quantity: v.pipe(
      v.number('Quantity must be a number'),
      v.minValue(1, 'Quantity must be at least 1'),
      v.integer('Quantity must be a whole number'),
    ),
    reasonCode: v.picklist(
      ['CYCLE_COUNT', 'DAMAGE', 'THEFT', 'FOUND', 'TRANSFER_IN', 'TRANSFER_OUT', 'OTHER'],
      'Select a reason',
    ),
    notes: v.optional(v.nullable(v.string())),
  }),
  v.forward(
    v.partialCheck(
      [['reasonCode'], ['notes']],
      (input) => input.reasonCode !== 'OTHER' || (!!input.notes && input.notes.trim().length > 0),
      'Notes are required when reason is Other',
    ),
    ['notes'],
  ),
);

export type StockAdjustmentFormValues = v.InferOutput<typeof stockAdjustmentSchema>;
```

- [ ] **Step 2: Create the create page**

```typescript
// apps/client-web/app/pages/stock-adjustments/StockAdjustmentCreate.tsx
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import {valibotResolver} from '@hookform/resolvers/valibot';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {AUTH_KERNEL_CONTEXT, RESOLVED_LOCATION_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useEffect, useState} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {
  type ClientActionFunctionArgs,
  Navigation,
  useActionData,
  useNavigate,
  useNavigation,
} from 'react-router';
import {stockAdjustmentQueries} from './queries/stockAdjustmentQueries';
import {STOCK_ADJUSTMENT_QUERY_KEYS} from './queries/stockAdjustmentQueryKey';
import {stockAdjustmentSchema, type StockAdjustmentFormValues} from './schemas/stockAdjustmentSchema';
import type {AdjustmentReasonCode} from './types/stockAdjustment';

const REASON_OPTIONS: {value: AdjustmentReasonCode; label: string}[] = [
  {value: 'CYCLE_COUNT', label: 'Cycle Count'},
  {value: 'DAMAGE', label: 'Damage / Write-off'},
  {value: 'THEFT', label: 'Theft'},
  {value: 'FOUND', label: 'Found / Unaccounted'},
  {value: 'TRANSFER_IN', label: 'Transfer In'},
  {value: 'TRANSFER_OUT', label: 'Transfer Out'},
  {value: 'OTHER', label: 'Other (specify in notes)'},
];

export async function clientAction({request, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const resolvedLocation = context.get(RESOLVED_LOCATION_CONTEXT);
  const token = await authKernel.getValidToken();

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') return {success: false as const, error: 'Invalid form data'};

  try {
    const values = JSON.parse(raw) as StockAdjustmentFormValues;
    const result = await stockAdjustmentQueries.create(
      {
        locationId: resolvedLocation?.locationId ?? '',
        partNumber: values.partNumber,
        type: values.type,
        quantity: values.quantity,
        reasonCode: values.reasonCode,
        notes: values.notes ?? null,
      },
      token ?? '',
    );
    await queryClient.invalidateQueries({
      queryKey: STOCK_ADJUSTMENT_QUERY_KEYS.all(resolvedLocation?.locationId ?? ''),
    });
    return {success: true as const, adjustmentNumber: result.adjustmentNumber};
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to create adjustment',
    };
  }
}

export default function StockAdjustmentCreate() {
  const navigate = useNavigate();
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const {
    control,
    handleSubmit,
    watch,
    formState: {errors},
  } = useForm<StockAdjustmentFormValues>({
    resolver: valibotResolver(stockAdjustmentSchema),
    defaultValues: {type: 'add', quantity: 1, reasonCode: undefined, notes: null},
  });

  const reasonCode = watch('reasonCode');
  const isOther = reasonCode === 'OTHER';

  const onSubmit = useCallback(
    (values: StockAdjustmentFormValues) => {
      const form = document.getElementById('adj-form') as HTMLFormElement;
      const fd = new FormData(form);
      fd.set('payload', JSON.stringify(values));
      form.dispatchEvent(
        new Event('submit', {bubbles: true, cancelable: true}),
      );
    },
    [],
  );

  useEffect(() => {
    if (actionData?.success) {
      setTimeout(() => navigate('/stock-adjustments'), 1500);
    }
  }, [actionData, navigate]);

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[
          {label: 'Stock Adjustments', to: '/stock-adjustments'},
          {label: 'New Adjustment'},
        ]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Save Adjustment'}
          </Button>
        }
      />

      {actionData?.success && (
        <HideAfterDelay delay={1500}>
          <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{mb: 2}}>
            Adjustment {actionData.adjustmentNumber} created — inventory updated.
          </Alert>
        </HideAfterDelay>
      )}
      {actionData && !actionData.success && (
        <Alert severity="error" sx={{mb: 2}}>
          {actionData.error}
        </Alert>
      )}

      <form id="adj-form" method="post">
        <input type="hidden" name="payload" />
        <Box sx={{maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 3}}>
          <Card variant="outlined">
            <CardContent sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              <Typography variant="subtitle2" color="text.secondary">
                Part
              </Typography>
              <Controller
                name="partNumber"
                control={control}
                render={({field}) => (
                  <TextField
                    {...field}
                    label="Part Number"
                    required
                    size="small"
                    error={!!errors.partNumber}
                    helperText={errors.partNumber?.message}
                    inputProps={{'data-testid': 'part-number-input'}}
                  />
                )}
              />
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
              <Typography variant="subtitle2" color="text.secondary">
                Adjustment
              </Typography>

              <Controller
                name="type"
                control={control}
                render={({field}) => (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{mb: 0.5, display: 'block'}}>
                      Type *
                    </Typography>
                    <ToggleButtonGroup
                      value={field.value}
                      exclusive
                      onChange={(_, v) => { if (v !== null) field.onChange(v); }}
                      size="small"
                    >
                      <ToggleButton value="add" color="success">Add</ToggleButton>
                      <ToggleButton value="remove" color="error">Remove</ToggleButton>
                    </ToggleButtonGroup>
                    {errors.type && (
                      <FormHelperText error>{errors.type.message}</FormHelperText>
                    )}
                  </Box>
                )}
              />

              <Controller
                name="quantity"
                control={control}
                render={({field}) => (
                  <TextField
                    {...field}
                    label="Quantity"
                    type="number"
                    required
                    size="small"
                    inputProps={{min: 1, step: 1}}
                    error={!!errors.quantity}
                    helperText={errors.quantity?.message}
                    onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                    sx={{maxWidth: 160}}
                  />
                )}
              />

              <Divider />

              <Controller
                name="reasonCode"
                control={control}
                render={({field}) => (
                  <FormControl size="small" error={!!errors.reasonCode} required>
                    <InputLabel>Reason</InputLabel>
                    <Select {...field} label="Reason" value={field.value ?? ''}>
                      {REASON_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.reasonCode && (
                      <FormHelperText>{errors.reasonCode.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />

              <Controller
                name="notes"
                control={control}
                render={({field}) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label={isOther ? 'Notes (required)' : 'Notes'}
                    multiline
                    rows={3}
                    size="small"
                    required={isOther}
                    error={!!errors.notes}
                    helperText={errors.notes?.message}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderColor: isOther && !field.value ? 'warning.main' : undefined,
                      },
                    }}
                  />
                )}
              />
            </CardContent>
          </Card>

          <Box sx={{display: 'flex', gap: 1}}>
            <Button variant="outlined" onClick={() => navigate('/stock-adjustments')} sx={{textTransform: 'none'}}>
              Cancel
            </Button>
          </Box>
        </Box>
      </form>
    </Box>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck:web
```

Fix any type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client-web/app/pages/stock-adjustments/
git commit -m "feat: add StockAdjustmentCreate page with Valibot schema and React Hook Form"
```

---

## Task 10: Routes, sidebar nav, feature registry

**Files:**
- Modify: `apps/client-web/app/routes.tsx`
- Modify: `apps/client-web/app/core/config/featureRegistry.ts`
- Modify: `apps/client-web/app/components/Layout.tsx`

- [ ] **Step 1: Add routes**

Open `apps/client-web/app/routes.tsx`. After the `vendors` prefix block and before the `user-settings` route, add:

```typescript
// Stock Adjustments
route('stock-adjustments', './pages/stock-adjustments/StockAdjustmentList.tsx'),
route('stock-adjustments/create', './pages/stock-adjustments/StockAdjustmentCreate.tsx'),
```

The resulting section:
```typescript
// Vendors
route('vendors', './pages/vendors/VendorList.tsx'),
route('vendors/create', './pages/vendors/VendorCreate.tsx'),
route('vendors/:id', './pages/vendors/VendorDetail.tsx'),

// Stock Adjustments
route('stock-adjustments', './pages/stock-adjustments/StockAdjustmentList.tsx'),
route('stock-adjustments/create', './pages/stock-adjustments/StockAdjustmentCreate.tsx'),

// User profile
route('user-settings', './pages/UserSettings.tsx'),
```

- [ ] **Step 2: Add feature registry entry**

Open `apps/client-web/app/core/config/featureRegistry.ts`. The `FEATURES` array currently has 6 entries ending with `system-config` and `integrations`. Add `stock-adjustments` after the `parts-inventory` entry:

```typescript
{
  id: 'stock-adjustments',
  nameKey: 'navigation:features.stockAdjustments.name',
  descriptionKey: 'navigation:features.stockAdjustments.description',
  route: '/stock-adjustments',
  category: 'inventory',
  status: 'partial',
},
```

Also add `'stock-adjustments'` to the `FeatureCategory` or confirm `'inventory'` is already a valid value — it is.

- [ ] **Step 3: Wire the sidebar nav item**

Open `apps/client-web/app/components/Layout.tsx`. Find the `stockAdjustments` nav item (line ~289) which currently has `route: null`:

```typescript
{
  label: t('navigation:stockAdjustments'),
  icon: <ShelvesIcon color="inherit" />,
  featureId: 'stock-adjustments',
  route: null,
},
```

Change `route: null` to `route: '/stock-adjustments'`:

```typescript
{
  label: t('navigation:stockAdjustments'),
  icon: <ShelvesIcon color="inherit" />,
  featureId: 'stock-adjustments',
  route: '/stock-adjustments',
},
```

- [ ] **Step 4: Typecheck both apps**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/client-web/app/routes.tsx apps/client-web/app/core/config/featureRegistry.ts apps/client-web/app/components/Layout.tsx
git commit -m "feat: add stock-adjustments routes, sidebar nav, and feature registry entry"
```

---

## Task 11: Seed data

**Files:**
- Create: `database/seeds/data/stock-adjustment.data.ts`
- Modify: `database/seed-runner.ts`

- [ ] **Step 1: Create the seed data file**

```typescript
// database/seeds/data/stock-adjustment.data.ts

export type StockAdjustmentSeedData = {
  adjustmentNumber: string;
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: 'add' | 'remove';
  quantity: number;
  quantityDelta: number;
  reasonCode: string;
  notes?: string | null;
};

export const stockAdjustmentSeedData: StockAdjustmentSeedData[] = [
  // LOC_HQ
  {
    adjustmentNumber: 'ADJ-2026-0001',
    locationId: 'locations/LOC_HQ',
    partNumber: 'OIL-FILTER-5W30',
    partDescriptionSnapshot: 'Oil Filter 5W30',
    type: 'remove',
    quantity: 2,
    quantityDelta: -2,
    reasonCode: 'DAMAGE',
    notes: 'Packaging crushed during storage',
  },
  // LOC_AAA
  {
    adjustmentNumber: 'ADJ-2026-0002',
    locationId: 'locations/LOC_AAA',
    partNumber: 'AIR-FILTER-CAB',
    partDescriptionSnapshot: 'Cabin Air Filter',
    type: 'add',
    quantity: 5,
    quantityDelta: 5,
    reasonCode: 'CYCLE_COUNT',
    notes: null,
  },
  // LOC_BBB
  {
    adjustmentNumber: 'ADJ-2026-0003',
    locationId: 'locations/LOC_BBB',
    partNumber: 'BRAKE-PAD-FRONT',
    partDescriptionSnapshot: 'Front Brake Pads',
    type: 'remove',
    quantity: 1,
    quantityDelta: -1,
    reasonCode: 'THEFT',
    notes: null,
  },
  // LOC_CCC
  {
    adjustmentNumber: 'ADJ-2026-0004',
    locationId: 'locations/LOC_CCC',
    partNumber: 'SPARK-PLUG-IRID',
    partDescriptionSnapshot: 'Iridium Spark Plug',
    type: 'add',
    quantity: 10,
    quantityDelta: 10,
    reasonCode: 'FOUND',
    notes: null,
  },
];
```

> **Note:** Use part numbers that actually exist in your `part.data.ts` seed. If `OIL-FILTER-5W30` etc. don't match exactly, look at `database/seeds/data/part.data.ts` and replace with real part numbers from there.

- [ ] **Step 2: Register in seed-runner.ts**

Open `database/seed-runner.ts`. At the top with the other imports:
```typescript
import {stockAdjustmentSeedData} from './seeds/data/stock-adjustment.data.js';
```

In the `seed()` function body, after the Parts step (step 14), add a new step 15:
```typescript
// ── 15. Stock Adjustments ────────────────────────────────────────────────────
for (const adj of stockAdjustmentSeedData) {
  const docId = `stock-adjustments/${adj.adjustmentNumber}`;
  await session.store(
    {
      id: docId,
      adjustmentNumber: adj.adjustmentNumber,
      locationId: adj.locationId,
      partNumber: adj.partNumber,
      partDescriptionSnapshot: adj.partDescriptionSnapshot,
      type: adj.type,
      quantity: adj.quantity,
      quantityDelta: adj.quantityDelta,
      reasonCode: adj.reasonCode,
      notes: adj.notes ?? null,
      createdDate: now,
      updatedDate: now,
      createdBy: 'system',
      updatedBy: 'system',
      version: 1,
      isDeleted: false,
    },
    docId,
  );
}
```

Also update the dependency-order comment block at the top to add:
```
 *   15. Stock Adjustments  (depends on Parts)
```

- [ ] **Step 3: Run the seeder**

```bash
npm run db -- seed
```

Expected: exits with no errors.

- [ ] **Step 4: Verify count**

```bash
npm run db -- count
```

Expected: `stock-adjustments: 4` (or similar) in the output.

- [ ] **Step 5: Commit**

```bash
git add database/seeds/data/stock-adjustment.data.ts database/seed-runner.ts
git commit -m "feat: add stock adjustment seed data (4 records across primary locations)"
```

---

## Task 12: End-to-end smoke test

No automated E2E tests yet. This task is manual verification.

- [ ] **Step 1: Start the full dev stack**

```bash
npm run dev:start
```

Wait for all four services to be running (API, web, doctor sidecar, Docker).

- [ ] **Step 2: Verify list endpoint with token**

In the running browser app, open DevTools → Network and grab a Bearer token from any API call. Then:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/stock-adjustments?locationId=locations/LOC_AAA"
```

Expected: `{"data":[...],"total":1,"page":1,"pageSize":25}` — one seeded adjustment for LOC_AAA.

- [ ] **Step 3: Navigate to the list page**

Open `http://localhost:5173/stock-adjustments` in the browser.

Expected:
- DataGrid shows seeded adjustment for the active location
- Add/Remove type chips display in green/red
- `+N` / `−N` quantity column renders correctly
- "New Adjustment" button is visible

- [ ] **Step 4: Create an Add adjustment**

Click "New Adjustment" → fill in a real part number (e.g. `OIL-FILTER-5W30`) → set Type = Add → Qty = 3 → Reason = Cycle Count → Save.

Expected:
- Form submits without error
- Success banner shows with the ADJ number
- Redirects to list after 1.5s
- New row appears in the list

- [ ] **Step 5: Verify Part inventory updated**

Navigate to `/parts` → search for the part you adjusted.

Expected: `On Hand` column shows the previous value **+ 3**.

- [ ] **Step 6: Test insufficient-stock guard**

Create a Remove adjustment for a part with Qty larger than its on-hand count.

Expected: error alert "Cannot remove N units — only X on hand".

- [ ] **Step 7: Test OTHER reason requires notes**

Create adjustment with Reason = Other, leave Notes blank, click Save.

Expected: Notes field shows validation error "Notes are required when reason is Other" — form does not submit.

- [ ] **Step 8: Final commit**

```bash
git add .
git commit -m "feat: complete Stock Adjustments feature — list, create, inventory write-back, seed"
```

---

## Summary

When all tasks are complete:
- `GET /api/stock-adjustments?locationId=X` — paginated list, scoped to location
- `POST /api/stock-adjustments` — creates adjustment, mutates Part inventory atomically
- `/stock-adjustments` — list with type filter chips and signed qty column
- `/stock-adjustments/create` — form with part number, type toggle, qty, reason, conditional notes
- Sidebar **Inventory → Stock Adjustments** navigates to the list
- 4 seed records across primary locations
- 6 unit tests for the service layer covering happy path and all error guards
