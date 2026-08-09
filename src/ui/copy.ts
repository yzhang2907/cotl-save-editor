import { CATALOG_GAME_VERSION } from "../save/catalogs";
import { MAX_SAVE_MEBIBYTES } from "../save/limits";

export const ADVANCED_DIAGNOSTICS_TITLE = "Advanced diagnostics";
export const EDITED_SAVE_STEP_TITLE = "Seal your fate";
export const EDITED_SAVE_SUBSECTION_TITLE = "Download the edited save";
export const EDITED_SAVE_REVIEW_LABEL = "Review edited file";
export const HERO_TAGLINE = "Wrong doctrine? Let’s fix that.";
export const NO_ACCOUNT_NEEDED_LABEL = "No account needed";
export const NO_DOCTRINE_CHANGES_LABEL = "No changes";
export const NO_EDITED_SAVE_CHANGES_LABEL = "No changes yet";
export const NOTHING_OVERWRITTEN_LABEL = "Nothing overwritten";
export const READ_ONLY_LABEL = "Read-Only";
export const SAVE_SIZE_MAXIMUM_LABEL =
  `${MAX_SAVE_MEBIBYTES} MiB maximum`;
export const SUPPORTED_GAME_VERSION_LABEL =
  `Tested with game version ${CATALOG_GAME_VERSION}`;
export const SAVE_REPORT_TITLE = "Rethink your path";
export const TECHNICAL_SAVE_PREVIEW_LABEL = "Technical save preview";
export const TECHNICAL_SAVE_PREVIEW_COPY_LABEL = "Copy record";
export const TECHNICAL_SAVE_PREVIEW_COPIED_LABEL = "Copied";
export const UNCHANGED_REBUILD_DISCLOSURE_LABEL =
  "Unchanged rebuild test copy";
export const UNCHANGED_REBUILD_DOWNLOAD_LABEL =
  "Download unchanged rebuild";

export const GO_TO_DOWNLOAD_LABEL = "Go to download";

export function doctrineChangeCountLabel(changeCount: number): string {
  return changeCount === 0
    ? NO_DOCTRINE_CHANGES_LABEL
    : `${changeCount} ${changeCount === 1 ? "change" : "changes"}`;
}

export function viewPendingChangesLabel(changeCount: number): string {
  return `View ${changeCount} ${changeCount === 1 ? "change" : "changes"}`;
}
