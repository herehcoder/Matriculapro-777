import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PieChartDataItem {
  name: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartProps {
  title: string;
  data: PieChartDataItem[];
  total: number;
  totalLabel?: string;
}

export function PieChart({ 
  title, 
  data, 
  total, 
  totalLabel = "Total de leads"
}: PieChartProps) {
  // Calculate stroke dashoffset for each segment
  let currentOffset = 0;
  const chartData = data.map(item => {
    const dashArray = item.percentage;
    const offset = -currentOffset;
    currentOffset += dashArray;
    
    return {
      ...item,
      dashArray,
      dashOffset: offset
    };
  });
  
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
        <div className="h-72 flex items-center justify-center">
          <div className="relative h-56 w-56">
            <svg viewBox="0 0 36 36" className="h-full w-full">
              {/* Base circle */}
              <path
                d="M18 2.0845
                  a 15.9155 15.9155 0 0 1 0 31.831
                  a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="3"
              />
              
              {/* Data segments */}
              {chartData.map((item, index) => (
                <path
                  key={index}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray={`${item.dashArray}, 100`}
                  strokeDashoffset={item.dashOffset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-bold">{total}</span>
              <span className="text-sm text-neutral-500">{totalLabel}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          {data.map((item, index) => (
            <div className="flex items-center" key={index}>
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></span>
              <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                {item.name} ({item.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
