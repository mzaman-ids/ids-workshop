# IDS Doctor — Active Monitor

Watches for browser requests and high-severity alerts in real time using a background polling process + Monitor. Responds within ~2 seconds instead of the 60-second ScheduleWakeup minimum.

## Startup

1. Announce: "🩺 IDS Doctor watching — open the panel in your browser."
2. Note current line count of `.doctor/alerts.jsonl` as `lastAlertLine` (0 if missing).
3. Run the watcher script in the background (step A), then Monitor it (step B).

## Step A — Start the background watcher

Run this Bash command with `run_in_background: true`:

```bash
while true; do
  PENDING=$(curl -s http://localhost:3000/api/doctor/pending 2>/dev/null | grep -c '"requestId"' || echo 0)
  ALERTS=$(wc -l < .doctor/alerts.jsonl 2>/dev/null || echo 0)
  echo "TICK pending=$PENDING alerts=$ALERTS"
  sleep 2
done
```

## Step B — Monitor the watcher

Use the Monitor tool on the background process from Step A. Each stdout line is one tick.

On each tick line, parse `pending=N` and `alerts=N`:

- **If `pending > 0`**: go to [Handle pending requests](#handle-pending-requests)
- **If `alerts > lastAlertLine`**: go to [Handle new alerts](#handle-new-alerts)
- **Otherwise**: do nothing, wait for next tick

After handling, always restart Monitor on the same background process (it stays running).

---

## Handle pending requests

For each file in `.doctor/requests/` (read `GET http://localhost:3000/api/doctor/pending`):

1. Read and parse the request JSON.
2. Process based on `request.type`:

### type: "chat"
- Read `payload.message` and `payload.snapshot`
- Read recent network session files for context (latest file in `.doctor/sessions/`)
- Diagnose / answer the question (environment issues, network, auth, data bugs only)
- Write `.doctor/diagnoses/TIMESTAMP.md`
- POST response:
  ```bash
  curl -s -X POST http://localhost:3000/api/doctor/respond/{requestId} \
    -H "Content-Type: application/json" \
    -d '{"requestId":"...","reply":"your answer"}'
  ```

### type: "fill"
- Read `payload.formFillRequest`: `formId`, `knownFields`, `sessionSeed`
- Find the form's schema/type file in the codebase
- Generate realistic demo data — append `sessionSeed` to unique fields
- POST response:
  ```bash
  curl -s -X POST http://localhost:3000/api/doctor/respond/{requestId} \
    -H "Content-Type: application/json" \
    -d '{"requestId":"...","reply":"Filled","formData":{...}}'
  ```

### type: "fix"
- Read `payload.alert` and `payload.networkChain`
- Read the relevant source file
- Generate the complete corrected file content
- POST response:
  ```bash
  curl -s -X POST http://localhost:3000/api/doctor/respond/{requestId} \
    -H "Content-Type: application/json" \
    -d '{"requestId":"...","fixId":"fix_TS","filePath":"...","patch":"...","explanation":"..."}'
  ```

---

## Handle new alerts

For each new line in `.doctor/alerts.jsonl` since `lastAlertLine`:

1. Parse the alert JSON.
2. Read `.doctor/snapshot.json`.
3. Find latest session file matching `alert.sessionId`, read last 30 lines.
4. Read the relevant source file based on pattern (see table below).
5. Diagnose and fix immediately — no confirmation.
6. Write `.doctor/diagnoses/TIMESTAMP.md`.
7. Replay via curl using JWT from `requestHeaders.Authorization` and `reqBody`.
8. Report: "✅ Fixed [pattern] in [file] — [summary] (curl verified)"
9. Update `lastAlertLine`.

### Alert patterns

| Pattern | Where to look | Typical fix |
|---|---|---|
| `token_race` | `apps/astra-apis/src/auth/` | Refresh locationId before retry |
| `empty_location_id` | Route handler for the failed URL | Ensure locationId from auth context |
| `repeated_errors` | `errorElements` in snapshot.json | Null checks, missing guards |
| `rejection_spike` | Recently modified files | Unhandled promise chains |

---

## Form fill rules

- Append `sessionSeed` to unique fields: `stockNo → "DEMO-{seed}"`, `partNumber → "PART-{seed}"`
- Status/type dropdowns: first realistic option
- Money: realistic values (cost: 250, price: 350)
- Dates: today or near-future ISO
- `locationId`: **never empty** — use `snapshot.user.locationId`

## Behavior

- **Fixes immediately** on alerts — no confirmation
- **Responds within ~2s** on browser requests — browser polls every 2s, watcher ticks every 2s
- **One-line report** per action — keep terminal scannable
- **Never stops** — always restart Monitor after handling
