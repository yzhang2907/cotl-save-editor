import type { SaveRecord } from "./types";

export const DLC_DEFINITIONS = {
  woolhaven: {
    displayName: "Woolhaven",
    slotActivationField: "MAJOR_DLC",
  },
} as const;

export type DlcKey = keyof typeof DLC_DEFINITIONS;

export function dlcDefinition(key: DlcKey) {
  return DLC_DEFINITIONS[key];
}

export function saveHasActivatedDlc(
  data: SaveRecord,
  key: DlcKey,
): boolean {
  return data[dlcDefinition(key).slotActivationField] === true;
}
