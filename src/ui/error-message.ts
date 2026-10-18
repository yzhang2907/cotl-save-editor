/* Chunk-load failures surface browser-specific wording:
   Firefox "error loading dynamically imported module: <url>",
   Chrome "Failed to fetch dynamically imported module: <url>",
   Safari "Importing a module script failed." */
const STALE_MODULE_PATTERN =
  /dynamically imported module|importing a module script failed/i;

export const STALE_MODULE_MESSAGE =
  "The editor has been updated. Reload the page and try again.";

export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unknown error.";
  return STALE_MODULE_PATTERN.test(message)
    ? STALE_MODULE_MESSAGE
    : message;
}
