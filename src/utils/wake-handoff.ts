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
export type WakeRoutingSnapshot = { ready: boolean; active: boolean; navigationReady: boolean; route: WakeRoute; data: WakeRoutingData };
export type WakeRoutingStatus = { state: "checking" | "pending" | "clear" | "error" };
export type WakeTrigger = "tick" | "native" | "route" | "resume" | "retry";
export type WakeRoutingDependencies = {
  snapshot(): WakeRoutingSnapshot;
  read(data: WakeRoutingData): Promise<WakeCandidate[]>;
  navigate(target: WakeCandidate, replace: boolean): void;
  acknowledge?(target: WakeCandidate, reason: "completed" | "deleted"): Promise<void>;
  status(value: WakeRoutingStatus): void;
  log(event: string, id: string, reason: string): void;
};
const routeKey = (route: WakeRoute) => JSON.stringify([route.pathname, route.id, route.eventId, route.sessionId, route.preview, route.reminder]);
const candidateKey = (target: WakeCandidate) => `${target.sessionId}/${target.eventId}`;
const wakeScreen = (route: WakeRoute) => route.pathname === "/ringing" || route.pathname === "/challenge";

/** One owner for cold launch and foreground routing. Reads never acknowledge a
 * live handoff; navigation is admitted once until the route actually commits. */
export class WakeHandoffCoordinator {
  private reading = false;
  private again: WakeTrigger | undefined;
  private flight: { key: string; from: string } | undefined;
  private failed: { key: string; route: string } | undefined;
  private fallbackSeen = new Set<string>();
  private lastLog = "";
  constructor(private readonly deps: WakeRoutingDependencies) {}
  private log(event: string, id = "", reason = "") {
    const signature = `${event}/${id}/${reason}`;
    if (signature !== this.lastLog) this.deps.log(event, id, reason);
    this.lastLog = signature;
  }
  async check(trigger: WakeTrigger = "tick"): Promise<void> {
    if (this.reading) { if (!this.again || trigger !== "tick") this.again = trigger; return; }
    const before = this.deps.snapshot();
    if (!before.ready || !before.active) {
      this.log("navigation.deferred", "", !before.ready ? "hydration" : "inactive"); return;
    }
    this.reading = true;
    try {
      const candidates = await this.deps.read(before.data);
      const snapshot = this.deps.snapshot();
      if (!snapshot.ready || !snapshot.active) { this.log("navigation.deferred", "", "lifecycle_changed_during_read"); return; }
      const valid: WakeCandidate[] = [];
      let unknown = false;
      for (const target of candidates) {
        const deleted = !snapshot.data.alarms.some(a => a.id === target.id);
        const cancelled = snapshot.data.wakeHandoffCancellations?.includes(target.id);
        const completion = snapshot.data.wakeHandoffCompletions?.[target.id];
        const completed = completion?.sessionId === target.sessionId || completion?.pendingCleanup?.includes(target.sessionId);
        if (cancelled || completed) {
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
        const snoozed = snapshot.data.snoozed;
        const held = snoozed?.sessionId === target.sessionId && target.kind !== "snooze" && target.createdAt < snoozed.at;
        if (target.deferred || held) continue;
        if (!target.durable && this.fallbackSeen.has(candidateKey(target))) continue;
        valid.push(target);
      }
      // Keep each wake-up together; a delivered timeout/snooze supersedes the
      // original delivery for that session without replacing another alarm.
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
        this.flight = undefined;
        if (this.again) { this.log("navigation.deferred", "", "native_changed_during_read"); return; }
        this.deps.status({ state: unknown ? "error" : "clear" }); return;
      }
      this.deps.status({ state: "pending" });
      const key = candidateKey(target), current = routeKey(route);
      if (trigger === "resume" || trigger === "retry") this.flight = undefined;
      if (this.flight && this.flight.from !== current) this.flight = undefined;
      const sameSession = wakeScreen(route) && route.preview !== "1" && route.id === target.id && currentSession === target.sessionId;
      if (sameSession && (route.eventId === target.eventId || (!target.reminder && !!route.sessionId))) {
        this.flight = undefined;
        this.log("navigation.ignored", target.eventId, "already_presented"); return;
      }
      if (!snapshot.navigationReady) { this.log("navigation.deferred", target.eventId, "navigator_not_ready"); return; }
      if (this.flight?.key === key) { this.log("navigation.deferred", target.eventId, "awaiting_route_commit"); return; }
      if (this.failed?.key === key && this.failed.route === current && !["resume", "retry"].includes(trigger)) {
        this.deps.status({ state: "error" });
        this.log("navigation.deferred", target.eventId, "awaiting_resume_or_retry"); return;
      }
      this.flight = { key, from: current };
      try {
        this.deps.navigate(target, route.pathname === "/" || wakeScreen(route));
        if (!target.durable) this.fallbackSeen.add(key);
        this.failed = undefined;
        this.log("navigation.accepted", target.eventId, route.pathname === "/" ? "cold_launch" : "pending_wake_up");
      } catch {
        this.flight = undefined; this.failed = { key, route: current };
        this.deps.status({ state: "error" }); this.log("navigation.failed", target.eventId, "router_rejected");
      }
    } catch {
      this.deps.status({ state: "error" }); this.log("handoff.read.failed", "", "pending_preserved");
    } finally {
      this.reading = false;
      if (this.again) { const next = this.again; this.again = undefined; await this.check(next); }
    }
  }
}
