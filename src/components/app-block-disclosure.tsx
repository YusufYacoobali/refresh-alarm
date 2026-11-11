export type AppBlockDisclosureProps = {
  onAgree(): void;
  onDecline(): void;
};

// AccessibilityService consent is Android-only. Metro selects the native dialog there.
export function AppBlockDisclosure(_props: AppBlockDisclosureProps) {
  return null;
}
