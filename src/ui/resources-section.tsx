import type { ResourceOverview } from "../save/overview";
import resourceIconDefinitions from "../save/resource-icons.json";
import { displayNumber } from "./overview-format";
import { OverviewSection } from "./overview-section";

const iconIds = new Set(
  resourceIconDefinitions.map((definition) => definition.id),
);

function ResourceRow({ resource }: { resource: ResourceOverview }) {
  return (
    <div className={`resource-row${resource.known ? "" : " unknown"}`}>
      <div className="resource-identity">
        {iconIds.has(resource.id) ? (
          <img
            className="resource-icon"
            src={`/resource-icons/${resource.id}.webp`}
            alt=""
            loading="lazy"
            width="52"
            height="52"
          />
        ) : null}
        <div>
          <strong>{resource.name}</strong>
          <small>Item {resource.id}</small>
        </div>
      </div>
      <div className="resource-quantity">
        <strong>{displayNumber(resource.quantity)}</strong>
        {resource.reserved > 0 ? (
          <small>{displayNumber(resource.reserved)} reserved</small>
        ) : null}
      </div>
    </div>
  );
}

interface ResourcesSectionProps {
  count: number;
  resources: ResourceOverview[];
}

export function ResourcesSection({
  count,
  resources,
}: ResourcesSectionProps) {
  return (
    <OverviewSection title="Resources" count={`${count} item types`}>
      {resources.length === 0 ? (
        <p className="empty-overview">No inventory records were found.</p>
      ) : (
        <div className="resource-grid">
          {resources.map((resource) => (
            <ResourceRow resource={resource} key={resource.id} />
          ))}
        </div>
      )}
    </OverviewSection>
  );
}
