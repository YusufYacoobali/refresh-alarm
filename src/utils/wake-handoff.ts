import type { Alarm } from "./alarms";
import type { SnoozedWake, WakeSession } from "./wake-session";

export type NativeWakeHandoff = {
  alarmId: string; occurrenceId: string; registrationId: string; sessionId: string;
  scheduledAt: number; createdAt: number; kind: "scheduled" | "snooze" | "timeout";
  source: "stop" | "alerting" | "legacy"; deferred: boolean;
};
export type WakeCandidate = {
  id: string; eventId: string; sessionId: string; createdAt: number;
  reminder?: "1"; kind?: NativeWakeHandoff["kind"]; deferred?: boolean;
  /** Native pending evidence stays authoritative until explicitly acknowledged. */
  durable: boolean; native?: boolean;
};
export type WakeRoute = { pathname: string; id?: string; eventId?: string; sessionId?: string; preview?: string; reminder?: string };
export type WakeRoutingData = {
  alarms: Alarm[]; snoozed?: SnoozedWake; wakeSessions?: Record<string, WakeSession>;
  wakeHandoffCompletions?: Record<string, { sessionId: string; completedAt: number; pendingCleanup?: string[] }>;
  wakeHandoffCancellations?: string[];
};
export type WakeRoutingSnapshot = { ready: boolean; active: boolean; navigationReady: boolean; foreground?: boolean; route: WakeRoute; data: WakeRoutingData };
export type WakeRoutingStatus = {
  state: "checking" | "pending" | "clear" | "error";
  reason?: "read_failed" | "alarm_missing" | "navigation_rejected" | "navigation_commit_timeout";
  target?: WakeCandidate;
};
export type WakeTrigger = "tick" | "native" | "route" | "resume" | "retry";
export type WakeRoutingDependencies = {
  snapshot(): WakeRoutingSnapshot;
  read(data: WakeRoutingData): Promise<WakeCandidate[]>;
  navigate(target: WakeCandidate, replace: boolean): void;
  acknowledge?(target: WakeCandidate, reason: "completed" | "deleted"): Promise<void>;
  status(value: WakeRoutingStatus): void;
  log(event: string, id: string, reason: string): void;
  now?(): number;
  schedule?(callback: () => void, delayMs: number): () => void;
};
const candidateKey = (target: WakeCandidate) => JSON.stringify([target.id, target.sessionId, target.eventId]);
const wakeScreen = (route: WakeRoute) => route.pathname === "/ringing" || route.pathname === "/challenge";
export const NAVIGATION_COMMIT_LIMIT_MS = 5000;
type Request = { key: string; target: WakeCandidate; expected: WakeRoute; startedAt: number };
type Flight = Request & { remainingMs: number; activeSince?: number };
type Failure = Request & { reason: "navigation_rejected" | "navigation_commit_timeout" };
const completed = (data: WakeRoutingData, target: WakeCandidate) => {
  const marker = data.wakeHandoffCompletions?.[target.id];
  return marker?.sessionId === target.sessionId || marker?.pendingCleanup?.includes(target.sessionId);
};
const held = (data: WakeRoutingData, target: WakeCandidate) =>
  data.snoozed?.sessionId === target.sessionId && target.kind !== "snooze" && target.createdAt < data.snoozed.at;
const matches = (route: WakeRoute, expected: WakeRoute) => route.pathname === expected.pathname && route.preview !== "1" &&
  route.id === expected.id && route.sessionId === expected.sessionId && route.eventId === expected.eventId && route.reminder === expected.reminder;

/** One owner for cold launch and foreground routing. Native evidence is never
 * consumed by navigation. Only a matching route confirms a navigation request. */
export class WakeHandoffCoordinator {
  private reading = false;
  private again: WakeTrigger | undefined;
  private flight: Flight | undefined;
  private failed: Failure | undefined;
  private cancelTimer: (() => void) | undefined;
  private fallbackSeen = new Set<string>();
  private lastLog = "";
  constructor(private readonly deps: WakeRoutingDependencies) {}
  private now() { return this.deps.now?.() ?? globalThis.performance.now(); }
  private log(event: string, id = "", reason = "") {
    const signature = `${event}/${id}/${reason}`;
    if (signature !== this.lastLog) this.deps.log(event, id, reason);
    this.lastLog = signature;
  }
  private resetFlight() { this.cancelTimer?.(); this.cancelTimer = undefined; this.flight = undefined; }
  private reportFailure() {
    if (this.failed) this.deps.status({ state: "error", reason: this.failed.reason, target: this.failed.target });
  }
  /** Synchronous route/lifecycle observation also runs from the watchdog, so a
   * stalled native read cannot keep a silently rejected navigation pending. */
  observe(): void {
    const snapshot = this.deps.snapshot(), request = this.flight ?? this.failed;
    if (!request) return;
    if (snapshot.ready) {
      const missing = !snapshot.data.alarms.some(a => a.id === request.target.id);
      if (missing || completed(snapshot.data, request.target) || snapshot.data.wakeHandoffCancellations?.includes(request.target.id) || held(snapshot.data, request.target)) {
        this.resetFlight(); this.failed = undefined;
        this.deps.status({ state: missing && !snapshot.data.wakeHandoffCancellations?.includes(request.target.id) ? "error" : "clear", ...(missing ? { reason: "alarm_missing" as const } : {}) });
        return;
      }
      if (matches(snapshot.route, request.expected)) {
        this.resetFlight(); this.failed = undefined;
        if (!request.target.durable) this.fallbackSeen.add(request.key);
        this.deps.status({ state: "pending" });
        this.log("navigation.accepted", request.target.eventId, "route_committed"); return;
      }
    }
    const flight = this.flight;
    if (!flight) return;
    const now = this.now();
    if (!snapshot.ready || !snapshot.active || snapshot.foreground === false) {
      if (flight.activeSince !== undefined) flight.remainingMs = Math.max(0, flight.remainingMs - (now - flight.activeSince));
      flight.activeSince = undefined;
      this.cancelTimer?.(); this.cancelTimer = undefined; return;
    }
    flight.activeSince ??= now;
    const remaining = flight.remainingMs - (now - flight.activeSince);
    if (remaining <= 0) {
      this.failed = { ...flight, reason: "navigation_commit_timeout" };
      this.resetFlight(); this.reportFailure();
      this.log("navigation.failed", flight.target.eventId, "route_commit_timeout"); return;
    }
    if (!this.cancelTimer) {
      const callback = () => { this.cancelTimer = undefined; this.observe(); };
      if (this.deps.schedule) this.cancelTimer = this.deps.schedule(callback, Math.ceil(remaining));
      else { const timer = setTimeout(callback, Math.ceil(remaining)); this.cancelTimer = () => clearTimeout(timer); }
    }
  }
  dispose(): void { this.resetFlight(); this.failed = undefined; }
  async check(trigger: WakeTrigger = "tick"): Promise<void> {
    this.observe();
    if (this.reading) {
      // A native callback/poll arriving during the lookup must not discard the
      // user's explicit retry in favor of another guarded background check.
      if (trigger === "retry" || !this.again || (this.again !== "retry" && trigger !== "tick")) this.again = trigger;
      return;
    }
    const before = this.deps.snapshot();
    if (!before.ready || !before.active) {
      this.log("navigation.deferred", "", !before.ready ? "hydration" : "inactive"); return;
    }
    this.reading = true;
    try {
      const candidates = await this.deps.read(before.data);
      const snapshot = this.deps.snapshot();
      if (!snapshot.ready || !snapshot.active) { this.observe(); this.log("navigation.deferred", "", "lifecycle_changed_during_read"); return; }
      const valid: WakeCandidate[] = [];
      let unknown = false;
      for (const target of candidates) {
        const deleted = !snapshot.data.alarms.some(a => a.id === target.id);
        const cancelled = snapshot.data.wakeHandoffCancellations?.includes(target.id);
        if (cancelled || completed(snapshot.data, target)) {
          if (target.native) {
            try { await this.deps.acknowledge?.(target, cancelled ? "deleted" : "completed"); }
            catch { this.log("cleanup.deferred", target.eventId, "native_write_failed"); }
          }
          continue;
        }
        if (deleted) {
          if (target.durable) { unknown = true; this.log("navigation.deferred", target.eventId, "alarm_not_in_saved_data"); }
          continue;
        }
        if (target.deferred || held(snapshot.data, target)) continue;
        if (!target.durable && this.fallbackSeen.has(candidateKey(target))) continue;
        valid.push(target);
      }
      // Keep each wake-up together; delivered timeouts/snoozes supersede the
      // original delivery without replacing another alarm's pending evidence.
      const groups = new Map<string, { first: number; target: WakeCandidate }>();
      for (const target of valid) {
        const group = groups.get(target.sessionId);
        if (!group) groups.set(target.sessionId, { first: target.createdAt, target });
        else if (target.createdAt > group.target.createdAt || (target.createdAt === group.target.createdAt && target.reminder === "1")) group.target = target;
      }
      const route = snapshot.route;
      const currentSession = route.sessionId ?? (route.id ? snapshot.data.wakeSessions?.[route.id]?.id : undefined);
      const target = (wakeScreen(route) && route.preview !== "1" && currentSession ? groups.get(currentSession)?.target : undefined) ??
        [...groups.values()].sort((a, b) => a.first - b.first)[0]?.target;
      if (!target) {
        this.resetFlight(); this.failed = undefined;
        if (this.again) { this.log("navigation.deferred", "", "native_changed_during_read"); return; }
        this.deps.status({ state: unknown ? "error" : "clear", ...(unknown ? { reason: "alarm_missing" as const } : {}) }); return;
      }
      const key = candidateKey(target);
      if (this.flight && this.flight.key !== key) this.resetFlight();
      if (this.failed && this.failed.key !== key) this.failed = undefined;
      const sameSession = wakeScreen(route) && route.preview !== "1" && route.id === target.id && currentSession === target.sessionId;
      const request = this.flight ?? this.failed;
      const presented = request ? matches(route, request.expected) ||
        (route.pathname === "/challenge" && sameSession && route.sessionId === target.sessionId && route.eventId === target.eventId) :
        sameSession && (route.eventId === target.eventId || (!target.reminder && !!route.sessionId));
      if (presented) {
        this.resetFlight(); this.failed = undefined;
        if (!target.durable) this.fallbackSeen.add(key);
        this.deps.status({ state: "pending" });
        this.log("navigation.ignored", target.eventId, "already_presented"); return;
      }
      if (this.failed && (trigger !== "retry" || !snapshot.navigationReady)) {
        this.reportFailure(); this.log("navigation.deferred", target.eventId, "awaiting_explicit_retry"); return;
      }
      this.deps.status({ state: "pending" });
      if (!snapshot.navigationReady) { this.log("navigation.deferred", target.eventId, "navigator_not_ready"); return; }
      if (this.flight) { this.observe(); this.log("navigation.deferred", target.eventId, "awaiting_route_commit"); return; }
      this.failed = undefined;
      const nextRequest: Flight = { key, target, expected: { pathname: "/ringing", id: target.id, sessionId: target.sessionId, eventId: target.eventId, reminder: target.reminder },
        startedAt: this.now(), remainingMs: NAVIGATION_COMMIT_LIMIT_MS };
      this.flight = nextRequest;
      this.observe();
      try {
        this.deps.navigate(target, trigger === "retry" || route.pathname === "/" || wakeScreen(route));
        this.log("navigation.requested", target.eventId, trigger === "retry" ? "explicit_retry" : "pending_wake_up");
        this.observe();
      } catch {
        this.resetFlight(); this.failed = { ...nextRequest, reason: "navigation_rejected" };
        this.reportFailure(); this.log("navigation.failed", target.eventId, "router_rejected");
      }
    } catch {
      if (this.failed) this.reportFailure();
      else if (this.deps.snapshot().ready) this.deps.status({ state: "error", reason: "read_failed" });
      this.log("handoff.read.failed", "", "pending_preserved");
    } finally {
      this.reading = false;
      if (this.again) { const next = this.again; this.again = undefined; await this.check(next); }
    }
  }
}
