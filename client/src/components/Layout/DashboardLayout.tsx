import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocation, Link } from 'wouter';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Home, 
  Users, 
  BookOpen, 
  FileText, 
  Bell, 
  MessageSquare, 
  BarChart, 
  Settings,
  Phone,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TopNavBar } from './TopNavBar';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ href, icon, label, active, onClick }) => {
  return (
    <Link href={href}>
      <a 
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
          active 
            ? "bg-primary text-primary-foreground" 
            : "hover:bg-muted"
        )}
      >
        {icon}
        <span>{label}</span>
      </a>
    </Link>
  );
};

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Fechar sidebar em mobile quando navegar
  const handleNavClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  if (!user) {
    return null;
  }

  const navItems = [
    { href: '/', icon: <Home size={20} />, label: 'Dashboard', roles: ['admin', 'school', 'attendant', 'student'] },
    { href: '/users', icon: <Users size={20} />, label: 'Usuários', roles: ['admin', 'school'] },
    { href: '/courses', icon: <BookOpen size={20} />, label: 'Cursos', roles: ['admin', 'school', 'attendant', 'student'] },
    { href: '/enrollments', icon: <FileText size={20} />, label: 'Matrículas', roles: ['admin', 'school', 'attendant'] },
    { href: '/messages', icon: <MessageSquare size={20} />, label: 'Mensagens', roles: ['admin', 'school', 'attendant', 'student'] },
    { href: '/whatsapp', icon: <Phone size={20} />, label: 'WhatsApp', roles: ['admin', 'school'] },
    { href: '/notifications', icon: <Bell size={20} />, label: 'Notificações', roles: ['admin', 'school', 'attendant', 'student'] },
    { href: '/metrics', icon: <BarChart size={20} />, label: 'Métricas', roles: ['admin', 'school'] },
    { href: '/settings', icon: <Settings size={20} />, label: 'Configurações', roles: ['admin', 'school', 'attendant', 'student'] },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <TopNavBar onSidebarToggle={toggleSidebar} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div 
          className={cn(
            "bg-card border-r fixed md:relative z-30 h-[calc(100vh-64px)] transition-all duration-300 ease-in-out",
            sidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:w-20 md:translate-x-0"
          )}
        >
          {isMobile && sidebarOpen && (
            <div className="absolute right-2 top-2">
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <X size={20} />
              </Button>
            </div>
          )}
          
          <div className="py-4 overflow-y-auto h-full">
            <nav className="space-y-1 px-2">
              {navItems
                .filter(item => item.roles.includes(user.role))
                .map(item => (
                  <NavItem 
                    key={item.href} 
                    href={item.href} 
                    icon={item.icon} 
                    label={item.label} 
                    active={location === item.href}
                    onClick={handleNavClick}
                  />
                ))
              }
            </nav>
          </div>
        </div>
        
        {/* Overlay para fechar sidebar em mobile */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20"
            onClick={toggleSidebar}
          />
        )}
        
        {/* Main content */}
        <main className={cn(
          "flex-1 overflow-y-auto transition-all duration-300 ease-in-out",
          sidebarOpen ? "md:ml-64" : "md:ml-20"
        )}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;