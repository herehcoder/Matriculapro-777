import {
  notifications, messages,
  type Notification, type InsertNotification,
  type Message, type InsertMessage
} from "@shared/schema";
import { eq, and, desc, or } from "drizzle-orm";
import { db } from "./db";

// Implementations for MemStorage
export function addNotificationMethodsToMemStorage(memStorage: any) {
  // TypeScript will not check the types inside this function since we're using 'any'
  // Notification methods
  memStorage.getNotification = async function(id: number): Promise<Notification | undefined> {
    return this.notificationsMap.get(id);
  };

  memStorage.getNotificationsByUser = async function(userId: number, read?: boolean): Promise<Notification[]> {
    let notifications = Array.from(this.notificationsMap.values())
      .filter(notification => notification.userId === userId);
    
    if (read !== undefined) {
      notifications = notifications.filter(notification => notification.read === read);
    }
    
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  memStorage.getNotificationsBySchool = async function(schoolId: number): Promise<Notification[]> {
    const notifications = Array.from(this.notificationsMap.values())
      .filter(notification => notification.schoolId === schoolId);
    
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  memStorage.createNotification = async function(notification: InsertNotification): Promise<Notification> {
    const id = this.notificationIdCounter++;
    const now = new Date();
    const newNotification: Notification = {
      ...notification,
      id,
      read: notification.read !== undefined ? notification.read : false,
      data: notification.data || null,
      relatedId: notification.relatedId || null,
      relatedType: notification.relatedType || null,
      createdAt: now,
    };
    this.notificationsMap.set(id, newNotification);
    return newNotification;
  };

  memStorage.updateNotification = async function(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const notification = this.notificationsMap.get(id);
    if (!notification) return undefined;
    
    const updatedNotification = {
      ...notification,
      ...notificationData,
    };
    this.notificationsMap.set(id, updatedNotification);
    return updatedNotification;
  };

  memStorage.markNotificationAsRead = async function(id: number): Promise<Notification | undefined> {
    return this.updateNotification(id, { read: true });
  };

  memStorage.markAllNotificationsAsRead = async function(userId: number): Promise<boolean> {
    const notifications = await this.getNotificationsByUser(userId, false);
    
    for (const notification of notifications) {
      await this.markNotificationAsRead(notification.id);
    }
    
    return true;
  };
  
  // Message methods
  memStorage.getMessage = async function(id: number): Promise<Message | undefined> {
    return this.messagesMap.get(id);
  };

  memStorage.getMessagesByUser = async function(userId: number, asReceiver = true): Promise<Message[]> {
    let messages = Array.from(this.messagesMap.values());
    
    if (asReceiver) {
      messages = messages.filter(message => message.receiverId === userId);
    } else {
      messages = messages.filter(message => message.senderId === userId);
    }
    
    return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };

  memStorage.getConversation = async function(user1Id: number, user2Id: number): Promise<Message[]> {
    const messages = Array.from(this.messagesMap.values())
      .filter(message => 
        (message.senderId === user1Id && message.receiverId === user2Id) || 
        (message.senderId === user2Id && message.receiverId === user1Id)
      );
    
    return messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  };

  memStorage.createMessage = async function(message: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const newMessage: Message = {
      ...message,
      id,
      status: message.status || 'sent',
      createdAt: now,
    };
    this.messagesMap.set(id, newMessage);
    return newMessage;
  };

  memStorage.updateMessageStatus = async function(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined> {
    const message = this.messagesMap.get(id);
    if (!message) return undefined;
    
    const updatedMessage = {
      ...message,
      status,
    };
    this.messagesMap.set(id, updatedMessage);
    return updatedMessage;
  };
}

// Implementations for DatabaseStorage
export function addNotificationMethodsToDatabaseStorage(dbStorage: any) {
  // Notification methods
  dbStorage.getNotification = async function(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  };

  dbStorage.getNotificationsByUser = async function(userId: number, read?: boolean): Promise<Notification[]> {
    let query = db.select().from(notifications).where(eq(notifications.userId, userId));
    
    if (read !== undefined) {
      query = query.where(eq(notifications.read, read));
    }
    
    return query.orderBy(desc(notifications.createdAt));
  };

  dbStorage.getNotificationsBySchool = async function(schoolId: number): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.schoolId, schoolId))
      .orderBy(desc(notifications.createdAt));
  };

  dbStorage.createNotification = async function(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  };

  dbStorage.updateNotification = async function(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db
      .update(notifications)
      .set(notificationData)
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification || undefined;
  };

  dbStorage.markNotificationAsRead = async function(id: number): Promise<Notification | undefined> {
    return this.updateNotification(id, { read: true });
  };

  dbStorage.markAllNotificationsAsRead = async function(userId: number): Promise<boolean> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    return true;
  };
  
  // Message methods
  dbStorage.getMessage = async function(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  };

  dbStorage.getMessagesByUser = async function(userId: number, asReceiver = true): Promise<Message[]> {
    if (asReceiver) {
      return db
        .select()
        .from(messages)
        .where(eq(messages.receiverId, userId))
        .orderBy(messages.createdAt);
    } else {
      return db
        .select()
        .from(messages)
        .where(eq(messages.senderId, userId))
        .orderBy(messages.createdAt);
    }
  };

  dbStorage.getConversation = async function(user1Id: number, user2Id: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, user1Id),
            eq(messages.receiverId, user2Id)
          ),
          and(
            eq(messages.senderId, user2Id),
            eq(messages.receiverId, user1Id)
          )
        )
      )
      .orderBy(messages.createdAt);
  };

  dbStorage.createMessage = async function(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  };

  dbStorage.updateMessageStatus = async function(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined> {
    const [updatedMessage] = await db
      .update(messages)
      .set({ status })
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage || undefined;
  };
}