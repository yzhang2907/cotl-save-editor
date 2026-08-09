import { ArrowDown, ListChecks } from "lucide-react";

import {
  GO_TO_DOWNLOAD_LABEL,
  viewPendingChangesLabel,
} from "./copy";

interface ChangeDockProps {
  changeCount: number;
  downloadTargetId: string | null;
  pendingListTargetId: string;
}

function jumpTo(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView();
}

export function ChangeDock({
  changeCount,
  downloadTargetId,
  pendingListTargetId,
}: ChangeDockProps) {
  if (changeCount === 0) {
    return null;
  }

  return (
    <nav className="change-dock" aria-label="Staged changes shortcuts">
      <button
        className="chip-button change-dock-view"
        onClick={() => jumpTo(pendingListTargetId)}
        type="button"
      >
        <ListChecks aria-hidden="true" size={16} strokeWidth={2.5} />
        {viewPendingChangesLabel(changeCount)}
      </button>
      {downloadTargetId === null ? null : (
        <button
          className="chip-button"
          onClick={() => jumpTo(downloadTargetId)}
          type="button"
        >
          <ArrowDown aria-hidden="true" size={16} strokeWidth={2.5} />
          {GO_TO_DOWNLOAD_LABEL}
        </button>
      )}
    </nav>
  );
}
