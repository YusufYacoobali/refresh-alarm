import React, { useEffect, useState } from "react";
import { AppState } from "react-native";
import { appBlockStatus } from "@/services/app-blocking";
import { T } from "./ui";
import { colors as c } from "@/theme";

export function AppBlockStatus() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => {
      if (AppState.currentState !== "active") return;
      try {
        const status = appBlockStatus();
        setSeconds(status.authorized ? Math.max(0, Math.ceil((status.activeUntil - Date.now()) / 1000)) : 0);
      } catch { setSeconds(0); }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds > 0 ? <T style={{ color: c.lavender, textAlign: "center" }}>Your app block continues · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} left</T> : null;
}
