import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { File, Directory, Paths } from "expo-file-system";
import { createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";
import AlarmKit from "./alarm-kit";
import { CustomSound, CustomSoundId, customSound } from "@/utils/sounds";

export async function customAudioSource(id: CustomSoundId): Promise<{ uri: string; release(): void }> {
  const sound = customSound(id);
  if (!sound) throw new Error("This imported sound is missing. Import it again.");
  const file = new File(Paths.document, "custom-audio", sound.fileName);
  if (!file.exists) throw new Error("This audio file is missing. Import it again.");
  return { uri: file.uri, release() {} };
}

export async function importAudio(): Promise<CustomSound | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return;
  const asset = result.assets[0];
  const source = new File(asset.uri);
  if (source.size > 50 * 1024 * 1024) throw new Error("Choose an audio file under 50 MB.");
  const extension = asset.name.split('.').pop()?.toLowerCase();
  if (!extension || !["mp3", "m4a", "aac", "wav", "ogg", "flac", "aiff", "caf"].includes(extension)) throw new Error("Choose an MP3, M4A, WAV, or another supported audio file.");
  const uuid = Crypto.randomUUID();
  const folder = new Directory(Paths.document, "custom-audio");
  folder.create({ intermediates: true, idempotent: true });
  const fileName = `${uuid}.${extension}`;
  const file = new File(folder, fileName);
  source.copy(file);
  let player: ReturnType<typeof createAudioPlayer> | undefined;
  try {
    if (Platform.OS === "ios" && !AlarmKit?.prepareCustomSound) throw new Error("Install the updated Refresh build to import alarm sounds.");
    player = createAudioPlayer({ uri: file.uri });
    const deadline = Date.now() + 15000;
    while (!player.isLoaded && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    if (!player.isLoaded || !Number.isFinite(player.duration) || player.duration <= 0) throw new Error("This file couldn’t be read as audio. Try an MP3, M4A, or WAV file.");
    const duration = player.duration;
    const nativeFile = Platform.OS === "ios" ? await AlarmKit?.prepareCustomSound(file.uri, uuid) : undefined;
    if (Platform.OS === "ios" && !nativeFile) throw new Error("Install the updated Refresh build to import alarm sounds.");
    return { id: `custom:${uuid}`, name: asset.name.replace(/\.[^.]+$/, '').slice(0, 80) || "My sound", fileName, duration, nativeFile };
  } catch (error) { if (file.exists) file.delete(); throw error; }
  finally { player?.remove(); }
}
