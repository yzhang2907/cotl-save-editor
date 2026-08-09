import type { CultOverview as CultOverviewData } from "../save/overview";
import type { DoctrineChangePlan } from "../save/doctrine-editor";
import type { PendingDoctrineChange } from "../save/doctrine-workspace";
import type { SaveRecord } from "../save/types";
import { doctrineChangeCountLabel } from "./copy";
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
  doctrineChanges: PendingDoctrineChange[];
  onApplyDoctrine: (plan: DoctrineChangePlan) => boolean;
  onDiscardDoctrine: (change: PendingDoctrineChange) => void;
  originalDoctrine: CultOverviewData["doctrine"];
  onResetDoctrines: () => void;
  overview: CultOverviewData;
}

export function CultOverview({
  data,
  doctrineChanges,
  onApplyDoctrine,
  onDiscardDoctrine,
  originalDoctrine,
  onResetDoctrines,
  overview,
}: CultOverviewProps) {
  const doctrineChoiceCount = overview.doctrine.categories.reduce(
    (total, category) =>
      total +
      category.pairs.reduce(
        (choiceTotal, pair) => choiceTotal + pair.choices.length,
        0,
      ),
    0,
  );
  const changeCount = doctrineChanges.length;

  return (
    <section className="cult-overview" aria-labelledby="cult-overview-title">
      <header className="overview-heading">
        <div>
          <h3 id="cult-overview-title">Inside the cult</h3>
          <p>
            Doctrine changes go to a working copy. The file you opened
            stays untouched.
          </p>
        </div>
        <span
          className={`change-count-seal${changeCount === 0 ? "" : " is-dirty"}`}
        >
          {doctrineChangeCountLabel(changeCount)}
        </span>
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
          <DoctrinePanel
            data={data}
            doctrine={overview.doctrine}
            changes={doctrineChanges}
            onApply={onApplyDoctrine}
            onDiscard={onDiscardDoctrine}
            originalDoctrine={originalDoctrine}
            onReset={onResetDoctrines}
          />
        </OverviewSection>
        <RitualsSection
          rituals={overview.rituals}
          sermonsAndRites={overview.sermonsAndRites}
        />
      </div>
    </section>
  );
}
