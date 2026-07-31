import { useEffect, useRef, useState } from "react";

import {
  assessDoctrineEditing,
  planDoctrineChange,
  type DoctrineChangePlan,
} from "../save/doctrine-editor";
import type {
  DoctrineOverview,
  DoctrinePairOverview,
} from "../save/overview";
import type { SaveRecord } from "../save/types";
import { DoctrinePreview } from "./doctrine-preview";

interface DoctrinePairProps {
  data: SaveRecord;
  onPreview: (plan: DoctrineChangePlan) => void;
  pair: DoctrinePairOverview;
}

function DoctrinePair({ data, onPreview, pair }: DoctrinePairProps) {
  const selected = pair.selected[0] ?? null;
  const opposing =
    pair.state === "selected" && selected
      ? pair.choices.find(
          (candidate) => candidate.doctrineId !== selected.doctrineId,
        ) ?? null
      : null;
  const plan = opposing
    ? planDoctrineChange(data, opposing.doctrineId)
    : null;

  let description;
  if (pair.state === "selected" && selected) {
    description = (
      <>
        <strong>{selected.name}</strong>
        <small>
          {opposing
            ? `Chosen over ${opposing.name} · ID ${selected.doctrineId}`
            : `Doctrine ID ${selected.doctrineId}`}
        </small>
      </>
    );
  } else if (pair.state === "conflict") {
    description = (
      <>
        <strong>Both choices are present</strong>
        <small>
          {pair.selected
            .map(
              (candidate) =>
                `${candidate.name} (${candidate.doctrineId})`,
            )
            .join(" · ")}
        </small>
      </>
    );
  } else {
    description = (
      <>
        <strong>Not declared</strong>
        <small>
          {pair.choices[0].name} or {pair.choices[1].name}
        </small>
      </>
    );
  }

  return (
    <div
      className={`doctrine-pair ${pair.state}${opposing ? " editable" : ""}`}
    >
      <span className="doctrine-rank">{pair.rank}</span>
      <div>{description}</div>
      {opposing && plan ? (
        <button
          className="doctrine-preview-button"
          type="button"
          disabled={plan.state !== "ready"}
          title={plan.blockers.length > 0 ? plan.blockers.join(" ") : undefined}
          onClick={() => onPreview(plan)}
        >
          {plan.state === "ready"
            ? `Preview ${opposing.name}`
            : "Preview blocked"}
        </button>
      ) : null}
    </div>
  );
}

interface DoctrinePanelProps {
  data: SaveRecord;
  doctrine: DoctrineOverview;
}

export function DoctrinePanel({ data, doctrine }: DoctrinePanelProps) {
  const [preview, setPreview] = useState<DoctrineChangePlan | null>(null);
  const previewElement = useRef<HTMLDivElement>(null);
  const assessment = assessDoctrineEditing(data);

  useEffect(() => {
    if (preview) {
      previewElement.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [preview]);

  return (
    <>
      <p className="catalog-note">
        Catalog for game {doctrine.catalogVersion}. Previewing a replacement
        does not change the opened save.
      </p>

      {doctrine.unknownIds.length > 0 ? (
        <p className="catalog-warning">
          Unknown doctrine IDs: {doctrine.unknownIds.join(", ")}.
        </p>
      ) : null}

      {assessment.blockers.length > 0 ? (
        <div className="catalog-warning doctrine-edit-blockers">
          <strong>Doctrine previews are blocked.</strong>
          <ul>
            {assessment.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="doctrine-grid">
        {doctrine.categories.map((category) => (
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
                pair={pair}
                onPreview={setPreview}
              />
            ))}
          </section>
        ))}
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

      <section className="doctrine-preview-section">
        <h4 className="overview-subheading">Change preview</h4>
        <div
          className="doctrine-change-preview"
          aria-live="polite"
          ref={previewElement}
        >
          <DoctrinePreview
            plan={preview}
            onClear={() => setPreview(null)}
          />
        </div>
      </section>
    </>
  );
}
