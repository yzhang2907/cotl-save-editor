export type StatusKind = "error" | "loading" | "ready";

interface StatusBannerProps {
  kind: StatusKind;
  message: string;
}

export function StatusBanner({ kind, message }: StatusBannerProps) {
  return (
    <section
      id="status"
      className={`status ${kind}`}
      aria-live="polite"
    >
      {message}
    </section>
  );
}
