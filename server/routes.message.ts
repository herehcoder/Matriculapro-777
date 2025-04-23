import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { messages, insertMessageSchema, users } from "../shared/schema";
import { sendPrivateMessage } from "./pusher";
import { eq, desc, and, or } from "drizzle-orm";
import { db } from "./db";

export function registerMessageRoutes(app: Express, isAuthenticated: any) {
  // Get all conversations for a user
  app.get("/api/messages/conversations/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      // Get all messages where the user is either sender or receiver
      const allMessages = await db.select({
        message: messages,
        sender: users,
        receiver: users
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .leftJoin(users.as('receiver'), eq(messages.receiverId, users.id))
      .where(
        or(
          eq(messages.senderId, parseInt(userId)),
          eq(messages.receiverId, parseInt(userId))
        )
      )
      .orderBy(desc(messages.createdAt));

      // Group messages by conversation (other user)
      const conversations = new Map();
      
      allMessages.forEach(msg => {
        const isUserSender = msg.message.senderId === parseInt(userId);
        const otherUserId = isUserSender ? msg.message.receiverId : msg.message.senderId;
        const otherUser = isUserSender ? msg.receiver : msg.sender;
        
        if (!conversations.has(otherUserId)) {
          conversations.set(otherUserId, {
            userId: otherUserId,
            fullName: otherUser.fullName,
            role: otherUser.role,
            lastMessage: msg.message.content,
            lastMessageTime: msg.message.createdAt,
            unreadCount: !isUserSender && msg.message.status !== 'read' ? 1 : 0
          });
        } else if (!isUserSender && msg.message.status !== 'read') {
          const conv = conversations.get(otherUserId);
          conv.unreadCount++;
          conversations.set(otherUserId, conv);
        }
      });
      
      // Convert map to array and sort by last message time
      const conversationsArray = Array.from(conversations.values()).sort((a, b) => 
        b.lastMessageTime.getTime() - a.lastMessageTime.getTime()
      );
      
      return res.json({ success: true, conversations: conversationsArray });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return res.status(500).json({ success: false, error: "Error fetching conversations" });
    }
  });

  // Get messages between two users
  app.get("/api/messages/:userId/:otherUserId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, otherUserId } = req.params;
      
      // Get the conversation between the two users
      const conversation = await storage.getConversation(
        parseInt(userId),
        parseInt(otherUserId)
      );
      
      // Mark messages as read if user is the recipient
      for (const message of conversation) {
        if (message.receiverId === parseInt(userId) && message.status !== 'read') {
          await storage.updateMessageStatus(message.id, 'read');
        }
      }
      
      // Get user details
      const otherUser = await storage.getUser(parseInt(otherUserId));
      
      return res.json({ 
        success: true, 
        messages: conversation,
        otherUser: otherUser ? {
          id: otherUser.id,
          fullName: otherUser.fullName,
          role: otherUser.role,
          profileImage: otherUser.profileImage
        } : null 
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ success: false, error: "Error fetching messages" });
    }
  });

  // Send a message
  app.post("/api/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validatedData = insertMessageSchema.parse(req.body);
      
      // Get the sender info
      const sender = await storage.getUser(validatedData.senderId);
      if (!sender) {
        return res.status(404).json({ success: false, error: "Sender not found" });
      }
      
      // Get the receiver info
      const receiver = await storage.getUser(validatedData.receiverId);
      if (!receiver) {
        return res.status(404).json({ success: false, error: "Receiver not found" });
      }
      
      // Create the message in the database
      const newMessage = await storage.createMessage(validatedData);
      
      // Send the message via Pusher
      await sendPrivateMessage(
        validatedData.senderId,
        validatedData.receiverId,
        {
          content: validatedData.content,
          senderId: validatedData.senderId,
          senderName: sender.fullName,
          senderRole: sender.role,
        }
      );
      
      return res.status(201).json({ success: true, message: newMessage });
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).json({ success: false, error: "Error sending message" });
    }
  });

  // Mark a message as read
  app.patch("/api/messages/:id/read", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const message = await storage.getMessage(parseInt(id));
      if (!message) {
        return res.status(404).json({ success: false, error: "Message not found" });
      }
      
      // Only the receiver can mark a message as read
      if (message.receiverId !== req.session.userId) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
      
      const updatedMessage = await storage.updateMessageStatus(parseInt(id), 'read');
      
      return res.json({ success: true, message: updatedMessage });
    } catch (error) {
      console.error("Error marking message as read:", error);
      return res.status(500).json({ success: false, error: "Error marking message as read" });
    }
  });

  // Get list of users that can be messaged
  app.get("/api/messages/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const currentUser = await storage.getUser(req.session.userId);
      if (!currentUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      
      let usersQuery = db.select({
        id: users.id,
        fullName: users.fullName,
        role: users.role,
        profileImage: users.profileImage,
        schoolId: users.schoolId
      })
      .from(users)
      .where(eq(users.id, req.session.userId).not());
      
      // Filter by role/school depending on the current user's role
      if (currentUser.role === 'admin') {
        // Admin can message anyone
      } else if (currentUser.role === 'school') {
        // School can message their own attendants, students, and admins
        usersQuery = usersQuery.where(
          or(
            eq(users.role, 'admin'),
            and(
              eq(users.schoolId, currentUser.schoolId),
              or(
                eq(users.role, 'attendant'),
                eq(users.role, 'student')
              )
            )
          )
        );
      } else if (currentUser.role === 'attendant') {
        // Attendant can message their school, students from their school, and admins
        usersQuery = usersQuery.where(
          or(
            eq(users.role, 'admin'),
            and(
              eq(users.schoolId, currentUser.schoolId),
              or(
                eq(users.role, 'school'),
                eq(users.role, 'student')
              )
            )
          )
        );
      } else if (currentUser.role === 'student') {
        // Student can message their school, attendants from their school, and admins
        usersQuery = usersQuery.where(
          or(
            eq(users.role, 'admin'),
            and(
              eq(users.schoolId, currentUser.schoolId),
              or(
                eq(users.role, 'school'),
                eq(users.role, 'attendant')
              )
            )
          )
        );
      }
      
      const usersList = await usersQuery;
      
      return res.json({ success: true, users: usersList });
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ success: false, error: "Error fetching users" });
    }
  });
}