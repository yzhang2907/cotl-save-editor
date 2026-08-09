import { Check, Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { GAME_CULT_NAME_INPUT_LIMIT } from "../save/cult-edits";
import type { CultOverview as CultOverviewData } from "../save/overview";
import type { DoctrineChangePlan } from "../save/doctrine-editor";
import type { SaveRecord } from "../save/types";
import { doctrineChangeCountLabel } from "./copy";
import { DoctrinePanel } from "./doctrine-panel";
import {
  PendingChanges,
  type PendingChangeItem,
} from "./pending-changes";
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
    <div
      className={`overview-stat editable${editing.nameEdited ? " edited" : ""}`}
    >
      {renaming ? null : (
        <div className="stat-edit-controls">
          {editing.nameEdited ? (
            <button
              aria-label="Discard the cult name edit"
              className="seal-button stat-edit-discard"
              onClick={editing.onDiscardRename}
              title="Discard this edit"
              type="button"
            >
              <X aria-hidden="true" size={18} strokeWidth={4} />
            </button>
          ) : null}
          <button
            aria-label="Rename the cult"
            className="seal-button stat-edit-toggle"
            onClick={() => {
              setDraft(name ?? "");
              setRenaming(true);
            }}
            title="Rename the cult"
            type="button"
          >
            <Pencil aria-hidden="true" size={17} strokeWidth={3} />
          </button>
        </div>
      )}
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
          <div className="stat-edit-seals">
            <button
              aria-label="Stage the cult name edit"
              className="seal-button"
              title="Stage this edit"
              type="submit"
            >
              <Check aria-hidden="true" size={20} strokeWidth={4} />
            </button>
            <button
              aria-label="Stop renaming the cult"
              className="seal-button resource-edit-cancel"
              onClick={() => setRenaming(false)}
              title="Cancel"
              type="button"
            >
              <X aria-hidden="true" size={20} strokeWidth={4} />
            </button>
          </div>
          {draft.trim().length > GAME_CULT_NAME_INPUT_LIMIT ? (
            <small className="stat-edit-warning" role="note">
              Longer than the game&apos;s {GAME_CULT_NAME_INPUT_LIMIT}
              -character name entry. The game loads it fine, but its
              rename screen cannot type it back in.
            </small>
          ) : null}
        </form>
      ) : (
        <>
          <strong>{value}</strong>
          {editing.nameEdited ? (
            <small>was “{editing.originalName ?? "Unnamed"}”</small>
          ) : null}
        </>
      )}
    </div>
  );
}

interface CultOverviewProps {
  data: SaveRecord;
  editing?: CultEditingProps;
  onApplyDoctrine: (plan: DoctrineChangePlan) => boolean;
  onDiscardAllChanges: () => void;
  originalDoctrine: CultOverviewData["doctrine"];
  overview: CultOverviewData;
  pendingChanges: PendingChangeItem[];
}

export function CultOverview({
  data,
  editing,
  onApplyDoctrine,
  onDiscardAllChanges,
  originalDoctrine,
  overview,
  pendingChanges,
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
  const changeCount = pendingChanges.length;

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

      <PendingChanges
        items={pendingChanges}
        onDiscardAll={onDiscardAllChanges}
      />

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
            onApply={onApplyDoctrine}
            originalDoctrine={originalDoctrine}
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
