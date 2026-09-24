export const APP_BLOCK_MINUTES = [5, 10, 15, 30, 60] as const;
export const SOCIAL_APPS = [
  { name: "Instagram", packages: ["com.instagram.android", "com.instagram.lite"] },
  { name: "YouTube", packages: ["com.google.android.youtube"] },
  { name: "Reddit", packages: ["com.reddit.frontpage"] },
  { name: "TikTok", packages: ["com.zhiliaoapp.musically", "com.ss.android.ugc.trill", "com.zhiliaoapp.musically.go", "com.ss.android.ugc.tiktok.lite"] },
  { name: "Facebook", packages: ["com.facebook.katana", "com.facebook.lite"] },
  { name: "Threads", packages: ["com.instagram.barcelona"] },
  { name: "X", packages: ["com.twitter.android"] },
  { name: "Snapchat", packages: ["com.snapchat.android"] },
  { name: "Pinterest", packages: ["com.pinterest"] },
  { name: "LinkedIn", packages: ["com.linkedin.android"] },
  { name: "Tumblr", packages: ["com.tumblr"] },
  { name: "Twitch", packages: ["tv.twitch.android.app"] },
  { name: "Discord", packages: ["com.discord"] },
] as const;

/** Resolve the preset against installed apps; never invent installed packages. */
export function socialAppIds(apps: { id: string }[]): string[] {
  const packages = new Set<string>(SOCIAL_APPS.flatMap(app => [...app.packages]));
  return [...new Set(apps.filter(app => packages.has(app.id)).map(app => app.id))];
}
