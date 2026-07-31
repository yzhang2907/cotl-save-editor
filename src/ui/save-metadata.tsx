import type {
  SaveCompatibilityReport,
  SaveFormat,
} from "../save/types";

interface SaveMetadataProps {
  file: File;
  format: SaveFormat;
  report: SaveCompatibilityReport;
}

const formatLabels: Record<SaveFormat, string> = {
  "plain-json": "Legacy plaintext JSON (.json)",
  "encrypted-json": "Legacy encrypted JSON (.json)",
  "encrypted-messagepack": "Encrypted MessagePack (.mp)",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SaveMetadata({
  file,
  format,
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
            : String(report.doctrineFields.cultTraitsCount)
        }
      />
    </dl>
  );
}
