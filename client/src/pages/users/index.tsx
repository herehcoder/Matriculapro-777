import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export default function UsersPage() {
  const { user } = useAuth();
  
  // Buscar usuários
  const { data: usersData, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res;
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Gerenciamento de Usuários</h1>
      <p className="text-muted-foreground mb-8">Lista de usuários registrados na plataforma</p>

      <Card className="bg-background border border-border">
        <CardContent className="p-10 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center mb-6">
            <Users className="h-10 w-10 text-gray-400" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Gerenciamento de Usuários</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Configure, monitore e gerencie os usuários da plataforma.
          </p>
          
          <Button size="lg" className="w-80">
            <Link href="/users/list">
              Acessar Gerenciamento de Usuários
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}