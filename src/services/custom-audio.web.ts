import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { CustomSound, CustomSoundId } from "@/utils/sounds";

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("refresh-audio", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Couldn’t open audio storage. Check your browser storage settings."));
  });
}
async function storeAudio(id: string, blob: Blob) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, id);
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(new Error("Couldn’t save this audio. Your browser storage may be full."));
  }); } finally { db.close(); }
}
export async function customAudioSource(id: CustomSoundId): Promise<{ uri: string; release(): void }> {
  const db = await database();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction("files").objectStore("files").get(id);
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("This imported audio is missing. Import it again."));
      request.onerror = () => reject(new Error("Couldn’t read your imported audio."));
    });
    const uri = URL.createObjectURL(blob);
    return { uri, release: () => URL.revokeObjectURL(uri) };
  } finally { db.close(); }
}
export async function importAudio(): Promise<CustomSound | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: false, base64: false });
  if (result.canceled) return;
  const asset = result.assets[0];
  try {
    if (!asset.file || asset.file.size > 50 * 1024 * 1024) throw new Error("Choose an audio file under 50 MB.");
    const duration = await new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const cleanup = () => { clearTimeout(timer); audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute("src"); audio.load(); };
      const failed = () => { cleanup(); reject(new Error("This file couldn’t be read as audio. Try an MP3, M4A, or WAV file.")); };
      const timer = setTimeout(failed, 15000);
      audio.onloadedmetadata = () => { const duration = audio.duration; cleanup(); Number.isFinite(duration) && duration > 0 ? resolve(duration) : reject(new Error("Choose an audio file with a valid duration.")); };
      audio.onerror = failed; audio.preload = "metadata"; audio.src = asset.uri;
    });
    const id: CustomSoundId = `custom:${Crypto.randomUUID()}`;
    await storeAudio(id, asset.file);
    return { id, name: asset.name.replace(/\.[^.]+$/, '').slice(0, 80) || "My sound", fileName: asset.name, duration };
  } finally { URL.revokeObjectURL(asset.uri); }
}
