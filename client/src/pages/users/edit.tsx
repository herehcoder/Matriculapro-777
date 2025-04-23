import { useLocation } from "wouter";
import { useEffect } from "react";

export default function EditUser() {
  const [, navigate] = useLocation();

  // Página de redirecionamento para a edição de um usuário específico
  useEffect(() => {
    navigate("/users");
  }, [navigate]);

  return null;
}