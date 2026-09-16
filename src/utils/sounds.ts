import { soundCatalog } from "@/data/sound-catalog";
export type BundledSoundId = typeof soundCatalog[number]["id"];
export type CustomSoundId = `custom:${string}`;
export type CustomSound = { id: CustomSoundId; name: string; fileName: string; duration: number; nativeFile?: string };
export type SoundId = "system" | BundledSoundId | CustomSoundId | "morning" | "forest" | "ocean" | "rain" | "chimes" | "night";
let customSounds: CustomSound[] = [];
export const isCustomSound = (id: string): id is CustomSoundId => /^custom:[0-9a-f-]{36}$/i.test(id);
export const setCustomSounds = (sounds: CustomSound[]) => { customSounds = sounds; };
export const customSound = (id: string) => customSounds.find(s => s.id === id);
const legacy: Record<string, BundledSoundId> = { morning: "lofi", forest: "rooster", ocean: "wake_up", rain: "short_ring", chimes: "digital_beep", night: "lofi" };
export function resolveSoundId(id: SoundId): BundledSoundId | CustomSoundId | "system" { return legacy[id] ?? id as BundledSoundId | CustomSoundId | "system"; }
export const sounds = soundCatalog;
export const soundName = (id: SoundId) => isCustomSound(id) ? customSound(id)?.name ?? "Imported sound" : sounds.find(s => s.id === resolveSoundId(id))?.name ?? "Device default";
export const soundFile = (id: SoundId) => isCustomSound(id) ? customSound(id)?.nativeFile : sounds.find(s => s.id === resolveSoundId(id))?.nativeFile;
export const validSound = (id: string) => isCustomSound(id) || id === "system" || Object.hasOwn(legacy, id) || sounds.some(s => s.id === id);
