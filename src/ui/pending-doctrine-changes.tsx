import { X } from "lucide-react";

import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import { doctrineChangeLabel } from "./doctrine-change-label";

interface PendingDoctrineChangesProps {
  changes: PendingDoctrineChange[];
  onDiscard: (change: PendingDoctrineChange) => void;
  onReset: () => void;
}

export function PendingDoctrineChanges({
  changes,
  onDiscard,
  onReset,
}: PendingDoctrineChangesProps) {
  if (changes.length === 0) {
    return null;
  }

  return (
    <section
      className="pending-doctrine-changes"
      aria-labelledby="pending-doctrine-title"
    >
      <header>
        <div>
          <p className="section-label">Working copy only</p>
          <h4 id="pending-doctrine-title">Pending doctrine changes</h4>
        </div>
        <strong>
          {changes.length} {changes.length === 1 ? "change" : "changes"}
        </strong>
      </header>
      <ol>
        {changes.map((change, index) => (
          <li
            key={`${index}-${change.fromDoctrineId}-${change.toDoctrineId}`}
          >
            <span>
              {change.categoryName} · Rank {change.rank}
            </span>
            <strong>{doctrineChangeLabel(change)}</strong>
            <button
              aria-label={`Discard ${doctrineChangeLabel(change)}`}
              className="pending-doctrine-remove"
              onClick={() => onDiscard(change)}
              title="Discard this change"
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={4.5} />
            </button>
          </li>
        ))}
      </ol>
      <p>Review and download the verified edited file below.</p>
      <div className="pending-doctrine-actions">
        <button type="button" onClick={onReset}>
          Discard all
        </button>
      </div>
    </section>
  );
}
