import {
  assessDoctrineEditing,
  planDoctrineChange,
  type DoctrineChangePlan,
  type DoctrineFieldChange,
} from "../save/doctrine-editor";
import type {
  CultOverview,
  DoctrinePairOverview,
  FollowerOverview,
  ResourceOverview,
} from "../save/overview";
import resourceIconDefinitions from "../save/resource-icons.json";
import type { SaveRecord } from "../save/types";

const RESOURCE_ICON_IDS = new Set(
  resourceIconDefinitions.map((definition) => definition.id),
);

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

function displayNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function displayDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function statCard(
  label: string,
  value: string,
  note?: string,
): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "overview-stat";
  card.append(
    textElement("span", "overview-stat-label", label),
    textElement("strong", "", value),
  );
  if (note) {
    card.append(textElement("small", "", note));
  }
  return card;
}

function detailsPanel(
  title: string,
  count: string,
): { body: HTMLDivElement; details: HTMLDetailsElement } {
  const details = document.createElement("details");
  details.className = "overview-panel";
  const summary = document.createElement("summary");
  summary.append(
    textElement("strong", "", title),
    textElement("span", "", count),
  );
  const body = document.createElement("div");
  body.className = "overview-panel-body";
  details.append(summary, body);
  return { body, details };
}

function percent(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${Math.round(Math.min(100, Math.max(0, value)))}%`;
}

function followerRow(follower: FollowerOverview): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "follower-row";

  const identity = document.createElement("div");
  identity.className = "follower-name";
  identity.append(textElement("strong", "", follower.name));
  if (follower.id !== null) {
    identity.append(textElement("small", "", `ID ${follower.id}`));
  }

  const state = document.createElement("div");
  state.className = "follower-statuses";
  for (const status of follower.statuses) {
    state.append(textElement("span", "", status));
  }

  row.append(
    identity,
    textElement("span", "", follower.level === null ? "—" : `Lv ${follower.level}`),
    textElement("span", "", follower.age === null ? "—" : `${follower.age} days`),
    textElement("span", "", percent(follower.happiness)),
    textElement("span", "", percent(follower.satiation)),
    state,
  );
  return row;
}

function resourceRow(resource: ResourceOverview): HTMLDivElement {
  const row = document.createElement("div");
  row.className = resource.known
    ? "resource-row"
    : "resource-row unknown";
  const identity = document.createElement("div");
  identity.className = "resource-identity";
  const name = document.createElement("div");
  name.append(
    textElement("strong", "", resource.name),
    textElement("small", "", `Item ${resource.id}`),
  );
  if (RESOURCE_ICON_IDS.has(resource.id)) {
    const icon = document.createElement("img");
    icon.className = "resource-icon";
    icon.src = `/resource-icons/${resource.id}.webp`;
    icon.alt = "";
    icon.loading = "lazy";
    icon.width = 52;
    icon.height = 52;
    identity.append(icon);
  }
  identity.append(name);
  const quantity = document.createElement("div");
  quantity.className = "resource-quantity";
  quantity.append(textElement("strong", "", displayNumber(resource.quantity)));
  if (resource.reserved > 0) {
    quantity.append(
      textElement(
        "small",
        "",
        `${displayNumber(resource.reserved)} reserved`,
      ),
    );
  }
  row.append(identity, quantity);
  return row;
}

function doctrinePair(
  pair: DoctrinePairOverview,
  data: SaveRecord,
  showPreview: (plan: DoctrineChangePlan) => void,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = `doctrine-pair ${pair.state}`;
  row.append(textElement("span", "doctrine-rank", String(pair.rank)));

  const description = document.createElement("div");
  let previewButton: HTMLButtonElement | null = null;
  if (pair.state === "selected") {
    const selected = pair.selected[0];
    if (!selected) {
      throw new Error("A selected doctrine pair has no selected choice.");
    }
    const opposing = pair.choices.find(
      (candidate) => candidate.doctrineId !== selected.doctrineId,
    );
    description.append(
      textElement("strong", "", selected.name),
      textElement(
        "small",
        "",
        opposing
          ? `Chosen over ${opposing.name} · ID ${selected.doctrineId}`
          : `Doctrine ID ${selected.doctrineId}`,
      ),
    );
    if (opposing) {
      const plan = planDoctrineChange(data, opposing.doctrineId);
      previewButton = document.createElement("button");
      previewButton.className = "doctrine-preview-button";
      previewButton.type = "button";
      previewButton.textContent =
        plan.state === "ready"
          ? `Preview ${opposing.name}`
          : "Preview blocked";
      previewButton.disabled = plan.state !== "ready";
      if (plan.blockers.length > 0) {
        previewButton.title = plan.blockers.join(" ");
      }
      previewButton.addEventListener("click", () => showPreview(plan));
      row.classList.add("editable");
    }
  } else if (pair.state === "conflict") {
    description.append(
      textElement("strong", "", "Both choices are present"),
      textElement(
        "small",
        "",
        pair.selected
          .map((candidate) => `${candidate.name} (${candidate.doctrineId})`)
          .join(" · "),
      ),
    );
  } else {
    description.append(
      textElement("strong", "", "Not declared"),
      textElement(
        "small",
        "",
        `${pair.choices[0].name} or ${pair.choices[1].name}`,
      ),
    );
  }

  row.append(description);
  if (previewButton) {
    row.append(previewButton);
  }
  return row;
}

function idList(ids: number[]): string {
  return ids.length > 0 ? ids.join(", ") : "none";
}

function storageFieldLabel(change: DoctrineFieldChange): string {
  if (change.field === "DoctrineUnlockedUpgrades") {
    return "Doctrine choice";
  }
  if (change.field === "UnlockedUpgrades") {
    return "Linked unlock";
  }
  return "Cult trait";
}

function doctrineValueName(
  plan: DoctrineChangePlan,
  direction: "added" | "removed",
): string {
  const choice = direction === "removed" ? plan.from : plan.to;
  if (choice === null) {
    return "Unknown value";
  }
  return choice.name;
}

function deltaItem(
  name: string,
  id: number,
  direction: "added" | "removed",
  change: DoctrineFieldChange,
): HTMLSpanElement {
  const item = document.createElement("span");
  item.className = `doctrine-change-item ${direction}`;
  item.append(
    textElement("strong", "", name),
    textElement(
      "small",
      "",
      `${storageFieldLabel(change)} · ID ${id}`,
    ),
  );
  return item;
}

function changeColumn(
  title: string,
  direction: "added" | "removed",
  plan: DoctrineChangePlan,
): HTMLElement {
  const column = document.createElement("section");
  column.className = `doctrine-change-column ${direction}`;
  column.append(textElement("h5", "", title));

  const list = document.createElement("div");
  list.className = "doctrine-change-list";
  for (const change of plan.changes) {
    const ids =
      direction === "removed" ? change.removed : change.added;
    for (const id of ids) {
      list.append(
        deltaItem(
          doctrineValueName(plan, direction),
          id,
          direction,
          change,
        ),
      );
    }
  }
  column.append(list);
  return column;
}

function completeArrayValues(plan: DoctrineChangePlan): HTMLDetailsElement {
  const complete = document.createElement("details");
  complete.className = "doctrine-array-details";
  const summary = document.createElement("summary");
  summary.textContent = "Show complete array values";
  const arrays = document.createElement("div");
  arrays.className = "doctrine-array-comparison";
  for (const change of plan.changes) {
    const field = document.createElement("section");
    field.title = change.field;
    field.append(textElement("h6", "", storageFieldLabel(change)));
    const values = document.createElement("div");
    values.className = "doctrine-array-values";
    const before = document.createElement("div");
    before.append(
      textElement("span", "", "Before"),
      textElement("code", "", `[${idList(change.before)}]`),
    );
    const after = document.createElement("div");
    after.append(
      textElement("span", "", "After"),
      textElement("code", "", `[${idList(change.after)}]`),
    );
    values.append(before, after);
    field.append(values);
    arrays.append(field);
  }
  complete.append(summary, arrays);
  return complete;
}

function emptyDoctrinePreview(): HTMLDivElement {
  const empty = document.createElement("div");
  empty.className = "doctrine-preview-empty";
  empty.append(
    textElement("span", "", "↟"),
    textElement("strong", "", "Choose a declared doctrine"),
    textElement(
      "p",
      "",
      "Use a Preview button above to inspect one replacement. The opened save will stay unchanged.",
    ),
  );
  return empty;
}

function renderDoctrinePlan(
  plan: DoctrineChangePlan,
  container: HTMLDivElement,
): void {
  container.replaceChildren();
  if (
    plan.state !== "ready" ||
    plan.from === null ||
    plan.to === null
  ) {
    const warning = document.createElement("div");
    warning.className = "doctrine-plan-blocked";
    warning.append(
      textElement("strong", "", "This preview is blocked"),
    );
    const list = document.createElement("ul");
    for (const blocker of plan.blockers) {
      list.append(textElement("li", "", blocker));
    }
    warning.append(list);
    container.append(warning);
    return;
  }

  const heading = document.createElement("header");
  const title = document.createElement("div");
  title.append(
    textElement(
      "p",
      "section-label",
      `${plan.categoryName} · Rank ${plan.rank}`,
    ),
    textElement("h4", "", `${plan.from.name} → ${plan.to.name}`),
  );
  heading.append(
    title,
    textElement("span", "preview-only-badge", "Preview only"),
  );

  const explanation = textElement(
    "p",
    "doctrine-plan-copy",
    "These are the exact array changes required for this replacement. No save data has been changed.",
  );
  const changes = document.createElement("div");
  changes.className = "doctrine-change-columns";
  changes.append(
    changeColumn("You lose", "removed", plan),
    changeColumn("You gain", "added", plan),
  );

  const unchangedFields = plan.changes
    .filter((change) => !change.changed)
    .map(storageFieldLabel);
  const unchanged =
    unchangedFields.length === 0
      ? null
      : textElement(
          "p",
          "doctrine-unchanged-note",
          `Unchanged: ${unchangedFields.join(", ").toLowerCase()}.`,
        );

  const clear = document.createElement("button");
  clear.className = "clear-doctrine-preview";
  clear.type = "button";
  clear.textContent = "Clear preview";
  clear.addEventListener("click", () => {
    container.replaceChildren(emptyDoctrinePreview());
  });

  container.append(heading, explanation, changes);
  if (unchanged) {
    container.append(unchanged);
  }
  container.append(completeArrayValues(plan), clear);
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderFollowers(overview: CultOverview): HTMLDetailsElement | null {
  if (overview.followerCount === null) {
    return null;
  }
  const panel = detailsPanel(
    "Followers",
    `${overview.followerCount} living`,
  );
  if (overview.followers.length === 0) {
    panel.body.append(
      textElement("p", "empty-overview", "No living follower records were found."),
    );
    return panel.details;
  }

  const labels = document.createElement("div");
  labels.className = "follower-row follower-labels";
  for (const label of [
    "Follower",
    "Level",
    "Age",
    "Happy",
    "Fed",
    "State",
  ]) {
    labels.append(textElement("span", "", label));
  }
  const list = document.createElement("div");
  list.className = "follower-list";
  list.append(labels, ...overview.followers.map(followerRow));
  panel.body.append(list);
  return panel.details;
}

function renderResources(overview: CultOverview): HTMLDetailsElement | null {
  if (overview.itemTypeCount === null) {
    return null;
  }
  const panel = detailsPanel(
    "Resources",
    `${overview.itemTypeCount} item types`,
  );
  if (overview.resources.length === 0) {
    panel.body.append(
      textElement("p", "empty-overview", "No inventory records were found."),
    );
    return panel.details;
  }
  const grid = document.createElement("div");
  grid.className = "resource-grid";
  grid.append(...overview.resources.map(resourceRow));
  panel.body.append(grid);
  return panel.details;
}

function renderDoctrines(
  overview: CultOverview,
  data: SaveRecord,
): HTMLDetailsElement {
  const totalChoices = overview.doctrine.categories.reduce(
    (total, category) => total + category.pairs.length,
    0,
  );
  const panel = detailsPanel(
    "Doctrines",
    `${overview.doctrine.selectedChoiceCount} of ${totalChoices} choices`,
  );
  panel.body.append(
    textElement(
      "p",
      "catalog-note",
      `Catalog for game ${overview.doctrine.catalogVersion}. Previewing a replacement does not change the opened save.`,
    ),
  );

  const assessment = assessDoctrineEditing(data);
  if (overview.doctrine.unknownIds.length > 0) {
    panel.body.append(
      textElement(
        "p",
        "catalog-warning",
        `Unknown doctrine IDs: ${overview.doctrine.unknownIds.join(", ")}.`,
      ),
    );
  }
  if (assessment.blockers.length > 0) {
    const warning = document.createElement("div");
    warning.className = "catalog-warning doctrine-edit-blockers";
    warning.append(
      textElement("strong", "", "Doctrine previews are blocked."),
    );
    const list = document.createElement("ul");
    for (const blocker of assessment.blockers) {
      list.append(textElement("li", "", blocker));
    }
    warning.append(list);
    panel.body.append(warning);
  }

  const preview = document.createElement("div");
  preview.className = "doctrine-change-preview";
  preview.setAttribute("aria-live", "polite");
  preview.append(emptyDoctrinePreview());
  const showPreview = (plan: DoctrineChangePlan): void => {
    renderDoctrinePlan(plan, preview);
  };

  const categories = document.createElement("div");
  categories.className = "doctrine-grid";
  for (const category of overview.doctrine.categories) {
    const card = document.createElement("section");
    card.className = "doctrine-category";
    const heading = document.createElement("header");
    heading.append(
      textElement("h4", "", category.name),
      textElement(
        "span",
        "",
        `${category.selectedCount}/${category.pairs.length}`,
      ),
    );
    card.append(
      heading,
      ...category.pairs.map((pair) =>
        doctrinePair(pair, data, showPreview),
      ),
    );
    categories.append(card);
  }
  panel.body.append(categories);

  if (overview.doctrine.specials.length > 0) {
    panel.body.append(
      textElement("h4", "overview-subheading", "Granted doctrines"),
    );
    const specials = document.createElement("div");
    specials.className = "named-id-list";
    for (const doctrine of overview.doctrine.specials) {
      const item = textElement("span", "", doctrine.name);
      item.title = `Doctrine ID ${doctrine.id}`;
      specials.append(item);
    }
    panel.body.append(specials);
  }
  const previewSection = document.createElement("section");
  previewSection.className = "doctrine-preview-section";
  previewSection.append(
    textElement("h4", "overview-subheading", "Change preview"),
    preview,
  );
  panel.body.append(previewSection);
  return panel.details;
}

function renderRituals(overview: CultOverview): HTMLDetailsElement {
  const recognizedCount =
    overview.rituals.length + overview.sermonsAndRites.length;
  const panel = detailsPanel(
    "Rituals and sermons",
    `${recognizedCount} found`,
  );
  if (recognizedCount === 0) {
    panel.body.append(
      textElement(
        "p",
        "empty-overview",
        "No ritual or sermon unlocks were found.",
      ),
    );
    return panel.details;
  }

  if (overview.rituals.length > 0) {
    panel.body.append(
      textElement("h4", "overview-subheading first", "Cult rituals"),
    );
    const list = document.createElement("div");
    list.className = "named-id-list";
    for (const ritual of overview.rituals) {
      const item = textElement("span", "", ritual.name);
      item.title = `Upgrade ID ${ritual.id}`;
      list.append(item);
    }
    panel.body.append(list);
  }
  if (overview.sermonsAndRites.length > 0) {
    panel.body.append(
      textElement("h4", "overview-subheading", "Sermons and rites"),
    );
    const list = document.createElement("div");
    list.className = "named-id-list";
    for (const entry of overview.sermonsAndRites) {
      const item = textElement("span", "", entry.name);
      item.title = `Sermon or rite ID ${entry.id}`;
      list.append(item);
    }
    panel.body.append(list);
  }
  return panel.details;
}

export function renderCultOverview(
  overview: CultOverview,
  data: SaveRecord,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "cult-overview";
  section.setAttribute("aria-labelledby", "cult-overview-title");

  const heading = document.createElement("header");
  heading.className = "overview-heading";
  const copy = document.createElement("div");
  copy.append(
    textElement("p", "section-label", "Local save record"),
    textElement("h3", "", "Inside the cult"),
    textElement(
      "p",
      "",
      "Inspect the cult and preview doctrine replacements below. Nothing is changed or exported.",
    ),
  );
  const title = copy.querySelector("h3");
  if (title) {
    title.id = "cult-overview-title";
  }
  heading.append(copy, textElement("span", "read-only-seal", "Preview only"));

  const stats = document.createElement("div");
  stats.className = "overview-stats";
  stats.append(
    statCard("Cult name", overview.identity.name ?? "Unnamed"),
    statCard(
      "Day",
      overview.identity.day === null
        ? "Unknown"
        : displayNumber(overview.identity.day),
    ),
    statCard(
      "Followers",
      overview.followerCount === null
        ? "Unknown"
        : displayNumber(overview.followerCount),
    ),
    statCard(
      "Structures",
      overview.structureCount === null
        ? "Unknown"
        : displayNumber(overview.structureCount),
    ),
  );
  if (overview.identity.playTimeSeconds !== null) {
    stats.append(
      statCard("Play time", displayDuration(overview.identity.playTimeSeconds)),
    );
  }
  if (overview.identity.version !== null) {
    stats.append(statCard("Game version", overview.identity.version));
  }

  const panels = document.createElement("div");
  panels.className = "overview-panels";
  const followerPanel = renderFollowers(overview);
  const resourcePanel = renderResources(overview);
  if (followerPanel) {
    panels.append(followerPanel);
  }
  if (resourcePanel) {
    panels.append(resourcePanel);
  }
  panels.append(renderDoctrines(overview, data), renderRituals(overview));

  section.append(heading, stats, panels);
  return section;
}
