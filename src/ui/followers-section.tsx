import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ChevronRight,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { FOLLOWER_TRAITS } from "../save/follower-catalogs";
import {
  DEATH_CAUSE_FIELD,
  MAX_FOLLOWER_AGE,
  MAX_FOLLOWER_LEVEL,
  STATUS_FIELD,
  type FollowerFieldEdit,
  type FollowerStatus,
} from "../save/follower-edits";
import {
  DEATH_CAUSES,
  type FollowerAppearance,
  type FollowerOverview,
} from "../save/overview";
import { displayPercent } from "./overview-format";
import { OverviewSection } from "./overview-section";
import "./followers-section.css";

function appearanceSummary(appearance: FollowerAppearance): string {
  if (appearance.skinName === null) {
    return "Unknown skin";
  }
  const variation =
    appearance.skinVariation === null || appearance.skinVariation === 0
      ? ""
      : `, variation ${appearance.skinVariation + 1}`;
  const colour =
    appearance.colour === null || appearance.colour === 0
      ? ""
      : `, colour ${appearance.colour}`;
  return `${appearance.skinName}${variation}${colour}`;
}

function wornItems(appearance: FollowerAppearance): string[] {
  const items: string[] = [];
  // Outfit names like "Old" or "Follower" read as nonsense without
  // their category.
  if (appearance.outfit !== null) {
    items.push(`${appearance.outfit} (Outfit)`);
  }
  if (appearance.clothing !== null) {
    items.push(appearance.clothing);
  }
  if (appearance.hat !== null) {
    items.push(appearance.hat);
  }
  if (appearance.necklace !== null) {
    items.push(
      appearance.necklaceHidden
        ? `${appearance.necklace} (hidden)`
        : appearance.necklace,
    );
  }
  return items;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (value === null) {
    return null;
  }
  return (
    <div className="follower-detail-row">
      <span className="follower-detail-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Localized names can carry Unity rich-text or sprite markup.
function cleanTraitName(name: string): string {
  return name.replace(/<[^>]*>/g, "").trim();
}

const TRAIT_OPTIONS = Object.entries(FOLLOWER_TRAITS)
  .map(([id, entry]) => ({
    id: Number(id),
    name: cleanTraitName(entry.name),
  }))
  // Skips the "None" sentinel and runtime-templated names ("… {0}").
  .filter((option) => option.id !== 0 && !option.name.includes("{"))
  .sort((left, right) => left.name.localeCompare(right.name));

function EditedStar() {
  return (
    <span aria-label="edited" className="follower-edited">
      *
    </span>
  );
}

function RevertSeal({
  label,
  onRevert,
}: {
  label: string;
  onRevert: () => void;
}) {
  return (
    <button
      aria-label={`Revert ${label} to the saved value`}
      className="seal-button resource-edit-discard"
      onClick={onRevert}
      title="Revert to the saved value"
      type="button"
    >
      <X aria-hidden="true" size={18} strokeWidth={4} />
    </button>
  );
}

interface FollowerEditModalProps {
  follower: FollowerOverview;
  followerId: number;
  onClose: () => void;
  onEdit: (edits: FollowerFieldEdit[]) => boolean;
  original: FollowerOverview;
}

function overviewStatus(follower: FollowerOverview): FollowerStatus {
  if (follower.death !== null) {
    return "Dead";
  }
  return follower.elder ? "Elder" : "Active";
}

function FollowerEditModal({
  follower,
  followerId,
  onClose,
  onEdit,
  original,
}: FollowerEditModalProps) {
  // The save stores percent stats with long float tails.
  const rounded = (value: number | null): number | null =>
    value === null ? null : Math.round(value * 100) / 100;
  const [name, setName] = useState(follower.name);
  const [level, setLevel] = useState(
    follower.level === null ? "" : String(follower.level),
  );
  const [age, setAge] = useState(
    follower.age === null ? "" : String(follower.age),
  );
  const [happiness, setHappiness] = useState(
    follower.happiness === null ? "" : String(rounded(follower.happiness)),
  );
  const [satiation, setSatiation] = useState(
    follower.satiation === null ? "" : String(rounded(follower.satiation)),
  );
  const [illness, setIllness] = useState(
    follower.illness === null ? "" : String(rounded(follower.illness)),
  );
  const [traitIds, setTraitIds] = useState(follower.traitIds);
  const [traitQuery, setTraitQuery] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");
  const [cause, setCause] = useState(
    follower.death?.causeFlag ?? "",
  );
  const [status, setStatus] = useState<FollowerStatus>(
    overviewStatus(follower),
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        if (renaming) {
          setRenaming(false);
        } else if (editingField !== null) {
          setEditingField(null);
        } else {
          onClose();
        }
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editingField, onClose, renaming]);

  function confirmRename(event: FormEvent): void {
    event.preventDefault();
    if (nameDraft.trim() !== "") {
      setName(nameDraft);
    }
    setRenaming(false);
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    const edits: FollowerFieldEdit[] = [];
    // Status goes first: a cause of death staged in the same batch needs
    // the staged status to already be visible.
    if (status !== overviewStatus(follower)) {
      edits.push({ field: STATUS_FIELD, followerId, value: status });
    }
    if (
      status === "Dead" &&
      cause !== (follower.death?.causeFlag ?? "")
    ) {
      edits.push({ field: DEATH_CAUSE_FIELD, followerId, value: cause });
    }
    if (name !== follower.name) {
      edits.push({ field: "_name", followerId, value: name });
    }
    const numberDrafts: Array<
      [string, string, number | null]
    > = [
      ["XPLevel", level, follower.level],
      ["Age", age, follower.age],
      ["_happiness", happiness, rounded(follower.happiness)],
      ["_satiation", satiation, rounded(follower.satiation)],
      ["_illness", illness, rounded(follower.illness)],
    ];
    for (const [field, draft, current] of numberDrafts) {
      if (draft !== "" && Number(draft) !== current) {
        edits.push({ field, followerId, value: Number(draft) });
      }
    }
    if (
      traitIds.length !== follower.traitIds.length ||
      traitIds.some((id, index) => id !== follower.traitIds[index])
    ) {
      edits.push({ field: "Traits", followerId, value: traitIds });
    }

    if (edits.length === 0 || onEdit(edits)) {
      onClose();
    }
  }

  // Firefox lets letters through type="number" inputs.
  function numeric(raw: string, integer: boolean): string {
    const digits = raw.replace(integer ? /[^0-9]/g : /[^0-9.]/g, "");
    return integer
      ? digits
      : digits.replace(/\./, "\u0000").replace(/\./g, "").replace("\u0000", ".");
  }

  const needle = traitQuery.trim().toLowerCase();
  // Removed originals stay out of the list; their chip restores them.
  const traitMatches = TRAIT_OPTIONS.filter(
    (option) =>
      !traitIds.includes(option.id) &&
      !original.traitIds.includes(option.id) &&
      (needle === "" ||
        option.name.toLowerCase().includes(needle) ||
        String(option.id) === needle),
  );

  return createPortal(
    <div
      className="edited-save-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="follower-edit-title"
        aria-modal="true"
        className="edited-save-modal resource-add-modal"
        role="dialog"
      >
        <header>
          <div className="follower-edit-heading">
            <p className="section-label">Edit follower</p>
            <h3 id="follower-edit-title">
              {renaming ? (
                <form
                  className="follower-rename-form"
                  onSubmit={confirmRename}
                >
                  <input
                    aria-label="New follower name"
                    autoFocus
                    onChange={(event) =>
                      setNameDraft(event.currentTarget.value)
                    }
                    type="text"
                    value={nameDraft}
                  />
                  <button
                    aria-label="Set the follower's name"
                    className="seal-button"
                    title="Set this name"
                    type="submit"
                  >
                    <Check aria-hidden="true" size={18} strokeWidth={4} />
                  </button>
                  <button
                    aria-label="Stop renaming the follower"
                    className="seal-button resource-edit-cancel"
                    onClick={() => setRenaming(false)}
                    title="Cancel"
                    type="button"
                  >
                    <X aria-hidden="true" size={18} strokeWidth={4} />
                  </button>
                </form>
              ) : (
                <>
                  <span className="follower-edit-name">{name}</span>
                  {name === original.name ? null : (
                    <>
                      <EditedStar />
                      <button
                        aria-label="Revert the name to the saved value"
                        className="seal-button stat-edit-discard"
                        onClick={() => setName(original.name)}
                        title="Revert to the saved name"
                        type="button"
                      >
                        <X aria-hidden="true" size={17} strokeWidth={4} />
                      </button>
                    </>
                  )}
                  <button
                    aria-label={`Rename ${follower.name}`}
                    className="seal-button stat-edit-toggle"
                    onClick={() => {
                      setNameDraft(name);
                      setRenaming(true);
                    }}
                    title="Rename this follower"
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={17} strokeWidth={3} />
                  </button>
                </>
              )}
            </h3>
          </div>
          <button
            aria-label="Close the follower editor"
            className="edited-save-modal-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={22} strokeWidth={4} />
          </button>
        </header>

        <form className="follower-edit-form" onSubmit={submit}>
      <div className="follower-edit-numbers">
        {(
          [
            [
              "Level",
              level,
              setLevel,
              true,
              follower.level,
              original.level,
              MAX_FOLLOWER_LEVEL,
            ],
            [
              "Age",
              age,
              setAge,
              true,
              follower.age,
              original.age,
              MAX_FOLLOWER_AGE,
            ],
            [
              "Happiness",
              happiness,
              setHappiness,
              false,
              follower.happiness,
              rounded(original.happiness),
              100,
            ],
            [
              "Satiation",
              satiation,
              setSatiation,
              false,
              follower.satiation,
              rounded(original.satiation),
              100,
            ],
            [
              "Illness",
              illness,
              setIllness,
              false,
              follower.illness,
              rounded(original.illness),
              100,
            ],
          ] as const
        ).map(([label, value, setValue, integer, current, saved, max]) => {
          const edited =
            saved !== null && value !== "" && Number(value) !== saved;
          const invalid = fieldDraft !== "" && Number(fieldDraft) > max;
          const confirmField = (): void => {
            // The same bound staging enforces; catching it here keeps the
            // failure next to the input instead of on the stage button.
            if (invalid) {
              return;
            }
            if (fieldDraft !== "") {
              setValue(fieldDraft);
            }
            setEditingField(null);
          };
          return (
            <div className="follower-edit-field" key={label}>
              <span>
                {label}
                {edited ? <EditedStar /> : null}
              </span>
              {editingField === label ? (
                <div className="follower-edit-input-row">
                  <input
                    aria-invalid={invalid}
                    aria-label={`New ${label.toLowerCase()} value`}
                    autoFocus
                    className="follower-edit-number"
                    title={invalid ? `At most ${max}` : undefined}
                    inputMode={integer ? "numeric" : "decimal"}
                    onChange={(event) =>
                      setFieldDraft(
                        numeric(event.currentTarget.value, integer),
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmField();
                      }
                    }}
                    type="text"
                    value={fieldDraft}
                  />
                  <button
                    aria-label={`Set the ${label.toLowerCase()} value`}
                    className="seal-button"
                    disabled={invalid}
                    onClick={confirmField}
                    title="Set this value"
                    type="button"
                  >
                    <Check aria-hidden="true" size={18} strokeWidth={4} />
                  </button>
                  <button
                    aria-label={`Stop editing ${label.toLowerCase()}`}
                    className="seal-button resource-edit-cancel"
                    onClick={() => setEditingField(null)}
                    title="Cancel"
                    type="button"
                  >
                    <X aria-hidden="true" size={18} strokeWidth={4} />
                  </button>
                </div>
              ) : (
                <div className="follower-edit-input-row">
                  <strong className="follower-field-value">
                    {value === "" ? "—" : value}
                  </strong>
                  {edited ? (
                    <RevertSeal
                      label={label}
                      onRevert={() => setValue(String(saved))}
                    />
                  ) : null}
                  <button
                    aria-label={`Edit ${label.toLowerCase()}`}
                    className="seal-button stat-edit-toggle"
                    disabled={current === null}
                    onClick={() => {
                      setFieldDraft(value);
                      setEditingField(label);
                    }}
                    title={`Edit ${label.toLowerCase()}`}
                    type="button"
                  >
                    <Pencil aria-hidden="true" size={17} strokeWidth={3} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {(() => {
          const savedStatus = overviewStatus(original);
          const edited = status !== savedStatus;
          return (
            <div className="follower-edit-field">
              <span>
                Status
                {edited ? <EditedStar /> : null}
              </span>
              <div className="follower-edit-input-row">
                <select
                  aria-label="Status"
                  className="follower-edit-select"
                  onChange={(event) =>
                    setStatus(
                      event.currentTarget.value as FollowerStatus,
                    )
                  }
                  value={status}
                >
                  <option value="Active">Active</option>
                  <option value="Elder">Elder</option>
                  <option value="Dead">Dead</option>
                </select>
                {edited ? (
                  <RevertSeal
                    label="Status"
                    onRevert={() => setStatus(savedStatus)}
                  />
                ) : null}
              </div>
            </div>
          );
        })()}
        {status !== "Dead"
          ? null
          : (() => {
              const savedCause = original.death?.causeFlag ?? "";
              const edited = cause !== savedCause;
              return (
                <div className="follower-edit-field">
                  <span>
                    Cause of death
                    {edited ? <EditedStar /> : null}
                  </span>
                  <div className="follower-edit-input-row">
                    <select
                      aria-label="Cause of death"
                      className="follower-edit-select"
                      onChange={(event) =>
                        setCause(event.currentTarget.value)
                      }
                      value={cause}
                    >
                      <option value="">Ritual (no recorded cause)</option>
                      {DEATH_CAUSES.map(([flag, label]) => (
                        <option key={flag} value={flag}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {edited ? (
                      <RevertSeal
                        label="Cause of death"
                        onRevert={() => setCause(savedCause)}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })()}
      </div>
      <div className="follower-edit-traits">
        <span className="follower-edit-label">
          Traits
          {traitIds.length === original.traitIds.length &&
          traitIds.every((id, index) => id === original.traitIds[index]) ? null : (
            <EditedStar />
          )}
        </span>
        {(() => {
          // Original traits keep their slots (removed ones show dashed);
          // additions append after them.
          const chipIds = [
            ...original.traitIds,
            ...traitIds.filter((id) => !original.traitIds.includes(id)),
          ];
          if (chipIds.length === 0) {
            return <p className="follower-trait-none">No traits.</p>;
          }
          return (
            <div className="follower-trait-chips">
              {chipIds.map((id) => {
                const removed = !traitIds.includes(id);
                const added = !original.traitIds.includes(id);
                const traitName = cleanTraitName(
                  FOLLOWER_TRAITS[id]?.name ?? `Unknown trait ${id}`,
                );
                return (
                  <span
                    className={`follower-trait-chip${added ? " added" : ""}${removed ? " removed" : ""}`}
                    key={id}
                  >
                    {traitName}
                    {removed ? (
                      <button
                        aria-label={`Restore the ${traitName} trait`}
                        onClick={() =>
                          setTraitIds(
                            chipIds.filter(
                              (kept) =>
                                traitIds.includes(kept) || kept === id,
                            ),
                          )
                        }
                        title="Restore this trait"
                        type="button"
                      >
                        <Plus aria-hidden="true" size={13} strokeWidth={3.5} />
                      </button>
                    ) : (
                      <button
                        aria-label={`Remove the ${traitName} trait`}
                        onClick={() =>
                          setTraitIds(
                            traitIds.filter((kept) => kept !== id),
                          )
                        }
                        title="Remove this trait"
                        type="button"
                      >
                        <X aria-hidden="true" size={13} strokeWidth={3.5} />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })()}
        <input
          aria-label="Search traits to add"
          className="resource-add-search"
          onChange={(event) => setTraitQuery(event.currentTarget.value)}
          placeholder="Search traits to add…"
          type="search"
          value={traitQuery}
        />
        <div className="resource-add-results follower-trait-results">
          {traitMatches.length === 0 ? (
            <p className="empty-overview">
              No more traits match “{traitQuery}”.
            </p>
          ) : (
            <div className="resource-add-list">
              {traitMatches.map((option) => (
                <button
                  className="resource-add-option"
                  key={option.id}
                  onClick={() => setTraitIds([...traitIds, option.id])}
                  type="button"
                >
                  <Plus aria-hidden="true" size={14} strokeWidth={4} />
                  <span>
                    <strong>{option.name}</strong>
                    <small>Trait {option.id}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="edited-save-modal-actions">
        <button
          className="chip-button ghost-button"
          onClick={onClose}
          type="button"
        >
          Cancel
        </button>
        <button className="chip-button" type="submit">
          Stage the edits
        </button>
      </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function FollowerDetail({
  edited,
  follower,
  onDiscardEdits,
  onEdit,
  original,
}: {
  edited: boolean;
  follower: FollowerOverview;
  onDiscardEdits: ((followerId: number) => void) | null;
  onEdit: ((edits: FollowerFieldEdit[]) => boolean) | null;
  original: FollowerOverview | null;
}) {
  const [editing, setEditing] = useState(false);
  const worn = wornItems(follower.appearance);
  const editable = onEdit !== null && follower.id !== null;
  return (
    <div className="follower-detail">
      <DetailRow
        label="Appearance"
        value={appearanceSummary(follower.appearance)}
      />
      <DetailRow
        label="Wearing"
        value={worn.length > 0 ? worn.join(", ") : "Nothing"}
      />
      <DetailRow
        label="Traits"
        value={follower.traits.length > 0 ? follower.traits.join(", ") : null}
      />
      <DetailRow label="Role" value={follower.role} />
      <DetailRow label="Former faction" value={follower.faction} />
      <DetailRow
        label="Faith"
        value={
          follower.faith === null ? null : displayPercent(follower.faith)
        }
      />
      <DetailRow
        label="Adoration"
        value={
          follower.adoration === null ? null : `${follower.adoration}`
        }
      />
      <DetailRow
        label="Joined"
        value={
          follower.dayJoined === null
            ? null
            : `Day ${follower.dayJoined}${follower.bornInCult ? ", born in the cult" : ""}`
        }
      />
      <DetailRow
        label="Life expectancy"
        value={
          follower.lifeExpectancy === null
            ? null
            : `${follower.lifeExpectancy} days`
        }
      />
      <DetailRow label="Spouse" value={follower.spouse} />
      <DetailRow
        label="Parents"
        value={
          follower.parents.length > 0 ? follower.parents.join(" and ") : null
        }
      />
      <DetailRow label="State of mind" value={follower.stateThought} />
      {follower.death === null ? null : (
        <>
          <DetailRow
            label="Cause of death"
            value={follower.death.cause ?? "Ritual"}
          />
          <DetailRow
            label="Died"
            value={
              follower.death.day === null
                ? null
                : `Day ${follower.death.day}`
            }
          />
          <DetailRow label="Murdered by" value={follower.death.murderedBy} />
          <DetailRow
            label="Remains"
            value={
              follower.death.buried
                ? follower.death.funeral
                  ? "Buried with a funeral"
                  : "Buried without a funeral"
                : "Not buried"
            }
          />
        </>
      )}
      {editable ? (
        <>
          <div className="follower-edit-actions">
            <button
              aria-label={`Edit ${follower.name}`}
              className="chip-button"
              onClick={() => setEditing(true)}
              type="button"
            >
              <Pencil aria-hidden="true" size={14} strokeWidth={3} />
              Edit
            </button>
            {edited && onDiscardEdits !== null ? (
              <button
                aria-label={`Discard the ${follower.name} edits`}
                className="chip-button follower-clear-edits"
                onClick={() => onDiscardEdits(follower.id as number)}
                type="button"
              >
                <X aria-hidden="true" size={14} strokeWidth={3.5} />
                Clear edits
              </button>
            ) : null}
          </div>
          {editing ? (
            <FollowerEditModal
              follower={follower}
              followerId={follower.id as number}
              onClose={() => setEditing(false)}
              onEdit={onEdit}
              original={original ?? follower}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function FollowerRow({
  edited,
  follower,
  onDiscardEdits,
  onEdit,
  original,
}: {
  edited: boolean;
  follower: FollowerOverview;
  onDiscardEdits: ((followerId: number) => void) | null;
  onEdit: ((edits: FollowerFieldEdit[]) => boolean) | null;
  original: FollowerOverview | null;
}) {
  return (
    <details className="follower-entry">
      <summary className="follower-row">
        <div className="follower-name">
          <strong>{follower.name}</strong>
          {edited ? (
            <span aria-label="edited" className="follower-edited">
              *
            </span>
          ) : null}
        </div>
        <span>{follower.id === null ? "—" : follower.id}</span>
        <span>{follower.level === null ? "—" : `Lv ${follower.level}`}</span>
        <span>{follower.age === null ? "—" : `${follower.age} days`}</span>
        <span>{displayPercent(follower.happiness)}</span>
        <span>{displayPercent(follower.satiation)}</span>
        <span>
          {follower.death === null
            ? follower.statuses.join(", ")
            : (follower.death.cause ?? "Ritual")}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="follower-chevron"
          size={15}
          strokeWidth={3}
        />
      </summary>
      <FollowerDetail
        edited={edited}
        follower={follower}
        onDiscardEdits={onDiscardEdits}
        onEdit={onEdit}
        original={original}
      />
    </details>
  );
}

type SortValue = number | string | null;

const SORT_COLUMNS: ReadonlyArray<{
  label: string;
  value: (follower: FollowerOverview) => SortValue;
}> = [
  { label: "Name", value: (follower) => follower.name.toLowerCase() },
  { label: "ID", value: (follower) => follower.id },
  { label: "Level", value: (follower) => follower.level },
  { label: "Age", value: (follower) => follower.age },
  { label: "Happy", value: (follower) => follower.happiness },
  { label: "Fed", value: (follower) => follower.satiation },
];

function stateValue(follower: FollowerOverview): SortValue {
  return follower.death === null
    ? follower.statuses.join(", ")
    : (follower.death.cause ?? "Ritual");
}

function compareValues(left: SortValue, right: SortValue): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  if (typeof left === "string" || typeof right === "string") {
    return String(left).localeCompare(String(right));
  }
  return left - right;
}

interface SortOrder {
  column: number;
  descending: boolean;
}

function FollowerList({
  dead,
  editedFollowerIds,
  followers,
  onDiscardEdits,
  onEdit,
  originalById,
}: {
  dead: boolean;
  editedFollowerIds: ReadonlySet<number> | null;
  followers: FollowerOverview[];
  onDiscardEdits: ((followerId: number) => void) | null;
  onEdit: ((edits: FollowerFieldEdit[]) => boolean) | null;
  originalById: ReadonlyMap<number, FollowerOverview> | null;
}) {
  const [order, setOrder] = useState<SortOrder | null>(null);
  const columns = useMemo(
    () => [
      ...SORT_COLUMNS,
      { label: dead ? "Death" : "State", value: stateValue },
    ],
    [dead],
  );
  const sorted = useMemo(() => {
    if (order === null) {
      return followers;
    }
    const value = columns[order.column]?.value;
    if (value === undefined) {
      return followers;
    }
    const sign = order.descending ? -1 : 1;
    return followers
      .slice()
      .sort(
        (left, right) => sign * compareValues(value(left), value(right)),
      );
  }, [columns, followers, order]);

  function toggleOrder(column: number) {
    setOrder((previous) =>
      previous?.column === column
        ? previous.descending
          ? null
          : { column, descending: true }
        : { column, descending: false },
    );
  }

  return (
    <div className="follower-list">
      <div className="follower-row follower-labels">
        {columns.map((column, index) => (
          <button
            key={column.label}
            onClick={() => toggleOrder(index)}
            type="button"
          >
            {column.label}
            {order?.column === index ? (
              order.descending ? (
                <ArrowDownWideNarrow
                  aria-hidden="true"
                  size={12}
                  strokeWidth={3}
                />
              ) : (
                <ArrowUpNarrowWide
                  aria-hidden="true"
                  size={12}
                  strokeWidth={3}
                />
              )
            ) : null}
          </button>
        ))}
      </div>
      {sorted.map((follower, index) => (
        <FollowerRow
          edited={
            follower.id !== null &&
            editedFollowerIds?.has(follower.id) === true
          }
          follower={follower}
          key={follower.id ?? `${follower.name}-${index}`}
          onDiscardEdits={onDiscardEdits}
          onEdit={onEdit}
          original={
            follower.id === null
              ? null
              : (originalById?.get(follower.id) ?? null)
          }
        />
      ))}
    </div>
  );
}

interface FollowersSectionProps {
  count: number;
  deadFollowers: FollowerOverview[];
  editedFollowerIds?: ReadonlySet<number>;
  followers: FollowerOverview[];
  onDiscardFollowerEdits?: (followerId: number) => void;
  onEditFollower?: (edits: FollowerFieldEdit[]) => boolean;
  originalFollowersById?: ReadonlyMap<number, FollowerOverview>;
}

export function FollowersSection({
  count,
  deadFollowers,
  editedFollowerIds,
  followers,
  onDiscardFollowerEdits,
  onEditFollower,
  originalFollowersById,
}: FollowersSectionProps) {
  return (
    <OverviewSection
      count={`${count} living`}
      experimental
      readOnly={onEditFollower === undefined}
      title="Followers"
    >
      {followers.length === 0 ? (
        <p className="empty-overview">No living follower records were found.</p>
      ) : (
        <FollowerList
          dead={false}
          editedFollowerIds={editedFollowerIds ?? null}
          followers={followers}
          onDiscardEdits={onDiscardFollowerEdits ?? null}
          onEdit={onEditFollower ?? null}
          originalById={originalFollowersById ?? null}
        />
      )}
      {deadFollowers.length === 0 ? null : (
        <details className="follower-subsection">
          <summary>
            <strong>Dead followers</strong>
            <span>{deadFollowers.length} dead</span>
            <ChevronRight
              aria-hidden="true"
              className="follower-chevron"
              size={17}
              strokeWidth={3}
            />
          </summary>
          <FollowerList
            dead
            editedFollowerIds={editedFollowerIds ?? null}
            followers={deadFollowers}
            onDiscardEdits={onDiscardFollowerEdits ?? null}
            onEdit={onEditFollower ?? null}
            originalById={originalFollowersById ?? null}
          />
        </details>
      )}
    </OverviewSection>
  );
}
