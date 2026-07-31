type AlchemicalMarkKind = "black-sulfur" | "salt" | "sulfur";

interface AlchemicalMarkProps {
  className: string;
  kind: AlchemicalMarkKind;
}

export function AlchemicalMark({
  className,
  kind,
}: AlchemicalMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={`alchemy-mark ${className}`}
      focusable="false"
      viewBox="0 0 64 72"
    >
      {kind === "black-sulfur" ? (
        <>
          <path d="M32 7v49M19 18h26M14 30h36" />
          <path d="M32 56C24 44 12 46 12 56s12 12 20 0c8-12 20-10 20 0s-12 12-20 0" />
        </>
      ) : kind === "salt" ? (
        <>
          <circle cx="32" cy="36" r="21" />
          <path d="M11 36h42" />
        </>
      ) : (
        <>
          <path d="m32 8 20 34H12L32 8Z" />
          <path d="M32 42v23M20 54h24" />
        </>
      )}
    </svg>
  );
}

export function DoubleBarInvertedCross() {
  return (
    <svg
      aria-hidden="true"
      className="eyebrow-mark"
      focusable="false"
      viewBox="0 0 28 38"
    >
      <path d="M14 4v30M9 18h10M5 25h18" />
    </svg>
  );
}
