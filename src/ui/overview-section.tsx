import type { ReactNode } from "react";
import { READ_ONLY_LABEL } from "./copy";
import "./overview-section.css";

interface OverviewSectionProps {
  children: ReactNode;
  count: string;
  experimental?: boolean;
  readOnly?: boolean;
  title: string;
}

export function OverviewSection({
  children,
  count,
  experimental = false,
  readOnly = false,
  title,
}: OverviewSectionProps) {
  return (
    <details className="overview-panel">
      <summary>
        <strong>
          {title}
        </strong>
        {readOnly ? (
          <span className="summary-badge">{READ_ONLY_LABEL}</span>
        ) : null}
        {experimental ? (
          <span className="summary-badge">Experimental</span>
        ) : null}
        <span>{count}</span>
      </summary>
      <div className="overview-panel-body">{children}</div>
    </details>
  );
}
