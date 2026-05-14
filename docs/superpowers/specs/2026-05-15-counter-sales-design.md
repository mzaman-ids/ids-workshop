# Counter Sales — Feature Design Spec

**Date:** 2026-05-15
**Status:** Approved
**Scope:** Full end-to-end Counter Sales (point-of-sale) workflow — create sale, add part lines, finalize — with inventory deduction. Backend + frontend, 4 days.

---

## Why This Feature

Counter Sales is the revenue-side of the parts department: a customer walks up, requests parts, and walks away with goods and a receipt. It is the first *transaction* feature in the system — the first time money changes hands. It consumes the Parts catalog in a real, tangible way (decrementing `totalOnHand`) and creates an audit trail of what was sold, to whom, at what price. Without Counter Sales the Parts inventory is a read-only catalog; with it the system becomes an operational tool.

---

## Scope

**In scope:**
- `DbCounterSale`, `DbSaleLine`, and related DTOs in `@ids/data-models`
- New `CounterSalesModule` in NestJS (controller, service, index, DTOs, entity)
- 4 REST endpoints: list, get one, create (open), finalize (status transition + inventory deduction)
- RavenDB static index `CounterSales/ByLocation`
- Frontend: sale list page, sale create page (line editor + customer field), sale detail/receipt page
- Sidebar navigation entry under **Parts Counter → Counter Sales**
- Seed data: 3–5 finalized sales per primary location

**Out of scope (follow-up):**
- Payment method tracking (cash, card, account — add in follow-up)
- Customer account lookup / AR integration
- Taxes per-line (flat tax rate applied to subtotal for day 1)
- Discounts and price overrides
- Returns / Cores (separate spec)
- Print / email receipt
- Partial fulfillment (back-order lines)

---

## Data Model

### Shared (`libs/shared/data-models/src/lib/counter-sale/`)

```typescript
// counter-sale.interface.ts
import type {Money} from '../money/money.interface';

export type SaleStatus = 'open' | 'finalized' | 'voided';

export interface DbSaleLine {
  lineNumber: number;
  partNumber: string;
  partDescriptionSnapshot: string;
  quantity: number;
  unitPrice: Money;       // pulled from part.listPrice at time of adding line
  lineTotal: Money;       // quantity × unitPrice, calculated
}

export interface DbCounterSale extends IdsBaseEntity {
  saleNumber: string;       // e.g. "CS-2026-0001"
  locationId: string;
  customerName: string;     // defaults to "Walk-in Customer" if blank
  status: SaleStatus;
  lines: DbSaleLine[];
  lineCount: number;
  subtotal: Money;          // sum of lineTotals
  taxRate: number;          // e.g. 0.13 for 13% HST — taken from location config or hardcoded 0 for now
  taxAmount: Money;         // subtotal × taxRate
  total: Money;             // subtotal + taxAmount
  notes?: string | null;
}

export interface DbCounterSaleListItem {
  id: string;
  saleNumber: string;
  locationId: string;
  customerName: string;
  status: SaleStatus;
  lineCount: number;
  total: Money;
  createdAt: string;
}

export interface DbCounterSaleListResponse {
  data: DbCounterSaleListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DbCounterSaleSearchCriteria {
  locationId: string;
  searchTerm?: string;
  status?: SaleStatus;
  page?: number;
  pageSize?: number;
}
```

### Backend RavenDB document shape

```json
{
  "id": "counter-sales/CS-2026-0001",
  "saleNumber": "CS-2026-0001",
  "locationId": "locations/LOC_AAA",
  "customerName": "Walk-in Customer",
  "status": "finalized",
  "lines": [
    {
      "lineNumber": 1,
      "partNumber": "OIL-FILTER-5W30",
      "partDescriptionSnapshot": "Oil Filter 5W30",
      "quantity": 2,
      "unitPrice": { "amount": 1299, "currency": "CAD" },
      "lineTotal": { "amount": 2598, "currency": "CAD" }
    }
  ],
  "lineCount": 1,
  "subtotal": { "amount": 2598, "currency": "CAD" },
  "taxRate": 0.13,
  "taxAmount": { "amount": 338, "currency": "CAD" },
  "total": { "amount": 2936, "currency": "CAD" },
  "notes": null,
  "createdBy": "user-id",
  "updatedBy": "user-id",
  "createdAt": "2026-05-15T14:00:00Z",
  "updatedAt": "2026-05-15T14:01:00Z",
  "isDeleted": false
}
```

---

## Backend

### Module structure

```
apps/astra-apis/src/counter-sales/
  counter-sales.module.ts
  counter-sales.controller.ts
  counter-sales.service.ts
  dto/
    sale-create.dto.ts           (customerName optional, lines[], notes optional)
    sale-line-create.dto.ts      (partNumber, quantity)
    sale-finalize.dto.ts         (no body — action endpoint)
    sale-list.query.dto.ts       (locationId required, searchTerm, status, page, pageSize)
    sale-detail.response.dto.ts
    sale-list.response.dto.ts
  entities/
    counter-sale.entity.ts
  indexes/
    counter-sales-by-location.index.ts
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/counter-sales` | Paginated list; query params: `locationId` (required), `searchTerm`, `status`, `page`, `pageSize` |
| GET | `/api/counter-sales/:id` | Single sale by document ID |
| POST | `/api/counter-sales` | Create sale in `open` status; lines include part lookup to snapshot description + price |
| POST | `/api/counter-sales/:id/finalize` | Transition `open → finalized`; decrements `part.totalOnHand` and `PartLocation.numOnHand` for each line |

All endpoints require JWT auth. List results are scoped to `locationId`.

### Sale number generation

Auto-generated: `CS-{YYYY}-{NNNN}` — same pattern as PO numbers, sequence per year.

### Part price lookup on create

When a line is added (`POST /api/counter-sales`), the service loads the Part record to:
1. Snapshot the current `description` into `partDescriptionSnapshot`
2. Use `part.listPrice` as `unitPrice` for the line

The price is snapshotted at creation time — subsequent price changes on the part do not affect existing open sales.

### Inventory deduction on finalize

```
for each line:
  load Part by parts/{line.partNumber}
  if part.totalOnHand < line.quantity → throw 400 InsufficientStock
  part.totalOnHand  -= line.quantity
  find PartLocation where locationId === sale.locationId
  if partLocation.numOnHand < line.quantity → throw 400 InsufficientStock (location level)
  partLocation.numOnHand -= line.quantity
  session.store(part)
session.saveChanges()
sale.status = 'finalized'
session.saveChanges()
```

Both Part updates and status change run in a single RavenDB session (atomic).

### Tax calculation

On create/finalize: `taxAmount = subtotal × taxRate`. For day 1, `taxRate` is hardcoded at `0` (tax-exempt / no tax configured) so `total === subtotal`. A follow-up can add location-level tax rate config.

### RavenDB index

```typescript
class CounterSalesByLocationIndex extends AbstractIndexCreationTask {
  map = `from sale in docs['counter-sales']
         select new {
           sale.locationId,
           sale.status,
           sale.saleNumber,
           sale.customerName
         }`;
}
```

### Error handling

| Scenario | Response |
|----------|----------|
| Finalize a non-open sale | 409 Conflict |
| Insufficient stock on finalize | 400 Bad Request with detail message |
| Part not found when adding line | 400 Bad Request |
| Empty lines array on create | 400 Bad Request |
| Sale not found | 404 Not Found |

---

## Frontend

### File structure

```
apps/client-web/app/pages/counter-sales/
  CounterSaleList.tsx          (DataGrid, status filter, "New Sale" button)
  CounterSaleCreate.tsx        (customer field + line editor + totals panel)
  CounterSaleDetail.tsx        (receipt view + Finalize button)
  SaleLineEditor.tsx           (inline line entry table — reuses PoLineEditor pattern)
  SaleTotalsPanel.tsx          (subtotal / tax / total summary card)
  columns.tsx
  hooks/
    useCounterSales.ts
    useCounterSale.ts
  queries/
    counterSaleQueries.ts
    counterSaleQueryKey.ts
  schemas/
    counterSaleSchema.ts       (Valibot: lines min 1, qty > 0, customerName optional)
  types/
    counterSale.ts
```

### Pages

**`/counter-sales` — CounterSaleList**
- MUI DataGrid: Sale Number, Customer, Status (chip), Lines, Total, Date
- Status filter chips: All / Open / Finalized / Voided
- Search bar (debounced, by sale number or customer name)
- "New Sale" button → `/counter-sales/create`
- Row click → `/counter-sales/:id`

**`/counter-sales/create` — CounterSaleCreate**
- **Customer field** (optional text input, placeholder "Walk-in Customer")
- **Line editor table** — same pattern as `PoLineEditor`:
  - Part Number (text input, on blur fetches part to auto-fill Description and Unit Price)
  - Description (auto-filled, read-only)
  - Qty (number input, min 1)
  - Unit Price (currency display, auto-filled from part.listPrice)
  - Line Total (calculated, read-only)
  - Add Row / Remove Row buttons
- **Totals panel** (right-aligned below table): Subtotal, Tax (0%), Total
- Submit → `POST /api/counter-sales` → redirect to `/counter-sales/:id`
- Cancel → back to list

**`/counter-sales/:id` — CounterSaleDetail**
- Header card: Sale Number, Customer, Location, Status chip, Date
- Lines table (read-only): Part Number, Description, Qty, Unit Price, Line Total
- Totals panel: Subtotal, Tax, Total
- Notes field (read-only)
- Action bar (conditional on status):
  - `open` → **Finalize Sale** button (calls `POST /:id/finalize`, invalidates query + part queries); shows confirmation dialog warning that inventory will be deducted
  - `finalized` → success banner "Sale finalized — inventory updated"
  - `voided` → warning banner

### Routing

```tsx
{ path: '/counter-sales', element: <CounterSaleList /> },
{ path: '/counter-sales/create', element: <CounterSaleCreate /> },
{ path: '/counter-sales/:id', element: <CounterSaleDetail /> },
```

Update `featureRegistry.ts`: add `counter-sales` feature entry with `route: '/counter-sales'`, status `'partial'`.
Update `Layout.tsx`: set `route: '/counter-sales'` on the Counter Sales nav item (currently `null`).

---

## Implementation Order

| Step | Task | Est. |
|------|------|------|
| 1 | Shared models — `DbCounterSale`, `DbSaleLine`, barrel export | 45 min |
| 2 | Backend entity + DTOs + sale number generator | 1 h |
| 3 | `CounterSalesService` — create (with part lookup + price snapshot), list, getOne, finalize (with stock guard + inventory deduction) | 2.5 h |
| 4 | `CounterSalesController` + module + register in AppModule | 45 min |
| 5 | RavenDB index `CounterSales/ByLocation` | 20 min |
| 6 | Frontend queries, query keys, hooks | 30 min |
| 7 | `CounterSaleList.tsx` + columns | 1 h |
| 8 | `SaleLineEditor.tsx` + `SaleTotalsPanel.tsx` sub-components | 1.5 h |
| 9 | `CounterSaleCreate.tsx` | 1.5 h |
| 10 | `CounterSaleDetail.tsx` (receipt view + finalize action + confirmation dialog) | 1 h |
| 11 | Schema (Valibot) + types | 30 min |
| 12 | Routing + sidebar nav + feature registry | 20 min |
| 13 | Seed data (3–5 finalized sales per location) | 30 min |
| 14 | Smoke test: create → add lines → finalize, verify part.totalOnHand decremented | 30 min |

**Total estimated: ~13 hours (~3 days focused, 4 days with buffer)**

---

## Template Files to Copy

| Copy from | Adapt to |
|---|---|
| `apps/astra-apis/src/purchase-order/purchase-order.service.ts` | `counter-sales.service.ts` (build PO first, or adapt location service) |
| `apps/client-web/app/pages/purchase-orders/PoLineEditor.tsx` | `SaleLineEditor.tsx` (same pattern, add unit price auto-fill) |
| `apps/client-web/app/pages/purchase-orders/PurchaseOrderList.tsx` | `CounterSaleList.tsx` |
| `apps/client-web/app/pages/purchase-orders/PurchaseOrderDetail.tsx` | `CounterSaleDetail.tsx` |
| `apps/client-web/app/pages/locations/queries/locationQueries.ts` | `queries/counterSaleQueries.ts` |

> Note: Counter Sales benefits from being built after Purchase Orders — `PoLineEditor` and `SaleLineEditor` share the same inline-table pattern.

---

## Success Criteria

- [ ] `GET /api/counter-sales?locationId=X` returns paginated list scoped to location
- [ ] `POST /api/counter-sales` creates a sale in `open` status; part description and unit price are auto-filled from Part record
- [ ] `POST /api/counter-sales/:id/finalize` transitions to `finalized`, decrements `part.totalOnHand` and `PartLocation.numOnHand`
- [ ] Finalizing with insufficient stock returns 400 with a descriptive message
- [ ] Finalizing an already-finalized sale returns 409
- [ ] `/counter-sales` page shows DataGrid with status filter and search
- [ ] `/counter-sales/create` allows entering customer name, adding lines by part number with auto-filled price, and saving
- [ ] `/counter-sales/:id` shows receipt-style view; Finalize button triggers confirmation dialog
- [ ] After finalize, Part list shows reduced on-hand quantity for affected parts
- [ ] Sidebar **Parts Counter → Counter Sales** link navigates to `/counter-sales`
- [ ] `npm run db -- seed` completes without errors including sale seed data
