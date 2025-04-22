import * as React from "react";
import { Link, useRoute } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  School,
  User,
  Users,
  ClipboardList,
  MessageSquare,
  LayoutDashboard,
  Settings,
  LogOut,
  MessagesSquare,
  FormInput,
  LineChart,
  PlusCircle,
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ className, isOpen, onClose, ...props }: SidebarProps) {
  const { user, logout } = useAuth();
  const role = user?.role;

  return (
    <aside
      className={cn(
        "bg-sidebar border-r border-sidebar-border w-64 flex-shrink-0 transition-all duration-300 ease-in-out overflow-y-auto h-screen fixed lg:relative z-40 lg:z-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        className
      )}
      {...props}
    >
      <div className="p-4">
        <nav className="space-y-1">
          <SidebarItem
            href="/"
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            onClick={onClose}
          />

          {/* Admin Links */}
          {role === "admin" && (
            <>
              <SidebarItem
                href="/schools"
                icon={<School size={18} />}
                label="Escolas"
                onClick={onClose}
              />
            </>
          )}

          {/* School and Attendant Links */}
          {(role === "school" || role === "attendant" || role === "admin") && (
            <>
              <SidebarItem
                href="/enrollments"
                icon={<ClipboardList size={18} />}
                label="Matrículas"
                onClick={onClose}
              />
              <SidebarItem
                href="/leads"
                icon={<Users size={18} />}
                label="Leads"
                onClick={onClose}
              />
              <SidebarItem
                href="/chatbot"
                icon={<MessageSquare size={18} />}
                label="Chatbot"
                onClick={onClose}
              />
              <SidebarItem
                href="/whatsapp"
                icon={<MessagesSquare size={18} />}
                label="WhatsApp"
                badge="Novo"
                onClick={onClose}
              />
              <SidebarItem
                href="/form-questions"
                icon={<FormInput size={18} />}
                label="Perguntas do Formulário"
                onClick={onClose}
              />
              <SidebarItem
                href="/analytics"
                icon={<LineChart size={18} />}
                label="Análises"
                onClick={onClose}
              />
            </>
          )}

          {/* Student Links */}
          {role === "student" && (
            <>
              <SidebarItem
                href="/my-enrollments"
                icon={<ClipboardList size={18} />}
                label="Minhas Matrículas"
                onClick={onClose}
              />
              <SidebarItem
                href="/support"
                icon={<MessageSquare size={18} />}
                label="Suporte"
                onClick={onClose}
              />
            </>
          )}

          {/* Configuration Section */}
          <h3 className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mt-8 mb-2">
            Configurações
          </h3>
          <SidebarItem
            href="/account"
            icon={<User size={18} />}
            label="Minha Conta"
            onClick={onClose}
          />
          <SidebarItem
            href="/settings"
            icon={<Settings size={18} />}
            label="Configurações"
            onClick={onClose}
          />
          <Button
            variant="ghost"
            className="w-full justify-start px-3 py-2 text-sm font-medium rounded-lg text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            onClick={() => {
              logout();
              if (onClose) onClose();
            }}
          >
            <LogOut className="mr-3 h-4 w-4 text-neutral-400" />
            <span>Sair</span>
          </Button>

          {/* Quick actions */}
          {(role === "admin" || role === "school") && (
            <div className="mt-8 px-3">
              <Button 
                className="w-full justify-center" 
                size="sm"
                onClick={() => {
                  const path = role === "admin" ? "/schools/new" : "/courses/new";
                  window.location.href = path;
                  if (onClose) onClose();
                }}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {role === "admin" ? "Nova Escola" : "Novo Curso"}
              </Button>
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick?: () => void;
}

function SidebarItem({ href, icon, label, badge, onClick }: SidebarItemProps) {
  const [isActive] = useRoute(href === "/" ? href : `${href}/*`);

  return (
    <Link href={href}>
      <a
        className={cn(
          "flex items-center px-3 py-2 text-sm font-medium rounded-lg",
          isActive
            ? "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
            : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
        )}
        onClick={onClick}
      >
        <span
          className={cn(
            "mr-3",
            isActive ? "text-primary-500 dark:text-primary-400" : "text-neutral-400 dark:text-neutral-500"
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
        {badge && (
          <span className="ml-auto bg-accent-500 text-white text-xs px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </a>
    </Link>
  );
}
