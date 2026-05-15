# User Management — Design Spec

**Date:** 2026-05-15  
**Branch:** `users-management`  
**Status:** Approved

---

## Overview

Build an admin-facing User Management module so operators can list, search, create, edit, and deactivate users. The backend user module already exists (CRUD, photo management, Logto sync); this feature adds a proper paginated list endpoint, Logto suspend on deactivation, and the full frontend UI.

---

## Scope

| What | In scope |
|---|---|
| User List page | ✅ |
| User Detail / Edit page | ✅ |
| User Create page | ✅ |
| Profile photo management (admin) | ✅ |
| Deactivate + Logto suspend | ✅ |
| Role management | ❌ (deferred) |
| Location filter on User List | ❌ (global location switcher in navbar handles this) |

---

## Architecture

### Backend — user module changes

**1. RavenDB index: `UsersSearch`**
- New static index in `apps/astra-apis/src/user/indexes/users-search.index.ts`
- Mirrors the existing `PartsSearch` index pattern
- Indexed fields: `displayName`, `email`, `username`, `isDeleted`
- Supports full-text search on name/email/username and boolean filter on `isDeleted`

**2. New DTOs**
- `UserListQueryDto` (`apps/astra-apis/src/user/dto/user-list.query.dto.ts`):
  - `page: number` (default 1)
  - `pageSize: number` (default 10)
  - `searchTerm?: string`
  - `isDeleted?: boolean` (undefined = all)
- `UserListResponseDto`: `{ items: UserResponseDto[], totalCount: number }`

**3. `UserService.findAll()` refactored**
- Accepts `UserListQueryDto`
- Queries via `UsersSearch` index with pagination and optional search/filter
- Returns `{ items, totalCount }`

**4. `GET /api/user` updated**
- Accepts query params: `page`, `pageSize`, `searchTerm`, `isDeleted`
- Replaces the current "return all" behaviour

**5. `LogtoManagementClient.suspendUser(userId: string)`**
- Calls `PATCH /api/users/:userId` with `{ isSuspended: true }` on the Logto Management API
- Called by `UserService.deleteUserProfile()` after soft-delete in RavenDB
- Best-effort: if Logto suspend fails, the soft-delete in RavenDB still commits; the error is logged

**6. Reactivation**
- New `UserService.restoreUserProfile(logtoUserId)`: sets `isDeleted = false`, calls Logto `{ isSuspended: false }`
- New `POST /api/user/:logtoUserId/restore` endpoint

---

### Frontend — new pages

**Routes registered in `apps/client-web/app/routes.tsx`:**
```
/users              → UserList
/users/create       → UserCreate
/users/:logtoUserId → UserDetail
```

**Navigation:** Add "Users" entry to the nav alongside "Locations".

---

## Component Design

### `UserList` (`apps/client-web/app/pages/users/UserList.tsx`)

- `clientLoader`: pre-fetches page 1, `isDeleted: false`, no search term into React Query cache
- DataGrid with server-side pagination, identical styling to `LocationList`
- Columns: Avatar, Name, Email, Username, Last Login, Profile % — clickable rows navigate to detail
- Toolbar:
  - Search input (debounced)
  - Active / Inactive / All toggle buttons
  - "Create User" button → `/users/create`
  - "Sync from Logto" button → `POST /api/user/sync/from-logto` → invalidate list query

### `UserCreate` (`apps/client-web/app/pages/users/UserCreate.tsx`)

- Fields: First Name, Last Name, Email (required), Password (required), Username (optional)
- `clientAction`: posts to `POST /api/user/register`
- On success → redirect to `/users`
- On 409 conflict → inline error on the Email field ("A user with this email already exists")
- Other errors → error banner

### `UserDetail` (`apps/client-web/app/pages/users/UserDetail.tsx`)

- `clientLoader`: pre-fetches `GET /api/user/:logtoUserId`
- Breadcrumb: Users → `<displayName || email>`
- **Read-only section** (Logto-managed): Email, Username — shown with "managed by Logto" hint
- **Editable section**: Display Name, Nickname, Bio, Timezone, Preferred Language
- **Notification preferences**: Email Notifications, SMS Notifications, Marketing Emails (toggles)
- **Profile photo section**: current photo or placeholder avatar; Upload button; Delete button
- `clientAction` (PATCH): saves editable fields; returns `{ success, error }`; success toast hidden after delay
- `UnsavedChangesDialog` guard on navigate-away with dirty form
- **Deactivate / Reactivate button** (bottom of page, destructive styling):
  - Opens confirmation dialog (mirrors `DeactivateDialog` from Locations)
  - On confirm: calls deactivate mutation (`DELETE /api/user/:id`) or restore mutation (`POST /api/user/:id/restore`)
  - Invalidates detail + list queries after success

---

## Data Flow

```
UserList
  clientLoader  →  GET /api/user?page=1&pageSize=10&isDeleted=false
  search/filter →  useQuery refetch with updated params
  Sync button   →  POST /api/user/sync/from-logto → invalidate list

UserCreate
  clientAction  →  POST /api/user/register
  success       →  redirect /users
  409 conflict  →  inline email field error

UserDetail
  clientLoader  →  GET /api/user/:logtoUserId
  save          →  PATCH /api/user/:logtoUserId → invalidate detail + list
  photo upload  →  POST /api/user/:logtoUserId/photo → invalidate detail
  photo delete  →  DELETE /api/user/:logtoUserId/photo → invalidate detail
  deactivate    →  DELETE /api/user/:logtoUserId (soft-delete + Logto suspend)
  reactivate    →  POST /api/user/:logtoUserId/restore (un-soft-delete + Logto unsuspend)
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| List fetch fails | `QueryErrorAlert` banner above the grid |
| Create: email conflict (409) | Inline error on Email field |
| Create: other error | Error banner below form |
| Detail save fails | `clientAction` returns `{ success: false, error }` → error banner |
| Photo upload: wrong type/size | API returns 400 → error banner |
| Logto suspend fails on deactivate | RavenDB soft-delete commits; Logto error logged; UI shows success |
| Navigate away with unsaved changes | `UnsavedChangesDialog` prompts confirmation |

---

## Seeding

Seed data already exists in `database/seeds/data/user.data.ts` (5 users: admin, alice, mike, sarah, tim). No new seed records required. After implementation, run:

```bash
npm run db -- seed
npm run db -- count
```

---

## Testing

- **Backend unit tests**:
  - `UserService.findAll()` with pagination, search, and `isDeleted` filter params (extends `user.service.test.ts`)
  - `LogtoManagementClient.suspendUser()` — mock fetch, assert correct endpoint + body
  - `UserController` — updated `GET /api/user` with query params (extends `user.controller.test.ts`)
- **Frontend**: no new test files; existing controller tests cover the updated endpoint signature

---

## Files to Create / Modify

### New files
| File | Purpose |
|---|---|
| `apps/astra-apis/src/user/indexes/users-search.index.ts` | RavenDB static index |
| `apps/astra-apis/src/user/dto/user-list.query.dto.ts` | Query + response DTOs |
| `apps/client-web/app/pages/users/UserList.tsx` | List page |
| `apps/client-web/app/pages/users/UserCreate.tsx` | Create page |
| `apps/client-web/app/pages/users/UserDetail.tsx` | Detail/edit page |
| `apps/client-web/app/pages/users/hooks/useUsers.ts` | List data hook |
| `apps/client-web/app/pages/users/hooks/useUser.ts` | Single user hook |
| `apps/client-web/app/pages/users/components/DeactivateDialog.tsx` | Confirm deactivate/reactivate dialog |
| `apps/client-web/app/pages/users/columns.tsx` | DataGrid column definitions |
| `apps/client-web/app/pages/users/schemas/userSchema.ts` | Zod validation schema for create form |

### Modified files
| File | Change |
|---|---|
| `apps/astra-apis/src/user/user.service.ts` | Refactor `findAll()`, add `restoreUserProfile()` |
| `apps/astra-apis/src/user/user.controller.ts` | Add query params to `GET /api/user`, add `POST /:id/restore` |
| `apps/astra-apis/src/user/logto-management.client.ts` | Add `suspendUser(userId)` and `unsuspendUser(userId)` |
| `apps/astra-apis/src/user/dto/user-response.dto.ts` | Expose `isDeleted` field (frontend needs it for deactivate/reactivate toggle) |
| `apps/client-web/app/pages/users/queries/userQueries.ts` | Add pagination params, `create`, `deactivate`, `restore` |
| `apps/client-web/app/pages/users/queries/userQueryKey.ts` | Add list key with params |
| `apps/client-web/app/pages/users/types/user.ts` | Add `isDeleted` to `UserProfile` type |
| `apps/client-web/app/routes.tsx` | Register `/users`, `/users/create`, `/users/:logtoUserId` |
| `apps/client-web/app/locales/en/users.json` | Add keys for create form and deactivate dialog |
| `apps/client-web/app/locales/fr/users.json` | Mirror EN additions |
| `apps/client-web/app/components/Layout.tsx` | Wire existing Users nav entry: change `route: null` → `route: '/users'` |
