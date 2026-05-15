# Stock Adjustments — Feature Design Spec

**Date:** 2026-05-15
**Status:** Approved
**Scope:** Full end-to-end Stock Adjustments workflow — create adjustment (add or remove inventory), immutable audit trail. Backend + frontend, 2 days.

---

## Why This Feature

Inventory counts are never perfectly accurate. Parts get damaged, miscounted, lost, or found. Right now there is no way to correct `totalOnHand` without running the seed script. Stock Adjustments gives parts managers a formal, audited mechanism to correct inventory levels with a reason code — the standard mechanism in every DMS for inventory variance management. Every dealership uses this daily.

This is also the simplest way to validate the inventory mutation pattern (write-back to Part) before building Purchase Orders and Counter Sales.

---

## Scope

**In scope:**
- `DbStockAdjustment` and related DTOs in `@ids/data-models`
- New `StockAdjustmentsModule` in NestJS (controller, service, index, DTOs, entity)
- 2 REST endpoints: list (GET), create (POST) — adjustments are immutable once created
- RavenDB static index `StockAdjustments/ByLocation`
- Frontend: adjustment list page, create adjustment page (part picker + reason + qty)
- Sidebar navigation entry under **Inventory → Stock Adjustments**
- Seed data: 2–3 adjustments per primary location

**Out of scope (follow-up):**
- Edit or reverse an adjustment (create a counter-adjustment instead — standard audit pattern)
- Cycle count workflow (multi-part batch counting session)
- Variance reports
- Approval workflow / dual-control

---

## Data Model

### Shared (`libs/shared/data-models/src/lib/stock-adjustment/`)

```typescript
// stock-adjustment.interface.ts

export type AdjustmentType = 'add' | 'remove';

export type AdjustmentReasonCode =
  | 'CYCLE_COUNT'    // physical count correction
  | 'DAMAGE'         // part damaged / written off
  | 'THEFT'          // stolen inventory
  | 'FOUND'          // previously unaccounted stock found
  | 'TRANSFER_IN'    // received from another location (informal)
  | 'TRANSFER_OUT'   // sent to another location (informal)
  | 'OTHER';         // free-text reason required when this is selected

export interface DbStockAdjustment extends IdsBaseEntity {
  adjustmentNumber: string;    // e.g. "ADJ-2026-0001"
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: AdjustmentType;
  quantity: number;            // always positive; direction encoded in `type`
  quantityDelta: number;       // signed: +quantity for 'add', -quantity for 'remove' — stored for query convenience
  reasonCode: AdjustmentReasonCode;
  notes?: string | null;       // required when reasonCode === 'OTHER'
  // IdsBaseEntity fields: createdAt, updatedAt, createdBy, updatedBy, isDeleted
  // Note: adjustments are effectively immutable — updatedAt === createdAt after creation
}

export interface DbStockAdjustmentListItem {
  id: string;
  adjustmentNumber: string;
  locationId: string;
  partNumber: string;
  partDescriptionSnapshot: string;
  type: AdjustmentType;
  quantity: number;
  reasonCode: AdjustmentReasonCode;
  createdAt: string;
  createdBy: string;
}

export interface DbStockAdjustmentListResponse {
  data: DbStockAdjustmentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DbStockAdjustmentSearchCriteria {
  locationId: string;
  partNumber?: string;       // filter by specific part
  searchTerm?: string;       // free-text search on part number or description
  type?: AdjustmentType;
  page?: number;
  pageSize?: number;
}
```

### Backend RavenDB document shape

```json
{
  "id": "stock-adjustments/ADJ-2026-0001",
  "adjustmentNumber": "ADJ-2026-0001",
  "locationId": "locations/LOC_AAA",
  "partNumber": "OIL-FILTER-5W30",
  "partDescriptionSnapshot": "Oil Filter 5W30",
  "type": "remove",
  "quantity": 3,
  "quantityDelta": -3,
  "reasonCode": "DAMAGE",
  "notes": "Water damage from storage leak",
  "createdBy": "user-id",
  "updatedBy": "user-id",
  "createdAt": "2026-05-15T09:00:00Z",
  "updatedAt": "2026-05-15T09:00:00Z",
  "isDeleted": false
}
```

---

## Backend

### Module structure

```
apps/astra-apis/src/stock-adjustments/
  stock-adjustments.module.ts
  stock-adjustments.controller.ts
  stock-adjustments.service.ts
  dto/
    adjustment-create.dto.ts      (partNumber, locationId, type, quantity, reasonCode, notes)
    adjustment-list.query.dto.ts  (locationId required, partNumber, searchTerm, type, page, pageSize)
    adjustment-detail.response.dto.ts
    adjustment-list.response.dto.ts
  entities/
    stock-adjustment.entity.ts
  indexes/
    stock-adjustments-by-location.index.ts
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stock-adjustments` | Paginated list; query params: `locationId` (required), `partNumber`, `searchTerm`, `type`, `page`, `pageSize` |
| POST | `/api/stock-adjustments` | Create adjustment; applies inventory delta to Part immediately |

No GET by ID, no PATCH, no DELETE — adjustments are immutable records. If you need to reverse one, create an opposing adjustment.

All endpoints require JWT auth. List scoped to `locationId`.

### Adjustment number generation

Auto-generated: `ADJ-{YYYY}-{NNNN}` — same sequence pattern as PO and Counter Sale numbers.

### Inventory write-back on create

```
load Part by parts/{dto.partNumber}
if not found → throw 404

snapshot part.description → partDescriptionSnapshot
delta = dto.type === 'add' ? +dto.quantity : -dto.quantity

// guard against negative inventory on remove
if delta < 0 && (part.totalOnHand + delta) < 0:
  throw 400 InsufficientStock

part.totalOnHand += delta

find PartLocation where locationId === dto.locationId
if not found → throw 400 (part not stocked at this location)
if delta < 0 && (partLocation.numOnHand + delta) < 0:
  throw 400 InsufficientStock (location level)
partLocation.numOnHand += delta

session.store(part)

create StockAdjustment document:
  quantityDelta = delta
  ... all other fields from dto + snapshot
session.store(adjustment)

session.saveChanges()   // atomic — both Part and Adjustment saved together
```

### Validation

- `quantity` must be a positive integer (> 0)
- `reasonCode === 'OTHER'` requires `notes` to be non-empty
- `type === 'remove'` with quantity that would push `totalOnHand` below 0 → 400 InsufficientStock

### RavenDB index

```typescript
class StockAdjustmentsByLocationIndex extends AbstractIndexCreationTask {
  map = `from adj in docs['stock-adjustments']
         select new {
           adj.locationId,
           adj.partNumber,
           adj.type,
           adj.reasonCode,
           adj.partDescriptionSnapshot
         }`;
}
```

### Error handling

| Scenario | Response |
|----------|----------|
| Part not found | 404 Not Found |
| Part not stocked at location | 400 Bad Request |
| Remove would make totalOnHand negative | 400 Bad Request with message |
| `reasonCode === 'OTHER'` with no notes | 400 Bad Request |
| quantity ≤ 0 | 400 Bad Request (class-validator) |

---

## Frontend

### File structure

```
apps/client-web/app/pages/stock-adjustments/
  StockAdjustmentList.tsx        (DataGrid, type filter chips, "New Adjustment" button)
  StockAdjustmentCreate.tsx      (form: part picker + type toggle + qty + reason + notes)
  columns.tsx
  hooks/
    useStockAdjustments.ts
  queries/
    stockAdjustmentQueries.ts
    stockAdjustmentQueryKey.ts
  schemas/
    stockAdjustmentSchema.ts     (Valibot: partNumber required, qty > 0, reasonCode required, notes required when OTHER)
  types/
    stockAdjustment.ts
```

No detail page — the list row IS the full record. If needed, a detail modal (not a page) can be added later.

### Pages

**`/stock-adjustments` — StockAdjustmentList**
- MUI DataGrid: Adjustment #, Part Number, Description, Type (chip: Add/Remove), Qty, Reason, Date, Adjusted By
- Type filter chips: All / Add / Remove
- Search bar (by part number or description)
- "New Adjustment" button → `/stock-adjustments/create`
- No row click (no detail page — record is fully visible in grid)
- Type chip: green for `add`, red for `remove`
- Quantity column: displays `+N` (green) or `−N` (red) using `quantityDelta`

**`/stock-adjustments/create` — StockAdjustmentCreate**
- **Part Number** field (text input; on blur fetches part to auto-fill Description — same pattern as sale line editor)
- **Description** (auto-filled, read-only)
- **Current On-Hand** (auto-filled from part + location data after part lookup, read-only — helps user see what they're adjusting from)
- **Type toggle**: Add / Remove (MUI ToggleButtonGroup, required)
- **Quantity** (number input, min 1)
- **Reason Code** (MUI Select dropdown — shows all `AdjustmentReasonCode` values with friendly labels)
- **Notes** (multi-line TextField; required and highlighted when Reason is `OTHER`, optional otherwise)
- **New On-Hand preview** (calculated: currentOnHand ± quantity, shown in real-time below the form so user can verify before submitting)
- Submit → `POST /api/stock-adjustments` → redirect to `/stock-adjustments` (list) with success snackbar
- Cancel → back to list

### Routing

```tsx
{ path: '/stock-adjustments', element: <StockAdjustmentList /> },
{ path: '/stock-adjustments/create', element: <StockAdjustmentCreate /> },
```

Update `featureRegistry.ts`: add `stock-adjustments` feature entry with `route: '/stock-adjustments'`, status `'partial'`.
Update `Layout.tsx`: set `route: '/stock-adjustments'` on the Stock Adjustments nav item (currently `null`).

### Reason code labels (i18n)

```
CYCLE_COUNT   → "Cycle Count"
DAMAGE        → "Damage / Write-off"
THEFT         → "Theft"
FOUND         → "Found / Unaccounted"
TRANSFER_IN   → "Transfer In"
TRANSFER_OUT  → "Transfer Out"
OTHER         → "Other (specify in notes)"
```

---

## Implementation Order

| Step | Task | Est. |
|------|------|------|
| 1 | Shared models — `DbStockAdjustment`, barrel export | 30 min |
| 2 | Backend entity + DTOs | 45 min |
| 3 | `StockAdjustmentsService` — create (with part lookup, inventory write-back, guards) + list | 1.5 h |
| 4 | `StockAdjustmentsController` + module + register in AppModule | 30 min |
| 5 | RavenDB index `StockAdjustments/ByLocation` | 20 min |
| 6 | Frontend queries, query keys, hooks | 30 min |
| 7 | `StockAdjustmentList.tsx` + columns (with signed qty formatting) | 1 h |
| 8 | `StockAdjustmentCreate.tsx` (part lookup + new-on-hand preview + reason conditional) | 1.5 h |
| 9 | Schema (Valibot) + types | 20 min |
| 10 | Routing + sidebar nav + feature registry | 20 min |
| 11 | Seed data (2–3 adjustments per location) | 20 min |
| 12 | Smoke test: create add + remove, verify part.totalOnHand updates, verify negative guard | 20 min |

**Total estimated: ~7.5 hours (~2 days)**

---

## Template Files to Copy

| Copy from | Adapt to |
|---|---|
| `apps/astra-apis/src/location/location-db.service.ts` | `stock-adjustments.service.ts` |
| `apps/client-web/app/pages/parts/PartList.tsx` | `StockAdjustmentList.tsx` (simpler — no row click) |
| `apps/client-web/app/pages/locations/LocationCreate.tsx` | `StockAdjustmentCreate.tsx` (single-form pattern) |
| `apps/client-web/app/pages/locations/queries/locationQueries.ts` | `queries/stockAdjustmentQueries.ts` |

---

## Success Criteria

- [ ] `GET /api/stock-adjustments?locationId=X` returns paginated list scoped to location
- [ ] `POST /api/stock-adjustments` with type `add` increments `part.totalOnHand` and `PartLocation.numOnHand`
- [ ] `POST /api/stock-adjustments` with type `remove` decrements both counts atomically
- [ ] Removing more than available stock returns 400 with a descriptive message
- [ ] `reasonCode === 'OTHER'` without notes returns 400
- [ ] Adjustment number is auto-generated (`ADJ-{YYYY}-{NNNN}`)
- [ ] `/stock-adjustments` page shows DataGrid with type filter chips; qty column shows `+N` / `−N` in green/red
- [ ] `/stock-adjustments/create` auto-fills part description and current on-hand after part number entry; shows new-on-hand preview before submit
- [ ] Notes field becomes required (highlighted) when reason is `OTHER`
- [ ] After creating an adjustment, Part list shows updated on-hand quantity
- [ ] Sidebar **Inventory → Stock Adjustments** link navigates to `/stock-adjustments`
- [ ] `npm run db -- seed` completes without errors including adjustment seed data
