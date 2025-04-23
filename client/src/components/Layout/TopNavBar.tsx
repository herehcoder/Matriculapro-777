import React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NotificationCenter } from "./NotificationCenter";
import { ThemeSwitch } from "@/components/theme-switch";

interface TopNavBarProps {
  onSidebarToggle: () => void;
}

export function TopNavBar({ onSidebarToggle }: TopNavBarProps) {
  const { user, logout } = useAuth();
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(word => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };
  
  const getRoleName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "school":
        return "Escola";
      case "attendant":
        return "Atendente";
      case "student":
        return "Aluno";
      default:
        return role;
    }
  };
  
  return (
    <header className="bg-white border-b border-neutral-200 py-2 px-4 flex items-center justify-between shadow-sm dark:bg-neutral-900 dark:border-neutral-800">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          onClick={onSidebarToggle}
        >
          <Menu size={20} />
          <span className="sr-only">Toggle menu</span>
        </Button>
        
        <Link href="/" className="flex items-center ml-2 lg:ml-0">
            <div className="h-9 w-9 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-bold text-lg dark:bg-primary-900 dark:text-primary-300">
              EM
            </div>
            <h1 className="text-xl font-display font-bold ml-2">
              <span className="text-primary-600 dark:text-primary-400">EduMatrik</span>
              <span className="text-secondary-500">AI</span>
            </h1>
        </Link>
      </div>
      
      <div className="flex items-center space-x-4">
        <ThemeSwitch />
        
        {user && (
          <NotificationCenter 
            userId={user.id}
            schoolId={user.schoolId}
          />
        )}
        
        <div className="flex items-center">
          <div className="mr-3 text-right hidden md:block">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {user?.fullName}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {user?.role && getRoleName(user.role)}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9">
                  <AvatarImage src="" alt={user?.fullName || "User"} />
                  <AvatarFallback className="bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300">
                    {user?.fullName ? getInitials(user.fullName) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.fullName}
                  </p>
                  <p className="text-xs leading-none text-neutral-500 dark:text-neutral-400">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/account" className="flex cursor-pointer items-center">
                    <User className="mr-2 h-4 w-4" />
                    <span>Minha Conta</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex cursor-pointer items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-red-500 dark:text-red-400 focus:text-red-500 dark:focus:text-red-400"
                onClick={() => logout()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
