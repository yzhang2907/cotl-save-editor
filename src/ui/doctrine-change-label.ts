import type { PendingDoctrineChange } from "../save/doctrine-workspace";

export function doctrineChangeLabel(
  change: PendingDoctrineChange,
): string {
  if (change.fromName === null) {
    return `Unlock ${change.toName}`;
  }
  if (change.toName === null) {
    return `Remove ${change.fromName}`;
  }
  return `${change.fromName} → ${change.toName}`;
}
