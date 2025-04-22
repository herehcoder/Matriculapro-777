import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityItem {
  id: string | number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconColor: string;
  content: React.ReactNode;
  timestamp: string;
}

interface ActivityFeedProps {
  title: string;
  activities: ActivityItem[];
  viewAllLink?: string;
  onViewAllClick?: () => void;
}

export function ActivityFeed({
  title,
  activities,
  viewAllLink,
  onViewAllClick
}: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
          {title}
        </CardTitle>
        {viewAllLink ? (
          <a 
            href={viewAllLink} 
            className="text-primary-600 text-sm font-medium hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Ver todas
          </a>
        ) : onViewAllClick ? (
          <button 
            onClick={onViewAllClick}
            className="text-primary-600 text-sm font-medium hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            Ver todas
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div className="flex" key={activity.id}>
              <div className={`flex-shrink-0 h-9 w-9 rounded-full ${activity.iconBgColor} flex items-center justify-center ${activity.iconColor}`}>
                {activity.icon}
              </div>
              <div className="ml-3">
                <div className="text-sm text-neutral-600 dark:text-neutral-300">
                  {activity.content}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
          
          {activities.length === 0 && (
            <div className="text-center py-6">
              <p className="text-neutral-500 dark:text-neutral-400">Nenhuma atividade recente.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
