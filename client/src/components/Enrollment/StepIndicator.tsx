import React from "react";
import { CheckCircle, CircleDot, Circle } from "lucide-react";

interface Step {
  label: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <React.Fragment key={index}>
            {/* Step with its indicator */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 ${
                  isCompleted 
                    ? "border-primary bg-primary text-white" 
                    : isCurrent 
                      ? "border-primary text-primary" 
                      : "border-neutral-300 dark:border-neutral-600 text-neutral-400 dark:text-neutral-500"
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : isCurrent ? (
                    <CircleDot className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </div>
              </div>
              
              <div className="mt-2 text-center max-w-[120px]">
                <p className={`text-sm font-medium ${
                  isCompleted || isCurrent
                    ? "text-neutral-800 dark:text-neutral-200" 
                    : "text-neutral-500 dark:text-neutral-400"
                }`}>
                  {step.label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
            
            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div className={`flex-1 h-[2px] mx-2 ${
                index < currentStep 
                  ? "bg-primary" 
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}