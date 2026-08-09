import { X } from "lucide-react";

export interface PendingChangeItem {
  key: string;
  label: string;
  onDiscard: () => void;
  scope: string;
}

interface PendingChangesProps {
  items: PendingChangeItem[];
  onDiscardAll: () => void;
}

export function PendingChanges({
  items,
  onDiscardAll,
}: PendingChangesProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="pending-changes"
      aria-labelledby="pending-changes-title"
    >
      <header>
        <h4 id="pending-changes-title">Pending changes</h4>
        <button
          className="pending-change-discard-all"
          onClick={onDiscardAll}
          type="button"
        >
          Discard all
        </button>
      </header>
      <ol>
        {items.map((item) => (
          <li key={item.key}>
            <span>{item.scope}</span>
            <strong>{item.label}</strong>
            <button
              aria-label={`Discard ${item.label}`}
              className="pending-change-remove"
              onClick={item.onDiscard}
              title="Discard this change"
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={4.5} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
