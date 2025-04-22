import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FunnelStage {
  title: string;
  value: number;
  percentage: number;
}

interface FunnelChartProps {
  title: string;
  data: FunnelStage[];
}

export function FunnelChart({ title, data }: FunnelChartProps) {
  // Ensure the data is sorted by percentage in descending order
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
          {title}
        </CardTitle>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4 text-neutral-400" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="h-72 flex flex-col items-center justify-center">
          <div className="w-full max-w-md">
            {sortedData.map((stage, index) => (
              <div className="relative pt-4 mb-6" key={stage.title}>
                <div 
                  className={`h-12 rounded-t-lg flex items-center justify-center text-white font-medium`}
                  style={{
                    width: `${stage.percentage}%`,
                    backgroundColor: `hsl(var(--primary-${600 + (index * 100)}))`,
                  }}
                >
                  {stage.title}: {stage.value.toLocaleString()}
                </div>
                {index < sortedData.length - 1 && (
                  <div 
                    className="absolute w-full h-6 -bottom-3 rounded-b-lg" 
                    style={{
                      width: `${stage.percentage}%`,
                      backgroundColor: `hsl(var(--primary-${600 + (index * 100)}))`,
                      clipPath: `polygon(0 0, 100% 0, ${85 - (index * 5)}% 100%, ${15 + (index * 5)}% 100%)`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
