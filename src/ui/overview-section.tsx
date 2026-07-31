import type { ReactNode } from "react";

interface OverviewSectionProps {
  children: ReactNode;
  count: string;
  title: string;
}

export function OverviewSection({
  children,
  count,
  title,
}: OverviewSectionProps) {
  return (
    <details className="overview-panel">
      <summary>
        <strong>{title}</strong>
        <span>{count}</span>
      </summary>
      <div className="overview-panel-body">{children}</div>
    </details>
  );
}
