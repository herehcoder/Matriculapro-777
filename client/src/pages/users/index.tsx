import { Route, Switch, useRoute } from "wouter";
import UsersList from "./list";
import NewUser from "./new";
import EditUser from "./edit";
import EditUserWithId from "./edit/[id]";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "../not-found";
import { Loader2 } from "lucide-react";

export default function UsersRoutes() {
  const { user, isLoading } = useAuth();
  const [match] = useRoute("/users");
  const [matchWildcard] = useRoute("/users/*");

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Carregando...</span>
      </div>
    );
  }

  // Verificar se o usuário tem permissão para acessar a área de usuários
  if (!user || (user.role !== "admin" && user.role !== "school")) {
    return <NotFound />;
  }

  if (match) {
    return <UsersList />;
  }

  return (
    <Switch>
      <Route path="/users/new" component={NewUser} />
      <Route path="/users/edit" component={EditUser} />
      <Route path="/users/edit/:id" component={EditUserWithId} />
      <Route component={NotFound} />
    </Switch>
  );
}