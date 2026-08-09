import { Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { GAME_CULT_NAME_INPUT_LIMIT } from "../save/cult-edits";
import type { CultOverview as CultOverviewData } from "../save/overview";
import type { DoctrineChangePlan } from "../save/doctrine-editor";
import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import type { SaveRecord } from "../save/types";
import { doctrineChangeCountLabel } from "./copy";
import { DoctrinePanel } from "./doctrine-panel";
import { FollowersSection } from "./followers-section";
import {
  displayDuration,
  displayNumber,
} from "./overview-format";
import { OverviewSection } from "./overview-section";
import {
  ResourcesSection,
  type AddableItem,
  type ResourceEditRequest,
} from "./resources-section";
import { RitualsSection } from "./rituals-section";

export interface CultEditingProps {
  addableItems: AddableItem[];
  editedResourceTypes: ReadonlySet<number>;
  nameEditable: boolean;
  nameEdited: boolean;
  onAddResource: (edit: ResourceEditRequest) => boolean;
  onDiscardRename: () => void;
  onDiscardResourceEdit: (type: number) => void;
  onEditResource: (edit: ResourceEditRequest) => boolean;
  onRename: (name: string) => boolean;
  originalName: string | null;
  pendingCultEditCount: number;
}

interface StatProps {
  label: string;
  note?: string;
  value: string;
}

function Stat({ label, note, value }: StatProps) {
  return (
    <div className="overview-stat">
      <span className="overview-stat-label">{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

function CultNameStat({
  editing,
  name,
}: {
  editing: CultEditingProps | undefined;
  name: string | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");
  const value = name ?? "Unnamed";

  if (editing === undefined || !editing.nameEditable) {
    return <Stat label="Cult name" value={value} />;
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (editing !== undefined && editing.onRename(draft)) {
      setRenaming(false);
    }
  }

  return (
    <div className="overview-stat editable">
      <span className="overview-stat-label">Cult name</span>
      {renaming ? (
        <form className="stat-edit-form" onSubmit={submit}>
          <input
            aria-label="New cult name"
            autoFocus
            onChange={(event) => setDraft(event.currentTarget.value)}
            type="text"
            value={draft}
          />
          {draft.trim().length > GAME_CULT_NAME_INPUT_LIMIT ? (
            <small className="stat-edit-warning" role="note">
              Longer than the game&apos;s {GAME_CULT_NAME_INPUT_LIMIT}
              -character name entry. The game loads it fine, but its
              rename screen cannot type it back in.
            </small>
          ) : null}
          <div className="stat-edit-actions">
            <button type="submit">Stage</button>
            <button onClick={() => setRenaming(false)} type="button">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <strong>{value}</strong>
          {editing.nameEdited ? (
            <small>was “{editing.originalName ?? "Unnamed"}”</small>
          ) : null}
          <div className="stat-edit-controls">
            {editing.nameEdited ? (
              <button
                aria-label="Discard the cult name edit"
                className="stat-edit-discard"
                onClick={editing.onDiscardRename}
                title="Discard this edit"
                type="button"
              >
                <X aria-hidden="true" size={14} strokeWidth={4} />
              </button>
            ) : null}
            <button
              aria-label="Rename the cult"
              className="stat-edit-toggle"
              onClick={() => {
                setDraft(name ?? "");
                setRenaming(true);
              }}
              title="Rename the cult"
              type="button"
            >
              <Pencil aria-hidden="true" size={14} strokeWidth={3} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface CultOverviewProps {
  data: SaveRecord;
  doctrineChanges: PendingDoctrineChange[];
  editing?: CultEditingProps;
  onApplyDoctrine: (plan: DoctrineChangePlan) => boolean;
  onDiscardDoctrine: (change: PendingDoctrineChange) => void;
  originalDoctrine: CultOverviewData["doctrine"];
  onResetDoctrines: () => void;
  overview: CultOverviewData;
}

export function CultOverview({
  data,
  doctrineChanges,
  editing,
  onApplyDoctrine,
  onDiscardDoctrine,
  originalDoctrine,
  onResetDoctrines,
  overview,
}: CultOverviewProps) {
  const doctrineChoiceCount = overview.doctrine.categories.reduce(
    (total, category) =>
      total +
      category.pairs.reduce(
        (choiceTotal, pair) => choiceTotal + pair.choices.length,
        0,
      ),
    0,
  );
  const changeCount =
    doctrineChanges.length + (editing?.pendingCultEditCount ?? 0);

  return (
    <section className="cult-overview" aria-labelledby="cult-overview-title">
      <header className="overview-heading">
        <div>
          <h3 id="cult-overview-title">Inside the cult</h3>
          <p>
            Changes go to a working copy. The file you opened stays
            untouched.
          </p>
        </div>
        <span
          className={`change-count-seal${changeCount === 0 ? "" : " is-dirty"}`}
        >
          {doctrineChangeCountLabel(changeCount)}
        </span>
      </header>

      <div className="overview-stats">
        <CultNameStat editing={editing} name={overview.identity.name} />
        <Stat
          label="Day"
          value={
            overview.identity.day === null
              ? "Unknown"
              : displayNumber(overview.identity.day)
          }
        />
        <Stat
          label="Followers"
          value={
            overview.followerCount === null
              ? "Unknown"
              : displayNumber(overview.followerCount)
          }
        />
        <Stat
          label="Structures"
          value={
            overview.structureCount === null
              ? "Unknown"
              : displayNumber(overview.structureCount)
          }
        />
        {overview.identity.playTimeSeconds === null ? null : (
          <Stat
            label="Play time"
            value={displayDuration(overview.identity.playTimeSeconds)}
          />
        )}
      </div>

      <div className="overview-panels">
        {overview.followerCount === null ? null : (
          <FollowersSection
            count={overview.followerCount}
            followers={overview.followers}
          />
        )}
        {overview.itemTypeCount === null ? null : (
          <ResourcesSection
            addableItems={editing?.addableItems}
            count={overview.itemTypeCount}
            editedTypes={editing?.editedResourceTypes}
            onAdd={editing?.onAddResource}
            onDiscardEdit={editing?.onDiscardResourceEdit}
            onEdit={editing?.onEditResource}
            resources={overview.resources}
          />
        )}
        <OverviewSection
          title="Doctrines"
          count={`${overview.doctrine.selectedChoiceCount} of ${doctrineChoiceCount} choices`}
        >
          <DoctrinePanel
            data={data}
            doctrine={overview.doctrine}
            changes={doctrineChanges}
            onApply={onApplyDoctrine}
            onDiscard={onDiscardDoctrine}
            originalDoctrine={originalDoctrine}
            onReset={onResetDoctrines}
          />
        </OverviewSection>
        <RitualsSection
          rituals={overview.rituals}
          sermonsAndRites={overview.sermonsAndRites}
        />
      </div>
    </section>
  );
}
