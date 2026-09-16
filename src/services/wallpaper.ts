import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";

export async function pickWallpaper(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [9, 16], quality: 0.8 });
  if (result.canceled) return;
  const source = new File(result.assets[0].uri);
  const folder = new Directory(Paths.document, "wallpapers");
  folder.create({ intermediates: true, idempotent: true });
  const file = new File(folder, `${Crypto.randomUUID()}${source.extension || ".jpg"}`);
  source.copy(file);
  return file.uri;
}
