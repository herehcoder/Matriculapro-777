import { notifications, type Notification, type InsertNotification } from "@shared/schema";
import { messages, type Message, type InsertMessage } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { db } from "./db";

export function addNotificationMethodsToMemStorage(memStorage: any) {
  memStorage.notifications = [];
  
  memStorage.getNotification = async function(id: number): Promise<Notification | undefined> {
    return this.notifications.find((n: Notification) => n.id === id);
  };
  
  memStorage.getNotificationsByUser = async function(userId: number, read?: boolean): Promise<Notification[]> {
    return this.notifications.filter((n: Notification) => {
      if (n.userId !== userId) return false;
      if (read !== undefined) return n.read === read;
      return true;
    }).sort((a: Notification, b: Notification) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  
  memStorage.getNotificationsBySchool = async function(schoolId: number): Promise<Notification[]> {
    return this.notifications.filter((n: Notification) => n.schoolId === schoolId)
      .sort((a: Notification, b: Notification) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  
  memStorage.createNotification = async function(notification: InsertNotification): Promise<Notification> {
    const newId = this.notifications.length > 0 
      ? Math.max(...this.notifications.map((n: Notification) => n.id)) + 1 
      : 1;
    
    const newNotification: Notification = {
      id: newId,
      ...notification,
      read: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.notifications.push(newNotification);
    return newNotification;
  };
  
  memStorage.updateNotification = async function(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const index = this.notifications.findIndex((n: Notification) => n.id === id);
    if (index === -1) return undefined;
    
    this.notifications[index] = {
      ...this.notifications[index],
      ...notificationData,
      updatedAt: new Date()
    };
    
    return this.notifications[index];
  };
  
  memStorage.markNotificationAsRead = async function(id: number): Promise<Notification | undefined> {
    return this.updateNotification(id, { read: true });
  };
  
  memStorage.markAllNotificationsAsRead = async function(userId: number): Promise<boolean> {
    const userNotifications = this.notifications.filter((n: Notification) => n.userId === userId && !n.read);
    
    for (const notification of userNotifications) {
      await this.markNotificationAsRead(notification.id);
    }
    
    return true;
  };
  
  // Message methods
  memStorage.messages = [];
  
  memStorage.getMessage = async function(id: number): Promise<Message | undefined> {
    return this.messages.find((m: Message) => m.id === id);
  };
  
  memStorage.getMessagesByUser = async function(userId: number, asReceiver: boolean = true): Promise<Message[]> {
    return this.messages.filter((m: Message) => {
      if (asReceiver) return m.receiverId === userId;
      return m.senderId === userId;
    }).sort((a: Message, b: Message) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  
  memStorage.getConversation = async function(user1Id: number, user2Id: number): Promise<Message[]> {
    return this.messages.filter((m: Message) => {
      return (m.senderId === user1Id && m.receiverId === user2Id) || 
             (m.senderId === user2Id && m.receiverId === user1Id);
    }).sort((a: Message, b: Message) => a.createdAt.getTime() - b.createdAt.getTime());
  };
  
  memStorage.createMessage = async function(message: InsertMessage): Promise<Message> {
    const newId = this.messages.length > 0 
      ? Math.max(...this.messages.map((m: Message) => m.id)) + 1 
      : 1;
    
    const newMessage: Message = {
      id: newId,
      ...message,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.messages.push(newMessage);
    return newMessage;
  };
  
  memStorage.updateMessageStatus = async function(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined> {
    const index = this.messages.findIndex((m: Message) => m.id === id);
    if (index === -1) return undefined;
    
    this.messages[index] = {
      ...this.messages[index],
      status,
      updatedAt: new Date()
    };
    
    return this.messages[index];
  };
}

export function addNotificationMethodsToDatabaseStorage(dbStorage: any) {
  // Notification methods
  dbStorage.getNotification = async function(id: number): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  };
  
  dbStorage.getNotificationsByUser = async function(userId: number, read?: boolean): Promise<Notification[]> {
    let query = db.select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
    
    if (read !== undefined) {
      query = query.where(eq(notifications.read, read));
    }
    
    return query.orderBy(desc(notifications.createdAt));
  };
  
  dbStorage.getNotificationsBySchool = async function(schoolId: number): Promise<Notification[]> {
    return db.select()
      .from(notifications)
      .where(eq(notifications.schoolId, schoolId))
      .orderBy(desc(notifications.createdAt));
  };
  
  dbStorage.createNotification = async function(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications)
      .values(notification)
      .returning();
    
    return newNotification;
  };
  
  dbStorage.updateNotification = async function(id: number, notificationData: Partial<Notification>): Promise<Notification | undefined> {
    const [updatedNotification] = await db.update(notifications)
      .set({
        ...notificationData,
        updatedAt: new Date()
      })
      .where(eq(notifications.id, id))
      .returning();
      
    return updatedNotification;
  };
  
  dbStorage.markNotificationAsRead = async function(id: number): Promise<Notification | undefined> {
    return this.updateNotification(id, { read: true });
  };
  
  dbStorage.markAllNotificationsAsRead = async function(userId: number): Promise<boolean> {
    await db.update(notifications)
      .set({
        read: true,
        updatedAt: new Date()
      })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.read, false)
      ));
      
    return true;
  };
  
  // Message methods
  dbStorage.getMessage = async function(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  };
  
  dbStorage.getMessagesByUser = async function(userId: number, asReceiver: boolean = true): Promise<Message[]> {
    const column = asReceiver ? messages.receiverId : messages.senderId;
    
    return db.select()
      .from(messages)
      .where(eq(column, userId))
      .orderBy(desc(messages.createdAt));
  };
  
  dbStorage.getConversation = async function(user1Id: number, user2Id: number): Promise<Message[]> {
    return db.select()
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
    const [newMessage] = await db.insert(messages)
      .values(message)
      .returning();
    
    return newMessage;
  };
  
  dbStorage.updateMessageStatus = async function(id: number, status: 'sent' | 'delivered' | 'read'): Promise<Message | undefined> {
    const [updatedMessage] = await db.update(messages)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(messages.id, id))
      .returning();
      
    return updatedMessage;
  };
}