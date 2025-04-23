import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface User {
  id: number;
  fullName: string;
  role: string;
  profileImage: string | null;
}

interface UserListProps {
  users: User[];
  onSelectUser: (userId: number) => void;
  isLoading: boolean;
}

const UserList: React.FC<UserListProps> = ({ users, onSelectUser, isLoading }) => {
  // Function to format role names for display
  const formatRole = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'school':
        return 'Escola';
      case 'attendant':
        return 'Atendente';
      case 'student':
        return 'Estudante';
      default:
        return role;
    }
  };

  if (isLoading) {
    return (
      <div className="py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-36 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Nenhum usuário encontrado.
      </div>
    );
  }

  // Group users by role for better organization
  const usersByRole: Record<string, User[]> = {};
  users.forEach(user => {
    if (!usersByRole[user.role]) {
      usersByRole[user.role] = [];
    }
    usersByRole[user.role].push(user);
  });

  // Order to display roles
  const roleOrder = ['admin', 'school', 'attendant', 'student'];

  return (
    <div className="py-2">
      {roleOrder.map(role => {
        const roleUsers = usersByRole[role] || [];
        if (roleUsers.length === 0) return null;
        
        return (
          <div key={role}>
            <div className="px-3 py-2 bg-muted/30 font-medium text-sm text-muted-foreground">
              {formatRole(role)}s
            </div>
            
            {roleUsers.map(user => (
              <div
                key={user.id}
                className="flex items-center p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectUser(user.id)}
              >
                <Avatar className="h-10 w-10 mr-3">
                  {user.profileImage ? (
                    <AvatarImage src={user.profileImage} alt={user.fullName} />
                  ) : (
                    <AvatarFallback>{user.fullName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                
                <div>
                  <h4 className="font-medium text-sm">{user.fullName}</h4>
                  <p className="text-xs text-muted-foreground">{formatRole(user.role)}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default UserList;