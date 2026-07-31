import { useState } from "react";

import type { DoctrineChangePlan } from "../save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
  type PendingDoctrineChange,
} from "../save/doctrine-workspace";
import { buildCultOverview } from "../save/overview";
import type {
  DecodedSave,
  SaveCompatibilityReport,
} from "../save/types";
import type { ToastKind } from "./action-toast";
import { AdvancedDiagnostics } from "./advanced-diagnostics";
import { CompatibilityNotes } from "./compatibility-notes";
import { CultOverview } from "./cult-overview";
import { SaveMetadata } from "./save-metadata";
import { UnchangedRebuild } from "./unchanged-rebuild";

interface SaveReportProps {
  decoded: DecodedSave;
  file: File;
  onNotice: (message: string, kind: ToastKind) => void;
  report: SaveCompatibilityReport;
}

export function SaveReport({
  decoded,
  file,
  onNotice,
  report,
}: SaveReportProps) {
  const [workspace, setWorkspace] = useState(() =>
    createDoctrineWorkspace(decoded.data),
  );
  const showCultOverview =
    decoded.messagePack?.schema === "slot" ||
    Array.isArray(decoded.data.Followers) ||
    Array.isArray(decoded.data.DoctrineUnlockedUpgrades);
  const overview = buildCultOverview(workspace.data);
  const originalDoctrine = buildCultOverview(workspace.original).doctrine;
  const pendingDoctrineChanges = listPendingDoctrineChanges(workspace);

  function applyDoctrine(plan: DoctrineChangePlan): boolean {
    try {
      const updated = applyDoctrineChange(workspace, plan);
      setWorkspace(updated);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(`The doctrine change was not applied: ${message}`, "error");
      return false;
    }
  }

  function discardDoctrine(change: PendingDoctrineChange): void {
    try {
      setWorkspace(discardDoctrineChange(workspace, change));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(
        `The doctrine change could not be discarded: ${message}`,
        "error",
      );
    }
  }

  function resetDoctrines(): void {
    if (workspace.history.length === 0) {
      return;
    }
    setWorkspace(resetDoctrineChanges(workspace));
  }

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
          data={workspace.data}
          doctrineChanges={pendingDoctrineChanges}
          onApplyDoctrine={applyDoctrine}
          onDiscardDoctrine={discardDoctrine}
          originalDoctrine={originalDoctrine}
          onResetDoctrines={resetDoctrines}
          overview={overview}
        />
      ) : null}

      <AdvancedDiagnostics
        data={workspace.data}
        key={workspace.history.length}
      >
        {decoded.messagePack ? (
          <UnchangedRebuild
            file={file}
            onNotice={onNotice}
            pendingChangeCount={pendingDoctrineChanges.length}
            source={decoded.messagePack}
          />
        ) : null}
      </AdvancedDiagnostics>
    </section>
  );
}
