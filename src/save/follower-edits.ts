import { ITEM_NAMES } from "./catalogs";
import {
  catalogName,
  FOLLOWER_CLOTHING,
  FOLLOWER_CUSTOMISATIONS,
  FOLLOWER_HATS,
  FOLLOWER_OUTFITS,
  FOLLOWER_SPECIALS,
  FOLLOWER_TRAITS,
  type FollowerCatalog,
} from "./follower-catalogs";
import { DEATH_CAUSES } from "./overview";
import { rawValuesMatch } from "./raw-values";
import type { SaveRecord } from "./types";

/**
 * Death cause is staged as one virtual field holding a single flag name
 * (or "" for a ritual death); apply expands it so exactly one of the
 * DiedOf* flags can end up true. The raw flags are never stageable, so
 * contradictory multi-flag states cannot be produced.
 */
export const DEATH_CAUSE_FIELD = "DeathCause";

/**
 * Status is staged as one virtual tri-state field. "Dead" moves the
 * record between the living and dead lists (the game keeps elder
 * membership across death, so killing leaves it untouched); "Elder" and
 * "Active" toggle Followers_Elderly_IDs membership, reviving first when
 * the follower is dead. Contradictions are structurally impossible: one
 * field, one value.
 *
 * The game turns a follower elder once Age reaches LifeExpectancy and
 * kills the elder 3.5 days later, so a status toggle that leaves the two
 * fields contradicting it would be undone on the next day tick. Applying
 * "Active" therefore pushes LifeExpectancy above Age when needed, and
 * applying "Elder" pulls it down to Age. A LifeExpectancy value that
 * already agrees with the target status is kept, including staged edits.
 */
export const STATUS_FIELD = "Status";

export type FollowerStatus = "Active" | "Elder" | "Dead";

const FOLLOWER_STATUSES: readonly FollowerStatus[] = [
  "Active",
  "Elder",
  "Dead",
];

function isFollowerStatus(value: unknown): value is FollowerStatus {
  return FOLLOWER_STATUSES.includes(value as FollowerStatus);
}

/**
 * A status toggle must leave Age and LifeExpectancy agreeing with it, or
 * the game undoes the toggle on the next day tick. Returns the pushed
 * (Active) or pulled (Elder) lifespan, or null when the current value
 * already agrees. A fresh recruit lives 15-30 more days, so a pushed-out
 * lifespan of Age + 15 stays inside the game's own range.
 */
function alignedLifeExpectancy(
  age: unknown,
  expectancy: unknown,
  target: FollowerStatus,
): number | null {
  if (typeof age !== "number" || typeof expectancy !== "number") {
    return null;
  }
  if (target === "Active" && expectancy <= age) {
    return Math.floor(age) + 15;
  }
  if (target === "Elder" && expectancy > age) {
    return Math.floor(age);
  }
  return null;
}

function elderIds(original: SaveRecord): number[] {
  const value = original.Followers_Elderly_IDs;
  return Array.isArray(value)
    ? value.filter((id): id is number => typeof id === "number")
    : [];
}

export function followerStatusOf(
  original: SaveRecord,
  followerId: number,
): FollowerStatus {
  const { dead } = followerById(original, followerId);
  if (dead) {
    return "Dead";
  }
  return elderIds(original).includes(followerId) ? "Elder" : "Active";
}

export function deathCauseOf(record: SaveRecord): string {
  return (
    DEATH_CAUSES.find(([flag]) => record[flag] === true)?.[0] ?? ""
  );
}

function deathCauseLabel(flag: string): string {
  if (flag === "") {
    return "None (Ritual)";
  }
  return (
    DEATH_CAUSES.find(([candidate]) => candidate === flag)?.[1] ?? flag
  );
}

export const MAX_FOLLOWER_NAME_LENGTH = 60;
export const MAX_FOLLOWER_AGE = 9999;
// The game no longer caps loyalty levels; this is only a sanity bound.
export const MAX_FOLLOWER_LEVEL = 9999;

export interface FollowerFieldEdit {
  field: string;
  followerId: number;
  value: unknown;
}

export interface FollowerEdits {
  fields: FollowerFieldEdit[];
}

export interface PendingFollowerEdit {
  field: string;
  fieldLabel: string;
  followerId: number;
  followerName: string;
  from: string;
  to: string;
  /**
   * Set when this row is a consequence of another staged edit rather
   * than an edit of its own: discarding the named source field removes
   * this row with it. Used for the lifespan alignment that a Status
   * toggle carries.
   */
  sourceField?: string;
}

export class FollowerEditError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FollowerEditError";
  }
}

interface FollowerFieldDefinition {
  display(value: unknown): string;
  label: string;
  validate(value: unknown): string | null;
}

function isWholeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function plainNumber(value: unknown): string {
  return typeof value === "number" ? String(value) : "unknown";
}

function wholeNumberField(
  label: string,
  maximum: number,
): FollowerFieldDefinition {
  return {
    display: plainNumber,
    label,
    validate: (value) =>
      isWholeNumber(value) && value <= maximum
        ? null
        : `must be a whole number between 0 and ${maximum}`,
  };
}

function percentField(label: string): FollowerFieldDefinition {
  return {
    display: (value) =>
      typeof value === "number"
        ? String(Math.round(value * 100) / 100)
        : "unknown",
    label,
    validate: (value) =>
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
        ? null
        : "must be a number between 0 and 100",
  };
}

function textField(label: string): FollowerFieldDefinition {
  return {
    display: (value) =>
      typeof value === "string" ? `“${value}”` : "unknown",
    label,
    validate: (value) =>
      typeof value === "string" ? null : "must be text",
  };
}

function catalogField(
  label: string,
  catalog: FollowerCatalog,
  kind: string,
): FollowerFieldDefinition {
  return {
    display: (value) =>
      isWholeNumber(value)
        ? catalogName(catalog, value, kind)
        : "unknown",
    label,
    validate: (value) =>
      isWholeNumber(value) && catalog[value] !== undefined
        ? null
        : `must be a catalogued ${kind} id`,
  };
}

// Mirrors the writer's FOLLOWER_EDITABLE_SUBFIELDS allowlist.
const FOLLOWER_FIELDS: Readonly<
  Record<string, FollowerFieldDefinition>
> = {
  Age: wholeNumberField("Age", MAX_FOLLOWER_AGE),
  Clothing: catalogField("Clothing", FOLLOWER_CLOTHING, "clothing"),
  ClothingPreviousVariant: textField("Previous clothing variant"),
  ClothingVariant: textField("Clothing variant"),
  Customisation: catalogField(
    "Customisation",
    FOLLOWER_CUSTOMISATIONS,
    "customisation",
  ),
  Hat: catalogField("Hat", FOLLOWER_HATS, "hat"),
  LifeExpectancy: wholeNumberField("Life expectancy", MAX_FOLLOWER_AGE),
  Necklace: {
    display: (value) =>
      value === 0
        ? "None"
        : isWholeNumber(value)
          ? (ITEM_NAMES[value] ?? `Unknown item ${value}`)
          : "unknown",
    label: "Necklace",
    validate: (value) =>
      value === 0 ||
      (isWholeNumber(value) && ITEM_NAMES[value] !== undefined)
        ? null
        : "must be 0 or a known inventory item id",
  },
  Outfit: catalogField("Outfit", FOLLOWER_OUTFITS, "outfit"),
  ShowingNecklace: {
    display: (value) => (value === true ? "shown" : "hidden"),
    label: "Necklace visibility",
    validate: (value) =>
      typeof value === "boolean" ? null : "must be true or false",
  },
  SkinColour: wholeNumberField("Skin colour", 99),
  SkinVariation: wholeNumberField("Skin variation", 99),
  Special: catalogField("Special", FOLLOWER_SPECIALS, "special"),
  Traits: {
    display: (value) =>
      Array.isArray(value) && value.length > 0
        ? value
            .map((trait) =>
              isWholeNumber(trait)
                ? catalogName(FOLLOWER_TRAITS, trait, "trait")
                : "unknown",
            )
            .join(", ")
        : "None",
    label: "Traits",
    validate: (value) => {
      if (
        !Array.isArray(value) ||
        !value.every(
          (trait) =>
            isWholeNumber(trait) &&
            FOLLOWER_TRAITS[trait] !== undefined,
        )
      ) {
        return "must be a list of catalogued trait ids";
      }
      return new Set(value).size === value.length
        ? null
        : "must not repeat a trait";
    },
  },
  XPLevel: wholeNumberField("Level", MAX_FOLLOWER_LEVEL),
  _happiness: percentField("Happiness"),
  _illness: percentField("Illness"),
  _name: {
    display: (value) =>
      typeof value === "string" ? `“${value}”` : "unknown",
    label: "Name",
    validate: (value) => {
      if (typeof value !== "string" || value.trim().length === 0) {
        return "must be non-empty text";
      }
      if (value.length > MAX_FOLLOWER_NAME_LENGTH) {
        return `cannot be longer than ${MAX_FOLLOWER_NAME_LENGTH} characters`;
      }
      if (/[\u0000-\u001f\u007f]/.test(value)) {
        return "cannot contain control characters";
      }
      return null;
    },
  },
  _satiation: percentField("Satiation"),
};

export function emptyFollowerEdits(): FollowerEdits {
  return { fields: [] };
}

export function hasFollowerEdits(edits: FollowerEdits): boolean {
  return edits.fields.length > 0;
}

function followerDisplayName(follower: SaveRecord): string {
  const name = follower._name ?? follower.Name;
  return typeof name === "string" && name.trim() !== ""
    ? name
    : `Follower ${String(follower.ID)}`;
}

function followerRecords(value: unknown): SaveRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is SaveRecord =>
      entry !== null && typeof entry === "object" && !Array.isArray(entry),
  );
}

function followerById(
  original: SaveRecord,
  followerId: number,
): { dead: boolean; record: SaveRecord } {
  if (!Array.isArray(original.Followers)) {
    throw new FollowerEditError(
      "This save does not store an editable follower list.",
    );
  }
  const matches = [
    ...followerRecords(original.Followers).map(
      (record) => ({ dead: false, record }),
    ),
    ...followerRecords(original.Followers_Dead).map(
      (record) => ({ dead: true, record }),
    ),
  ].filter((entry) => entry.record.ID === followerId);
  if (matches.length === 0) {
    throw new FollowerEditError(
      `Follower ${followerId} is not in this save's living or dead follower lists.`,
    );
  }
  const match = matches[0];
  if (matches.length > 1 || match === undefined) {
    throw new FollowerEditError(
      `Follower ${followerId} appears more than once in the follower lists.`,
    );
  }
  return match;
}

function requiredFieldDefinition(
  field: string,
): FollowerFieldDefinition {
  const definition = FOLLOWER_FIELDS[field];
  if (definition === undefined) {
    throw new FollowerEditError(
      `Follower field ${field} is not editable.`,
    );
  }
  return definition;
}

export function stageFollowerEdit(
  original: SaveRecord,
  edits: FollowerEdits,
  edit: FollowerFieldEdit,
): FollowerEdits {
  if (!isWholeNumber(edit.followerId)) {
    throw new FollowerEditError(
      "A follower edit needs the follower's numeric ID.",
    );
  }
  const { dead, record } = followerById(original, edit.followerId);
  const stagedStatus = edits.fields.find(
    (candidate) =>
      candidate.followerId === edit.followerId &&
      candidate.field === STATUS_FIELD,
  );

  let unchanged: boolean;
  let others = edits.fields.filter(
    (candidate) =>
      candidate.followerId !== edit.followerId ||
      candidate.field !== edit.field,
  );
  if (edit.field === STATUS_FIELD) {
    const value = edit.value;
    if (!isFollowerStatus(value)) {
      throw new FollowerEditError(
        "Status must be Active, Elder, or Dead.",
      );
    }
    if (value === "Dead" && !dead) {
      if (!Array.isArray(original.Followers_Dead)) {
        throw new FollowerEditError(
          "This save does not store a dead follower list to move into.",
        );
      }
      for (const [flag] of DEATH_CAUSES) {
        if (!Object.hasOwn(record, flag)) {
          throw new FollowerEditError(
            `This follower's record does not store the ${flag} flag.`,
          );
        }
      }
    }
    if (value !== "Dead") {
      // A revive (or a still-living status) contradicts a staged cause
      // of death, so the cause edit goes with it.
      others = others.filter(
        (candidate) =>
          candidate.followerId !== edit.followerId ||
          candidate.field !== DEATH_CAUSE_FIELD,
      );
    }
    unchanged = value === followerStatusOf(original, edit.followerId);
  } else if (edit.field === DEATH_CAUSE_FIELD) {
    const effectivelyDead =
      stagedStatus === undefined
        ? dead
        : stagedStatus.value === "Dead";
    if (!effectivelyDead) {
      throw new FollowerEditError(
        "Only a dead follower's cause of death can be edited.",
      );
    }
    const value = edit.value;
    if (
      typeof value !== "string" ||
      (value !== "" &&
        !DEATH_CAUSES.some(([flag]) => flag === value))
    ) {
      throw new FollowerEditError(
        "Cause of death must be a known death flag or empty for a ritual death.",
      );
    }
    if (value !== "" && !Object.hasOwn(record, value)) {
      throw new FollowerEditError(
        `This follower's record does not store the ${value} flag.`,
      );
    }
    unchanged = value === deathCauseOf(record);
  } else {
    const definition = requiredFieldDefinition(edit.field);
    const problem = definition.validate(edit.value);
    if (problem !== null) {
      throw new FollowerEditError(
        `${definition.label} ${problem}.`,
      );
    }
    unchanged = rawValuesMatch(record[edit.field], edit.value);
  }

  return {
    ...edits,
    fields: unchanged ? others : [...others, { ...edit }],
  };
}

export function discardFollowerEdit(
  original: SaveRecord,
  edits: FollowerEdits,
  followerId: number,
  field: string,
): FollowerEdits {
  // A cause of death on a living follower exists only because a kill is
  // staged, so discarding the kill takes the cause with it. A cause on
  // an already-dead follower stands on its own and survives.
  const dropsCause =
    field === STATUS_FIELD &&
    !followerById(original, followerId).dead;
  return {
    ...edits,
    fields: edits.fields.filter(
      (candidate) =>
        candidate.followerId !== followerId ||
        (candidate.field !== field &&
          !(dropsCause && candidate.field === DEATH_CAUSE_FIELD)),
    ),
  };
}

export function discardFollowerEdits(
  edits: FollowerEdits,
  followerId: number,
): FollowerEdits {
  return {
    ...edits,
    fields: edits.fields.filter(
      (candidate) => candidate.followerId !== followerId,
    ),
  };
}

export function editedFollowerIds(
  edits: FollowerEdits,
): Set<number> {
  return new Set(edits.fields.map((edit) => edit.followerId));
}

export function listPendingFollowerEdits(
  original: SaveRecord,
  edits: FollowerEdits,
): PendingFollowerEdit[] {
  const rows: PendingFollowerEdit[] = edits.fields.map((edit) => {
    const { record } = followerById(original, edit.followerId);
    if (edit.field === STATUS_FIELD) {
      return {
        field: edit.field,
        fieldLabel: "Status",
        followerId: edit.followerId,
        followerName: followerDisplayName(record),
        from: followerStatusOf(original, edit.followerId),
        to: String(edit.value),
      };
    }
    if (edit.field === DEATH_CAUSE_FIELD) {
      return {
        field: edit.field,
        fieldLabel: "Cause of death",
        followerId: edit.followerId,
        followerName: followerDisplayName(record),
        from: deathCauseLabel(deathCauseOf(record)),
        to: deathCauseLabel(String(edit.value)),
      };
    }
    const definition = requiredFieldDefinition(edit.field);
    return {
      field: edit.field,
      fieldLabel: definition.label,
      followerId: edit.followerId,
      followerName: followerDisplayName(record),
      from: definition.display(record[edit.field]),
      to: definition.display(edit.value),
    };
  });

  // A status toggle aligns LifeExpectancy at apply time; list that
  // consequence explicitly so the change dock shows the full effect.
  for (const edit of edits.fields) {
    if (edit.field !== STATUS_FIELD || !isFollowerStatus(edit.value)) {
      continue;
    }
    const { record } = followerById(original, edit.followerId);
    const staged = (field: string): unknown =>
      edits.fields.find(
        (candidate) =>
          candidate.followerId === edit.followerId &&
          candidate.field === field,
      )?.value ?? record[field];
    const expectancy = staged("LifeExpectancy");
    const aligned = alignedLifeExpectancy(
      staged("Age"),
      expectancy,
      edit.value,
    );
    if (aligned !== null) {
      const definition = requiredFieldDefinition("LifeExpectancy");
      rows.push({
        field: "LifeExpectancy",
        fieldLabel: definition.label,
        followerId: edit.followerId,
        followerName: followerDisplayName(record),
        from: definition.display(expectancy),
        to: definition.display(aligned),
        sourceField: STATUS_FIELD,
      });
    }
  }
  return rows;
}

const FOLLOWER_EDIT_RESULT_KEYS = [
  "Followers",
  "Followers_Dead",
  "Followers_Dead_IDs",
  "Followers_Elderly_IDs",
] as const;

export function applyFollowerEdits(
  data: SaveRecord,
  original: SaveRecord,
  edits: FollowerEdits,
): SaveRecord {
  if (!hasFollowerEdits(edits)) {
    return data;
  }
  for (const key of FOLLOWER_EDIT_RESULT_KEYS) {
    if (!rawValuesMatch(data[key], original[key])) {
      throw new FollowerEditError(
        "The follower lists changed before the staged edits were applied.",
      );
    }
  }
  if (!Array.isArray(data.Followers)) {
    throw new FollowerEditError(
      "This save does not store an editable follower list.",
    );
  }

  // Re-validate against the original, status first so that cause-of-death
  // edits on a newly killed follower see the staged status.
  let validated = emptyFollowerEdits();
  for (const edit of [
    ...edits.fields.filter((edit) => edit.field === STATUS_FIELD),
    ...edits.fields.filter((edit) => edit.field !== STATUS_FIELD),
  ]) {
    validated = stageFollowerEdit(original, validated, edit);
  }

  const byFollower = new Map<number, FollowerFieldEdit[]>();
  for (const edit of validated.fields) {
    const existing = byFollower.get(edit.followerId) ?? [];
    byFollower.set(edit.followerId, [...existing, edit]);
  }
  const statusEditOf = (id: number): FollowerStatus | undefined => {
    const edit = (byFollower.get(id) ?? []).find(
      (candidate) => candidate.field === STATUS_FIELD,
    );
    return edit === undefined ? undefined : (edit.value as FollowerStatus);
  };
  const causeEditOf = (id: number): string | undefined => {
    const edit = (byFollower.get(id) ?? []).find(
      (candidate) => candidate.field === DEATH_CAUSE_FIELD,
    );
    return edit === undefined ? undefined : String(edit.value);
  };

  function editedRecord(record: SaveRecord): SaveRecord {
    const followerEdits =
      typeof record.ID === "number"
        ? (byFollower.get(record.ID) ?? [])
        : [];
    const replacement: SaveRecord = { ...record };
    for (const edit of followerEdits) {
      if (
        edit.field === STATUS_FIELD ||
        edit.field === DEATH_CAUSE_FIELD
      ) {
        continue;
      }
      replacement[edit.field] = Array.isArray(edit.value)
        ? edit.value.slice()
        : edit.value;
    }
    return replacement;
  }

  function setDeathFlags(record: SaveRecord, cause: string): void {
    for (const [flag] of DEATH_CAUSES) {
      if (Object.hasOwn(record, flag)) {
        record[flag] = flag === cause;
      }
    }
  }

  const alignLifeExpectancy = (
    record: SaveRecord,
    target: FollowerStatus,
  ): void => {
    const aligned = alignedLifeExpectancy(
      record.Age,
      record.LifeExpectancy,
      target,
    );
    if (aligned !== null) {
      record.LifeExpectancy = aligned;
    }
  };

  const followerId = (entry: unknown): number | null =>
    entry !== null &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    typeof (entry as SaveRecord).ID === "number"
      ? ((entry as SaveRecord).ID as number)
      : null;

  const living: unknown[] = [];
  const dead: unknown[] = [];
  const revived: unknown[] = [];
  const killed: unknown[] = [];
  let moved = false;

  for (const entry of data.Followers) {
    const id = followerId(entry);
    const target = id === null ? undefined : statusEditOf(id);
    if (id !== null && target === "Dead") {
      // Killing keeps the elder markers in place, exactly like the game.
      const record = editedRecord(entry as SaveRecord);
      setDeathFlags(record, causeEditOf(id) ?? "");
      killed.push(record);
      moved = true;
      continue;
    }
    if (id === null || (byFollower.get(id) ?? []).length === 0) {
      living.push(entry);
      continue;
    }
    const record = editedRecord(entry as SaveRecord);
    if (target !== undefined) {
      if (Object.hasOwn(record, "OldAge")) {
        record.OldAge = target === "Elder";
      }
      alignLifeExpectancy(record, target);
    }
    living.push(
      rawValuesMatch(record, entry) ? entry : record,
    );
  }
  const deadList = Array.isArray(data.Followers_Dead)
    ? data.Followers_Dead
    : [];
  for (const entry of deadList) {
    const id = followerId(entry);
    const target = id === null ? undefined : statusEditOf(id);
    if (id !== null && (target === "Active" || target === "Elder")) {
      const record = editedRecord(entry as SaveRecord);
      setDeathFlags(record, "never");
      if (Object.hasOwn(record, "OldAge")) {
        record.OldAge = target === "Elder";
      }
      alignLifeExpectancy(record, target);
      revived.push(record);
      moved = true;
      continue;
    }
    if (id === null || (byFollower.get(id) ?? []).length === 0) {
      dead.push(entry);
      continue;
    }
    const record = editedRecord(entry as SaveRecord);
    const cause = id === null ? undefined : causeEditOf(id);
    if (cause !== undefined) {
      setDeathFlags(record, cause);
    }
    dead.push(rawValuesMatch(record, entry) ? entry : record);
  }
  living.push(...revived);
  dead.push(...killed);

  const result: SaveRecord = { ...data };
  const sameEntries = (built: unknown[], source: unknown): boolean =>
    Array.isArray(source) &&
    built.length === source.length &&
    built.every((entry, index) => entry === source[index]);
  result.Followers = sameEntries(living, data.Followers)
    ? data.Followers
    : living;
  if (Object.hasOwn(data, "Followers_Dead") || killed.length > 0) {
    result.Followers_Dead = sameEntries(dead, data.Followers_Dead)
      ? data.Followers_Dead
      : dead;
  }

  if (moved) {
    // The save keeps this array in the dead list's order; refuse to guess
    // if the file we opened does not.
    const deadIds = deadList.map(followerId);
    if (
      !Array.isArray(data.Followers_Dead_IDs) ||
      !rawValuesMatch(data.Followers_Dead_IDs, deadIds)
    ) {
      throw new FollowerEditError(
        "Followers_Dead_IDs does not mirror the dead follower list, so followers cannot be moved safely.",
      );
    }
    result.Followers_Dead_IDs = dead.map(followerId);
  }

  const elderTargets = validated.fields.filter(
    (edit) => edit.field === STATUS_FIELD && edit.value !== "Dead",
  );
  if (elderTargets.length > 0) {
    if (!Array.isArray(data.Followers_Elderly_IDs)) {
      throw new FollowerEditError(
        "This save does not store the elderly follower list.",
      );
    }
    let elderly = data.Followers_Elderly_IDs.slice();
    for (const edit of elderTargets) {
      if (edit.value === "Elder") {
        if (!elderly.includes(edit.followerId)) {
          elderly.push(edit.followerId);
        }
      } else {
        elderly = elderly.filter((id) => id !== edit.followerId);
      }
    }
    if (!rawValuesMatch(elderly, data.Followers_Elderly_IDs)) {
      result.Followers_Elderly_IDs = elderly;
    }
  }

  for (const key of new Set([
    ...Object.keys(data),
    ...Object.keys(result),
  ])) {
    if (
      !(FOLLOWER_EDIT_RESULT_KEYS as readonly string[]).includes(key) &&
      !Object.is(data[key], result[key])
    ) {
      throw new FollowerEditError(
        `The follower edits changed unapproved field ${key}.`,
      );
    }
  }
  return result;
}
