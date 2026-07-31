import {
  planDoctrineChange,
  planDoctrineRemoval,
  type DoctrineChangePlan,
  type DoctrineFieldChange,
  type DoctrineOperation,
  type DoctrineStorageField,
} from "./doctrine-editor";
import type { DlcKey } from "./dlc";
import type { SaveRecord } from "./types";

const EDITABLE_FIELDS = new Set<DoctrineStorageField>([
  "DoctrineUnlockedUpgrades",
  "CultTraits",
  "CultTrait",
  "UnlockedUpgrades",
]);

export interface AppliedDoctrineChange {
  categoryName: string;
  changes: DoctrineFieldChange[];
  fromDoctrineId: number | null;
  fromName: string | null;
  operation: DoctrineOperation;
  rank: number;
  requiredDlc: DlcKey | null;
  toDoctrineId: number | null;
  toName: string | null;
}

export type PendingDoctrineChange = Omit<
  AppliedDoctrineChange,
  "changes"
>;

export interface DoctrineWorkspace {
  data: SaveRecord;
  history: AppliedDoctrineChange[];
  original: SaveRecord;
}

export class DoctrineWorkspaceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DoctrineWorkspaceError";
  }
}

function numberArray(value: unknown): number[] | null {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "number")
  ) {
    return null;
  }
  return value;
}

function arraysMatch(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function changesMatch(
  left: DoctrineFieldChange[],
  right: DoctrineFieldChange[],
): boolean {
  return (
    left.length === right.length &&
    left.every((change, index) => {
      const comparison = right[index];
      return (
        comparison !== undefined &&
        change.field === comparison.field &&
        arraysMatch(change.before, comparison.before) &&
        arraysMatch(change.after, comparison.after) &&
        arraysMatch(change.added, comparison.added) &&
        arraysMatch(change.removed, comparison.removed)
      );
    })
  );
}

function freshPlan(
  data: SaveRecord,
  selection: DoctrineChangePlan,
): DoctrineChangePlan {
  if (
    selection.state !== "ready" ||
    selection.operation === null ||
    (selection.operation === "remove"
      ? selection.from === null
      : selection.to === null)
  ) {
    throw new DoctrineWorkspaceError(
      "Only a valid doctrine selection can be applied.",
    );
  }

  let current: DoctrineChangePlan;
  if (selection.operation === "remove") {
    if (selection.from === null) {
      throw new DoctrineWorkspaceError(
        "A doctrine removal must identify its current choice.",
      );
    }
    current = planDoctrineRemoval(data, selection.from.doctrineId);
  } else {
    if (selection.to === null) {
      throw new DoctrineWorkspaceError(
        "A doctrine selection must identify its new choice.",
      );
    }
    current = planDoctrineChange(data, selection.to.doctrineId);
  }
  if (
    current.state !== "ready" ||
    current.operation === null ||
    current.categoryKey !== selection.categoryKey ||
    current.rank !== selection.rank ||
    current.requiredDlc !== selection.requiredDlc ||
    current.operation !== selection.operation ||
    current.from?.doctrineId !== selection.from?.doctrineId ||
    current.to?.doctrineId !== selection.to?.doctrineId ||
    !changesMatch(current.changes, selection.changes)
  ) {
    throw new DoctrineWorkspaceError(
      "The working copy changed before this selection was applied. Select it again.",
    );
  }
  return current;
}

function applyFieldValues(
  data: SaveRecord,
  changes: DoctrineFieldChange[],
  direction: "after" | "before",
): SaveRecord {
  const result: SaveRecord = { ...data };
  const expectedFields = new Set<string>();

  for (const change of changes) {
    if (!EDITABLE_FIELDS.has(change.field)) {
      throw new DoctrineWorkspaceError(
        `${change.field} is not an approved doctrine field.`,
      );
    }
    const current = numberArray(data[change.field]);
    const expected = direction === "after" ? change.before : change.after;
    if (current === null || !arraysMatch(current, expected)) {
      throw new DoctrineWorkspaceError(
        `${change.field} changed unexpectedly. The operation was stopped.`,
      );
    }

    if (change.changed) {
      result[change.field] = (
        direction === "after" ? change.after : change.before
      ).slice();
      expectedFields.add(change.field);
    }
  }

  const keys = new Set([...Object.keys(data), ...Object.keys(result)]);
  for (const key of keys) {
    if (!expectedFields.has(key) && !Object.is(data[key], result[key])) {
      throw new DoctrineWorkspaceError(
        `The operation changed unapproved field ${key}.`,
      );
    }
  }

  return result;
}

function assertWorkspaceIntegrity(
  original: SaveRecord,
  working: SaveRecord,
): void {
  const keys = new Set([
    ...Object.keys(original),
    ...Object.keys(working),
  ]);
  for (const key of keys) {
    if (
      !EDITABLE_FIELDS.has(key as DoctrineStorageField) &&
      !Object.is(original[key], working[key])
    ) {
      throw new DoctrineWorkspaceError(
        `The working copy changed unapproved field ${key}.`,
      );
    }
  }
}

function hasDoctrineChanges(
  original: SaveRecord,
  working: SaveRecord,
): boolean {
  for (const field of EDITABLE_FIELDS) {
    const originalValue = numberArray(original[field]);
    const workingValue = numberArray(working[field]);
    if (originalValue === null || workingValue === null) {
      if (!Object.is(original[field], working[field])) {
        return true;
      }
    } else if (!arraysMatch(originalValue, workingValue)) {
      return true;
    }
  }
  return false;
}

function appliedChange(plan: DoctrineChangePlan): AppliedDoctrineChange {
  if (
    plan.operation === null ||
    plan.categoryName === null ||
    plan.rank === null ||
    (plan.operation === "remove" ? plan.from === null : plan.to === null)
  ) {
    throw new DoctrineWorkspaceError(
      "The doctrine selection does not identify a complete change.",
    );
  }
  return {
    categoryName: plan.categoryName,
    changes: plan.changes.map((change) => ({
      ...change,
      added: change.added.slice(),
      after: change.after.slice(),
      before: change.before.slice(),
      removed: change.removed.slice(),
    })),
    fromDoctrineId: plan.from?.doctrineId ?? null,
    fromName: plan.from?.name ?? null,
    operation: plan.operation,
    rank: plan.rank,
    requiredDlc: plan.requiredDlc,
    toDoctrineId: plan.to?.doctrineId ?? null,
    toName: plan.to?.name ?? null,
  };
}

export function createDoctrineWorkspace(
  original: SaveRecord,
): DoctrineWorkspace {
  return {
    data: original,
    history: [],
    original,
  };
}

export function applyDoctrineChange(
  workspace: DoctrineWorkspace,
  selection: DoctrineChangePlan,
): DoctrineWorkspace {
  const plan = freshPlan(workspace.data, selection);
  const data = applyFieldValues(workspace.data, plan.changes, "after");
  assertWorkspaceIntegrity(workspace.original, data);
  if (!hasDoctrineChanges(workspace.original, data)) {
    return createDoctrineWorkspace(workspace.original);
  }
  return {
    ...workspace,
    data,
    history: [...workspace.history, appliedChange(plan)],
  };
}

export function listPendingDoctrineChanges(
  workspace: DoctrineWorkspace,
): PendingDoctrineChange[] {
  const pending = new Map<string, PendingDoctrineChange>();

  for (const change of workspace.history) {
    const key = `${change.categoryName}\u0000${change.rank}`;
    const existing = pending.get(key);
    const netChange: PendingDoctrineChange = existing
      ? {
          ...existing,
          toDoctrineId: change.toDoctrineId,
          toName: change.toName,
        }
      : {
          categoryName: change.categoryName,
          fromDoctrineId: change.fromDoctrineId,
          fromName: change.fromName,
          operation: change.operation,
          rank: change.rank,
          requiredDlc: change.requiredDlc,
          toDoctrineId: change.toDoctrineId,
          toName: change.toName,
        };

    netChange.operation =
      netChange.fromDoctrineId === null
        ? "unlock"
        : netChange.toDoctrineId === null
          ? "remove"
          : "replace";
    if (
      netChange.fromDoctrineId === netChange.toDoctrineId
    ) {
      pending.delete(key);
    } else {
      pending.set(key, netChange);
    }
  }

  return [...pending.values()];
}

export function discardDoctrineChange(
  workspace: DoctrineWorkspace,
  change: PendingDoctrineChange,
): DoctrineWorkspace {
  const pending = listPendingDoctrineChanges(workspace).find(
    (candidate) =>
      candidate.categoryName === change.categoryName &&
      candidate.rank === change.rank,
  );
  if (
    pending === undefined ||
    pending.fromDoctrineId !== change.fromDoctrineId ||
    pending.toDoctrineId !== change.toDoctrineId
  ) {
    throw new DoctrineWorkspaceError(
      "That pending doctrine change is no longer current.",
    );
  }

  let rebuilt = createDoctrineWorkspace(workspace.original);
  for (const retained of listPendingDoctrineChanges(workspace)) {
    if (
      retained.categoryName === pending.categoryName &&
      retained.rank === pending.rank
    ) {
      continue;
    }
    let plan: DoctrineChangePlan;
    if (retained.operation === "remove") {
      if (retained.fromDoctrineId === null) {
        throw new DoctrineWorkspaceError(
          "A pending doctrine removal has no current choice.",
        );
      }
      plan = planDoctrineRemoval(
        rebuilt.data,
        retained.fromDoctrineId,
      );
    } else {
      if (retained.toDoctrineId === null) {
        throw new DoctrineWorkspaceError(
          "A pending doctrine selection has no new choice.",
        );
      }
      plan = planDoctrineChange(rebuilt.data, retained.toDoctrineId);
    }
    try {
      rebuilt = applyDoctrineChange(rebuilt, plan);
    } catch (error) {
      throw new DoctrineWorkspaceError(
        "That change is required by another pending doctrine unlock. Discard the later rank first.",
        { cause: error },
      );
    }
  }
  return rebuilt;
}

export function resetDoctrineChanges(
  workspace: DoctrineWorkspace,
): DoctrineWorkspace {
  if (workspace.history.length === 0) {
    return workspace;
  }
  return createDoctrineWorkspace(workspace.original);
}
