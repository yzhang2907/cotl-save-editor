import type { SaveFormat } from "./types";

export function sourceWarnings(
  fileName: string,
  format: SaveFormat,
): string[] {
  const warnings: string[] = [];

  if (format !== "encrypted-messagepack") {
    warnings.push(
      "Current game versions use slot_#.mp. If a matching .mp file exists, this legacy JSON may be a stale copy.",
    );
  }

  if (
    format === "encrypted-messagepack" &&
    !fileName.toLowerCase().endsWith(".mp")
  ) {
    warnings.push(
      "The file contains current MessagePack data but does not use the expected .mp extension.",
    );
  }

  return warnings;
}
