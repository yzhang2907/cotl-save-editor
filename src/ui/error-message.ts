/* Chunk-load failures surface browser-specific wording:
   Firefox "error loading dynamically imported module: <url>",
   Chrome "Failed to fetch dynamically imported module: <url>",
   Safari "Importing a module script failed." */
const STALE_MODULE_PATTERN =
  /dynamically imported module|importing a module script failed/i;

export const STALE_MODULE_MESSAGE =
  "The editor was updated since this tab was opened. Reload the " +
  "page and try again — any staged changes will need to be staged " +
  "again.";

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unknown error.";
  return STALE_MODULE_PATTERN.test(message)
    ? STALE_MODULE_MESSAGE
    : message;
}
