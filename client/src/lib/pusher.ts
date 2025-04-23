import PusherJs from 'pusher-js';

// Initialize Pusher with your app credentials from environment variables
const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY || '';
const pusherCluster = import.meta.env.VITE_PUSHER_APP_CLUSTER || 'us2';

// Create a Pusher instance
const pusher = new PusherJs(pusherKey, {
  cluster: pusherCluster,
  forceTLS: true,
});

export default pusher;

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
  id?: number;
  content: string;
  senderId: number;
  senderName?: string;
  senderRole?: string;
  timestamp?: string;
}

// Function to subscribe to a user's private channel
export function subscribeToUserChannel(userId: number, onNotification: (data: NotificationPayload) => void, onMessage: (data: MessagePayload) => void) {
  const channel = pusher.subscribe(`private-user-${userId}`);

  // Listen for notification events
  channel.bind('new-notification', onNotification);

  // Listen for message events
  channel.bind('new-message', onMessage);

  return () => {
    channel.unbind('new-notification', onNotification);
    channel.unbind('new-message', onMessage);
    pusher.unsubscribe(`private-user-${userId}`);
  };
}

// Function to subscribe to a school's private channel
export function subscribeToSchoolChannel(schoolId: number, onNotification: (data: NotificationPayload) => void) {
  const channel = pusher.subscribe(`private-school-${schoolId}`);

  // Listen for notification events
  channel.bind('new-notification', onNotification);

  return () => {
    channel.unbind('new-notification', onNotification);
    pusher.unsubscribe(`private-school-${schoolId}`);
  };
}

// Function to subscribe to the global channel
export function subscribeToGlobalChannel(onNotification: (data: NotificationPayload) => void) {
  const channel = pusher.subscribe('global');

  // Listen for notification events
  channel.bind('new-notification', onNotification);

  return () => {
    channel.unbind('new-notification', onNotification);
    pusher.unsubscribe('global');
  };
}

// Connect to native WebSocket for direct messaging
export function connectToWebSocket(userId: number, onMessage: (data: any) => void) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('WebSocket connected');
    // Identify user to server
    socket.send(JSON.stringify({
      type: 'identify',
      userId: userId.toString()
    }));
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return {
    socket,
    sendMessage: (recipientId: number, content: string) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'message',
          senderId: userId.toString(),
          recipientId: recipientId.toString(),
          content
        }));
      } else {
        console.error('WebSocket not connected');
      }
    },
    disconnect: () => {
      socket.close();
    }
  };
}