import type { Simulation } from './simulation.js';
import { parseStrategicDecision, strategicMessages, type StrategicBrief } from './qwen-plan.js';

export type QwenStatus = 'off' | 'loading' | 'ready' | 'planning' | 'fallback';

type WorkerReply =
  | { type: 'status'; status: string }
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'plan'; id: number; answer: unknown; durationMs: number }
  | { type: 'plan-error'; id: number; message: string };
interface PendingPlan { id: number; game: Simulation; brief: StrategicBrief }

/**
 * Experimental browser-only adviser. The simulation never waits for the model.
 * Qwen selects from valid known sectors; TacticalAI retains final authority.
 */
export class QwenGeneral {
  enabled = false;
  status: QwenStatus = 'off';
  progress = 0;
  lastDecision: number | null = null;
  lastDurationMs: number | null = null;
  invalid = 0;
  lastError = '';
  onChange: () => void = () => {};
  private worker: Worker | null = null;
  private pending: PendingPlan | null = null;
  private serial = 0;
  private lastRequestAt = -Infinity;

  private update(status: QwenStatus): void { this.status = status; this.onChange(); }
  private fail(message: string): void {
    this.worker?.terminate(); this.worker = null; this.pending = null;
    this.enabled = false; this.lastError = message;
    this.update('fallback');
  }
  enable(): void {
    if (this.enabled) return;
    this.disable();
    if (!('gpu' in navigator) || !window.isSecureContext) {
      this.fail('WebGPU benötigt einen unterstützten Browser und HTTPS (localhost ist erlaubt).');
      return;
    }
    try {
      const worker = new Worker(new URL('./qwen-general.worker.js', import.meta.url), { type: 'module' });
      this.worker = worker;
      this.enabled = true;
      worker.onmessage = (event: MessageEvent<WorkerReply>) => this.receive(event.data);
      worker.onerror = () => this.fail('Der Qwen-Web-Worker konnte nicht gestartet werden.');
      worker.onmessageerror = () => this.fail('Ungültige Nachricht vom Qwen-Web-Worker.');
      this.update('loading');
      worker.postMessage({ type: 'init' });
    } catch (error) {
      this.fail(String(error instanceof Error ? error.message : error));
    }
  }
  disable(): void {
    this.worker?.terminate(); this.worker = null; this.pending = null;
    this.enabled = false; this.progress = 0; this.lastRequestAt = -Infinity;
    this.update('off');
  }
  resetCampaign(): void {
    this.lastRequestAt = -Infinity;
    this.lastDecision = null;
    // Any pending plan still refers to the old Simulation object and is ignored on reply.
  }
  maybePlan(game: Simulation): void {
    if (!this.enabled || this.status !== 'ready' || this.pending
      || game.paused || game.status !== 'playing' || game.time - this.lastRequestAt < 30) return;
    const brief = game.tactical.strategicBrief();
    if (!brief || brief.options.length < 2 || brief.phase === 'attack' || brief.phase === 'defend') return;
    const id = ++this.serial;
    this.pending = { id, game, brief };
    this.lastRequestAt = game.time;
    this.update('planning');
    this.worker?.postMessage({ type: 'plan', id, messages: strategicMessages(brief) });
  }
  private receive(message: WorkerReply): void {
    if (!this.enabled || !message || typeof message !== 'object') return;
    if (message.type === 'progress') {
      this.progress = Math.round(message.progress);
      this.onChange(); return;
    }
    if (message.type === 'ready') { this.update('ready'); return; }
    if (message.type === 'error') { this.fail(message.message); return; }
    if (message.type !== 'plan' && message.type !== 'plan-error') return;
    const pending = this.pending;
    if (!pending || message.id !== pending.id) return;
    this.pending = null;
    if (message.type === 'plan-error') {
      this.lastError = message.message;
      this.invalid++;
      this.update('ready');
      return;
    }
    this.lastDurationMs = message.durationMs;
    const choice = parseStrategicDecision(message.answer, pending.brief);
    const game = pending.game;
    const stillCurrent = game.status === 'playing' && !game.paused
      && game.time >= pending.brief.time && game.time - pending.brief.time <= 35
      && game.tactical.strategicBrief()?.time !== undefined;
    if (stillCurrent && choice && game.tactical.preferSector(choice.sectorId)) {
      this.lastDecision = choice.sectorId;
      this.lastError = '';
    } else if (stillCurrent) {
      this.invalid++;
      this.lastError = 'Ungültiger oder zu riskanter Sektor; klassische KI bleibt aktiv.';
    }
    this.update('ready');
  }
  description(): string {
    switch (this.status) {
      case 'off': return 'Aus: klassische Gegner-KI. Kein Modelldownload.';
      case 'loading': return `Qwen3-0.6B wird geladen (${this.progress} % der letzten Datei). Das Spiel läuft weiter.`;
      case 'planning': return 'Qwen bewertet bekannte Angriffsziele. Das Spiel läuft weiter.';
      case 'fallback': return `Klassische KI aktiv: ${this.lastError}`;
      case 'ready': return `Qwen bereit · letztes Ziel: ${this.lastDecision === null ? '—' : this.lastDecision + 1} · letzte Inferenz: ${this.lastDurationMs === null ? '—' : this.lastDurationMs + ' ms'} · verworfen: ${this.invalid}`;
    }
  }
}
