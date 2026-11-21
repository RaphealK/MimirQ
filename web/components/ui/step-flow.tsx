import * as React from "react";

import { cn } from "@/lib/utils";

export type StepFlowState = "active" | "done" | "pending" | "skipped";

export type StepFlowStep = {
  id: string;
  label: React.ReactNode;
  status?: React.ReactNode;
  state?: StepFlowState;
  disabled?: boolean;
};

export type StepFlowPreset = {
  id: string;
  label: React.ReactNode;
};

type StepFlowProps = {
  steps: readonly StepFlowStep[];
  presets?: readonly StepFlowPreset[];
  value?: string;
  onValueChange?: (presetId: string) => void;
  onStepClick?: (stepId: string) => void;
  className?: string;
};

/**
 * Merged "execution path + endpoint" control: presets on top, clickable nodes
 * below. It replaces the old pair of mutually-confusing path/end-point inputs.
 */
export function StepFlow({
  steps,
  presets,
  value,
  onValueChange,
  onStepClick,
  className,
}: Readonly<StepFlowProps>) {
  return (
    <div data-slot="step-flow" className={cn("step-flow", className)}>
      {presets?.length ? (
        <div className="step-flow__presets" role="group">
          {presets.map((preset) => {
            const isActive = value === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className="step-flow__preset"
                data-active={isActive ? "true" : "false"}
                aria-pressed={isActive}
                onClick={() => onValueChange?.(preset.id)}
              >
                <span className="step-flow__preset-dot" aria-hidden="true" />
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {steps.length ? (
        <div className="step-flow__track">
          {steps.map((step, index) => {
            const state = step.state ?? (index === 0 ? "active" : "pending");
            const isActive = state === "active" || state === "done";
            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  className="step-flow__step disabled:cursor-not-allowed disabled:opacity-45"
                  data-active={isActive ? "true" : "false"}
                  disabled={step.disabled || !onStepClick}
                  aria-pressed={isActive}
                  onClick={() => onStepClick?.(step.id)}
                >
                  <span className="step-flow__dot" aria-hidden="true" />
                  <span>
                    <span className="step-flow__label">{step.label}</span>
                    {step.status ? (
                      <span className="step-flow__state">{step.status}</span>
                    ) : null}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <span className="step-flow__line" aria-hidden="true" />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
