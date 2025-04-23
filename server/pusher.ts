import Pusher from 'pusher';
import { storage } from './storage';

// Inicialize Pusher com credenciais ou use uma versão falsa
let pusher: Pusher;

try {
  // Tentamos inicializar o Pusher
  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID || 'app-id',
    key: process.env.PUSHER_APP_KEY || 'app-key',
    secret: process.env.PUSHER_APP_SECRET || 'app-secret',
    cluster: process.env.PUSHER_APP_CLUSTER || 'us2',
    useTLS: true,
  });
  console.log('Pusher inicializado com sucesso');
} catch (error) {
  console.log('Erro ao inicializar Pusher, usando implementação simulada');
  // Implementação falsa se não tivermos credenciais válidas
  pusher = {
    trigger: async () => Promise.resolve(),
    authorizeChannel: () => ({ auth: 'fake-auth-token' }),
  } as unknown as Pusher;
}

// Types for pusher payloads
export interface NotificationPayload {
  title: string;
  message: string;
  type: 'message' | 'enrollment' | 'lead' | 'system' | 'payment';
  data?: Record<string, any>;
  relatedId?: number;
  relatedType?: string;
}

export interface MessagePayload {
  content: string;
  senderId: number;
  senderName?: string;
  senderRole?: string;
  timestamp?: string;
}

/**
 * Send a notification to a specific user
 * @param userId The ID of the user to send the notification to
 * @param notification The notification payload
 */
export const sendUserNotification = async (
  userId: number,
  notification: NotificationPayload
): Promise<void> => {
  try {
    // Create record in database
    await storage.createNotification({
      userId,
      schoolId: null,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      data: notification.data ? JSON.stringify(notification.data) : null,
      read: false,
      relatedId: notification.relatedId,
      relatedType: notification.relatedType,
    });

    // Send notification via Pusher
    await pusher.trigger(
      `private-user-${userId}`,
      'new-notification',
      notification
    );

    console.log(`Notification sent to user ${userId}`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

/**
 * Send a notification to all users in the system
 * @param notification The notification payload
 */
export const sendGlobalNotification = async (notification: NotificationPayload): Promise<void> => {
  try {
    // Send notification via Pusher to the global channel
    await pusher.trigger(
      'global',
      'new-notification',
      notification
    );

    console.log('Global notification sent to all users');
  } catch (error) {
    console.error('Error sending global notification:', error);
  }
};

/**
 * Send a notification to all users in a specific school
 * @param schoolId The ID of the school
 * @param notification The notification payload
 */
export const sendSchoolNotification = async (
  schoolId: number,
  notification: NotificationPayload
): Promise<void> => {
  try {
    // Create record in database
    await storage.createNotification({
      userId: null,
      schoolId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      data: notification.data ? JSON.stringify(notification.data) : null,
      read: false,
      relatedId: notification.relatedId,
      relatedType: notification.relatedType,
    });

    // Send notification via Pusher to the school channel
    await pusher.trigger(
      `private-school-${schoolId}`,
      'new-notification',
      notification
    );

    console.log(`Notification sent to school ${schoolId}`);
  } catch (error) {
    console.error('Error sending school notification:', error);
  }
};

/**
 * Send a private message between users
 * @param senderId The ID of the sender
 * @param receiverId The ID of the receiver
 * @param message The message payload
 */
export const sendPrivateMessage = async (
  senderId: number, 
  receiverId: number, 
  message: MessagePayload
): Promise<void> => {
  try {
    // Get sender information
    const sender = await storage.getUser(senderId);
    if (!sender) {
      throw new Error(`Sender with ID ${senderId} not found`);
    }

    // Create record in database
    const newMessage = await storage.createMessage({
      senderId,
      receiverId,
      content: message.content,
      status: 'sent',
    });

    // Add sender information to the message payload
    const enhancedMessage = {
      ...message,
      id: newMessage.id,
      senderName: sender.fullName,
      senderRole: sender.role,
      timestamp: new Date().toISOString(),
    };

    // Send message via Pusher to the recipient's private channel
    await pusher.trigger(
      `private-user-${receiverId}`,
      'new-message',
      enhancedMessage
    );

    console.log(`Message sent from user ${senderId} to user ${receiverId}`);
  } catch (error) {
    console.error('Error sending private message:', error);
  }
};

/**
 * Authorize a private channel connection
 * @param socketId The socket ID of the client connection
 * @param channel The channel name
 * @param userId The ID of the user trying to subscribe
 */
export const authorizeChannel = (
  socketId: string,
  channel: string,
  userId: number
): { auth: string } => {
  // Check if user is allowed to subscribe to this channel
  if (channel.startsWith('private-user-')) {
    const channelUserId = parseInt(channel.replace('private-user-', ''), 10);
    if (channelUserId !== userId) {
      throw new Error('Unauthorized access to private channel');
    }
  } else if (channel.startsWith('private-school-')) {
    // TODO: Check if user belongs to this school
  }

  // Authorize the subscription
  const auth = pusher.authorizeChannel(socketId, channel);
  return auth;
};

export default pusher;