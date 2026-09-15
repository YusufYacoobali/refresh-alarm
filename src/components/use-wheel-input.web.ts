import { useEffect } from "react";
import type { WheelInput } from "./use-wheel-input";

/** RN Web does not implement snapToInterval or desktop drag-to-scroll. */
export function useWheelInput({ scroll, row, count, reduced, interacting }: WheelInput) {
  useEffect(() => {
    const node = scroll.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node) return;
    node.style.scrollSnapType = "y mandatory";
    node.style.overscrollBehaviorY = "contain";
    node.style.cursor = "grab";
    const clamp = (y: number) => Math.max(0, Math.min((count - 1) * row, y));
    let goal = node.scrollTop, lastWheel = 0;
    let pointer: { id: number; start: number; y: number; time: number; velocity: number; dragged: boolean } | null = null;
    let suppressClick = false;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY || event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      interacting.set(true);
      const now = performance.now();
      if (now - lastWheel > 180) goal = node.scrollTop;
      lastWheel = now;
      const delta = event.deltaY * (event.deltaMode === 1 ? row : event.deltaMode === 2 ? row * 3 : 1);
      goal = clamp(goal + delta);
      scroll.current?.scrollTo({ y: Math.round(goal / row) * row, animated: !reduced });
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      // Interrupt a glide at its current location when the user grabs the wheel.
      scroll.current?.scrollTo({ y: node.scrollTop, animated: false });
      interacting.set(true);
      suppressClick = false;
      pointer = { id: event.pointerId, start: event.clientY, y: event.clientY, time: performance.now(), velocity: 0, dragged: false };
    };
    const move = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const now = performance.now();
      if (Math.abs(event.clientY - pointer.start) > 4) pointer.dragged = true;
      if (pointer.dragged) {
        node.setPointerCapture(event.pointerId);
        node.style.scrollSnapType = "none";
        node.style.cursor = "grabbing";
        const delta = pointer.y - event.clientY;
        pointer.velocity = delta / Math.max(1, now - pointer.time);
        scroll.current?.scrollTo({ y: clamp(node.scrollTop + delta), animated: false });
        event.preventDefault();
      }
      pointer.y = event.clientY;
      pointer.time = now;
    };
    const up = (event: PointerEvent) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { dragged, velocity, time } = pointer;
      pointer = null;
      node.style.cursor = "grab";
      if (!dragged) return;
      suppressClick = true;
      // A short projection preserves release momentum without skipping huge ranges.
      const momentum = reduced || performance.now() - time > 100 || event.type === "pointercancel" ? 0 : Math.max(-row * 4, Math.min(row * 4, velocity * 120));
      node.style.scrollSnapType = "y mandatory";
      goal = Math.round(clamp(node.scrollTop + momentum) / row) * row;
      scroll.current?.scrollTo({ y: goal, animated: !reduced });
      if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    };
    const click = (event: MouseEvent) => { if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopPropagation(); } };
    const touch = () => { interacting.set(true); };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("click", click, true);
    node.addEventListener("touchstart", touch, { passive: true });
    return () => {
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("click", click, true);
      node.removeEventListener("touchstart", touch);
    };
  }, [scroll, row, count, reduced, interacting]);
}
