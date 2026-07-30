import type {
  CultOverview,
  DoctrinePairOverview,
  FollowerOverview,
  ResourceOverview,
} from "../save/overview";

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
  open = false,
): { body: HTMLDivElement; details: HTMLDetailsElement } {
  const details = document.createElement("details");
  details.className = "overview-panel";
  details.open = open;
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
  const name = document.createElement("div");
  name.append(
    textElement("strong", "", resource.name),
    textElement("small", "", `Item ${resource.id}`),
  );
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
  row.append(name, quantity);
  return row;
}

function doctrinePair(pair: DoctrinePairOverview): HTMLDivElement {
  const row = document.createElement("div");
  row.className = `doctrine-pair ${pair.state}`;
  row.append(textElement("span", "doctrine-rank", String(pair.rank)));

  const description = document.createElement("div");
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
  return row;
}

function renderFollowers(overview: CultOverview): HTMLDetailsElement | null {
  if (overview.followerCount === null) {
    return null;
  }
  const panel = detailsPanel(
    "Followers",
    `${overview.followerCount} living`,
    true,
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

function renderDoctrines(overview: CultOverview): HTMLDetailsElement {
  const totalChoices = overview.doctrine.categories.reduce(
    (total, category) => total + category.pairs.length,
    0,
  );
  const panel = detailsPanel(
    "Doctrines",
    `${overview.doctrine.selectedChoiceCount} of ${totalChoices} choices`,
    true,
  );
  panel.body.append(
    textElement(
      "p",
      "catalog-note",
      `Read-only catalog for game ${overview.doctrine.catalogVersion}.`,
    ),
  );

  if (overview.doctrine.unknownIds.length > 0) {
    panel.body.append(
      textElement(
        "p",
        "catalog-warning",
        `Unknown doctrine IDs: ${overview.doctrine.unknownIds.join(", ")}.`,
      ),
    );
  }

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
    card.append(heading, ...category.pairs.map(doctrinePair));
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

export function renderCultOverview(overview: CultOverview): HTMLElement {
  const section = document.createElement("section");
  section.className = "cult-overview";
  section.setAttribute("aria-labelledby", "cult-overview-title");

  const heading = document.createElement("header");
  heading.className = "overview-heading";
  const copy = document.createElement("div");
  copy.append(
    textElement("p", "section-label", "Read-only record"),
    textElement("h3", "", "Inside the cult"),
    textElement(
      "p",
      "",
      "These values are extracted from the opened save. Nothing here can be changed yet.",
    ),
  );
  const title = copy.querySelector("h3");
  if (title) {
    title.id = "cult-overview-title";
  }
  heading.append(copy, textElement("span", "read-only-seal", "Look, don't touch"));

  const stats = document.createElement("div");
  stats.className = "overview-stats";
  stats.append(
    statCard("Cult", overview.identity.name ?? "Unnamed"),
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
      "Base",
      overview.structureCount === null
        ? "Unknown"
        : `${displayNumber(overview.structureCount)} structures`,
      overview.structureTypeCount === null
        ? undefined
        : `${overview.structureTypeCount} structure types`,
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
  panels.append(renderDoctrines(overview), renderRituals(overview));

  section.append(heading, stats, panels);
  return section;
}
