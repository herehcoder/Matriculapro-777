import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "school" | "attendant" | "student";
  phone: string | null;
  schoolId: number | null;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  email: string;
  fullName: string;
  role?: string;
  phone?: string;
  schoolId?: number;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
    refetch
  } = useQuery<User | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false
  });

  const loginMutation = useMutation<User, Error, LoginData>({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      
      if (!res.ok) {
        let errorMessage = "Erro ao fazer login";
        
        try {
          const errorData = await res.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          console.error("Erro ao processar resposta de erro:", e);
        }
        
        throw new Error(errorMessage);
      }
      
      const userData = await res.json();
      return userData;
    },
    onSuccess: (user: User) => {
      // Atualizar o cache com os dados do usuário
      queryClient.setQueryData(["/api/user"], user);
      
      // Forçar uma refetch para garantir que os dados estejam atualizados
      refetch();
      
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo(a), ${user.fullName}!`,
      });
      
      // Redirecionar para a página inicial (será feito automaticamente pelo Router)
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no login",
        description: error.message || "Verifique suas credenciais e tente novamente",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation<User, Error, RegisterData>({
    mutationFn: async (userData: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", userData);
      
      if (!res.ok) {
        let errorMessage = "Erro ao registrar usuário";
        
        try {
          const errorData = await res.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          console.error("Erro ao processar resposta de erro:", e);
        }
        
        throw new Error(errorMessage);
      }
      
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      refetch();
      
      toast({
        title: "Registro realizado com sucesso",
        description: `Bem-vindo(a), ${user.fullName}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no registro",
        description: error.message || "Não foi possível registrar o usuário",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/logout");
      
      if (!res.ok) {
        throw new Error("Erro ao fazer logout");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      refetch();
      
      toast({
        title: "Logout realizado com sucesso",
        description: "Você foi desconectado do sistema",
      });
      
      // Redirecionar para a página de login (será feito automaticamente pelo Router)
    },
    onError: (error: Error) => {
      toast({
        title: "Falha no logout",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}