# Purchase Orders (Ordering) — Feature Design Spec

**Date:** 2026-05-15
**Status:** Approved
**Scope:** Full end-to-end Purchase Order workflow — create, confirm, receive — with inventory write-back. Backend + frontend, 4 days.

---

## Why This Feature

Parts inventory numbers are currently static seed data with no audit trail. Purchase Orders are how inventory legitimately enters the system. Building POs closes the supply chain input loop: a vendor is selected, parts and quantities are ordered, the PO is confirmed, and when goods arrive the receiving step increments `totalOnHand` on each Part. This feature depends on Vendor Management (in progress) and makes the Part inventory figures meaningful for the first time.

---

## Scope

**In scope:**
- `DbPurchaseOrder`, `DbPoLine`, and related DTOs in `@ids/data-models`
- New `PurchaseOrderModule` in NestJS (controller, service, index, DTOs, entity)
- 5 REST endpoints: list, get one, create, confirm (status transition), receive (status transition + inventory write-back)
- RavenDB static index `PurchaseOrders/ByLocation`
- Frontend: PO list page, PO create page (vendor picker + line editor), PO detail page (with Confirm and Receive actions)
- Sidebar navigation entry under **Inventory → Ordering**
- Seed data: 3–4 POs per primary location in various statuses

**Out of scope (follow-up):**
- Partial receiving (receive only some lines — all-or-nothing for day 1)
- PO amendment after confirmation (cancel + recreate pattern)
- Vendor price catalogue / cost lookup (user types cost manually)
- Email/print PO to vendor
- Backorder tracking across POs
- AP integration (accounts payable)

---

## Data Model

### Shared (`libs/shared/data-models/src/lib/purchase-order/`)

```typescript
// purchase-order.interface.ts
import type {Money} from '../money/money.interface';

export type PoStatus = 'draft' | 'confirmed' | 'received' | 'cancelled';

export interface DbPoLine {
  lineNumber: number;
  partNumber: string;
  partDescriptionSnapshot: string;
  quantity: number;
  unitCost: Money;
  totalCost: Money;        // quantity × unitCost, calculated on save
}

export interface DbPurchaseOrder extends IdsBaseEntity {
  poNumber: string;        // human-readable, e.g. "PO-2026-0001"
  locationId: string;
  vendorId: string;
  vendorSnapshot: { code: string; name: string };
  status: PoStatus;
  lines: DbPoLine[];
  lineCount: number;
  grandTotal: Money;       // sum of all line totalCost, calculated on save
  notes?: string | null;
}

export interface DbPurchaseOrderListItem {
  id: string;
  poNumber: string;
  locationId: string;
  vendorCode: string;
  vendorName: string;
  status: PoStatus;
  lineCount: number;
  grandTotal: Money;
  createdAt: string;
}

export interface DbPurchaseOrderListResponse {
  data: DbPurchaseOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DbPurchaseOrderSearchCriteria {
  locationId: string;
  searchTerm?: string;
  status?: PoStatus;
  page?: number;
  pageSize?: number;
}
```

### Backend RavenDB document shape

```json
{
  "id": "purchase-orders/PO-2026-0001",
  "poNumber": "PO-2026-0001",
  "locationId": "locations/LOC_AAA",
  "vendorId": "vendors/STAR-OFFICE",
  "vendorSnapshot": { "code": "STAR-OFFICE", "name": "Star Office Supply Co." },
  "status": "draft",
  "lines": [
    {
      "lineNumber": 1,
      "partNumber": "OIL-FILTER-5W30",
      "partDescriptionSnapshot": "Oil Filter 5W30",
      "quantity": 24,
      "unitCost": { "amount": 850, "currency": "CAD" },
      "totalCost": { "amount": 20400, "currency": "CAD" }
    }
  ],
  "lineCount": 1,
  "grandTotal": { "amount": 20400, "currency": "CAD" },
  "notes": null,
  "createdBy": "user-id",
  "updatedBy": "user-id",
  "createdAt": "2026-05-15T10:00:00Z",
  "updatedAt": "2026-05-15T10:00:00Z",
  "isDeleted": false
}
```

---

## Backend

### Module structure

```
apps/astra-apis/src/purchase-order/
  purchase-order.module.ts
  purchase-order.controller.ts
  purchase-order.service.ts
  dto/
    po-create.dto.ts          (vendorId, lines[], notes)
    po-line-create.dto.ts     (partNumber, quantity, unitCost)
    po-confirm.dto.ts         (no body — action endpoint)
    po-receive.dto.ts         (no body — action endpoint)
    po-list.query.dto.ts      (locationId required, searchTerm, status, page, pageSize)
    po-detail.response.dto.ts
    po-list.response.dto.ts
  entities/
    purchase-order.entity.ts
  indexes/
    purchase-orders-by-location.index.ts
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/purchase-orders` | Paginated list; query params: `locationId` (required), `searchTerm`, `status`, `page`, `pageSize` |
| GET | `/api/purchase-orders/:id` | Single PO by document ID |
| POST | `/api/purchase-orders` | Create PO in `draft` status |
| POST | `/api/purchase-orders/:id/confirm` | Transition `draft → confirmed`; increments `part.totalOnOrder` for each line |
| POST | `/api/purchase-orders/:id/receive` | Transition `confirmed → received`; decrements `part.totalOnOrder`, increments `part.totalOnHand` for each line at the PO's location |

All endpoints require JWT auth. `locationId` scopes list results — users see only POs for their active location.

### PO number generation

Auto-generated in service: `PO-{YYYY}-{NNNN}` where NNNN is zero-padded sequence per year. Use RavenDB's `HiLo` algorithm or a simple count query on startup. Format stored on the document for display.

### Inventory write-back (confirm + receive)

**On confirm:**
```
for each line:
  load Part by parts/{line.partNumber}
  part.totalOnOrder += line.quantity   (add to global rollup)
  session.store(part)
session.saveChanges()
```

**On receive:**
```
for each line:
  load Part by parts/{line.partNumber}
  part.totalOnOrder -= line.quantity
  part.totalOnHand  += line.quantity
  find PartLocation where locationId === po.locationId
  partLocation.numOnHand += line.quantity
  session.store(part)
session.saveChanges()
po.status = 'received'
session.saveChanges()
```

Both operations run in a single RavenDB session (atomic).

### RavenDB index

```typescript
// PurchaseOrders/ByLocation — supports list + search
class PurchaseOrdersByLocationIndex extends AbstractIndexCreationTask {
  map = `from po in docs['purchase-orders']
         select new {
           po.locationId,
           po.status,
           po.poNumber,
           po.vendorSnapshot.code,
           po.vendorSnapshot.name
         }`;
}
```

### Error handling

| Scenario | Response |
|----------|----------|
| Confirm a non-draft PO | 409 Conflict |
| Receive a non-confirmed PO | 409 Conflict |
| Part on a PO line not found | 400 Bad Request |
| Vendor not found on create | 400 Bad Request |
| PO not found | 404 Not Found |
| Empty lines array on create | 400 Bad Request |

---

## Frontend

### File structure

```
apps/client-web/app/pages/purchase-orders/
  PurchaseOrderList.tsx        (DataGrid, status filter chips, "New PO" button)
  PurchaseOrderCreate.tsx      (step-like form: select vendor → add lines → save)
  PurchaseOrderDetail.tsx      (view lines + Confirm / Receive action buttons)
  PoLineEditor.tsx             (sub-component: add/remove lines table)
  columns.tsx                  (DataGrid column definitions)
  hooks/
    usePurchaseOrders.ts       (TanStack Query: list)
    usePurchaseOrder.ts        (TanStack Query: single)
  queries/
    purchaseOrderQueries.ts
    purchaseOrderQueryKey.ts
  schemas/
    purchaseOrderSchema.ts     (Valibot: vendorId required, lines min 1, qty > 0, unitCost ≥ 0)
  types/
    purchaseOrder.ts
```

### Pages

**`/purchase-orders` — PurchaseOrderList**
- MUI DataGrid: PO Number, Vendor, Status (chip), Lines, Grand Total, Date
- Status filter: All / Draft / Confirmed / Received / Cancelled (MUI ToggleButtonGroup)
- Search bar (debounced, filters by PO number or vendor name via `searchTerm`)
- "New PO" button → `/purchase-orders/create`
- Row click → `/purchase-orders/:id`

**`/purchase-orders/create` — PurchaseOrderCreate**
- Section 1 — Header: Vendor picker (Autocomplete populated from `GET /api/vendors`), location display (read-only, taken from active location context), optional notes field
- Section 2 — Lines: inline table; each row has Part Number (text input), Description (auto-filled from `GET /api/parts/:partNumber` on blur), Qty (number), Unit Cost (currency input); Add Row / Remove Row buttons; running Grand Total shown below table
- Submit → `POST /api/purchase-orders` → redirect to `/purchase-orders/:id`
- Cancel → back to list

**`/purchase-orders/:id` — PurchaseOrderDetail**
- Header card: PO Number, Vendor, Location, Status chip, Created date, Notes
- Lines table (read-only): Part Number, Description, Qty, Unit Cost, Line Total
- Grand Total row at bottom
- Action bar (conditional on status):
  - `draft` → **Confirm PO** button (calls `POST /:id/confirm`, invalidates query)
  - `confirmed` → **Receive Goods** button (calls `POST /:id/receive`, invalidates query + part queries)
  - `received` / `cancelled` → no actions, informational banner

### Routing

```tsx
{ path: '/purchase-orders', element: <PurchaseOrderList /> },
{ path: '/purchase-orders/create', element: <PurchaseOrderCreate /> },
{ path: '/purchase-orders/:id', element: <PurchaseOrderDetail /> },
```

Update `featureRegistry.ts`: add `ordering` feature entry with `route: '/purchase-orders'`, status `'partial'`.
Update `Layout.tsx`: set `route: '/purchase-orders'` on the Ordering nav item (currently `null`).

---

## Implementation Order

| Step | Task | Est. |
|------|------|------|
| 1 | Shared models — `DbPurchaseOrder`, `DbPoLine`, barrel export | 45 min |
| 2 | Backend entity + DTOs + PO number generator utility | 1 h |
| 3 | `PurchaseOrderService` — create, list, getOne, confirm, receive (with inventory write-back) | 2.5 h |
| 4 | `PurchaseOrderController` + module + register in AppModule | 45 min |
| 5 | RavenDB index `PurchaseOrders/ByLocation` | 20 min |
| 6 | Frontend queries, query keys, hooks | 30 min |
| 7 | `PurchaseOrderList.tsx` + columns | 1 h |
| 8 | `PoLineEditor.tsx` sub-component | 1 h |
| 9 | `PurchaseOrderCreate.tsx` (vendor picker + line editor) | 1.5 h |
| 10 | `PurchaseOrderDetail.tsx` (view + action buttons) | 1 h |
| 11 | Schema (Valibot) + types | 30 min |
| 12 | Routing + sidebar nav + feature registry | 20 min |
| 13 | Seed data (3–4 POs per location, mixed statuses) | 30 min |
| 14 | Smoke test end-to-end (create → confirm → receive, verify part inventory changes) | 30 min |

**Total estimated: ~12 hours (~3 days focused, 4 days with buffer)**

---

## Template Files to Copy

| Copy from | Adapt to |
|---|---|
| `apps/astra-apis/src/location/location-db.service.ts` | `purchase-order.service.ts` |
| `apps/astra-apis/src/part/indexes/parts-search.index.ts` | `purchase-orders-by-location.index.ts` |
| `apps/client-web/app/pages/parts/PartList.tsx` | `PurchaseOrderList.tsx` |
| `apps/client-web/app/pages/locations/LocationCreate.tsx` | `PurchaseOrderCreate.tsx` (header section) |
| `apps/client-web/app/pages/locations/LocationDetail.tsx` | `PurchaseOrderDetail.tsx` |
| `apps/client-web/app/pages/locations/queries/locationQueries.ts` | `queries/purchaseOrderQueries.ts` |

---

## Success Criteria

- [ ] `GET /api/purchase-orders?locationId=X` returns paginated list scoped to location
- [ ] `POST /api/purchase-orders` creates PO in `draft` status with embedded lines and calculated totals
- [ ] `POST /api/purchase-orders/:id/confirm` transitions status to `confirmed` and increments `part.totalOnOrder` for each line
- [ ] `POST /api/purchase-orders/:id/receive` transitions status to `received`, decrements `part.totalOnOrder`, increments `part.totalOnHand`, and updates `PartLocation.numOnHand`
- [ ] Confirming a non-draft PO returns 409
- [ ] Receiving a non-confirmed PO returns 409
- [ ] `/purchase-orders` page shows DataGrid with status filter chips and search
- [ ] `/purchase-orders/create` allows vendor selection, adding multiple lines, and saving
- [ ] `/purchase-orders/:id` shows PO details and conditional Confirm / Receive buttons
- [ ] Sidebar **Inventory → Ordering** link navigates to `/purchase-orders`
- [ ] `npm run db -- seed` completes without errors including PO seed data
