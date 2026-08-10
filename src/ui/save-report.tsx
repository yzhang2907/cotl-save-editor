import { useEffect, useMemo, useState } from "react";

import {
  ITEM_NAMES,
  UNOBTAINABLE_ITEM_TYPES,
} from "../save/catalogs";
import {
  applyCultEdits,
  discardCultNameEdit,
  discardResourceEdit,
  emptyCultEdits,
  itemRequiredDlc,
  listPendingCultEdits,
  stageCultNameEdit,
  stageResourceAddition,
  stageResourceEdit,
  type CultEdits,
} from "../save/cult-edits";
import { dlcDefinition, saveHasActivatedDlc } from "../save/dlc";
import type { DoctrineChangePlan } from "../save/doctrine-editor";
import {
  applyDoctrineChange,
  createDoctrineWorkspace,
  discardDoctrineChange,
  listPendingDoctrineChanges,
  resetDoctrineChanges,
  restoreDoctrineWorkspace,
  type AppliedDoctrineChange,
  type PendingDoctrineChange,
} from "../save/doctrine-workspace";
import { buildCultOverview } from "../save/overview";
import type {
  DecodedSave,
  SaveCompatibilityReport,
} from "../save/types";
import type { ToastKind } from "./action-toast";
import { AdvancedDiagnostics } from "./advanced-diagnostics";
import { ChangeDock } from "./change-dock";
import { CompatibilityNotes } from "./compatibility-notes";
import { SAVE_REPORT_TITLE } from "./copy";
import { CultOverview, type CultEditingProps } from "./cult-overview";
import { EditedSaveDownload } from "./edited-save-download";
import {
  cultEditPendingSaveChange,
  doctrinePendingSaveChange,
} from "./pending-save-changes";
import type { ResourceEditRequest } from "./resources-section";
import { SaveMetadata } from "./save-metadata";
import { StepHeader } from "./step-header";
import { UnchangedRebuild } from "./unchanged-rebuild";
import "./save-report.css";

interface SaveReportProps {
  decoded: DecodedSave;
  file: File;
  onEditsChange?: (edits: {
    cultEdits: CultEdits;
    doctrineHistory: AppliedDoctrineChange[];
  }) => void;
  onNotice: (message: string, kind: ToastKind) => void;
  report: SaveCompatibilityReport;
  restoredCultEdits?: CultEdits;
  restoredDoctrineHistory?: AppliedDoctrineChange[];
}

export function SaveReport({
  decoded,
  file,
  onEditsChange,
  onNotice,
  report,
  restoredCultEdits,
  restoredDoctrineHistory,
}: SaveReportProps) {
  const [workspace, setWorkspace] = useState(() => {
    try {
      return restoreDoctrineWorkspace(
        decoded.data,
        restoredDoctrineHistory ?? [],
      );
    } catch {
      // A history that no longer fits the save is dropped rather than
      // blocking the save from opening at all.
      return createDoctrineWorkspace(decoded.data);
    }
  });
  const [cultEdits, setCultEdits] = useState(
    () => restoredCultEdits ?? emptyCultEdits(),
  );

  useEffect(() => {
    onEditsChange?.({ cultEdits, doctrineHistory: workspace.history });
  }, [cultEdits, onEditsChange, workspace.history]);
  const showCultOverview =
    decoded.messagePack?.schema === "slot" ||
    Array.isArray(decoded.data.Followers) ||
    Array.isArray(decoded.data.DoctrineUnlockedUpgrades);
  const showEditedSaveDownload =
    decoded.messagePack?.schema === "slot";

  const working = useMemo(() => {
    try {
      return applyCultEdits(workspace.data, workspace.original, cultEdits);
    } catch {
      return workspace.data;
    }
  }, [cultEdits, workspace]);
  const overview = buildCultOverview(working);
  const originalDoctrine = buildCultOverview(workspace.original).doctrine;
  const pendingDoctrineChanges = listPendingDoctrineChanges(workspace);
  const pendingCultEdits = useMemo(() => {
    try {
      return listPendingCultEdits(workspace.original, cultEdits);
    } catch {
      return [];
    }
  }, [cultEdits, workspace.original]);
  const pendingChanges = [
    ...pendingDoctrineChanges.map(doctrinePendingSaveChange),
    ...pendingCultEdits.map(cultEditPendingSaveChange),
  ];
  const pendingChangeItems = [
    ...pendingDoctrineChanges.map((change) => ({
      ...doctrinePendingSaveChange(change),
      onDiscard: () => discardDoctrine(change),
    })),
    ...pendingCultEdits.map((edit) => ({
      ...cultEditPendingSaveChange(edit),
      onDiscard: () =>
        setCultEdits(
          edit.kind === "cult-name"
            ? discardCultNameEdit(cultEdits)
            : discardResourceEdit(cultEdits, edit.itemType),
        ),
    })),
  ];

  function discardAllChanges(): void {
    resetDoctrines();
    setCultEdits(emptyCultEdits());
  }

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

  function renameCult(name: string): boolean {
    try {
      setCultEdits(
        stageCultNameEdit(workspace.original, cultEdits, name),
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(`The cult was not renamed: ${message}`, "error");
      return false;
    }
  }

  function editResource(edit: ResourceEditRequest): boolean {
    try {
      setCultEdits(
        stageResourceEdit(workspace.original, cultEdits, edit),
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(`The resource edit was not staged: ${message}`, "error");
      return false;
    }
  }

  function addResource(edit: ResourceEditRequest): boolean {
    try {
      setCultEdits(
        stageResourceAddition(workspace.original, cultEdits, edit),
      );
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error.";
      onNotice(`The item was not added: ${message}`, "error");
      return false;
    }
  }

  const presentItems = new Map(
    overview.resources.map((resource) => [resource.id, resource]),
  );
  const editing: CultEditingProps | undefined = showEditedSaveDownload
    ? {
        addableItems: Object.entries(ITEM_NAMES)
          .map(([id, name]) => {
            const itemType = Number(id);
            const present = presentItems.get(itemType);
            const requiredDlc = itemRequiredDlc(itemType);
            const locked =
              present === undefined &&
              requiredDlc !== null &&
              !saveHasActivatedDlc(workspace.original, requiredDlc);
            return {
              id: itemType,
              lockedReason: locked
                ? `needs ${dlcDefinition(requiredDlc).displayName}`
                : null,
              name,
              owned:
                present === undefined
                  ? null
                  : {
                      quantity: present.quantity,
                      reserved: present.reserved,
                    },
              unobtainable: UNOBTAINABLE_ITEM_TYPES.has(itemType),
            };
          })
          .sort((left, right) => left.name.localeCompare(right.name)),
        editedResourceTypes: new Set([
          ...cultEdits.resources.map((edit) => edit.type),
          ...cultEdits.additions.map((edit) => edit.type),
        ]),
        nameEditable: typeof workspace.original.CultName === "string",
        nameEdited: cultEdits.cultName !== null,
        onDiscardRename: () =>
          setCultEdits(discardCultNameEdit(cultEdits)),
        onDiscardResourceEdit: (type) =>
          setCultEdits(discardResourceEdit(cultEdits, type)),
        onAddResource: addResource,
        onEditResource: editResource,
        onRename: renameCult,
        originalName:
          typeof workspace.original.CultName === "string" &&
          workspace.original.CultName.trim()
            ? workspace.original.CultName
            : null,
      }
    : undefined;

  const advancedDiagnostics = (
    <AdvancedDiagnostics
      data={working}
      key={pendingChanges.length}
    >
      {decoded.messagePack ? (
        <UnchangedRebuild
          file={file}
          onNotice={onNotice}
          pendingChangeCount={pendingChanges.length}
          source={decoded.messagePack}
        />
      ) : null}
    </AdvancedDiagnostics>
  );

  return (
    <>
      <section id="report" className="report">
        <StepHeader
          aside={
            <span
              className={
                report.canEditDoctrines ? "badge safe" : "badge caution"
              }
            >
              {report.canEditDoctrines ? "Save decoded" : "Check notes"}
            </span>
          }
          description={file.name}
          eyebrow="Save inspection"
          step="II"
          title={SAVE_REPORT_TITLE}
        />

        <SaveMetadata
          file={file}
          format={decoded.format}
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
            editing={editing}
            onApplyDoctrine={applyDoctrine}
            onDiscardAllChanges={discardAllChanges}
            originalDoctrine={originalDoctrine}
            overview={overview}
            pendingChanges={pendingChangeItems}
          />
        ) : null}

        {showEditedSaveDownload ? null : advancedDiagnostics}
      </section>

      {showEditedSaveDownload && decoded.messagePack ? (
        <EditedSaveDownload
          changes={pendingChanges}
          fileName={file.name}
          onNotice={onNotice}
          original={workspace.original}
          source={decoded.messagePack}
          working={working}
        >
          {advancedDiagnostics}
        </EditedSaveDownload>
      ) : null}

      <ChangeDock
        changeCount={pendingChanges.length}
        downloadTargetId={
          showEditedSaveDownload && decoded.messagePack
            ? "edited-save-download"
            : null
        }
        pendingListTargetId="pending-changes"
      />
    </>
  );
}
