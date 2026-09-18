import { useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import { Icon } from "./icon";
import { colors as c, fonts } from "@/theme";
import type { AlarmActionsMenuProps } from "./alarm-actions-menu";

export function AlarmActionsMenu({ label, disabled, onDuplicate, onDelete }: AlarmActionsMenuProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const close = () => { setPosition(null); trigger.current?.focus(); };
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismiss = () => setPosition(null);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [position]);
  return <>
    <button ref={trigger} type="button" aria-label={`More options for ${label}`}
      aria-haspopup="menu" aria-expanded={!!position} disabled={disabled}
      style={{ border: 0, padding: 0, background: "transparent", width: 44, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: disabled ? .45 : 1 }}
      onClick={() => {
        const rect = trigger.current!.getBoundingClientRect();
        setPosition({ top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 112)), right: Math.max(8, window.innerWidth - rect.right) });
      }}>
      <Icon name="ellipsis-vertical" size={21} color={c.muted} />
    </button>
    <Modal visible={!!position} transparent animationType="none" onRequestClose={close}>
    {position && <div style={{ position: "fixed", inset: 0 }}
      onClick={close} onKeyDown={event => {
        if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); close(); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const items = Array.from(menu.current!.querySelectorAll<HTMLButtonElement>("button"));
          const index = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        }
      }}>
      <div ref={menu} role="menu" aria-label={`Options for ${label}`} onClick={event => event.stopPropagation()}
        style={{ position: "absolute", ...position, width: 180, padding: 4, borderRadius: 14,
          background: c.surface, border: `1px solid ${c.line}`, boxShadow: "0 8px 30px #0006" }}>
        {(["Duplicate", "Delete"] as const).map(action => <button key={action} type="button" role="menuitem"
          aria-label={`${action} ${label}`} disabled={disabled}
          onClick={() => { close(); if (action === "Duplicate") onDuplicate(); else onDelete(); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            minHeight: 44, border: 0, borderRadius: 10, padding: "0 12px", background: "transparent",
            color: action === "Delete" ? c.danger : c.text, fontFamily: fonts.medium, fontSize: 14, cursor: "pointer" }}>
          {action}<Icon name={action === "Delete" ? "trash-outline" : "copy-outline"} size={18} color={action === "Delete" ? c.danger : c.muted} />
        </button>)}
      </div>
    </div>}
    </Modal>
  </>;
}
