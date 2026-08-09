import type { PendingCultEdit } from "../save/cult-edits";
import type { DlcKey } from "../save/dlc";
import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import { doctrineChangeLabel } from "./doctrine-change-label";
import { displayNumber } from "./overview-format";

export interface PendingSaveChange {
  key: string;
  label: string;
  requiredDlc: DlcKey | null;
  scope: string;
}

export function doctrinePendingSaveChange(
  change: PendingDoctrineChange,
): PendingSaveChange {
  return {
    key: `doctrine-${change.categoryName}-${change.rank}`,
    label: doctrineChangeLabel(change),
    requiredDlc: change.requiredDlc,
    scope: `${change.categoryName} · Rank ${change.rank}`,
  };
}

export function cultEditPendingSaveChange(
  edit: PendingCultEdit,
): PendingSaveChange {
  if (edit.kind === "cult-name") {
    return {
      key: "cult-name",
      label: `“${edit.from}” → “${edit.to}”`,
      requiredDlc: null,
      scope: "Cult name",
    };
  }

  if (edit.kind === "resource-add") {
    return {
      key: `resource-add-${edit.itemType}`,
      label: `Add ${edit.itemName}: ${displayNumber(edit.quantity)}${
        edit.reserved > 0
          ? ` (reserved ${displayNumber(edit.reserved)})`
          : ""
      }`,
      requiredDlc: edit.requiredDlc,
      scope: `Resources · Item ${edit.itemType}`,
    };
  }

  const parts: string[] = [];
  if (edit.quantityFrom !== edit.quantityTo) {
    parts.push(
      `${displayNumber(edit.quantityFrom)} → ${displayNumber(edit.quantityTo)}`,
    );
  }
  if (edit.reservedFrom !== edit.reservedTo) {
    parts.push(
      `reserved ${displayNumber(edit.reservedFrom)} → ${displayNumber(edit.reservedTo)}`,
    );
  }
  return {
    key: `resource-${edit.itemType}`,
    label: `${edit.itemName}: ${parts.join(", ")}`,
    requiredDlc: null,
    scope: `Resources · Item ${edit.itemType}`,
  };
}
