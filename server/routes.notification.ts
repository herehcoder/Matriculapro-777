import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authorizeChannel, sendUserNotification } from "./pusher";

export function registerNotificationRoutes(app: Express, isAuthenticated: any) {
  // Notification routes
  app.get("/api/notifications/user/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const read = req.query.read !== undefined ? req.query.read === 'true' : undefined;
      
      // Ensure user can only see their own notifications
      if (userId !== (req.user as any).id && (req.user as any).role !== 'admin') {
        return res.status(403).json({ message: "Não autorizado a ver notificações de outro usuário" });
      }
      
      // Temporariamente retornamos um array vazio até resolver o problema do banco
      //const notifications = await storage.getNotificationsByUser(userId, read);
      const notifications = [];
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Erro ao buscar notificações" });
    }
  });
  
  app.patch("/api/notifications/user/:userId/read-all", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      // Ensure user can only mark their own notifications as read
      if (userId !== (req.user as any).id && (req.user as any).role !== 'admin') {
        return res.status(403).json({ message: "Não autorizado a alterar notificações de outro usuário" });
      }
      
      // Temporariamente comentando a chamada real
      //await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ message: "Erro ao marcar notificações como lidas" });
    }
  });
  
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const notificationId = parseInt(req.params.id);
      const notification = await storage.getNotification(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notificação não encontrada" });
      }
      
      // Ensure user can only mark their own notifications as read
      if (notification.userId !== (req.user as any).id && (req.user as any).role !== 'admin') {
        return res.status(403).json({ message: "Não autorizado a alterar essa notificação" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
  });
  
  // Pusher authentication route
  app.post('/api/pusher/auth', isAuthenticated, (req: Request, res: Response) => {
    const socketId = req.body.socket_id;
    const channel = req.body.channel_name;
    const user = req.user as any;
    
    try {
      // Check if user is allowed to subscribe to this channel
      if (channel.startsWith('private-user-')) {
        const channelUserId = parseInt(channel.replace('private-user-', ''), 10);
        if (channelUserId !== user.id && user.role !== 'admin') {
          return res.status(403).json({ message: "Não autorizado a acessar este canal" });
        }
      } else if (channel.startsWith('private-school-')) {
        const channelSchoolId = parseInt(channel.replace('private-school-', ''), 10);
        if (user.schoolId !== channelSchoolId && user.role !== 'admin') {
          return res.status(403).json({ message: "Não autorizado a acessar este canal de escola" });
        }
      }
      
      // Authorize the subscription
      const auth = authorizeChannel(socketId, channel, user.id);
      res.send(auth);
    } catch (error) {
      console.error("Pusher auth error:", error);
      res.status(403).json({ message: "Erro na autenticação do Pusher" });
    }
  });

  // Test notification endpoint (for development)
  app.post('/api/notifications/test', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { title, message, type } = req.body;
      
      await sendUserNotification(userId, {
        title: title || 'Notificação de teste',
        message: message || 'Esta é uma notificação de teste enviada pela API.',
        type: type || 'system'
      });
      
      res.json({ success: true, message: "Notificação de teste enviada" });
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Erro ao enviar notificação de teste" });
    }
  });
}