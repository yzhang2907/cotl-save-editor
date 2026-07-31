import type { ReactNode } from "react";

interface StepHeaderProps {
  aside?: ReactNode;
  description: ReactNode;
  eyebrow: string;
  step: string;
  title: string;
  titleId?: string;
}

export function StepHeader({
  aside,
  description,
  eyebrow,
  step,
  title,
  titleId,
}: StepHeaderProps) {
  return (
    <header className="step-header">
      <span className="step" aria-hidden="true">
        {step}
      </span>
      <div>
        <p className="section-label step-eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        <p className="step-description">{description}</p>
      </div>
      {aside}
    </header>
  );
}
