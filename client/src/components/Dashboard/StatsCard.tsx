import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconColor: string;
  iconBgColor: string;
  change?: number;
  formatter?: (value: number | string) => string;
  comparisonText?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  iconColor,
  iconBgColor,
  change,
  formatter = (val) => val.toString(),
  comparisonText = "vs mês anterior"
}: StatsCardProps) {
  const isPositiveChange = change !== undefined && change >= 0;
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-neutral-500 text-sm font-medium">{title}</p>
            <p className="text-3xl font-display font-bold mt-1 text-neutral-800 dark:text-neutral-200">
              {formatter(value)}
            </p>
          </div>
          <div className={cn("p-2 rounded-lg", iconBgColor)}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        
        {change !== undefined && (
          <div className="mt-3 flex items-center text-sm">
            <span className={cn(
              "font-medium flex items-center",
              isPositiveChange ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"
            )}>
              {isPositiveChange ? (
                <ArrowUp className="mr-1" size={16} />
              ) : (
                <ArrowDown className="mr-1" size={16} />
              )}
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-neutral-500 dark:text-neutral-400 ml-1">{comparisonText}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
