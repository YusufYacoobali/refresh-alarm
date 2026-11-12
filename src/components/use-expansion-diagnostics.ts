import { useEffect, useRef } from "react";
import { Platform, View, type LayoutChangeEvent } from "react-native";

/** Android development builds distinguish a missed press, a missed state
 * commit, and native content that mounted with empty/stale bounds. No delays
 * or changes to input handling; production builds add no measurement handlers. */
export function useExpansionDiagnostics(screen: string, open: string | null) {
  const request = useRef(0);
  const bodies = useRef(new Map<string, View>());
  const enabled = __DEV__ && Platform.OS === "android";
  const log = (event: string, detail: object) => {
    if (enabled) console.debug("[RefreshExpansion]", { screen, event, request: request.current, ...detail });
  };
  useEffect(() => { log("committed", { open }); }, [open]);
  return {
    press(section: string) {
      request.current += 1;
      log("press", { section, wasOpen: open === section });
    },
    body(section: string) {
      if (!enabled) return {};
      return {
        ref: (node: View | null) => { if (node) bodies.current.set(section, node); else bodies.current.delete(section); },
        onLayout: (event: LayoutChangeEvent) => {
          log("layout", { section, ...event.nativeEvent.layout });
          bodies.current.get(section)?.measureInWindow((x, y, width, height) => {
            log("windowBounds", { section, x, y, width, height });
          });
        },
      };
    },
  };
}
