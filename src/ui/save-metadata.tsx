import type {
  MessagePackSource,
  SaveCompatibilityReport,
  SaveFormat,
  SaveRecord,
} from "../save/types";

interface SaveMetadataProps {
  data: SaveRecord;
  file: File;
  format: SaveFormat;
  messagePack?: MessagePackSource;
  report: SaveCompatibilityReport;
}

const formatLabels: Record<SaveFormat, string> = {
  "plain-json": "Legacy plaintext JSON (.json)",
  "encrypted-json": "Legacy encrypted JSON (.json)",
  "encrypted-messagepack": "Encrypted MessagePack (.mp)",
};

function gameVersionLabel(
  data: SaveRecord,
  messagePack?: MessagePackSource,
): string {
  if (
    (typeof data.Version === "string" && data.Version.trim()) ||
    typeof data.Version === "number"
  ) {
    return String(data.Version);
  }
  return messagePack?.schema === "slot"
    ? "Not stored in this slot file"
    : "Not recorded";
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SaveMetadata({
  data,
  file,
  format,
  messagePack,
  report,
}: SaveMetadataProps) {
  return (
    <dl className="details">
      <Detail label="Format" value={formatLabels[format]} />
      <Detail label="Size" value={`${(file.size / 1024).toFixed(1)} KiB`} />
      <Detail
        label="File modified"
        value={
          file.lastModified
            ? new Date(file.lastModified).toLocaleString()
            : "Unavailable"
        }
      />
      <Detail
        label="Game version"
        value={gameVersionLabel(data, messagePack)}
      />
      <Detail label="Top-level fields" value={String(report.fieldCount)} />
      <Detail
        label="Doctrine unlocks"
        value={
          report.doctrineFields.doctrineUnlockCount?.toString() ?? "Not found"
        }
      />
      <Detail
        label="General upgrades"
        value={
          report.doctrineFields.unlockedUpgradeCount?.toString() ?? "Not found"
        }
      />
      <Detail
        label="Cult traits"
        value={
          report.doctrineFields.cultTraitsCount === null
            ? "Not found"
            : `${report.doctrineFields.cultTraitsCount} (${report.doctrineFields.cultTraitsField})`
        }
      />
    </dl>
  );
}
