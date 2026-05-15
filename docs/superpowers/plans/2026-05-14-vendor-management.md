# Vendor Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full CRUD Vendor Management feature — list, create, and edit vendors — end-to-end across shared models, NestJS backend, and React frontend.

**Architecture:** A new `VendorModule` in NestJS exposes 4 REST endpoints following the Location module pattern exactly. The frontend mirrors the Location pages (list, create, detail) using the same TanStack Query + React Router clientLoader/clientAction pattern. Vendor is a global entity (not location-scoped) stored as a RavenDB document collection.

**Tech Stack:** NestJS 11, RavenDB (ravendb-node-client), class-validator, Swagger; React 19, React Router 7, MUI v7, TanStack Query v5, React Hook Form, Valibot, i18next.

---

## File Map

### New files to create

**Shared (`libs/shared/data-models/src/lib/vendor/`)**
- `vendor.interface.ts` — `DbVendor`, `DbVendorListItem`, `DbVendorListResponse`, `DbVendorSearchCriteria`
- `index.ts` — barrel re-export

**Backend (`apps/astra-apis/src/vendor/`)**
- `vendor.module.ts`
- `vendor.controller.ts`
- `vendor.service.ts`
- `entities/vendor.entity.ts`
- `dto/vendor-create.dto.ts`
- `dto/vendor-update.dto.ts`
- `dto/vendor-list.query.dto.ts`

**Frontend (`apps/client-web/app/pages/vendors/`)**
- `types/vendor.ts`
- `queries/vendorQueryKey.ts`
- `queries/vendorQueries.ts`
- `hooks/useVendors.ts`
- `hooks/useVendor.ts`
- `schemas/vendorSchema.ts`
- `VendorForm.tsx`
- `columns.tsx`
- `VendorList.tsx`
- `VendorCreate.tsx`
- `VendorDetail.tsx`

### Files to modify

- `libs/shared/data-models/src/index.ts` — add `export * from './lib/vendor/index.js'`
- `apps/astra-apis/src/app.module.ts` — import `VendorModule`
- `apps/client-web/app/routes.tsx` — add vendor routes
- `apps/client-web/app/components/Layout.tsx` — add Vendors nav item to inventory category
- `apps/client-web/app/core/config/featureRegistry.ts` — add vendors feature entry
- `database/seeds/data/vendor.data.ts` — simplify to only seed core fields (code, name, terms)
- `database/seed-runner.ts` — register vendor seed if not already wired

---

## Task 1: Shared data model

**Files:**
- Create: `libs/shared/data-models/src/lib/vendor/vendor.interface.ts`
- Create: `libs/shared/data-models/src/lib/vendor/index.ts`
- Modify: `libs/shared/data-models/src/index.ts`

- [ ] **Step 1: Create the vendor interface file**

Create `libs/shared/data-models/src/lib/vendor/vendor.interface.ts`:

```typescript
import type {IdsBaseEntity} from '../common/index.js';

export interface DbVendor extends IdsBaseEntity {
  code: string;
  name: string;
  terms?: string | null;
}

export interface DbVendorListItem {
  id: string;
  code: string;
  name: string;
  terms?: string | null;
}

export interface DbVendorListResponse {
  data: DbVendorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DbVendorSearchCriteria {
  searchTerm?: string;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 2: Create the vendor barrel export**

Create `libs/shared/data-models/src/lib/vendor/index.ts`:

```typescript
export * from './vendor.interface.js';
```

- [ ] **Step 3: Add vendor to the root barrel**

In `libs/shared/data-models/src/index.ts`, add after the existing exports:

```typescript
export * from './lib/vendor/index.js';
```

The full file should now end with:
```typescript
export * from './lib/address/index.js';
export * from './lib/common/index.js';
export * from './lib/constants/console-colors.js';
export * from './lib/constants/constants.js';
export * from './lib/constants/error-messages.js';
export * from './lib/location/index.js';
export * from './lib/money/index.js';
export * from './lib/telcom/index.js';
export * from './lib/user/index.js';
export * from './lib/vendor/index.js';
```

- [ ] **Step 4: Verify the barrel compiles**

```bash
cd libs/shared/data-models && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/data-models/src/lib/vendor/ libs/shared/data-models/src/index.ts
git commit -m "feat: add DbVendor shared interface to data-models"
```

---

## Task 2: Backend entity and DTOs

**Files:**
- Create: `apps/astra-apis/src/vendor/entities/vendor.entity.ts`
- Create: `apps/astra-apis/src/vendor/dto/vendor-create.dto.ts`
- Create: `apps/astra-apis/src/vendor/dto/vendor-update.dto.ts`
- Create: `apps/astra-apis/src/vendor/dto/vendor-list.query.dto.ts`

- [ ] **Step 1: Create the vendor entity**

Create `apps/astra-apis/src/vendor/entities/vendor.entity.ts`:

```typescript
import {IdsBaseEntity} from '../../common/entities/ids-base.entity';

export class Vendor extends IdsBaseEntity {
  public code!: string;
  public name!: string;
  public terms?: string | null;
}
```

- [ ] **Step 2: Create the create DTO**

Create `apps/astra-apis/src/vendor/dto/vendor-create.dto.ts`:

```typescript
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsNotEmpty, IsOptional, IsString, MaxLength} from 'class-validator';

export class VendorCreateDto {
  @ApiProperty({description: 'Short unique vendor code', example: 'ACME-CORP', maxLength: 50})
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  code!: string;

  @ApiProperty({description: 'Vendor display name', example: 'Acme Corporation', maxLength: 200})
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({description: 'Payment terms, e.g. "Net 30"', maxLength: 100, nullable: true})
  @IsOptional()
  @IsString()
  @MaxLength(100)
  terms?: string | null;
}

export class VendorCreateResponseDto {
  @ApiProperty({description: 'Vendor document ID'})
  id!: string;

  @ApiProperty({description: 'Short unique vendor code'})
  code!: string;

  @ApiProperty({description: 'Vendor display name'})
  name!: string;

  @ApiPropertyOptional({description: 'Payment terms', nullable: true})
  terms?: string | null;
}
```

- [ ] **Step 3: Create the update DTO**

Create `apps/astra-apis/src/vendor/dto/vendor-update.dto.ts`:

```typescript
import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsOptional, IsString, MaxLength} from 'class-validator';

export class VendorUpdateDto {
  @ApiPropertyOptional({description: 'Vendor display name', maxLength: 200})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({description: 'Payment terms', maxLength: 100, nullable: true})
  @IsOptional()
  @IsString()
  @MaxLength(100)
  terms?: string | null;
}

export class VendorUpdateResponseDto extends VendorCreateResponseDto {}

// Re-export for convenience
import {VendorCreateResponseDto} from './vendor-create.dto';
export {VendorCreateResponseDto};
```

- [ ] **Step 4: Create the list query DTO**

Create `apps/astra-apis/src/vendor/dto/vendor-list.query.dto.ts`:

```typescript
import {PaginationQueryDto} from '@ids/data-models';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsOptional, IsString, MaxLength} from 'class-validator';

export class VendorListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({description: 'Search by vendor code or name', maxLength: 200})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchTerm?: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/astra-apis/src/vendor/
git commit -m "feat: add vendor entity and DTOs"
```

---

## Task 3: Backend service

**Files:**
- Create: `apps/astra-apis/src/vendor/vendor.service.ts`

- [ ] **Step 1: Write a failing test for VendorService.findAll**

Create `apps/astra-apis/src/vendor/vendor.service.spec.ts`:

```typescript
import {NotFoundException} from '@nestjs/common';
import {describe, expect, it, vi} from 'vitest';
import {VendorService} from './vendor.service';

const mockSession = {
  query: vi.fn().mockReturnValue({all: vi.fn().mockResolvedValue([])}),
  load: vi.fn(),
  store: vi.fn(),
  saveChanges: vi.fn(),
  [Symbol.dispose]: vi.fn(),
};

const mockSessionFactory = {
  openSession: vi.fn().mockReturnValue(mockSession),
};

describe('VendorService', () => {
  const service = new VendorService(mockSessionFactory as any);

  it('findAll returns paged response with empty items', async () => {
    mockSession.query.mockReturnValue({all: vi.fn().mockResolvedValue([])});
    const result = await service.findAll({page: 1, pageSize: 10});
    expect(result.items).toEqual([]);
    expect(result.page).toBe(1);
    expect(result.totalCount).toBe(0);
  });

  it('findOne throws NotFoundException when vendor missing', async () => {
    mockSession.load.mockResolvedValue(null);
    await expect(service.findOne('vendors/nonexistent')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx nx test astra-apis --testFile=src/vendor/vendor.service.spec.ts
```

Expected: FAIL — `VendorService` not found.

- [ ] **Step 3: Implement VendorService**

Create `apps/astra-apis/src/vendor/vendor.service.ts`:

```typescript
import {DEFAULT_PAGE_SIZE, type PagedResponseDto, toPagedDto} from '@ids/data-models';
import {ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {createIdsBaseEntity, touchIdsBaseEntity} from '../common/entities/ids-base.entity';
import {RavenSessionFactory} from '../infrastructure/ravendb/session-factory';
import type {VendorCreateDto, VendorCreateResponseDto} from './dto/vendor-create.dto';
import type {VendorUpdateDto} from './dto/vendor-update.dto';
import {Vendor} from './entities/vendor.entity';

@Injectable()
export class VendorService {
  public constructor(private readonly _sessionFactory: RavenSessionFactory) {}

  public async create(dto: VendorCreateDto, userId: string): Promise<VendorCreateResponseDto> {
    using session = this._sessionFactory.openSession();

    const all: Vendor[] = await session.query<Vendor>({collection: 'vendors'}).all();
    const exists = all.some((v) => v.code.toLowerCase() === dto.code.toLowerCase());
    if (exists) {
      throw new ConflictException(`Vendor with code "${dto.code}" already exists`);
    }

    const entity: Vendor = {
      ...createIdsBaseEntity(userId),
      id: `vendors/${dto.code}`,
      code: dto.code,
      name: dto.name,
      terms: dto.terms ?? null,
    };

    await session.store(entity, entity.id);
    await session.saveChanges();
    return this._toResponseDto(entity);
  }

  public async findAll(options?: {
    searchTerm?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResponseDto<VendorCreateResponseDto>> {
    const {searchTerm, page = 1, pageSize = DEFAULT_PAGE_SIZE} = options ?? {};

    using session = this._sessionFactory.openSession();
    const all: Vendor[] = await session.query<Vendor>({collection: 'vendors'}).all();

    const filtered = all.filter((vendor) => {
      if (!searchTerm) return true;
      const tokens = searchTerm.toLowerCase().trim().split(/\s+/).filter((t) => t.length > 0);
      const haystack = `${vendor.code} ${vendor.name}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const skip = (page - 1) * pageSize;
    const items = filtered.slice(skip, skip + pageSize);

    return toPagedDto(items.map(this._toResponseDto), page, pageSize, filtered.length);
  }

  public async findOne(id: string): Promise<VendorCreateResponseDto> {
    const docId = this._toDocId(id);
    using session = this._sessionFactory.openSession();
    const vendor: Vendor | null = await session.load<Vendor>(docId);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found`);
    }
    return this._toResponseDto(vendor);
  }

  public async update(
    id: string,
    dto: VendorUpdateDto,
    userId: string,
  ): Promise<VendorCreateResponseDto> {
    const docId = this._toDocId(id);
    using session = this._sessionFactory.openSession();
    const vendor: Vendor | null = await session.load<Vendor>(docId);
    if (!vendor) {
      throw new NotFoundException(`Vendor with ID "${id}" not found`);
    }

    if (dto.name !== undefined) vendor.name = dto.name;
    if (dto.terms !== undefined) vendor.terms = dto.terms;
    touchIdsBaseEntity(vendor, userId);

    await session.store(vendor, docId);
    await session.saveChanges();
    return this._toResponseDto(vendor);
  }

  private _toDocId(id: string): string {
    return id.startsWith('vendors/') ? id : `vendors/${id}`;
  }

  private _toResponseDto(vendor: Vendor): VendorCreateResponseDto {
    return {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      terms: vendor.terms ?? null,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx nx test astra-apis --testFile=src/vendor/vendor.service.spec.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/astra-apis/src/vendor/vendor.service.ts apps/astra-apis/src/vendor/vendor.service.spec.ts
git commit -m "feat: add VendorService with findAll, findOne, create, update"
```

---

## Task 4: Backend controller and module

**Files:**
- Create: `apps/astra-apis/src/vendor/vendor.controller.ts`
- Create: `apps/astra-apis/src/vendor/vendor.module.ts`
- Modify: `apps/astra-apis/src/app.module.ts`

- [ ] **Step 1: Create the controller**

Create `apps/astra-apis/src/vendor/vendor.controller.ts`:

```typescript
import type {PagedResponseDto} from '@ids/data-models';
import {Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {Auth} from '../auth/auth.decorator';
import {AuthInfo} from '../auth/auth-utils';
import {VendorCreateDto, VendorCreateResponseDto} from './dto/vendor-create.dto';
import {VendorListQueryDto} from './dto/vendor-list.query.dto';
import {VendorUpdateDto} from './dto/vendor-update.dto';
import {VendorService} from './vendor.service';

@ApiTags('vendor')
@ApiBearerAuth()
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  @ApiOperation({summary: 'List vendors', description: 'Paginated vendor list with optional search'})
  @ApiResponse({status: 200, description: 'Paginated list of vendors'})
  async findAll(@Query() query: VendorListQueryDto): Promise<PagedResponseDto<VendorCreateResponseDto>> {
    return this.vendorService.findAll({
      searchTerm: query.searchTerm,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':id')
  @ApiOperation({summary: 'Get vendor by ID'})
  @ApiResponse({status: 200, description: 'Vendor found', type: VendorCreateResponseDto})
  @ApiResponse({status: 404, description: 'Vendor not found'})
  async findOne(@Param('id') id: string): Promise<VendorCreateResponseDto> {
    return this.vendorService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({summary: 'Create vendor'})
  @ApiResponse({status: 201, description: 'Vendor created', type: VendorCreateResponseDto})
  @ApiResponse({status: 409, description: 'Vendor code already exists'})
  async create(
    @Body() dto: VendorCreateDto,
    @Auth() auth: AuthInfo,
  ): Promise<VendorCreateResponseDto> {
    return this.vendorService.create(dto, auth.sub);
  }

  @Patch(':id')
  @ApiOperation({summary: 'Update vendor'})
  @ApiResponse({status: 200, description: 'Vendor updated', type: VendorCreateResponseDto})
  @ApiResponse({status: 404, description: 'Vendor not found'})
  async update(
    @Param('id') id: string,
    @Body() dto: VendorUpdateDto,
    @Auth() auth: AuthInfo,
  ): Promise<VendorCreateResponseDto> {
    return this.vendorService.update(id, dto, auth.sub);
  }
}
```

- [ ] **Step 2: Create the module**

Create `apps/astra-apis/src/vendor/vendor.module.ts`:

```typescript
import {Module} from '@nestjs/common';
import {RavenDbModule} from '../infrastructure/ravendb/ravendb.module';
import {VendorController} from './vendor.controller';
import {VendorService} from './vendor.service';

@Module({
  imports: [RavenDbModule],
  controllers: [VendorController],
  providers: [VendorService],
  exports: [VendorService],
})
export class VendorModule {}
```

- [ ] **Step 3: Register VendorModule in AppModule**

In `apps/astra-apis/src/app.module.ts`, add the import:

```typescript
import {VendorModule} from './vendor/vendor.module';
```

And add `VendorModule` to the `imports` array:

```typescript
imports: [
  ConfigModule.forRoot({...}),
  RavenDbModule,
  AuthModule,
  GlobalModule,
  SystemHealthModule,
  UserModule,
  LocationModule,
  PartModule,
  VendorModule,   // <-- add this
],
```

- [ ] **Step 4: Start the API and verify endpoints appear**

```bash
npm run dev:apis
```

Open `http://localhost:3000/api` (Swagger UI). Confirm you see a `vendor` tag with 4 endpoints: GET /vendors, GET /vendors/:id, POST /vendors, PATCH /vendors/:id.

- [ ] **Step 5: Smoke-test with curl**

```bash
curl -s http://localhost:3000/api/vendors -H "Authorization: Bearer <token>" | jq .
```

Expected: `{"items":[],"page":1,"pageSize":20,"totalCount":0,"totalPages":0}`

(Get a token from the browser dev tools Network tab after signing in.)

- [ ] **Step 6: Commit**

```bash
git add apps/astra-apis/src/vendor/vendor.controller.ts apps/astra-apis/src/vendor/vendor.module.ts apps/astra-apis/src/app.module.ts
git commit -m "feat: add VendorController and VendorModule, register in AppModule"
```

---

## Task 5: Seed data update

**Files:**
- Modify: `database/seeds/data/vendor.data.ts`
- Modify: `database/seed-runner.ts` (verify vendor is registered)

- [ ] **Step 1: Inspect seed-runner to see if vendor is already registered**

Open `database/seed-runner.ts` and search for `vendor`. If it's present, skip Step 2.

- [ ] **Step 2: Check what fields are actually stored by the seed runner**

Look at how `vendor.data.ts` is used. The current seed data has `addresses` and `telcoms` but the Vendor entity only stores `code`, `name`, and `terms`. The seed runner must only pass the supported fields to `session.store`.

In `database/seeds/data/vendor.data.ts`, update the seed data to remove addresses/telcoms (they can't be stored in the Vendor document since Vendor entity has no such fields):

```typescript
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
  {id: '4e0d0001-0000-4000-8000-000000000001', code: 'STAR-OFFICE', name: 'Star Office Supply Co.', terms: 'Net 30', isDeleted: false, createdBy: 'system', updatedBy: 'system'},
  {id: '4e0d0001-0000-4000-8000-000000000002', code: 'CLINCHTECH', name: 'ClinchTech Systems Inc.', terms: 'Net 45', isDeleted: false, createdBy: 'system', updatedBy: 'system'},
  {id: '4e0d0001-0000-4000-8000-000000000003', code: 'GREENLIGHT', name: 'GreenLight Energy Solutions', terms: 'Due on Receipt', isDeleted: false, createdBy: 'system', updatedBy: 'system'},
  {id: '4e0d0001-0000-4000-8000-000000000004', code: 'RELIABLE-FL', name: 'Reliable Freight & Logistics', terms: 'Net 15', isDeleted: false, createdBy: 'system', updatedBy: 'system'},
  {id: '4e0d0001-0000-4000-8000-000000000005', code: 'PRO-SERVICES', name: 'Professional Services Group LLC', terms: 'Net 30', isDeleted: false, createdBy: 'system', updatedBy: 'system'},
];
```

- [ ] **Step 3: Verify vendor seeder stores correctly and run seed**

```bash
npm run db -- seed
```

Expected: completes without errors.

- [ ] **Step 4: Verify vendor count**

```bash
npm run db -- count
```

Expected: shows `vendors: 5` (or similar).

- [ ] **Step 5: Test the list endpoint returns seeded vendors**

```bash
curl -s "http://localhost:3000/api/vendors" -H "Authorization: Bearer <token>" | jq '.totalCount'
```

Expected: `5`

- [ ] **Step 6: Commit**

```bash
git add database/seeds/data/vendor.data.ts
git commit -m "chore: simplify vendor seed data to match Vendor entity schema"
```

---

## Task 6: Frontend types, queries, and hooks

**Files:**
- Create: `apps/client-web/app/pages/vendors/types/vendor.ts`
- Create: `apps/client-web/app/pages/vendors/queries/vendorQueryKey.ts`
- Create: `apps/client-web/app/pages/vendors/queries/vendorQueries.ts`
- Create: `apps/client-web/app/pages/vendors/hooks/useVendors.ts`
- Create: `apps/client-web/app/pages/vendors/hooks/useVendor.ts`

- [ ] **Step 1: Create the frontend type definitions**

Create `apps/client-web/app/pages/vendors/types/vendor.ts`:

```typescript
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
```

- [ ] **Step 2: Create the query key constants**

Create `apps/client-web/app/pages/vendors/queries/vendorQueryKey.ts`:

```typescript
export const VENDOR_QUERY_KEYS = {
  all: () => ['vendors'] as const,
  list: (filters?: Record<string, unknown>) => ['vendors', 'list', filters ?? {}] as const,
  detail: (id: string) => ['vendors', 'detail', id] as const,
} as const;
```

- [ ] **Step 3: Create the query functions**

Create `apps/client-web/app/pages/vendors/queries/vendorQueries.ts`:

```typescript
import {API_CONFIG} from 'core/config/api';
import {apiClient} from 'core/services/apiClient';
import type {CreateVendorInput, DbVendor, UpdateVendorInput, VendorListResponse, VendorSearchCriteria} from '../types/vendor';

export const vendorQueries = {
  fetchAll: async (criteria: VendorSearchCriteria): Promise<VendorListResponse> => {
    const params = new URLSearchParams({
      page: String(criteria.page ?? 1),
      pageSize: String(criteria.pageSize ?? 10),
    });
    if (criteria.searchTerm) {
      params.set('searchTerm', criteria.searchTerm);
    }
    return apiClient.get<VendorListResponse>(
      `${API_CONFIG.baseUrl}/vendors?${params.toString()}`,
      {signal: criteria.signal, token: criteria.token},
    );
  },

  fetchById: async ({id, signal, token}: {id: string; signal?: AbortSignal; token: string}): Promise<DbVendor> => {
    return apiClient.get<DbVendor>(`${API_CONFIG.baseUrl}/vendors/${id}`, {signal, token});
  },

  create: async (input: CreateVendorInput, token: string): Promise<DbVendor> => {
    return apiClient.post<DbVendor>(`${API_CONFIG.baseUrl}/vendors`, input, {token});
  },

  update: async (id: string, input: UpdateVendorInput, token: string): Promise<DbVendor> => {
    return apiClient.patch<DbVendor>(`${API_CONFIG.baseUrl}/vendors/${id}`, input, {token});
  },
};
```

- [ ] **Step 4: Create the list hook**

Create `apps/client-web/app/pages/vendors/hooks/useVendors.ts`:

```typescript
import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {vendorQueries} from '../queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from '../queries/vendorQueryKey';

export function useVendors(params: {page: number; pageSize: number; searchTerm?: string}) {
  const {accessToken} = useAuth();

  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.list(params),
    queryFn: ({signal}) =>
      vendorQueries.fetchAll({...params, signal, token: accessToken ?? ''}),
    enabled: !!accessToken,
    placeholderData: (previousData) => previousData,
  });
}
```

- [ ] **Step 5: Create the detail hook**

Create `apps/client-web/app/pages/vendors/hooks/useVendor.ts`:

```typescript
import {useQuery} from '@tanstack/react-query';
import {useAuth} from 'core/contexts/auth/useAuth';
import {vendorQueries} from '../queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from '../queries/vendorQueryKey';

export function useVendor(id: string) {
  const {accessToken} = useAuth();

  return useQuery({
    queryKey: VENDOR_QUERY_KEYS.detail(id),
    queryFn: ({signal}) => vendorQueries.fetchById({id, signal, token: accessToken ?? ''}),
    enabled: !!accessToken && !!id,
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/client-web/app/pages/vendors/
git commit -m "feat: add vendor frontend types, query keys, query functions, and hooks"
```

---

## Task 7: Valibot schema and VendorForm component

**Files:**
- Create: `apps/client-web/app/pages/vendors/schemas/vendorSchema.ts`
- Create: `apps/client-web/app/pages/vendors/VendorForm.tsx`

- [ ] **Step 1: Create the Valibot schema**

Create `apps/client-web/app/pages/vendors/schemas/vendorSchema.ts`:

```typescript
import * as v from 'valibot';

export const vendorCreateSchema = v.object({
  code: v.pipe(v.string(), v.minLength(1, 'Code is required'), v.maxLength(50, 'Code must be 50 characters or less')),
  name: v.pipe(v.string(), v.minLength(1, 'Name is required'), v.maxLength(200, 'Name must be 200 characters or less')),
  terms: v.optional(v.string()),
});

export const vendorUpdateSchema = v.object({
  code: v.string(), // read-only in edit mode, not validated
  name: v.pipe(v.string(), v.minLength(1, 'Name is required'), v.maxLength(200, 'Name must be 200 characters or less')),
  terms: v.optional(v.string()),
});

export type VendorFormValues = v.InferOutput<typeof vendorCreateSchema>;
```

- [ ] **Step 2: Create the VendorForm component**

Create `apps/client-web/app/pages/vendors/VendorForm.tsx`:

```typescript
import {valibotResolver} from '@hookform/resolvers/valibot';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {useEffect} from 'react';
import {Controller, useForm} from 'react-hook-form';
import {SubmitFunction, useSubmit} from 'react-router';
import {vendorCreateSchema, vendorUpdateSchema, type VendorFormValues} from './schemas/vendorSchema';
import type {DbVendor} from './types/vendor';

type Props = {
  mode: 'create' | 'edit';
  initialData?: DbVendor | null;
  isSubmitting: boolean;
  serverError?: string | null;
  onDirtyChange?: (dirty: boolean) => void;
};

export function VendorForm({mode, initialData, isSubmitting, serverError, onDirtyChange}: Props) {
  const submit: SubmitFunction = useSubmit();
  const isEdit = mode === 'edit';

  const {control, handleSubmit, formState: {isDirty, errors}} = useForm<VendorFormValues>({
    resolver: valibotResolver(isEdit ? vendorUpdateSchema : vendorCreateSchema),
    defaultValues: {
      code: initialData?.code ?? '',
      name: initialData?.name ?? '',
      terms: initialData?.terms ?? '',
    },
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleFormSubmit = (data: VendorFormValues) => {
    const payload = isEdit
      ? {name: data.name, terms: data.terms || null}
      : {code: data.code, name: data.name, terms: data.terms || null};
    submit(
      {payload: JSON.stringify(payload)},
      {method: 'post', encType: 'application/x-www-form-urlencoded'},
    );
  };

  return (
    <>
      <button
        id="vendor-form-submit"
        type="button"
        onClick={handleSubmit(handleFormSubmit)}
        disabled={isSubmitting}
        style={{display: 'none'}}
      />

      {serverError && (
        <Alert severity="error" sx={{mb: 3}} data-testid="vendor-form-error">
          {serverError}
        </Alert>
      )}

      <Box sx={{mt: 2}}>
        <Typography variant="subtitle2" sx={{mb: 2, fontWeight: 600}}>
          Vendor Details
        </Typography>
        <Stack spacing={2.5}>
          <Controller
            name="code"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Vendor Code"
                size="small"
                required={!isEdit}
                disabled={isEdit}
                error={!!errors.code}
                helperText={errors.code?.message}
                slotProps={{htmlInput: {'data-testid': 'vendor-code-input'}}}
                fullWidth
              />
            )}
          />
          <Controller
            name="name"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Vendor Name"
                size="small"
                required
                error={!!errors.name}
                helperText={errors.name?.message}
                slotProps={{htmlInput: {'data-testid': 'vendor-name-input'}}}
                fullWidth
              />
            )}
          />
          <Controller
            name="terms"
            control={control}
            render={({field}) => (
              <TextField
                {...field}
                label="Payment Terms"
                size="small"
                placeholder="e.g. Net 30"
                slotProps={{htmlInput: {'data-testid': 'vendor-terms-input'}}}
                fullWidth
              />
            )}
          />
        </Stack>
      </Box>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client-web/app/pages/vendors/schemas/ apps/client-web/app/pages/vendors/VendorForm.tsx
git commit -m "feat: add vendor Valibot schema and VendorForm component"
```

---

## Task 8: DataGrid columns

**Files:**
- Create: `apps/client-web/app/pages/vendors/columns.tsx`

- [ ] **Step 1: Create the columns definition**

Create `apps/client-web/app/pages/vendors/columns.tsx`:

```typescript
import Typography from '@mui/material/Typography';
import {type GridColDef, type GridRenderCellParams} from '@mui/x-data-grid';
import type {DbVendor} from './types/vendor';

export function getVendorListColumns(): GridColDef[] {
  return [
    {
      field: 'code',
      headerName: 'Code',
      flex: 0.8,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography sx={{fontSize: '0.8125rem', fontFamily: 'monospace', color: 'text.primary'}}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      minWidth: 160,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography sx={{fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary'}}>
          {params.value as string}
        </Typography>
      ),
    },
    {
      field: 'terms',
      headerName: 'Terms',
      flex: 1,
      minWidth: 100,
      renderCell: (params: GridRenderCellParams<DbVendor>) => (
        <Typography sx={{fontSize: '0.8125rem', color: params.value ? 'text.primary' : 'text.secondary'}}>
          {(params.value as string | null) ?? '—'}
        </Typography>
      ),
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-web/app/pages/vendors/columns.tsx
git commit -m "feat: add vendor DataGrid columns"
```

---

## Task 9: VendorList page

**Files:**
- Create: `apps/client-web/app/pages/vendors/VendorList.tsx`

- [ ] **Step 1: Create VendorList**

Create `apps/client-web/app/pages/vendors/VendorList.tsx`:

```typescript
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {DataGrid} from '@mui/x-data-grid';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {useAuth} from 'core/contexts/auth/useAuth';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {type ClientLoaderFunctionArgs, useNavigate} from 'react-router';
import {getVendorListColumns} from './columns';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';
import {useVendors} from './hooks/useVendors';

export async function clientLoader({context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  await queryClient.ensureQueryData({
    queryKey: VENDOR_QUERY_KEYS.list({page: 1, pageSize: 10}),
    queryFn: ({signal}) => vendorQueries.fetchAll({page: 1, pageSize: 10, signal, token: token ?? ''}),
  });

  return null;
}

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 44;
const FOOTER_HEIGHT = 52;
const DEFAULT_PAGE_SIZE = 10;
const ROW_BORDER_PX = 0.1;
const GRID_HEIGHT = ROW_HEIGHT * DEFAULT_PAGE_SIZE + ROW_BORDER_PX * DEFAULT_PAGE_SIZE + HEADER_HEIGHT + FOOTER_HEIGHT;

export default function VendorList() {
  const navigate = useNavigate();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');

  const measureRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const width = el.getBoundingClientRect().width;
    if (width > 0) setGridWidth(Math.floor(width));
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setGridWidth(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = useMemo(() => getVendorListColumns(), []);

  const {data, isFetching, error} = useVendors({
    page: page + 1,
    pageSize,
    searchTerm: search || undefined,
  });

  const vendors = data?.items ?? [];
  const total = data?.totalCount ?? 0;

  return (
    <Box sx={{width: '100%'}}>
      <QueryErrorAlert error={error instanceof Error ? error : null} />
      <Typography variant="h5" component="h1" sx={{mb: 2, fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.3px'}}>
        Vendors
      </Typography>

      <Box sx={{bgcolor: 'background.paper', borderRadius: 4, border: '1px solid', borderColor: 'divider', overflow: 'hidden', width: '100%'}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider'}}>
          <TextField
            size="small"
            placeholder="Search vendors…"
            value={search}
            onChange={(e) => {setSearch(e.target.value); setPage(0);}}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{fontSize: 16, color: 'text.secondary'}} /></InputAdornment>,
                sx: {fontSize: '0.8rem', height: 36, borderRadius: '8px', '& .MuiOutlinedInput-notchedOutline': {borderColor: 'divider'}},
              },
              htmlInput: {'data-testid': 'vendor-search-input'},
            }}
            sx={{flex: 1}}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => navigate('/vendors/create')}
            sx={{height: 36, px: 2, borderRadius: '8px', fontSize: '0.8125rem', whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
            data-testid="create-vendor-button"
          >
            New Vendor
          </Button>
        </Box>

        <div ref={measureRef} style={{width: '100%'}} data-testid="vendors-table-container">
          {gridWidth > 0 && (
            <div style={{width: gridWidth, height: GRID_HEIGHT}} data-testid="vendors-table">
              <DataGrid
                columns={columns}
                columnHeaderHeight={HEADER_HEIGHT}
                disableRowSelectionOnClick
                getRowId={(row) => row.id}
                onRowClick={(params) => navigate(`/vendors/${params.row.id}`)}
                loading={isFetching && vendors.length === 0}
                onPaginationModelChange={(model) => {
                  if (model.pageSize !== pageSize) {setPageSize(model.pageSize); setPage(0);}
                  else setPage(model.page);
                }}
                paginationMode="server"
                paginationModel={{page, pageSize}}
                pageSizeOptions={[10, 25, 50]}
                rows={vendors}
                rowHeight={ROW_HEIGHT}
                rowCount={Math.max(0, total)}
                slots={{
                  noRowsOverlay: () => (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                      <Typography sx={{fontSize: '0.8125rem', color: 'text.secondary'}} data-testid="vendors-no-results">No vendors found</Typography>
                    </Box>
                  ),
                  loadingOverlay: () => (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                      <CircularProgress size={40} />
                    </Box>
                  ),
                }}
                sx={dataGridSx}
              />
            </div>
          )}
        </div>
      </Box>
    </Box>
  );
}

const dataGridSx = {
  border: 'none',
  '& .MuiDataGrid-columnHeaders': {bgcolor: 'background.default', borderColor: 'divider', minHeight: '44px !important', maxHeight: '44px !important', lineHeight: '44px'},
  '& .MuiDataGrid-columnHeader': {bgcolor: 'background.default', borderBottom: 'none !important', '&:focus, &:focus-within': {outline: 'none'}},
  '& .MuiDataGrid-columnHeaderTitle': {fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'capitalize', letterSpacing: '0.04em'},
  '& .MuiDataGrid-row': {cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'}},
  '& .MuiDataGrid-cell': {borderBottom: '1px solid', borderColor: 'divider', '&:focus, &:focus-within': {outline: 'none'}, display: 'flex', alignItems: 'center', py: 0},
  '& .MuiDataGrid-footerContainer': {borderTop: '1px solid', borderColor: 'divider', minHeight: 52},
  '& .MuiDataGrid-virtualScroller': {bgcolor: 'background.paper'},
  '& .MuiTablePagination-root': {fontSize: '0.8rem'},
  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {fontSize: '0.75rem', color: 'text.secondary', fontWeight: 400},
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-web/app/pages/vendors/VendorList.tsx
git commit -m "feat: add VendorList page with DataGrid, search, and pagination"
```

---

## Task 10: VendorCreate page

**Files:**
- Create: `apps/client-web/app/pages/vendors/VendorCreate.tsx`

- [ ] **Step 1: Create VendorCreate**

Create `apps/client-web/app/pages/vendors/VendorCreate.tsx`:

```typescript
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useState} from 'react';
import {type ClientActionFunctionArgs, Navigation, useActionData, useNavigate, useNavigation} from 'react-router';
import {VendorForm} from './VendorForm';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';

export async function clientAction({request, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const payload = JSON.parse(raw);
    await vendorQueries.create(payload, token ?? '');
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.all()});
    return {success: true as const};
  } catch (err) {
    return {success: false as const, error: err instanceof Error ? err.message : 'Failed to create vendor'};
  }
}

export default function VendorCreate() {
  const navigate = useNavigate();
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [formDirty, setFormDirty] = useState(false);
  const handleDirtyChange = useCallback((dirty: boolean) => setFormDirty(dirty), []);

  if (actionData?.success) {
    navigate('/vendors');
  }

  return (
    <Box sx={{width: '100%'}}>
      <Breadcrumb
        items={[{label: 'Vendors', to: '/vendors'}, {label: 'New Vendor'}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting}
            onClick={() => document.getElementById('vendor-form-submit')?.click()}
            data-testid="vendor-submit-button"
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Create Vendor'}
          </Button>
        }
      />

      {actionData?.success && (
        <HideAfterDelay delay={3000}>
          <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{mb: 2}}>
            Vendor created successfully.
          </Alert>
        </HideAfterDelay>
      )}

      <Box sx={{maxWidth: 600}}>
        <VendorForm
          mode="create"
          isSubmitting={isSubmitting}
          serverError={actionData && !actionData.success ? actionData.error : null}
          onDirtyChange={handleDirtyChange}
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-web/app/pages/vendors/VendorCreate.tsx
git commit -m "feat: add VendorCreate page"
```

---

## Task 11: VendorDetail page

**Files:**
- Create: `apps/client-web/app/pages/vendors/VendorDetail.tsx`

- [ ] **Step 1: Create VendorDetail**

Create `apps/client-web/app/pages/vendors/VendorDetail.tsx`:

```typescript
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import {Breadcrumb} from 'components/Breadcrumb';
import {HideAfterDelay} from 'components/HideAfterDelay';
import {QueryErrorAlert} from 'components/QueryErrorAlert';
import {AUTH_KERNEL_CONTEXT} from 'core/middleware/routerContext';
import {queryClient} from 'core/queries/queryClient';
import {useCallback, useState} from 'react';
import {type ClientActionFunctionArgs, type ClientLoaderFunctionArgs, Navigation, useActionData, useNavigation, useParams} from 'react-router';
import {useVendor} from './hooks/useVendor';
import {VendorForm} from './VendorForm';
import {vendorQueries} from './queries/vendorQueries';
import {VENDOR_QUERY_KEYS} from './queries/vendorQueryKey';

export async function clientLoader({params, context}: ClientLoaderFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const id = params.id ?? '';

  await queryClient.ensureQueryData({
    queryKey: VENDOR_QUERY_KEYS.detail(id),
    queryFn: ({signal}) => vendorQueries.fetchById({id, signal, token: token ?? ''}),
  });

  return {id};
}

export async function clientAction({request, params, context}: ClientActionFunctionArgs) {
  const authKernel = context.get(AUTH_KERNEL_CONTEXT);
  const token = await authKernel.getValidToken();
  const id = params.id ?? '';

  const formData = await request.formData();
  const raw = formData.get('payload');
  if (typeof raw !== 'string') {
    return {success: false as const, error: 'Invalid form data'};
  }

  try {
    const payload = JSON.parse(raw);
    await vendorQueries.update(id, payload, token ?? '');
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.all()});
    await queryClient.invalidateQueries({queryKey: VENDOR_QUERY_KEYS.detail(id)});
    return {success: true as const};
  } catch (err) {
    return {success: false as const, error: err instanceof Error ? err.message : 'Failed to update vendor'};
  }
}

export default function VendorDetail() {
  const {id} = useParams<{id: string}>();
  const {data: vendor, isLoading, error} = useVendor(id ?? '');
  const actionData = useActionData<typeof clientAction>();
  const navigation: Navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [formDirty, setFormDirty] = useState(false);
  const handleDirtyChange = useCallback((dirty: boolean) => setFormDirty(dirty), []);

  if (isLoading) {
    return <Box sx={{display: 'flex', justifyContent: 'center', mt: 4}}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{width: '100%'}}>
      <QueryErrorAlert error={error instanceof Error ? error : null} />
      <Breadcrumb
        items={[{label: 'Vendors', to: '/vendors'}, {label: vendor?.name ?? id ?? ''}]}
        trailing={
          <Button
            variant="contained"
            size="small"
            disabled={isSubmitting || !formDirty}
            onClick={() => document.getElementById('vendor-form-submit')?.click()}
            data-testid="vendor-save-button"
            sx={{textTransform: 'none', boxShadow: 'none', '&:hover': {boxShadow: 'none'}}}
          >
            {isSubmitting ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      />

      {actionData?.success && (
        <HideAfterDelay delay={3000}>
          <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{mb: 2}}>
            Vendor updated successfully.
          </Alert>
        </HideAfterDelay>
      )}

      <Box sx={{maxWidth: 600}}>
        <VendorForm
          mode="edit"
          initialData={vendor}
          isSubmitting={isSubmitting}
          serverError={actionData && !actionData.success ? actionData.error : null}
          onDirtyChange={handleDirtyChange}
        />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client-web/app/pages/vendors/VendorDetail.tsx
git commit -m "feat: add VendorDetail page with inline edit"
```

---

## Task 12: Routes, navigation, and feature registry

**Files:**
- Modify: `apps/client-web/app/routes.tsx`
- Modify: `apps/client-web/app/components/Layout.tsx`
- Modify: `apps/client-web/app/core/config/featureRegistry.ts`

- [ ] **Step 1: Add vendor routes**

In `apps/client-web/app/routes.tsx`, add before the `user-settings` route:

```typescript
// Vendors
route('vendors', './pages/vendors/VendorList.tsx'),
route('vendors/create', './pages/vendors/VendorCreate.tsx'),
route('vendors/:id', './pages/vendors/VendorDetail.tsx'),
```

The protected routes section should look like:

```typescript
layout('./pages/ProtectedLayout.tsx', [
  layout('./components/Layout.tsx', [
    index('./app.tsx'),

    // Parts
    ...prefix('parts', [
      index('./pages/parts/PartList.tsx'),
      route(':partNumber', './pages/parts/PartDetail.tsx'),
    ]),

    // Admin
    route('locations', './pages/locations/LocationList.tsx'),
    route('locations/create', './pages/locations/LocationCreate.tsx'),
    route('locations/:id', './pages/locations/LocationDetail.tsx'),

    // Vendors
    route('vendors', './pages/vendors/VendorList.tsx'),
    route('vendors/create', './pages/vendors/VendorCreate.tsx'),
    route('vendors/:id', './pages/vendors/VendorDetail.tsx'),

    // User profile
    route('user-settings', './pages/UserSettings.tsx'),

    // Catch-all
    route('*', './pages/NotFound.tsx'),
  ]),
]),
```

- [ ] **Step 2: Add Vendors to the feature registry**

In `apps/client-web/app/core/config/featureRegistry.ts`, add after the `locations` feature entry:

```typescript
{
  id: 'vendors',
  nameKey: 'navigation:features.vendors.name',
  descriptionKey: 'navigation:features.vendors.description',
  route: '/vendors',
  category: 'admin',
  status: 'partial',
},
```

- [ ] **Step 3: Add Vendors nav item to the sidebar**

In `apps/client-web/app/components/Layout.tsx`, find the `admin` category in the `categories` array. It currently has items for locations, users, systemConfig, and integrations. Add a vendors item after locations:

```typescript
{
  key: 'admin',
  label: t('navigation:adminSettings'),
  icon: <BusinessIcon />,
  items: [
    {
      label: t('navigation:locations'),
      icon: <AddLocationAltIcon color="inherit" />,
      featureId: 'locations',
      route: '/locations',
    },
    {
      label: 'Vendors',          // <-- add this item
      icon: <LocalShippingIcon color="inherit" />,
      featureId: 'vendors',
      route: '/vendors',
    },
    {
      label: t('navigation:users'),
      icon: <BadgeIcon color="inherit" />,
      featureId: 'users',
      route: null,
    },
    // ... rest unchanged
  ],
},
```

`LocalShippingIcon` is already imported in `Layout.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/client-web/app/routes.tsx apps/client-web/app/components/Layout.tsx apps/client-web/app/core/config/featureRegistry.ts
git commit -m "feat: add vendor routes and sidebar navigation entry"
```

---

## Task 13: End-to-end smoke test

- [ ] **Step 1: Ensure all services are running**

```bash
npm run dev:full
```

Wait for the API and web servers to start (API on :3000, web on :3004).

- [ ] **Step 2: Test the vendor list**

Open `http://localhost:3004/vendors`.

Expected:
- Page loads without errors
- DataGrid shows 5 vendors from seed data (STAR-OFFICE, CLINCHTECH, GREENLIGHT, RELIABLE-FL, PRO-SERVICES)
- Search field filters the list
- "New Vendor" button navigates to `/vendors/create`

- [ ] **Step 3: Test creating a vendor**

Click "New Vendor". Fill in:
- Code: `TEST-VENDOR`
- Name: `Test Vendor Inc.`
- Terms: `Net 60`

Click "Create Vendor".

Expected:
- Redirects to `/vendors`
- New vendor appears in the list

- [ ] **Step 4: Test editing a vendor**

Click on the `TEST-VENDOR` row. Change the Name field. Click "Save Changes".

Expected:
- Success alert appears
- Breadcrumb title updates to the new name

- [ ] **Step 5: Test duplicate code rejection**

Go to `/vendors/create`. Enter code `STAR-OFFICE` (already exists). Submit.

Expected:
- Form shows error: `Vendor with code "STAR-OFFICE" already exists`

- [ ] **Step 6: Verify sidebar nav link**

In the sidebar, expand "Admin & Settings". Confirm "Vendors" link is present and navigates to `/vendors`.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete vendor management feature — list, create, edit end-to-end"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| GET /api/vendors (paginated, searchable) | Task 3, 4 |
| GET /api/vendors/:id | Task 3, 4 |
| POST /api/vendors with 409 on duplicate code | Task 3, 4 |
| PATCH /api/vendors/:id | Task 3, 4 |
| DbVendor in @ids/data-models | Task 1 |
| /vendors list with DataGrid, search | Task 9 |
| /vendors/create form | Task 10 |
| /vendors/:id detail + edit | Task 11 |
| Sidebar "Vendors" link | Task 12 |
| Seed data seeded on npm run db -- seed | Task 5 |
