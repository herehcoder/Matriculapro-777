import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  subscribeToUserChannel,
  subscribeToSchoolChannel,
  subscribeToGlobalChannel,
  connectToWebSocket,
  type NotificationPayload,
  type MessagePayload
} from '@/lib/pusher';

interface PusherHookOptions {
  userId?: number;
  schoolId?: number;
  subscribeToGlobal?: boolean;
}

export function usePusher(options: PusherHookOptions = {}) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [wsConnection, setWsConnection] = useState<any>(null);

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    // Handle incoming notifications
    const handleNotification = (notification: NotificationPayload) => {
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast notification
      toast({
        title: notification.title,
        description: notification.message,
        variant: notification.type === 'message' ? 'default' : 
          notification.type === 'enrollment' ? 'success' :
          notification.type === 'lead' ? 'info' : 'default'
      });
    };

    // Handle incoming messages
    const handleMessage = (message: MessagePayload) => {
      setMessages(prev => [message, ...prev]);
      
      // Show toast for new messages
      toast({
        title: `Nova mensagem de ${message.senderName || 'Usuário'}`,
        description: message.content.length > 50 
          ? `${message.content.substring(0, 50)}...` 
          : message.content,
        variant: 'default'
      });
    };

    // Handle WebSocket messages
    const handleWsMessage = (data: any) => {
      if (data.type === 'message') {
        const wsMessage: MessagePayload = {
          content: data.content,
          senderId: parseInt(data.senderId),
          timestamp: data.timestamp
        };
        handleMessage(wsMessage);
      }
    };

    // Subscribe to user's private channel
    if (options.userId) {
      // Subscribe to Pusher for notifications and messages
      const unsubscribeUser = subscribeToUserChannel(
        options.userId,
        handleNotification,
        handleMessage
      );
      cleanupFns.push(unsubscribeUser);

      // Connect to WebSocket for direct messaging
      const ws = connectToWebSocket(options.userId, handleWsMessage);
      setWsConnection(ws);
      cleanupFns.push(() => ws.disconnect());
    }

    // Subscribe to school's private channel
    if (options.schoolId) {
      const unsubscribeSchool = subscribeToSchoolChannel(
        options.schoolId,
        handleNotification
      );
      cleanupFns.push(unsubscribeSchool);
    }

    // Subscribe to global channel
    if (options.subscribeToGlobal) {
      const unsubscribeGlobal = subscribeToGlobalChannel(handleNotification);
      cleanupFns.push(unsubscribeGlobal);
    }

    // Cleanup subscriptions
    return () => {
      cleanupFns.forEach(fn => fn());
      if (wsConnection) {
        wsConnection.disconnect();
      }
    };
  }, [options.userId, options.schoolId, options.subscribeToGlobal, toast]);

  // Function to send a direct message via WebSocket
  const sendDirectMessage = (recipientId: number, content: string) => {
    if (wsConnection) {
      wsConnection.sendMessage(recipientId, content);
    } else {
      console.error('WebSocket not connected');
    }
  };

  return {
    notifications,
    messages,
    sendDirectMessage,
    clearNotifications: () => setNotifications([]),
    clearMessages: () => setMessages([])
  };
}