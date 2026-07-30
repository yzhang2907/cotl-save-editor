import "@fontsource/lilita-one/latin-400.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-900.css";
import "./styles.css";

import { analyzeSave } from "./save/analyze";
import { buildCultOverview } from "./save/overview";
import { sourceWarnings } from "./save/source";
import { renderCultOverview } from "./ui/cult-overview";
import type {
  MessagePackSource,
  SaveCompatibilityReport,
  SaveFormat,
  SaveRecord,
} from "./save/types";

const MAX_SAVE_BYTES = 64 * 1024 * 1024;

const formatLabels: Record<SaveFormat, string> = {
  "plain-json": "Legacy plaintext JSON (.json)",
  "encrypted-json": "Legacy encrypted JSON (.json)",
  "encrypted-messagepack": "Encrypted MessagePack (.mp)",
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("The application root was not found.");
}

app.innerHTML = `
  <header class="topbar">
    <div class="topbar-mark" aria-hidden="true">
      <svg viewBox="0 0 64 82">
        <path
          class="crown-body"
          d="M5 7c12 0 20 10 27 30C39 17 47 7 59 7l2 58c-15 12-43 13-58 0L5 7Z"
        />
        <path class="crown-eye" d="M12 49c11-13 29-13 40 0-11 13-29 13-40 0Z" />
        <ellipse class="crown-pupil" cx="32" cy="49" rx="4" ry="10" />
      </svg>
    </div>
    <span>Unofficial fan-made save tool</span>
    <span class="topbar-local">Your save stays in this tab</span>
  </header>

  <main class="shell">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span>✦</span> Cult of the Lamb <span>✦</span></p>
        <h1><span>Save</span> Editor</h1>
        <p class="hook">Picked the wrong doctrine?</p>
        <p class="lede">
          Start by opening your save. This version checks the file and shows
          what it contains; it does not change anything yet.
        </p>
      </div>

      <div class="save-emblem" aria-hidden="true">
        <span class="spark spark-one">✦</span>
        <span class="spark spark-two">×</span>
        <span class="spark spark-three">✦</span>
        <svg viewBox="0 0 280 260" role="presentation">
          <path
            class="disk-body"
            d="M48 25h137l45 44v165H48V25Z"
          />
          <path
            class="disk-corner"
            d="M185 26v43h43"
          />
          <path
            class="disk-label"
            d="M77 25h103v76H77V25Z"
          />
          <path
            class="disk-shutter"
            d="M135 42h29v42h-29V42Z"
          />
          <path
            class="disk-panel"
            d="M75 137h128v97H75v-97Z"
          />
          <path class="disk-eye" d="M96 181c22-25 64-25 86 0-22 25-64 25-86 0Z" />
          <ellipse class="disk-pupil" cx="139" cy="181" rx="7" ry="15" />
          <circle class="disk-screw" cx="65" cy="119" r="5" />
          <path class="disk-scratch" d="m190 112 15-8m-10 16 14-1" />
        </svg>
      </div>
    </header>

    <section class="reader" aria-labelledby="reader-title">
      <div class="reader-copy">
        <div class="step" aria-hidden="true">I</div>
        <div>
          <p class="section-label">First things first</p>
          <h2 id="reader-title">Bring forth your save</h2>
          <p>
            Choose a <code>slot_#.mp</code> save, or an older
            <code>slot_#.json</code> save.
          </p>
        </div>
      </div>
      <label class="drop-zone" id="drop-zone">
        <input id="file-input" type="file" accept=".mp,.json,application/json" />
        <span class="drop-mark" aria-hidden="true">
          <svg viewBox="0 0 96 96">
            <path d="M29 19h27l13 13v45H29V19Z" />
            <path d="M56 19v15h14M40 52c5-7 11-7 16 0-5 7-11 7-16 0Z" />
            <circle cx="48" cy="52" r="2.5" />
          </svg>
        </span>
        <strong>Choose a save</strong>
        <span>or drop it into the circle</span>
      </label>
      <div class="save-rules" aria-label="File handling details">
        <span><b>✓</b> Read locally</span>
        <span><b>✓</b> Nothing overwritten</span>
        <span><b>✓</b> 64 MiB maximum</span>
      </div>
    </section>

    <section id="status" class="status" aria-live="polite" hidden></section>
    <section id="report" class="report" hidden></section>

    <footer>
      <span>Not affiliated with Massive Monster or Devolver Digital</span>
      <span>Back up thy save.</span>
    </footer>
  </main>
`;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

const fileInput = requiredElement<HTMLInputElement>("#file-input");
const dropZone = requiredElement<HTMLElement>("#drop-zone");
const statusElement = requiredElement<HTMLElement>("#status");
const reportElement = requiredElement<HTMLElement>("#report");

function setStatus(message: string, state: "loading" | "error" | "ready"): void {
  statusElement.hidden = false;
  statusElement.className = `status ${state}`;
  statusElement.textContent = message;
}

function makeDetail(label: string, value: string): HTMLDivElement {
  const detail = document.createElement("div");
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  detail.append(term, description);
  return detail;
}

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

function serializeSaveData(data: SaveRecord): string {
  return JSON.stringify(
    data,
    (_key, value: unknown) => {
      if (typeof value === "bigint") {
        return `${value}n`;
      }
      if (value instanceof Uint8Array) {
        return Array.from(value);
      }
      if (value instanceof Map) {
        return Object.fromEntries(value);
      }
      if (value instanceof Set) {
        return Array.from(value);
      }
      return value;
    },
    2,
  );
}

function renderAdvancedDiagnostics(data: SaveRecord): HTMLElement {
  const section = document.createElement("section");
  section.className = "advanced-diagnostics";
  section.append(
    textElement("h3", "", "Advanced diagnostics"),
    textElement(
      "p",
      "",
      "Use this complete decoded record for troubleshooting. Large saves may take a moment to display.",
    ),
  );

  const preview = document.createElement("details");
  preview.className = "preview";
  const summary = document.createElement("summary");
  summary.textContent = "Technical save preview";
  const code = document.createElement("pre");
  code.textContent = "Open this section to prepare the complete save record.";
  let rendered = false;
  preview.addEventListener("toggle", () => {
    if (!preview.open || rendered) {
      return;
    }
    rendered = true;
    code.textContent = "Preparing the complete save record…";
    window.requestAnimationFrame(() => {
      try {
        code.textContent = serializeSaveData(data);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error.";
        code.textContent = `The technical preview could not be prepared: ${message}`;
      }
    });
  });
  preview.append(summary, code);
  section.append(preview);
  return section;
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function roundTripFileName(fileName: string): string {
  return /\.mp$/i.test(fileName)
    ? fileName.replace(/\.mp$/i, ".roundtrip.mp")
    : `${fileName}.roundtrip.mp`;
}

function renderWriteCheck(
  file: File,
  source: MessagePackSource,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "write-check";

  const copy = document.createElement("div");
  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = "Compatibility check";
  const heading = document.createElement("h3");
  heading.textContent = "Download an unchanged rebuild";
  const description = document.createElement("p");
  description.textContent =
    "This keeps the original game-data bytes and only rebuilds their compression and encryption. It cannot replace the file you opened.";
  copy.append(label, heading, description);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Download unchanged rebuild";
  button.addEventListener("click", async () => {
    button.disabled = true;
    setStatus("Rebuilding the save locally…", "loading");

    try {
      const { encodeVerifiedMessagePackSave } = await import("./save/encode");
      const encoded = await encodeVerifiedMessagePackSave(source);
      const outputName = roundTripFileName(file.name);
      const url = URL.createObjectURL(
        new Blob([encoded.slice().buffer], {
          type: "application/octet-stream",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = outputName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setStatus(`Downloaded ${outputName}. The original file was not changed.`, "ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error.";
      setStatus(`The test copy could not be created: ${message}`, "error");
    } finally {
      button.disabled = false;
    }
  });

  section.append(copy, button);
  return section;
}

function renderWarnings(
  report: SaveCompatibilityReport,
  additionalWarnings: string[],
): HTMLElement | null {
  const allWarnings = [...additionalWarnings, ...report.warnings];
  if (allWarnings.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "warnings";
  const heading = document.createElement("h3");
  heading.textContent =
    allWarnings.length === 1
      ? "Compatibility note"
      : "Compatibility notes";
  section.append(heading);

  const list = document.createElement("ul");
  for (const warning of allWarnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    list.append(item);
  }
  section.append(list);
  return section;
}

function renderReport(
  file: File,
  format: SaveFormat,
  data: SaveRecord,
  report: SaveCompatibilityReport,
  messagePack?: MessagePackSource,
): void {
  reportElement.replaceChildren();
  reportElement.hidden = false;

  const heading = document.createElement("div");
  heading.className = "report-heading";
  const step = document.createElement("p");
  step.className = "step";
  step.textContent = "II";
  const titleGroup = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "The save opens";
  const subtitle = document.createElement("p");
  subtitle.textContent = file.name;
  titleGroup.append(title, subtitle);
  const badge = document.createElement("span");
  badge.className = report.canEditDoctrines ? "badge safe" : "badge caution";
  badge.textContent = report.canEditDoctrines
    ? "Save decoded"
    : "Check notes";
  heading.append(step, titleGroup, badge);

  const details = document.createElement("dl");
  details.className = "details";
  details.append(
    makeDetail("Format", formatLabels[format]),
    makeDetail("Size", `${(file.size / 1024).toFixed(1)} KiB`),
    makeDetail(
      "File modified",
      file.lastModified
        ? new Date(file.lastModified).toLocaleString()
        : "Unavailable",
    ),
    makeDetail("Game version", gameVersionLabel(data, messagePack)),
    makeDetail("Top-level fields", String(report.fieldCount)),
    makeDetail(
      "Doctrine unlocks",
      report.doctrineFields.doctrineUnlockCount?.toString() ?? "Not found",
    ),
    makeDetail(
      "General upgrades",
      report.doctrineFields.unlockedUpgradeCount?.toString() ?? "Not found",
    ),
    makeDetail(
      "Cult traits",
      report.doctrineFields.cultTraitsCount === null
        ? "Not found"
        : `${report.doctrineFields.cultTraitsCount} (${report.doctrineFields.cultTraitsField})`,
    ),
  );

  const sections: (Node | string)[] = [heading, details];
  const warnings = renderWarnings(
    report,
    sourceWarnings(file.name, format),
  );
  if (warnings) {
    sections.push(warnings);
  }
  if (
    messagePack?.schema === "slot" ||
    Array.isArray(data.Followers) ||
    Array.isArray(data.DoctrineUnlockedUpgrades)
  ) {
    sections.push(renderCultOverview(buildCultOverview(data), data));
  }
  if (messagePack) {
    sections.push(renderWriteCheck(file, messagePack));
  }
  sections.push(renderAdvancedDiagnostics(data));
  reportElement.append(...sections);
}

async function inspectFile(file: File): Promise<void> {
  reportElement.hidden = true;

  if (file.size > MAX_SAVE_BYTES) {
    setStatus("That file is larger than the 64 MiB safety limit.", "error");
    return;
  }

  setStatus(`Opening ${file.name}…`, "loading");

  try {
    const { decodeSave } = await import("./save/decode");
    const decoded = await decodeSave(await file.arrayBuffer());
    const report = analyzeSave(decoded.data);
    renderReport(
      file,
      decoded.format,
      decoded.data,
      report,
      decoded.messagePack,
    );
    setStatus("Save opened successfully.", "ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    setStatus(message, "error");
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) {
    void inspectFile(file);
  }
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) {
    void inspectFile(file);
  }
});
