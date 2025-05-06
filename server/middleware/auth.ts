import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para verificar se o usuário está autenticado
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized - Por favor, faça login" });
};

/**
 * Middleware para verificar se o usuário é administrador
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized - Por favor, faça login" });
  }
  
  const user = req.user as any;
  if (user.role === 'admin') {
    return next();
  }
  
  return res.status(403).json({ message: "Forbidden - Apenas administradores podem acessar este recurso" });
};

/**
 * Middleware para verificar se o usuário é administrador de escola
 */
export const requireSchoolAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized - Por favor, faça login" });
  }
  
  const user = req.user as any;
  if (user.role === 'admin' || user.role === 'school') {
    return next();
  }
  
  return res.status(403).json({ message: "Forbidden - Apenas administradores ou administradores de escola podem acessar este recurso" });
};

/**
 * Middleware para verificar se o usuário tem um dos papéis especificados
 */
export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized - Por favor, faça login" });
    }
    
    const user = req.user as any;
    if (roles.includes(user.role)) {
      return next();
    }
    
    return res.status(403).json({ message: "Forbidden - Você não tem permissão para acessar este recurso" });
  };
};