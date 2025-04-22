import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface School {
  id: number;
  name: string;
  location: string;
  enrollments: number;
  status: "active" | "configuring";
  createdAt: string;
  abbreviation: string;
  color?: string;
}

interface RecentSchoolsProps {
  schools: School[];
  viewAllLink?: string;
  onViewAllClick?: () => void;
}

export function RecentSchools({
  schools,
  viewAllLink,
  onViewAllClick
}: RecentSchoolsProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };
  
  const getColorClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "configuring":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativa";
      case "configuring":
        return "Configurando";
      default:
        return status;
    }
  };
  
  const getSchoolColorClass = (index: number) => {
    const colors = [
      "bg-primary-100 text-primary-600",
      "bg-secondary-100 text-secondary-600",
      "bg-accent-100 text-accent-600",
      "bg-purple-100 text-purple-600",
      "bg-indigo-100 text-indigo-600"
    ];
    
    return colors[index % colors.length];
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
          Escolas Recentes
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
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Escola</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Localização</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Matrículas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
              {schools.map((school, index) => (
                <tr key={school.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-8 w-8 rounded-lg ${school.color || getSchoolColorClass(index)} flex items-center justify-center font-bold text-sm`}>
                        {school.abbreviation || getInitials(school.name)}
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{school.name}</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Desde {school.createdAt}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">{school.location}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-300">{school.enrollments}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge variant="secondary" className={getColorClass(school.status)}>
                      {getStatusLabel(school.status)}
                    </Badge>
                  </td>
                </tr>
              ))}
              
              {schools.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400">
                    Nenhuma escola encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
