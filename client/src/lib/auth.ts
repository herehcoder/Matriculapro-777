import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getCurrentUser, loginUser, logoutUser } from "./api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "./supabase";

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
  supabaseUser: any;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session with Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setSupabaseUser(session.user);
          
          // Also get our application user data
          const userData = await getCurrentUser();
          setUser(userData);
        } else {
          // No Supabase session, but check our app session as fallback
          try {
            const userData = await getCurrentUser();
            if (userData) {
              setUser(userData);
            }
          } catch (err) {
            // Not authenticated in our app either
            console.log("No authenticated session found");
          }
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Set up Supabase auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setSupabaseUser(session.user);
          
          // When Supabase auth changes, sync with our application
          try {
            const userData = await getCurrentUser();
            setUser(userData);
          } catch (err) {
            console.error("Error syncing user data:", err);
          }
        } else {
          setSupabaseUser(null);
          setUser(null);
        }
      }
    );
    
    checkAuth();
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const login = async (email: string, password: string, role: string) => {
    try {
      setIsLoading(true);
      
      // First authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) {
        throw error;
      }
      
      // Then authenticate with our session-based system
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
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Sign out from our session system
      await logoutUser();
      
      setUser(null);
      setSupabaseUser(null);
      
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
    { value: { user, isLoading, login, logout, supabaseUser } },
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
