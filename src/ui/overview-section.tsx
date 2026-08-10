import type { ReactNode } from "react";
import { READ_ONLY_LABEL } from "./copy";
import "./overview-section.css";

interface OverviewSectionProps {
  children: ReactNode;
  count: string;
  readOnly?: boolean;
  title: string;
}

export function OverviewSection({
  children,
  count,
  readOnly = false,
  title,
}: OverviewSectionProps) {
  return (
    <details
      className={`overview-panel${readOnly ? " read-only" : ""}`}
    >
      <summary>
        <strong>
          {title}
          {readOnly ? ` (${READ_ONLY_LABEL})` : null}
        </strong>
        <span>{count}</span>
      </summary>
      <div className="overview-panel-body">{children}</div>
    </details>
  );
}
