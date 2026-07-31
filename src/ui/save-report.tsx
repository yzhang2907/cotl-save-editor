import { buildCultOverview } from "../save/overview";
import type {
  DecodedSave,
  SaveCompatibilityReport,
} from "../save/types";
import { AdvancedDiagnostics } from "./advanced-diagnostics";
import { CompatibilityNotes } from "./compatibility-notes";
import { CultOverview } from "./cult-overview";
import { SaveMetadata } from "./save-metadata";
import type { StatusKind } from "./status-banner";
import { UnchangedRebuild } from "./unchanged-rebuild";

interface SaveReportProps {
  decoded: DecodedSave;
  file: File;
  onStatus: (message: string, kind: StatusKind) => void;
  report: SaveCompatibilityReport;
}

export function SaveReport({
  decoded,
  file,
  onStatus,
  report,
}: SaveReportProps) {
  const showCultOverview =
    decoded.messagePack?.schema === "slot" ||
    Array.isArray(decoded.data.Followers) ||
    Array.isArray(decoded.data.DoctrineUnlockedUpgrades);

  return (
    <section id="report" className="report">
      <div className="report-heading">
        <p className="step">II</p>
        <div>
          <h2>The save opens</h2>
          <p>{file.name}</p>
        </div>
        <span className={report.canEditDoctrines ? "badge safe" : "badge caution"}>
          {report.canEditDoctrines ? "Save decoded" : "Check notes"}
        </span>
      </div>

      <SaveMetadata
        data={decoded.data}
        file={file}
        format={decoded.format}
        messagePack={decoded.messagePack}
        report={report}
      />

      <CompatibilityNotes
        fileName={file.name}
        format={decoded.format}
        report={report}
      />

      {showCultOverview ? (
        <CultOverview
          data={decoded.data}
          overview={buildCultOverview(decoded.data)}
        />
      ) : null}

      {decoded.messagePack ? (
        <UnchangedRebuild
          file={file}
          onStatus={onStatus}
          source={decoded.messagePack}
        />
      ) : null}

      <AdvancedDiagnostics data={decoded.data} />
    </section>
  );
}
