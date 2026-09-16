import * as ImagePicker from "expo-image-picker";

export async function pickWallpaper(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset.base64) throw new Error("Couldn’t read this photo. Choose another image.");
  if (asset.base64.length > 3_000_000) throw new Error("Choose a photo under 2 MB for the browser preview.");
  return `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`;
}
