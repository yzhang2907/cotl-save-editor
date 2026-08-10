import { sourceWarnings } from "../save/source";
import type {
  SaveCompatibilityReport,
  SaveFormat,
} from "../save/types";
import "./compatibility-notes.css";

interface CompatibilityNotesProps {
  fileName: string;
  format: SaveFormat;
  report: SaveCompatibilityReport;
}

export function CompatibilityNotes({
  fileName,
  format,
  report,
}: CompatibilityNotesProps) {
  const warnings = [...sourceWarnings(fileName, format), ...report.warnings];
  if (warnings.length === 0) {
    return null;
  }

  return (
    <section className="warnings">
      <h3>
        About this save
      </h3>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </section>
  );
}
