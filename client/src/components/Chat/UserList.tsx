import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

interface User {
  id: number;
  fullName: string;
  role: string;
  online?: boolean;
}

interface UserListProps {
  users: User[];
  onSelectUser: (userId: number) => void;
  isLoading: boolean;
}

const UserList: React.FC<UserListProps> = ({ users, onSelectUser, isLoading }) => {
  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Função para obter a cor de fundo baseada no papel do usuário
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'school':
        return 'bg-blue-100 text-blue-800';
      case 'attendant':
        return 'bg-yellow-100 text-yellow-800';
      case 'student':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Nenhum usuário encontrado</p>
      </div>
    );
  }

  // Agrupar usuários por papel
  const groupedUsers: Record<string, User[]> = {};
  
  users.forEach(user => {
    if (!groupedUsers[user.role]) {
      groupedUsers[user.role] = [];
    }
    groupedUsers[user.role].push(user);
  });

  // Ordem de exibição dos papéis
  const roleOrder = ['admin', 'school', 'attendant', 'student'];
  
  // Tradução dos papéis
  const roleTranslation: Record<string, string> = {
    admin: 'Administradores',
    school: 'Escolas',
    attendant: 'Atendentes',
    student: 'Estudantes'
  };

  return (
    <div className="divide-y">
      {roleOrder.map(role => {
        const usersInRole = groupedUsers[role] || [];
        
        if (usersInRole.length === 0) return null;
        
        return (
          <div key={role} className="py-2">
            <div className="px-3 py-1">
              <h4 className="text-sm font-medium text-muted-foreground">
                {roleTranslation[role] || role}
              </h4>
            </div>
            
            {usersInRole.map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`/api/avatar/${user.id}`} alt={user.fullName} />
                    <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.fullName}</span>
                      {user.online && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online" />
                      )}
                    </div>
                    <Badge variant="outline" className={`text-xs ${getRoleColor(user.role)}`}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectUser(user.id)}
                  title="Iniciar conversa"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default UserList;