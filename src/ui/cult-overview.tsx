import type { CultOverview as CultOverviewData } from "../save/overview";
import type { SaveRecord } from "../save/types";
import { DoctrinePanel } from "./doctrine-panel";
import { FollowersSection } from "./followers-section";
import {
  displayDuration,
  displayNumber,
} from "./overview-format";
import { OverviewSection } from "./overview-section";
import { ResourcesSection } from "./resources-section";
import { RitualsSection } from "./rituals-section";

interface StatProps {
  label: string;
  note?: string;
  value: string;
}

function Stat({ label, note, value }: StatProps) {
  return (
    <div className="overview-stat">
      <span className="overview-stat-label">{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  );
}

interface CultOverviewProps {
  data: SaveRecord;
  overview: CultOverviewData;
}

export function CultOverview({ data, overview }: CultOverviewProps) {
  const doctrineChoiceCount = overview.doctrine.categories.reduce(
    (total, category) => total + category.pairs.length,
    0,
  );

  return (
    <section className="cult-overview" aria-labelledby="cult-overview-title">
      <header className="overview-heading">
        <div>
          <p className="section-label">Local save record</p>
          <h3 id="cult-overview-title">Inside the cult</h3>
          <p>
            Inspect the cult and preview doctrine replacements below. Nothing
            is changed or exported.
          </p>
        </div>
        <span className="read-only-seal">Preview only</span>
      </header>

      <div className="overview-stats">
        <Stat label="Cult name" value={overview.identity.name ?? "Unnamed"} />
        <Stat
          label="Day"
          value={
            overview.identity.day === null
              ? "Unknown"
              : displayNumber(overview.identity.day)
          }
        />
        <Stat
          label="Followers"
          value={
            overview.followerCount === null
              ? "Unknown"
              : displayNumber(overview.followerCount)
          }
        />
        <Stat
          label="Structures"
          value={
            overview.structureCount === null
              ? "Unknown"
              : displayNumber(overview.structureCount)
          }
        />
        {overview.identity.playTimeSeconds === null ? null : (
          <Stat
            label="Play time"
            value={displayDuration(overview.identity.playTimeSeconds)}
          />
        )}
        {overview.identity.version === null ? null : (
          <Stat label="Game version" value={overview.identity.version} />
        )}
      </div>

      <div className="overview-panels">
        {overview.followerCount === null ? null : (
          <FollowersSection
            count={overview.followerCount}
            followers={overview.followers}
          />
        )}
        {overview.itemTypeCount === null ? null : (
          <ResourcesSection
            count={overview.itemTypeCount}
            resources={overview.resources}
          />
        )}
        <OverviewSection
          title="Doctrines"
          count={`${overview.doctrine.selectedChoiceCount} of ${doctrineChoiceCount} choices`}
        >
          <DoctrinePanel data={data} doctrine={overview.doctrine} />
        </OverviewSection>
        <RitualsSection
          rituals={overview.rituals}
          sermonsAndRites={overview.sermonsAndRites}
        />
      </div>
    </section>
  );
}
