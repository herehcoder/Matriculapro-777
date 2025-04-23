import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: number;
  fullName: string;
  role: string;
  online?: boolean;
  profileImage?: string | null;
}

interface UserListProps {
  users: User[];
  onSelectUser: (userId: number) => void;
  isLoading: boolean;
}

// Função para obter as iniciais do nome
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Função para traduzir o papel do usuário
const translateRole = (role: string): string => {
  const translations: Record<string, string> = {
    'admin': 'Administrador',
    'school': 'Escola',
    'attendant': 'Atendente',
    'student': 'Estudante'
  };
  return translations[role] || role;
};

const UserList: React.FC<UserListProps> = ({ users, onSelectUser, isLoading }) => {
  // Agrupar usuários por papel
  const groupedUsers = users.reduce<Record<string, User[]>>((acc, user) => {
    const role = user.role;
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  // Ordem de exibição dos papéis
  const roleOrder = ['admin', 'school', 'attendant', 'student'];

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-2">
      {roleOrder.map(role => {
        const usersInRole = groupedUsers[role] || [];
        if (usersInRole.length === 0) return null;

        return (
          <div key={role} className="mb-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">
              {translateRole(role)}s
            </h3>
            <div className="space-y-1">
              {usersInRole.map(user => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser(user.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="h-9 w-9">
                    {user.profileImage ? (
                      <AvatarImage src={user.profileImage} alt={user.fullName} />
                    ) : (
                      <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{user.fullName}</span>
                      {user.online && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {translateRole(user.role)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <Separator className="my-2" />
          </div>
        );
      })}
    </div>
  );
};

export default UserList;