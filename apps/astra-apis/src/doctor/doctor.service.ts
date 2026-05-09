import * as fs from 'node:fs';
import * as path from 'node:path';
import {Injectable, Logger} from '@nestjs/common';
import {
  ConsoleEventDto,
  NetworkEventDto,
  SnapshotDto,
  SyncPayloadDto,
} from './dto/sync-payload.dto';

type Finding = {
  id: string;
  ts: string;
  severity: 'high' | 'medium';
  pattern: 'token_race' | 'empty_location_id' | 'repeated_errors' | 'rejection_spike';
  url?: string;
  sessionId: string;
  userId: string;
  locationId: string;
  locationName: string;
};

const doctorDir = path.resolve(process.cwd(), '.doctor');
const sessionsDir = path.join(doctorDir, 'sessions');
const alertsFile = path.join(doctorDir, 'alerts.jsonl');
const snapshotFile = path.join(doctorDir, 'snapshot.json');

const maxRingBuffer = 50;

function ensureDirs(): void {
  for (const d of [doctorDir, sessionsDir]) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, {recursive: true});
    }
  }
}

function formatSessionEnd(sessionId: string): string {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${sessionId}-${h12.toString().padStart(2, '0')}-${m}${ampm}`;
}

function nowHuman(): string {
  return new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

@Injectable()
export class DoctorService {
  private readonly _logger = new Logger(DoctorService.name);
  private readonly _networkRing: NetworkEventDto[] = [];
  private readonly _consoleRing: ConsoleEventDto[] = [];
  private _currentSnapshot: SnapshotDto | null = null;

  constructor() {
    ensureDirs();
  }

  public sync(payload: SyncPayloadDto): {findings: Finding[]} {
    ensureDirs();

    for (const e of payload.networkEvents) {
      this._networkRing.push(e);
    }
    while (this._networkRing.length > maxRingBuffer) {
      this._networkRing.shift();
    }

    for (const e of payload.consoleEvents) {
      this._consoleRing.push(e);
    }
    while (this._consoleRing.length > maxRingBuffer) {
      this._consoleRing.shift();
    }

    this._currentSnapshot = payload.snapshot;

    const sessionWithEnd = formatSessionEnd(payload.sessionId);
    const networkFile = path.join(sessionsDir, `network_${sessionWithEnd}.jsonl`);
    const consoleFile = path.join(sessionsDir, `console_${sessionWithEnd}.jsonl`);

    const networkLines = payload.networkEvents.map((e) => JSON.stringify(e)).join('\n');
    const consoleLines = payload.consoleEvents.map((e) => JSON.stringify(e)).join('\n');

    if (networkLines) {
      fs.appendFileSync(networkFile, `${networkLines}\n`, 'utf8');
    }
    if (consoleLines) {
      fs.appendFileSync(consoleFile, `${consoleLines}\n`, 'utf8');
    }

    fs.writeFileSync(snapshotFile, JSON.stringify(payload.snapshot, null, 2), 'utf8');

    const findings = this._detectPatterns(
      payload.networkEvents,
      payload.consoleEvents,
      payload.sessionId,
    );

    const highFindings = findings.filter((f) => f.severity === 'high');
    if (highFindings.length > 0) {
      const lines = highFindings.map((f) => JSON.stringify(f)).join('\n');
      fs.appendFileSync(alertsFile, `${lines}\n`, 'utf8');
      this._logger.warn(`HIGH severity: ${highFindings.map((f) => f.pattern).join(', ')}`);
    }

    return {findings};
  }

  public getSnapshot(): object {
    return {
      snapshot: this._currentSnapshot,
      networkEvents: this._networkRing.slice(-20),
      consoleEvents: this._consoleRing.slice(-20),
    };
  }

  public writeSnapshot(snapshot: SnapshotDto): void {
    ensureDirs();
    this._currentSnapshot = snapshot;
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');
  }

  private _detectPatterns(
    networkEvents: NetworkEventDto[],
    consoleEvents: ConsoleEventDto[],
    sessionId: string,
  ): Finding[] {
    const findings: Finding[] = [];
    const ctx = networkEvents[0] ?? {userId: '', locationId: '', locationName: ''};

    for (let i = 0; i < networkEvents.length - 1; i++) {
      const a = networkEvents[i];
      const b = networkEvents[i + 1];
      if (a.status === 401 && b.status === 201 && a.url === b.url && b.ts - a.ts < 5000) {
        findings.push({
          id: `f_${Date.now()}_${i}`,
          ts: b.tsHuman,
          severity: 'high',
          pattern: 'token_race',
          url: b.url,
          sessionId,
          userId: ctx.userId,
          locationId: ctx.locationId,
          locationName: ctx.locationName,
        });
      }
    }

    for (const e of networkEvents) {
      if (
        e.method === 'POST' &&
        e.status === 201 &&
        (e.reqBody as Record<string, unknown>)?.['locationId'] === ''
      ) {
        findings.push({
          id: `f_${Date.now()}_loc`,
          ts: e.tsHuman,
          severity: 'high',
          pattern: 'empty_location_id',
          url: e.url,
          sessionId,
          userId: e.userId,
          locationId: e.locationId,
          locationName: e.locationName,
        });
      }
    }

    const errors = consoleEvents.filter((e) => e.level === 'error');
    if (errors.length >= 3) {
      findings.push({
        id: `f_${Date.now()}_err`,
        ts: nowHuman(),
        severity: 'medium',
        pattern: 'repeated_errors',
        sessionId,
        userId: ctx.userId,
        locationId: ctx.locationId,
        locationName: ctx.locationName,
      });
    }

    const rejections = consoleEvents.filter((e) => e.level === 'rejection');
    if (rejections.length >= 2 && rejections[rejections.length - 1].ts - rejections[0].ts < 10000) {
      findings.push({
        id: `f_${Date.now()}_rej`,
        ts: nowHuman(),
        severity: 'medium',
        pattern: 'rejection_spike',
        sessionId,
        userId: ctx.userId,
        locationId: ctx.locationId,
        locationName: ctx.locationName,
      });
    }

    return findings;
  }
}
