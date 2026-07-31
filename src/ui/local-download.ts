export function downloadLocalFile(
  bytes: Uint8Array,
  fileName: string,
): void {
  const exactBytes = bytes.slice().buffer as ArrayBuffer;
  const url = URL.createObjectURL(
    new Blob([exactBytes], {
      type: "application/octet-stream",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
