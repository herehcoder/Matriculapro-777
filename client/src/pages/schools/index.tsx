import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getSchools } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  School as SchoolIcon, 
  MapPin, 
  Mail, 
  Phone, 
  MoreHorizontal,
  Pencil,
  ExternalLink,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SchoolsPage() {
  // Fetch schools data
  const { data: schools, isLoading } = useQuery({
    queryKey: ['/api/schools'],
    refetchOnWindowFocus: false,
  });
  
  // Format school data for display
  const formatSchools = (schools: any[]) => {
    return schools?.map(school => ({
      ...school,
      initial: school.name.charAt(0).toUpperCase(),
      locationDisplay: `${school.city}, ${school.state}`,
      statusClass: school.active 
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300",
      statusText: school.active ? "Ativa" : "Inativa",
    }));
  };
  
  // Column definitions for schools table
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm dark:bg-primary-900 dark:text-primary-300">
            {row.original.initial}
          </div>
          <div className="ml-3">
            <div className="font-medium">{row.getValue("name")}</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              ID: {row.original.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "locationDisplay",
      header: "Localização",
      cell: ({ row }) => (
        <div className="flex items-center">
          <MapPin size={14} className="mr-1 text-neutral-500" />
          <span>{row.getValue("locationDisplay")}</span>
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Contato",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <Mail size={14} className="mr-1 text-neutral-500" />
            <span>{row.getValue("email")}</span>
          </div>
          <div className="flex items-center text-sm">
            <Phone size={14} className="mr-1 text-neutral-500" />
            <span>{row.original.phone}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary" className={row.original.statusClass}>
          {row.original.statusText}
        </Badge>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href={`/schools/${row.original.id}`}>
                  <a className="flex items-center cursor-pointer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    <span>Ver detalhes</span>
                  </a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/schools/edit/${row.original.id}`}>
                  <a className="flex items-center cursor-pointer">
                    <Pencil className="mr-2 h-4 w-4" />
                    <span>Editar</span>
                  </a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/schools/${row.original.id}/attendants`}>
                  <a className="flex items-center cursor-pointer">
                    <span>Gerenciar atendentes</span>
                  </a>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/schools/${row.original.id}/courses`}>
                  <a className="flex items-center cursor-pointer">
                    <span>Gerenciar cursos</span>
                  </a>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando escolas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-neutral-800 dark:text-neutral-100">
            Escolas
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Gerencie as instituições de ensino cadastradas no sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/schools/new">
            <a className="flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Nova Escola
            </a>
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
            Lista de Escolas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schools && schools.length > 0 ? (
            <DataTable 
              columns={columns} 
              data={formatSchools(schools)} 
              searchField="name"
              searchPlaceholder="Buscar por nome da escola..."
            />
          ) : (
            <div className="text-center py-10">
              <div className="mx-auto h-12 w-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 mb-4 dark:bg-neutral-800">
                <SchoolIcon size={24} />
              </div>
              <h3 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
                Nenhuma escola encontrada
              </h3>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                Não há escolas cadastradas no sistema.
              </p>
              <Button asChild>
                <Link href="/schools/new">
                  <a className="flex items-center justify-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Escola
                  </a>
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-semibold text-neutral-800 dark:text-neutral-200">
            Estatísticas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {schools?.length || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total de Escolas</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {schools?.filter(s => s.active).length || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Escolas Ativas</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
              <p className="text-2xl font-bold text-accent-600 dark:text-accent-400">
                {schools?.reduce((acc, curr) => acc + (curr.mainCourse ? 1 : 0), 0) || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Com Curso Principal</p>
            </div>
            <div className="p-4 bg-neutral-50 rounded-lg text-center dark:bg-neutral-800/50">
              <p className="text-2xl font-bold text-secondary-600 dark:text-secondary-400">
                {schools?.filter(s => s.whatsappEnabled).length || 0}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">WhatsApp Integrado</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
