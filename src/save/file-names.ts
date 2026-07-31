export function editedSaveFileName(sourceName: string): string {
  const baseName = sourceName.replace(/\.mp$/i, "") || "slot";
  return `${baseName}.edited.mp`;
}
