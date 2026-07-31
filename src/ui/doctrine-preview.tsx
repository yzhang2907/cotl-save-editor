import type {
  DoctrineChangePlan,
  DoctrineFieldChange,
} from "../save/doctrine-editor";

type ChangeDirection = "added" | "removed";

function storageFieldLabel(change: DoctrineFieldChange): string {
  if (change.field === "DoctrineUnlockedUpgrades") {
    return "Doctrine choice";
  }
  if (change.field === "UnlockedUpgrades") {
    return "Linked unlock";
  }
  return "Cult trait";
}

function doctrineValueName(
  plan: DoctrineChangePlan,
  direction: ChangeDirection,
): string {
  const choice = direction === "removed" ? plan.from : plan.to;
  return choice?.name ?? "Unknown value";
}

interface ChangeColumnProps {
  direction: ChangeDirection;
  plan: DoctrineChangePlan;
  title: string;
}

function ChangeColumn({ direction, plan, title }: ChangeColumnProps) {
  return (
    <section className={`doctrine-change-column ${direction}`}>
      <h5>{title}</h5>
      <div className="doctrine-change-list">
        {plan.changes.flatMap((change) => {
          const ids =
            direction === "removed" ? change.removed : change.added;
          return ids.map((id) => (
            <span
              className={`doctrine-change-item ${direction}`}
              key={`${change.field}-${direction}-${id}`}
            >
              <strong>{doctrineValueName(plan, direction)}</strong>
              <small>
                {storageFieldLabel(change)} · ID {id}
              </small>
            </span>
          ));
        })}
      </div>
    </section>
  );
}

function idList(ids: number[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function CompleteArrayValues({ plan }: { plan: DoctrineChangePlan }) {
  return (
    <details className="doctrine-array-details">
      <summary>Show complete array values</summary>
      <div className="doctrine-array-comparison">
        {plan.changes.map((change) => (
          <section title={change.field} key={change.field}>
            <h6>{storageFieldLabel(change)}</h6>
            <div className="doctrine-array-values">
              <div>
                <span>Before</span>
                <code>[{idList(change.before)}]</code>
              </div>
              <div>
                <span>After</span>
                <code>[{idList(change.after)}]</code>
              </div>
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

function EmptyPreview() {
  return (
    <div className="doctrine-preview-empty">
      <span aria-hidden="true">↟</span>
      <strong>Choose a declared doctrine</strong>
      <p>
        Use a Preview button above to inspect one replacement. The opened save
        will stay unchanged.
      </p>
    </div>
  );
}

function BlockedPreview({ plan }: { plan: DoctrineChangePlan }) {
  return (
    <div className="doctrine-plan-blocked">
      <strong>This preview is blocked</strong>
      <ul>
        {plan.blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
    </div>
  );
}

interface DoctrinePreviewProps {
  onClear: () => void;
  plan: DoctrineChangePlan | null;
}

export function DoctrinePreview({
  onClear,
  plan,
}: DoctrinePreviewProps) {
  if (!plan) {
    return <EmptyPreview />;
  }
  if (
    plan.state !== "ready" ||
    plan.from === null ||
    plan.to === null
  ) {
    return <BlockedPreview plan={plan} />;
  }

  const unchangedFields = plan.changes
    .filter((change) => !change.changed)
    .map(storageFieldLabel);

  return (
    <>
      <header>
        <div>
          <p className="section-label">
            {plan.categoryName} · Rank {plan.rank}
          </p>
          <h4>
            {plan.from.name} → {plan.to.name}
          </h4>
        </div>
        <span className="preview-only-badge">Preview only</span>
      </header>
      <p className="doctrine-plan-copy">
        These are the exact array changes required for this replacement. No
        save data has been changed.
      </p>
      <div className="doctrine-change-columns">
        <ChangeColumn direction="removed" plan={plan} title="You lose" />
        <ChangeColumn direction="added" plan={plan} title="You gain" />
      </div>
      {unchangedFields.length > 0 ? (
        <p className="doctrine-unchanged-note">
          Unchanged: {unchangedFields.join(", ").toLowerCase()}.
        </p>
      ) : null}
      <CompleteArrayValues plan={plan} />
      <button
        className="clear-doctrine-preview"
        type="button"
        onClick={onClear}
      >
        Clear preview
      </button>
    </>
  );
}
