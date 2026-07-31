import {
  Check,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect } from "react";

export type ToastKind = "error" | "info" | "loading" | "ready";

interface ActionToastProps {
  id: number;
  kind: ToastKind;
  message: string;
  onDismiss: (id: number) => void;
}

export const TOAST_DISMISS_AFTER_MS: Partial<
  Record<ToastKind, number>
> = {
  error: 8_000,
  info: 3_500,
  ready: 3_500,
};

export function ActionToast({
  id,
  kind,
  message,
  onDismiss,
}: ActionToastProps) {
  useEffect(() => {
    const delay = TOAST_DISMISS_AFTER_MS[kind];
    if (delay === undefined) {
      return;
    }
    const timer = window.setTimeout(() => onDismiss(id), delay);
    return () => window.clearTimeout(timer);
  }, [id, kind, onDismiss]);

  const Icon =
    kind === "error"
      ? TriangleAlert
      : kind === "loading"
        ? LoaderCircle
        : kind === "ready"
          ? Check
          : Info;

  return (
    <aside
      aria-atomic="true"
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={`action-toast ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <span className="action-toast-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={4} />
      </span>
      <p>{message}</p>
      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        type="button"
      >
        <X aria-hidden="true" size={18} strokeWidth={4} />
      </button>
    </aside>
  );
}
