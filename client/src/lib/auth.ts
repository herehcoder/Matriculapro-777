import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getCurrentUser, loginUser, logoutUser } from "./api";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: "admin" | "school" | "attendant" | "student";
  schoolId?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error("Error checking authentication:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);
  
  const login = async (email: string, password: string, role: string) => {
    try {
      setIsLoading(true);
      const response = await loginUser(email, password, role);
      const userData = await response.json();
      setUser(userData);
      
      toast({
        title: "Login bem-sucedido",
        description: `Bem-vindo(a), ${userData.fullName}!`,
      });
      
      navigate("/");
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Erro no login",
        description: "Email ou senha incorretos. Tente novamente.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const logout = async () => {
    try {
      setIsLoading(true);
      await logoutUser();
      setUser(null);
      navigate("/login");
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Erro ao desconectar",
        description: "Ocorreu um erro ao realizar o logout.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return React.createElement(
    AuthContext.Provider,
    { value: { user, isLoading, login, logout } },
    children
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
