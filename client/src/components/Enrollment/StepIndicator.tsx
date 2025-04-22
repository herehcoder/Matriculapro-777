import React from "react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          {/* Step Item */}
          <div className="flex-1">
            <div className="relative flex items-center">
              <div 
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center font-medium",
                  index <= currentStep 
                    ? "bg-primary-600 text-white dark:bg-primary-700" 
                    : "bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
                )}
              >
                {index + 1}
              </div>
              <div className="ml-3">
                <p 
                  className={cn(
                    "text-sm font-medium",
                    index <= currentStep 
                      ? "text-neutral-800 dark:text-neutral-200" 
                      : "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="w-20 h-1 mx-2 bg-neutral-200 dark:bg-neutral-700">
              <div 
                className={cn(
                  "h-full transition-all duration-300",
                  index < currentStep ? "bg-primary-600 w-full" : "w-0"
                )}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
