type NetworkEvent = {
  id: string;
  sessionId: string;
  ts: number;
  tsHuman: string;
  method: string;
  url: string;
  status: number;
  requestHeaders: Record<string, string>;
  reqBody: unknown;
  resBody: unknown;
  durationMs: number;
  userId: string;
  locationId: string;
  locationName: string;
};

type ConsoleEvent = {
  id: string;
  sessionId: string;
  ts: number;
  tsHuman: string;
  level: 'error' | 'warn' | 'rejection';
  message: string;
  stack?: string;
};

type UserContext = {userId: string; locationId: string; locationName: string};

const doctorApiUrl = import.meta.env['VITE_DOCTOR_API_URL'] ?? 'http://localhost:3000';

function buildSessionId(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-CA');
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${date}_${h12.toString().padStart(2, '0')}-${m}${ampm}`;
}

function decodeJwtUserId(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as Record<string, unknown>;
    return (payload['sub'] as string) ?? '';
  } catch {
    return '';
  }
}

function toHuman(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function getUserContext(): UserContext {
  return (
    (window as Window & {__doctorContext?: UserContext}).__doctorContext ?? {
      userId: '',
      locationId: '',
      locationName: '',
    }
  );
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------

const DB_NAME = 'ids_doctor';
const DB_VERSION = 1;
let _db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_db) {
    return Promise.resolve(_db);
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('networkEvents', {keyPath: 'id'});
      req.result.createObjectStore('consoleEvents', {keyPath: 'id'});
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function storeEvent(store: string, event: NetworkEvent | ConsoleEvent): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Public API — used by DoctorPanel to read telemetry without HTTP
// ---------------------------------------------------------------------------

export async function getRecentNetworkEvents(limit = 20): Promise<NetworkEvent[]> {
  const all = await getAllFromStore<NetworkEvent>('networkEvents');
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export async function getRecentConsoleEvents(limit = 20): Promise<ConsoleEvent[]> {
  const all = await getAllFromStore<ConsoleEvent>('consoleEvents');
  return all.sort((a, b) => b.ts - a.ts).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Session state
// ---------------------------------------------------------------------------

const _currentSessionId = buildSessionId();
let _syncPending = false;

const _networkRing: NetworkEvent[] = [];
const maxRing = 50;

function pushRing(event: NetworkEvent): void {
  _networkRing.push(event);
  if (_networkRing.length > maxRing) {
    _networkRing.shift();
  }
}

function detectHighSeverity(event: NetworkEvent): boolean {
  const prev = _networkRing.at(-2);
  if (prev && prev.status === 401 && event.status === 201 && prev.url === event.url) {
    return true;
  }
  if (
    event.method === 'POST' &&
    event.status === 201 &&
    (event.reqBody as Record<string, unknown>)?.['locationId'] === ''
  ) {
    return true;
  }
  return false;
}

export async function syncToBackend(force = false): Promise<{findings: unknown[]}> {
  if (_syncPending && !force) {
    return {findings: []};
  }
  _syncPending = true;
  try {
    const [network, consoleEvents] = await Promise.all([
      getRecentNetworkEvents(maxRing),
      getRecentConsoleEvents(maxRing),
    ]);
    if (network.length === 0 && consoleEvents.length === 0) {
      return {findings: []};
    }
    const snapshot = captureSnapshot();
    const res = await fetch(`${doctorApiUrl}/api/doctor/sync`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        sessionId: _currentSessionId,
        networkEvents: network,
        consoleEvents,
        snapshot,
      }),
    });
    return (await res.json()) as {findings: unknown[]};
  } catch {
    return {findings: []};
  } finally {
    _syncPending = false;
  }
}

export function captureSnapshot(): object {
  const ctx = getUserContext();

  // Exclude the Doctor widget itself from all DOM reads
  const doctorRoot = document.getElementById('ids-doctor-root');

  const visibleText = [...document.body.children]
    .filter((el) => el !== doctorRoot)
    .map((el) => (el as HTMLElement).innerText ?? '')
    .join('\n')
    .slice(0, 2000);

  const errorElements = [...document.querySelectorAll('[role="alert"], .Mui-error, .error')]
    .filter((el) => !doctorRoot?.contains(el))
    .map((el) => el.textContent?.trim())
    .filter(Boolean);

  return {
    ts: toHuman(Date.now()),
    url: window.location.href,
    title: document.title,
    user: ctx.userId ? ctx : null,
    visibleText,
    errorElements,
    formState: [],
    recentFindings: [],
  };
}

let _eventCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}_${_currentSessionId}_${++_eventCounter}`;
}

// ---------------------------------------------------------------------------
// initialize — call once from entry.client.tsx
// ---------------------------------------------------------------------------

export function initialize(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    const isOwnApi = url.startsWith(doctorApiUrl) || url.startsWith('/api');
    const isDoctorEndpoint = url.includes('/api/doctor');

    if (!isOwnApi || isDoctorEndpoint) {
      return origFetch(input, init);
    }

    const start = Date.now();
    const res = await origFetch(input, init);
    const clone = res.clone();

    void clone
      .json()
      .catch(() => null)
      .then(async (resBody) => {
        const rawBody = init?.body;
        let reqBody: unknown = null;
        if (typeof rawBody === 'string') {
          try {
            reqBody = JSON.parse(rawBody);
          } catch {
            reqBody = rawBody;
          }
        }

        const headers = init?.headers ?? {};
        const headersRecord: Record<string, string> =
          headers instanceof Headers
            ? Object.fromEntries(headers.entries())
            : (headers as Record<string, string>);

        const authHeader = headersRecord['Authorization'] ?? headersRecord['authorization'] ?? '';
        const userId = authHeader.startsWith('Bearer ')
          ? decodeJwtUserId(authHeader.slice(7))
          : getUserContext().userId;

        const ctx = getUserContext();
        const event: NetworkEvent = {
          id: nextId('net'),
          sessionId: _currentSessionId,
          ts: start,
          tsHuman: toHuman(start),
          method: (init?.method ?? 'GET').toUpperCase(),
          url: url.replace(doctorApiUrl, ''),
          status: res.status,
          requestHeaders: headersRecord,
          reqBody,
          resBody,
          durationMs: Date.now() - start,
          userId,
          locationId: ctx.locationId,
          locationName: ctx.locationName,
        };

        pushRing(event);
        await storeEvent('networkEvents', event);

        if (detectHighSeverity(event)) {
          void syncToBackend(true);
        }
      });

    return res;
  };

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    const message = args
      .map((a) => String(a))
      .join(' ')
      .slice(0, 500);
    const event: ConsoleEvent = {
      id: nextId('con'),
      sessionId: _currentSessionId,
      ts: Date.now(),
      tsHuman: toHuman(Date.now()),
      level: 'error',
      message,
    };
    void storeEvent('consoleEvents', event);
  };

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const message = String(e.reason?.message ?? e.reason ?? 'Unhandled rejection').slice(0, 500);
    const stack = String(e.reason?.stack ?? '').slice(0, 500);
    const event: ConsoleEvent = {
      id: nextId('rej'),
      sessionId: _currentSessionId,
      ts: Date.now(),
      tsHuman: toHuman(Date.now()),
      level: 'rejection',
      message,
      stack: stack || undefined,
    };
    void storeEvent('consoleEvents', event);
  });

  (
    window as Window & {__doctorSync?: (force?: boolean) => Promise<{findings: unknown[]}>}
  ).__doctorSync = (force = true) => syncToBackend(force);

  (window as Window & {__doctorContext?: UserContext}).__doctorContext ??= {
    userId: '',
    locationId: '',
    locationName: '',
  };

  // Push a fresh DOM snapshot on every navigation — keeps .doctor/snapshot.json
  // current without requiring the user to open the panel
  const pushSnapshot = () => {
    const snapshot = captureSnapshot();
    void fetch(`${doctorApiUrl}/api/doctor/snapshot`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(snapshot),
    }).catch(() => undefined);
  };

  window.addEventListener('popstate', pushSnapshot);

  // React Router uses history.pushState — intercept to capture navigation snapshots
  const origPush = history.pushState.bind(history);
  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    origPush(...args);
    // Small delay so the new page content has rendered before we capture
    setTimeout(pushSnapshot, 300);
  };
}
