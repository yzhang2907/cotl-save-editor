import { Check } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import {
  assessDoctrineEditing,
  planDoctrineChange,
  planDoctrineRemoval,
  type DoctrineChangePlan,
} from "../save/doctrine-editor";
import type {
  DoctrineOverview,
  DoctrinePairOverview,
} from "../save/overview";
import type { SaveRecord } from "../save/types";
import "./doctrine-panel.css";

/**
 * The one visual state a choice tile is in. Kept mutually exclusive so the
 * stylesheet never has to resolve a pile-up of overlapping modifiers.
 */
type ChoiceState =
  | "added"
  | "available"
  | "blocked"
  | "removed"
  | "selected";

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
  const choicePlans = pair.choices.map((choice) => ({
    choice,
    removalPlan: planDoctrineRemoval(data, choice.doctrineId),
    selectionPlan: planDoctrineChange(data, choice.doctrineId),
  }));
  const isUnlockable =
    pair.state === "missing" &&
    choicePlans.some(
      ({ selectionPlan }) => selectionPlan.state === "ready",
    );

  return (
    <div
      className={[
        "doctrine-pair",
        pair.state,
        pair.state === "missing"
          ? isUnlockable
            ? "unlockable"
            : "locked"
          : "",
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
        {choicePlans.map(({ choice, removalPlan, selectionPlan }) => {
          const isSelected = pair.selected.some(
            (selected) => selected.doctrineId === choice.doctrineId,
          );
          const isOriginal = originalPair?.selected.some(
            (selected) => selected.doctrineId === choice.doctrineId,
          ) ?? false;
          const activePlan = isSelected ? removalPlan : selectionPlan;
          const canActivate = activePlan.state === "ready";
          const state: ChoiceState = isSelected
            ? isOriginal
              ? "selected"
              : "added"
            : isOriginal
              ? "removed"
              : canActivate
                ? "available"
                : "blocked";
          const stateLabel: string | null =
            state === "added"
              ? originalPair?.state === "missing"
                ? "Unlocked"
                : "Changed"
              : state === "removed"
                ? "Original"
                : state === "selected"
                  ? removalPlan.state === "ready"
                    ? "Remove"
                    : null
                  : state === "available"
                    ? "Unlock"
                    : null;
          const title =
            isSelected
              ? removalPlan.state === "ready"
                ? `Remove ${choice.name} and its linked grants.`
                : removalPlan.blockers.join(" ")
              : pair.state === "complete"
                ? "Both choices were legitimately unlocked with Forgotten Commandment Stones."
                : selectionPlan.blockers.length > 0
                  ? selectionPlan.blockers.join(" ")
                : pair.state === "missing"
                  ? `Unlock ${choice.name} and its linked grants.`
                  : undefined;

          return (
            <button
              aria-pressed={isSelected}
              className="doctrine-choice-option"
              disabled={!canActivate}
              data-doctrine-id={choice.doctrineId}
              data-state={state}
              key={choice.doctrineId}
              onClick={(event) =>
                onChange(
                  activePlan,
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
  data: SaveRecord;
  doctrine: DoctrineOverview;
  onApply: (plan: DoctrineChangePlan) => boolean;
  originalDoctrine: DoctrineOverview;
}

export function DoctrinePanel({
  data,
  doctrine,
  onApply,
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
                  {category.selectedCount}/
                  {category.pairs.reduce(
                    (total, pair) => total + pair.choices.length,
                    0,
                  )}
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
