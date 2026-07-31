import { Check } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import {
  assessDoctrineEditing,
  planDoctrineChange,
  type DoctrineChangePlan,
} from "../save/doctrine-editor";
import type {
  DoctrineOverview,
  DoctrinePairOverview,
} from "../save/overview";
import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import type { SaveRecord } from "../save/types";
import { PendingDoctrineChanges } from "./pending-doctrine-changes";

interface DoctrinePairProps {
  data: SaveRecord;
  onChange: (
    plan: DoctrineChangePlan,
    doctrineId: number,
    viewportTop: number,
  ) => void;
  originalPair: DoctrinePairOverview | null;
  pair: DoctrinePairOverview;
}

function selectedIds(pair: DoctrinePairOverview | null): string {
  return (
    pair?.selected
      .map((choice) => choice.doctrineId)
      .sort((left, right) => left - right)
      .join(",") ?? ""
  );
}

function DoctrinePair({
  data,
  onChange,
  originalPair,
  pair,
}: DoctrinePairProps) {
  const changed = selectedIds(pair) !== selectedIds(originalPair);

  return (
    <div
      className={[
        "doctrine-pair",
        pair.state,
        changed ? "changed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="doctrine-rank">{pair.rank}</span>
      <div
        className="doctrine-choice-options"
        role="group"
        aria-label={`Rank ${pair.rank} doctrine`}
      >
        {pair.choices.map((choice) => {
          const isSelected = pair.selected.some(
            (selected) => selected.doctrineId === choice.doctrineId,
          );
          const isOriginal = originalPair?.selected.some(
            (selected) => selected.doctrineId === choice.doctrineId,
          ) ?? false;
          const plan = planDoctrineChange(data, choice.doctrineId);
          const canSelect =
            !isSelected &&
            pair.state === "selected" &&
            plan.state === "ready";
          const stateLabel = isSelected
            ? changed
              ? "Changed"
              : null
            : changed && isOriginal
              ? "Original"
              : null;
          const title =
            pair.state === "conflict"
              ? "This rank contains both choices."
              : pair.state === "missing"
                ? "This rank has no selected choice."
                : plan.blockers.length > 0
                  ? plan.blockers.join(" ")
                  : undefined;

          return (
            <button
              aria-pressed={isSelected}
              className={[
                "doctrine-choice-option",
                isSelected ? "selected" : "",
                changed && isSelected ? "changed" : "",
                changed && isOriginal ? "original" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canSelect}
              data-doctrine-id={choice.doctrineId}
              key={choice.doctrineId}
              onClick={(event) =>
                onChange(
                  plan,
                  choice.doctrineId,
                  event.currentTarget.getBoundingClientRect().top,
                )
              }
              title={title}
              type="button"
            >
              <strong>{choice.name}</strong>
              <small>
                ID {choice.doctrineId}
                {stateLabel ? (
                  <span className="doctrine-choice-state">
                    {stateLabel}
                  </span>
                ) : null}
              </small>
              {isSelected ? (
                <span className="doctrine-choice-check" aria-hidden="true">
                  <Check size={20} strokeWidth={5} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DoctrinePanelProps {
  changes: PendingDoctrineChange[];
  data: SaveRecord;
  doctrine: DoctrineOverview;
  onApply: (plan: DoctrineChangePlan) => boolean;
  onDiscard: (change: PendingDoctrineChange) => void;
  onReset: () => void;
  originalDoctrine: DoctrineOverview;
}

export function DoctrinePanel({
  changes,
  data,
  doctrine,
  onApply,
  onDiscard,
  onReset,
  originalDoctrine,
}: DoctrinePanelProps) {
  const assessment = assessDoctrineEditing(data);
  const selectionAnchor = useRef<{
    doctrineId: number;
    viewportTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    const anchor = selectionAnchor.current;
    selectionAnchor.current = null;
    if (anchor === null) {
      return;
    }
    const choice = document.querySelector<HTMLElement>(
      `[data-doctrine-id="${anchor.doctrineId}"]`,
    );
    if (choice === null) {
      return;
    }
    const offset = choice.getBoundingClientRect().top - anchor.viewportTop;
    if (Math.abs(offset) > 1) {
      window.scrollBy(0, offset);
    }
  }, [data]);

  function applySelection(
    plan: DoctrineChangePlan,
    doctrineId: number,
    viewportTop: number,
  ): void {
    selectionAnchor.current = { doctrineId, viewportTop };
    if (!onApply(plan)) {
      selectionAnchor.current = null;
    }
  }

  return (
    <>
      {doctrine.unknownIds.length > 0 ? (
        <p className="catalog-warning">
          Unknown doctrine IDs: {doctrine.unknownIds.join(", ")}.
        </p>
      ) : null}

      {assessment.blockers.length > 0 ? (
        <div className="catalog-warning doctrine-edit-blockers">
          <strong>Doctrine changes are unavailable.</strong>
          <ul>
            {assessment.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PendingDoctrineChanges
        changes={changes}
        onDiscard={onDiscard}
        onReset={onReset}
      />

      <div className="doctrine-grid">
        {doctrine.categories.map((category) => {
          const originalCategory =
            originalDoctrine.categories.find(
              (candidate) => candidate.key === category.key,
            ) ?? null;

          return (
            <section className="doctrine-category" key={category.key}>
              <header>
                <h4>{category.name}</h4>
                <span>
                  {category.selectedCount}/{category.pairs.length}
                </span>
              </header>
              {category.pairs.map((pair) => (
                <DoctrinePair
                  data={data}
                  key={pair.rank}
                  onChange={applySelection}
                  originalPair={
                    originalCategory?.pairs.find(
                      (candidate) => candidate.rank === pair.rank,
                    ) ?? null
                  }
                  pair={pair}
                />
              ))}
            </section>
          );
        })}
      </div>

      {doctrine.specials.length > 0 ? (
        <>
          <h4 className="overview-subheading">Granted doctrines</h4>
          <div className="named-id-list">
            {doctrine.specials.map((entry) => (
              <span title={`Doctrine ID ${entry.id}`} key={entry.id}>
                {entry.name}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
