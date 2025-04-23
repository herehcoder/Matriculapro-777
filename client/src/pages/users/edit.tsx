import { useEffect } from "react";
import { useLocation } from "wouter";

export default function EditUser() {
  const [, navigate] = useLocation();

  // Redirecionar para a lista de usuários se acessar esta rota diretamente
  useEffect(() => {
    navigate("/users");
  }, [navigate]);

  // Este componente não renderiza nada, apenas redireciona
  return null;
}