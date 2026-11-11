import { validateMystery, type GameplayKind, type Mission, type MysterySettings } from "./alarms";

/** Fisher–Yates; injection keeps randomness reproducible in tests. Never mutates settings. */
export function shuffled<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateMysterySequence(settings: MysterySettings, previous: readonly GameplayKind[] = [], random = Math.random): Mission[] {
  validateMystery(settings);
  const count = 2 + Math.floor(random() * (Math.min(4, settings.games.length) - 1));
  const games = shuffled(shuffled(settings.games, random).slice(0, count), random).map(m => ({ ...m }));
  // A bounded repair also works with a constant RNG; two distinct games always
  // offer another ordering. Never reroll a user's difficulty or round count.
  if (games.length === previous.length && games.every((m, i) => m.kind === previous[i]))
    [games[0], games[1]] = [games[1], games[0]];
  const ending: Mission[] = [{ kind: "supplication", difficulty: "gentle", duaIds: shuffled(settings.duaIds, random) }];
  if (settings.fajr) ending.splice(random() < .5 ? 0 : 1, 0, { kind: "fajr_reminder", difficulty: "gentle" });
  return [...games, ...ending];
}
