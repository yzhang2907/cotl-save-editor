import { useState, type SyntheticEvent } from "react";

import type { SaveRecord } from "../save/types";

function serializeSaveData(data: SaveRecord): string {
  return JSON.stringify(
    data,
    (_key, value: unknown) => {
      if (typeof value === "bigint") {
        return `${value}n`;
      }
      if (value instanceof Uint8Array) {
        return Array.from(value);
      }
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    },
    2,
  );
}

export function AdvancedDiagnostics({ data }: { data: SaveRecord }) {
  const [record, setRecord] = useState<string | null>(null);

  function prepareRecord(event: SyntheticEvent<HTMLDetailsElement>): void {
    if (!event.currentTarget.open || record !== null) {
      return;
    }
    setRecord("Preparing the complete save record…");
    window.requestAnimationFrame(() => {
      try {
        setRecord(serializeSaveData(data));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error.";
        setRecord(`The technical preview could not be prepared: ${message}`);
      }
    });
  }

  return (
    <section className="advanced-diagnostics">
      <h3>Advanced diagnostics</h3>
      <p>
        Use this complete decoded record for troubleshooting. Large saves may
        take a moment to display.
      </p>
      <details className="preview" onToggle={prepareRecord}>
        <summary>Technical save preview</summary>
        <pre>
          {record ??
            "Open this section to prepare the complete save record."}
        </pre>
      </details>
    </section>
  );
}
