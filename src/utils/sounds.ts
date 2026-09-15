import { soundCatalog } from "@/data/sound-catalog";
export type BundledSoundId = typeof soundCatalog[number]["id"];
export type SoundId = "system" | BundledSoundId | "morning" | "forest" | "ocean" | "rain" | "chimes" | "night";
const legacy: Record<string, BundledSoundId> = { morning: "lofi", forest: "rooster", ocean: "wake_up", rain: "short_ring", chimes: "digital_beep", night: "lofi" };
export function resolveSoundId(id: SoundId): BundledSoundId | "system" { return legacy[id] ?? id as BundledSoundId | "system"; }
export const sounds = soundCatalog;
export const soundName = (id: SoundId) => sounds.find(s => s.id === resolveSoundId(id))?.name ?? "Device default";
export const soundFile = (id: SoundId) => sounds.find(s => s.id === resolveSoundId(id))?.nativeFile;
export const validSound = (id: string) => id === "system" || Object.hasOwn(legacy, id) || sounds.some(s => s.id === id);
