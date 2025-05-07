import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'school' | 'attendant' | 'student';
  schoolId?: number;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  role?: string;
}

export function useAuth() {
  const { toast } = useToast();
  
  // Consulta para obter o usuário atual
  const {
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/auth/me');
        if (!response.ok && response.status === 401) {
          return null;
        }
        return await response.json();
      } catch (error) {
        console.error('Error fetching authenticated user:', error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutação para login
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/auth/me'], userData);
      toast({
        title: "Login bem-sucedido",
        description: `Bem-vindo, ${userData.fullName || userData.username}!`,
      });
    },
    onError: (error: any) => {
      console.error('Login error:', error);
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Credenciais inválidas. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para registro
  const registerMutation = useMutation({
    mutationFn: async (userData: RegisterCredentials) => {
      const response = await apiRequest('POST', '/api/auth/register', userData);
      return await response.json();
    },
    onSuccess: (userData: User) => {
      queryClient.setQueryData(['/api/auth/me'], userData);
      toast({
        title: "Registro bem-sucedido",
        description: `Bem-vindo, ${userData.fullName || userData.username}!`,
      });
    },
    onError: (error: any) => {
      console.error('Registration error:', error);
      toast({
        title: "Erro ao registrar",
        description: error.message || "Não foi possível criar a conta. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Mutação para logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.setQueryData(['/api/auth/me'], null);
      queryClient.invalidateQueries();
      toast({
        title: "Logout bem-sucedido",
        description: "Você saiu da sua conta.",
      });
    },
    onError: (error: any) => {
      console.error('Logout error:', error);
      toast({
        title: "Erro ao sair",
        description: error.message || "Não foi possível efetuar o logout. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading,
    error,
    refetch,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}