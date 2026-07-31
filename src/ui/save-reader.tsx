import { useState, type ChangeEvent, type DragEvent } from "react";

interface SaveReaderProps {
  onFile: (file: File) => void;
}

function firstFile(files: FileList | null): File | null {
  return files?.item(0) ?? null;
}

export function SaveReader({ onFile }: SaveReaderProps) {
  const [dragging, setDragging] = useState(false);

  function selectFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = firstFile(event.currentTarget.files);
    if (file) {
      onFile(file);
    }
    event.currentTarget.value = "";
  }

  function enterDropZone(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(true);
  }

  function leaveDropZone(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setDragging(false);
  }

  function dropFile(event: DragEvent<HTMLLabelElement>): void {
    event.preventDefault();
    setDragging(false);
    const file = firstFile(event.dataTransfer.files);
    if (file) {
      onFile(file);
    }
  }

  return (
    <section className="reader" aria-labelledby="reader-title">
      <div className="reader-copy">
        <div className="step" aria-hidden="true">
          I
        </div>
        <div>
          <p className="section-label">First things first</p>
          <h2 id="reader-title">Bring forth your save</h2>
          <p>
            Choose a <code>slot_#.mp</code> save, or an older{" "}
            <code>slot_#.json</code> save.
          </p>
        </div>
      </div>

      <label
        className={`drop-zone${dragging ? " dragging" : ""}`}
        id="drop-zone"
        onDragEnter={enterDropZone}
        onDragLeave={leaveDropZone}
        onDragOver={enterDropZone}
        onDrop={dropFile}
      >
        <input
          id="file-input"
          type="file"
          accept=".mp,.json,application/json"
          onChange={selectFile}
        />
        <span className="drop-mark" aria-hidden="true">
          <svg viewBox="0 0 96 96">
            <path d="M29 19h27l13 13v45H29V19Z" />
            <path d="M56 19v15h14M40 52c5-7 11-7 16 0-5 7-11 7-16 0Z" />
            <circle cx="48" cy="52" r="2.5" />
          </svg>
        </span>
        <strong>Choose a save</strong>
        <span>or drop it into the circle</span>
      </label>

      <div className="save-rules" aria-label="File handling details">
        <span>
          <b>✓</b> Read locally
        </span>
        <span>
          <b>✓</b> Nothing overwritten
        </span>
        <span>
          <b>✓</b> 64 MiB maximum
        </span>
      </div>
    </section>
  );
}
