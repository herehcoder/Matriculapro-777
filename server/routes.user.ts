import { Request, Response, Express, NextFunction } from "express";
import { storage } from "./storage";
import { hashPassword } from "./auth";
import { eq, and, or, like } from "drizzle-orm";
import { users } from "@shared/schema";

/**
 * Registra as rotas de usuários
 * @param app Express application
 * @param isAuthenticated Middleware de autenticação
 */
export function registerUserRoutes(app: Express, isAuthenticated: any) {
  /**
   * @route GET /api/users
   * @desc Lista todos os usuários
   * @access Private
   */
  app.get("/api/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;

      // Apenas administradores podem ver todos os usuários
      // Escolas só podem ver seus usuários (atendentes e alunos)
      let usersList = [];

      if (userRole === "admin") {
        usersList = await storage.getAllUsers();
      } else if (userRole === "school" && userSchoolId) {
        usersList = await storage.getUsersBySchool(userSchoolId);
      } else {
        return res.status(403).json({ message: "Acesso negado. Permissão insuficiente." });
      }

      res.json(usersList);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  /**
   * @route GET /api/users/:id
   * @desc Busca um usuário pelo ID
   * @access Private
   */
  app.get("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;

      const targetUser = await storage.getUser(userId);

      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificação de permissão:
      // 1. Admins podem ver qualquer usuário
      // 2. Escolas só podem ver seus usuários (atendentes e alunos vinculados)
      // 3. Qualquer usuário pode ver seu próprio perfil
      if (
        userRole === "admin" ||
        (userRole === "school" && targetUser.schoolId === userSchoolId) ||
        req.user?.id === targetUser.id
      ) {
        return res.json(targetUser);
      }

      res.status(403).json({ message: "Acesso negado. Você não tem permissão para ver este usuário." });
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  /**
   * @route POST /api/users
   * @desc Cria um novo usuário
   * @access Private - apenas admin ou escola (com restrições)
   */
  app.post("/api/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;
      const { role, schoolId, ...userData } = req.body;

      // Verificar permissões
      // 1. Apenas admins podem criar admins ou escolas
      // 2. Escolas só podem criar atendentes ou alunos vinculados a elas
      if (
        (userRole !== "admin" && (role === "admin" || role === "school")) ||
        (userRole === "school" && (!schoolId || schoolId !== userSchoolId))
      ) {
        return res.status(403).json({ message: "Acesso negado. Você não tem permissão para criar este tipo de usuário." });
      }

      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }

      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já está em uso" });
      }

      // Hash da senha
      const hashedPassword = await hashPassword(userData.password);

      // Criar o usuário
      const newUser = await storage.createUser({
        ...userData,
        role,
        schoolId: role === "attendant" || role === "student" ? schoolId : null,
        password: hashedPassword,
      });

      // Remover a senha da resposta
      const { password, ...userResponse } = newUser;

      res.status(201).json(userResponse);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  /**
   * @route PATCH /api/users/:id
   * @desc Atualiza um usuário existente
   * @access Private
   */
  app.patch("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;
      const { role, schoolId, password, ...userData } = req.body;

      // Buscar o usuário que será atualizado
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificar permissões
      // 1. Admins podem atualizar qualquer usuário
      // 2. Escolas só podem atualizar seus atendentes e alunos
      // 3. Usuários podem atualizar seus próprios dados (exceto papel/role)
      if (
        userRole !== "admin" &&
        !(userRole === "school" && targetUser.schoolId === userSchoolId) &&
        req.user?.id !== targetUser.id
      ) {
        return res.status(403).json({ message: "Acesso negado. Você não tem permissão para atualizar este usuário." });
      }

      // Não permitir que usuários não-admin alterem papéis
      if (userRole !== "admin" && role && role !== targetUser.role) {
        return res.status(403).json({ message: "Acesso negado. Você não tem permissão para alterar o papel do usuário." });
      }

      // Escolas não podem alterar para escolas que não sejam elas mesmas
      if (
        userRole === "school" &&
        schoolId &&
        schoolId !== userSchoolId
      ) {
        return res.status(403).json({ message: "Acesso negado. Você só pode associar usuários à sua própria escola." });
      }

      // Se mudar email ou username, verificar se já existe
      if (
        userData.username && 
        userData.username !== targetUser.username
      ) {
        const existingUser = await storage.getUserByUsername(userData.username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Nome de usuário já existe" });
        }
      }

      if (
        userData.email && 
        userData.email !== targetUser.email
      ) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail && existingEmail.id !== userId) {
          return res.status(400).json({ message: "Email já está em uso" });
        }
      }

      // Atualizar o usuário
      const updatedUser = await storage.updateUser(userId, {
        ...userData,
        role: role || targetUser.role,
        schoolId: role === "attendant" || role === "student" ? schoolId : null,
      });

      // Remover a senha da resposta
      const { password: userPassword, ...userResponse } = updatedUser;

      res.json(userResponse);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  /**
   * @route DELETE /api/users/:id
   * @desc Exclui um usuário
   * @access Private - apenas admin ou escola (com restrições)
   */
  app.delete("/api/users/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;

      // Buscar o usuário que será excluído
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificar permissões
      // 1. Admins podem excluir qualquer usuário (exceto a si mesmos)
      // 2. Escolas só podem excluir seus atendentes e alunos
      if (
        req.user?.id === userId ||
        (userRole !== "admin" &&
          !(userRole === "school" && targetUser.schoolId === userSchoolId))
      ) {
        return res.status(403).json({ message: "Acesso negado. Você não tem permissão para excluir este usuário." });
      }

      // Não permitir excluir o usuário admin principal
      if (targetUser.username === "admin" && targetUser.role === "admin") {
        return res.status(403).json({ message: "Não é possível excluir o usuário administrador principal." });
      }

      // Excluir o usuário
      await storage.deleteUser(userId);

      res.json({ message: "Usuário excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  /**
   * @route POST /api/users/:id/change-password
   * @desc Altera a senha de um usuário
   * @access Private
   */
  app.post("/api/users/:id/change-password", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ message: "A senha é obrigatória" });
      }

      // Buscar o usuário
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Verificar permissões
      // 1. Admins podem alterar a senha de qualquer usuário
      // 2. Escolas só podem alterar a senha de seus atendentes e alunos
      // 3. Usuários podem alterar sua própria senha
      if (
        userRole !== "admin" &&
        !(userRole === "school" && targetUser.schoolId === userSchoolId) &&
        req.user?.id !== targetUser.id
      ) {
        return res.status(403).json({ message: "Acesso negado. Você não tem permissão para alterar a senha deste usuário." });
      }

      // Hash da nova senha
      const hashedPassword = await hashPassword(password);

      // Atualizar a senha
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: "Senha alterada com sucesso" });
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      res.status(500).json({ message: "Erro ao alterar senha" });
    }
  });

  /**
   * @route GET /api/users/search
   * @desc Busca usuários por termo de pesquisa
   * @access Private
   */
  app.get("/api/users/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { term } = req.query;
      const userRole = req.user?.role;
      const userSchoolId = req.user?.schoolId;

      if (!term) {
        return res.status(400).json({ message: "Termo de pesquisa é obrigatório" });
      }

      let searchResults = [];
      const searchTerm = `%${term}%`;

      // Administradores podem pesquisar qualquer usuário
      if (userRole === "admin") {
        searchResults = await storage.searchUsers(searchTerm as string);
      } 
      // Escolas só podem pesquisar seus usuários
      else if (userRole === "school" && userSchoolId) {
        searchResults = await storage.searchUsersBySchool(searchTerm as string, userSchoolId);
      } else {
        return res.status(403).json({ message: "Acesso negado. Permissão insuficiente." });
      }

      res.json(searchResults);
    } catch (error) {
      console.error("Erro ao pesquisar usuários:", error);
      res.status(500).json({ message: "Erro ao pesquisar usuários" });
    }
  });
}