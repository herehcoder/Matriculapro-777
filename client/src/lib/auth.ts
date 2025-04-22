import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getCurrentUser, loginUser, logoutUser, registerUser } from "./api";
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
  register: (userData: any) => Promise<void>;
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
        if (userData) {
          setUser(userData);
        }
      } catch (err) {
        console.log("No authenticated session found");
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
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao fazer login");
      }
      
      const userData = await response.json();
      setUser(userData);
      
      toast({
        title: "Login bem-sucedido",
        description: `Bem-vindo(a), ${userData.fullName}!`,
      });
      
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Email ou senha incorretos. Tente novamente.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };
  
  const register = async (userData: any) => {
    try {
      setIsLoading(true);
      
      const response = await registerUser(userData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao registrar");
      }
      
      const newUser = await response.json();
      
      toast({
        title: "Registro realizado com sucesso",
        description: "Você já pode fazer login com suas credenciais.",
      });
      
      navigate("/login");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Erro no registro",
        description: error.message || "Erro ao registrar usuário. Tente novamente.",
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
    { value: { user, isLoading, login, logout, register } },
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
