# Vendor Management — Feature Design Spec

**Date:** 2026-05-14  
**Status:** Approved  
**Scope:** Full CRUD for Vendors (list, create, view/edit) — backend + frontend, end-to-end in 1 day.

---

## Why This Feature

Vendors are currently referenced (embedded as snapshots) in Parts, but there is no UI to manage them. Users cannot view the vendor catalog, add new vendors, or correct vendor details. This makes part creation awkward because vendor data can only be seeded or entered blind.

---

## Scope

**In scope:**
- `DbVendor` interface and related DTOs in `@ids/data-models`
- New `VendorModule` in NestJS (controller, service, RavenDB queries)
- RavenDB static index `Vendors/ByCode` for search
- 4 REST endpoints: list (GET), get one (GET), create (POST), update (PATCH)
- Frontend: vendor list page, create page, detail/edit page
- Sidebar navigation entry

**Out of scope (day 1):**
- Vendor contacts (addresses and telcoms are sufficient for day 1)
- Soft-delete / deactivation (referential integrity check needed; add in a follow-up)
- Vendor-to-part re-linking (parts already embed snapshots; snapshot sync is a separate feature)
- Vendor search from the Part create form (picker component, separate task)

---

## Data Model

### Shared (`libs/shared/data-models/src/lib/vendor/`)

```typescript
// vendor.interface.ts
export interface DbVendor extends IdsBaseEntity {
  code: string;           // short unique code, e.g. "STAR-OFFICE"
  name: string;           // display name
  terms?: string | null;  // payment terms, e.g. "Net 30"
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

### Backend entity (RavenDB document — no separate collection needed for addresses/telcoms day 1)

The `Vendor` document stored in RavenDB has:
```
{
  id: "vendors/xxx",
  code: "STAR-OFFICE",
  name: "Star Office Supply Co.",
  terms: "Net 30",
  createdBy: "user-id",
  updatedBy: "user-id",
  createdAt: "ISO8601",
  updatedAt: "ISO8601"
}
```

Addresses and telcoms from the seed data are not stored on the Vendor document for day 1. They can be added in a follow-up using the same pattern as Location (separate linked records). The seed runner will be updated to only seed the core Vendor fields.

---

## Backend

### Module structure

```
apps/astra-apis/src/vendor/
  vendor.module.ts
  vendor.controller.ts
  vendor.service.ts
  dto/
    vendor-create.dto.ts    (code, name, terms)
    vendor-update.dto.ts    (Partial of create)
    vendor-list.query.dto.ts (searchTerm, page, pageSize)
  entities/
    vendor.entity.ts        (RavenDB document shape)
  indexes/
    vendors-by-code.index.ts  (AbstractIndexCreationTask)
```

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vendors` | Paginated list; query params: `searchTerm`, `page`, `pageSize` |
| GET | `/api/vendors/:id` | Single vendor by RavenDB document ID |
| POST | `/api/vendors` | Create vendor; returns created document |
| PATCH | `/api/vendors/:id` | Partial update; returns updated document |

All endpoints protected by the existing `@Auth()` guard (JWT required).  
No location-scoping on vendors — vendors are global/shared across all locations (same pattern as in the seed data).

### RavenDB index

```typescript
// Vendors/ByCode — allows search by code or name
class VendorsByCodeIndex extends AbstractIndexCreationTask {
  map = "from vendor in docs.Vendors select new { vendor.code, vendor.name }";
}
```

### Error handling

- `POST /api/vendors` with a duplicate `code` → 409 Conflict (same pattern as Location)
- `GET/PATCH /api/vendors/:id` not found → 404 Not Found
- Validation errors → 400 Bad Request (class-validator)

---

## Frontend

### File structure

```
apps/client-web/app/pages/vendors/
  VendorList.tsx           (DataGrid, search bar, "New Vendor" button)
  VendorCreate.tsx         (form page)
  VendorDetail.tsx         (view + inline edit)
  VendorForm.tsx           (shared form component used by Create & Detail)
  columns.tsx              (DataGrid column definitions)
  hooks/
    useVendors.ts          (TanStack Query: list)
    useVendor.ts           (TanStack Query: single)
  queries/
    vendorQueries.ts       (axios fetch functions)
    vendorQueryKey.ts      (query key constants)
  schemas/
    vendorSchema.ts        (Valibot schema: code required, name required, terms optional)
  types/
    vendor.ts              (frontend type aliases from @ids/data-models)
```

### Pages

**`/vendors` — VendorList**
- MUI DataGrid with columns: Code, Name, Terms, Actions
- Search bar (debounced, filters by name or code)
- Pagination (server-side, matches Part/Location grid behavior)
- "New Vendor" button → navigates to `/vendors/create`
- Row click → navigates to `/vendors/:id`

**`/vendors/create` — VendorCreate**
- Form fields: Code (required), Name (required), Terms (optional free-text)
- Submit → POST `/api/vendors` → redirect to `/vendors/:id` on success
- Cancel → back to `/vendors`
- Follows `LocationCreate.tsx` structure exactly

**`/vendors/:id` — VendorDetail**
- Displays vendor details with an Edit mode toggle
- In edit mode: same form fields as Create, pre-populated
- Save → PATCH `/api/vendors/:id`
- Cancel → discard changes
- Follows `LocationDetail.tsx` structure exactly

### Routing

Add to `apps/client-web/app/routes.tsx`:
```tsx
{ path: '/vendors', element: <VendorList /> },
{ path: '/vendors/create', element: <VendorCreate /> },
{ path: '/vendors/:id', element: <VendorDetail /> },
```

### Navigation

Add "Vendors" entry to the sidebar nav (in `ProtectedLayout.tsx` or equivalent nav config file), grouped near Parts.

---

## Implementation Order

1. **Shared models** — add `DbVendor` interfaces + barrel export to `@ids/data-models` (~30 min)
2. **Backend** — entity, DTOs, service, controller, module, register in AppModule (~2 hrs)
3. **RavenDB index** — `VendorsByCode` index creation task (~20 min)
4. **Frontend queries** — `vendorQueries.ts`, query keys, hooks (~30 min)
5. **Frontend pages** — VendorList → VendorCreate → VendorDetail, columns, schema (~2.5 hrs)
6. **Navigation** — sidebar entry (~15 min)
7. **Seed data** — update vendor seed runner to only seed core fields (code, name, terms) (~20 min)
8. **Smoke test** — run seed, verify list/create/edit end-to-end (~20 min)

**Total estimated: ~6–7 hours**

---

## Template Files to Copy

| Copy from | Adapt to |
|---|---|
| `apps/astra-apis/src/location/location-db.service.ts` | `vendor.service.ts` |
| `apps/astra-apis/src/location/dto/location-create.dto.ts` | `dto/vendor-create.dto.ts` |
| `apps/astra-apis/src/location/dto/location-list.query.dto.ts` | `dto/vendor-list.query.dto.ts` |
| `apps/client-web/app/pages/locations/LocationList.tsx` | `VendorList.tsx` |
| `apps/client-web/app/pages/locations/LocationCreate.tsx` | `VendorCreate.tsx` |
| `apps/client-web/app/pages/locations/LocationDetail.tsx` | `VendorDetail.tsx` |
| `apps/client-web/app/pages/locations/LocationForm.tsx` | `VendorForm.tsx` (simpler — fewer fields) |
| `apps/client-web/app/pages/locations/queries/locationQueries.ts` | `queries/vendorQueries.ts` |

---

## Success Criteria

- [ ] `GET /api/vendors` returns paginated list of seeded vendors
- [ ] `POST /api/vendors` creates a new vendor, rejects duplicate codes with 409
- [ ] `PATCH /api/vendors/:id` updates vendor fields
- [ ] `/vendors` page shows DataGrid with search and pagination
- [ ] `/vendors/create` creates a vendor and redirects to detail
- [ ] `/vendors/:id` shows vendor details and supports editing
- [ ] Sidebar shows "Vendors" link
- [ ] `npm run db -- seed` completes without errors
