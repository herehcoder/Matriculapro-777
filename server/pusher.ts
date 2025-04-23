import Pusher from 'pusher';

// Verificar se todas as variáveis de ambiente necessárias estão disponíveis
if (!process.env.PUSHER_APP_ID || 
    !process.env.PUSHER_APP_KEY || 
    !process.env.PUSHER_APP_SECRET || 
    !process.env.PUSHER_APP_CLUSTER) {
  throw new Error('As variáveis de ambiente do Pusher não estão configuradas corretamente.');
}

// Inicializar o cliente do Pusher
const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_APP_KEY,
  secret: process.env.PUSHER_APP_SECRET,
  cluster: process.env.PUSHER_APP_CLUSTER,
  useTLS: true,
});

interface NotificationPayload {
  title: string;
  message: string;
  type: 'message' | 'enrollment' | 'lead' | 'system' | 'payment';
  data?: Record<string, any>;
  relatedId?: number;
  relatedType?: string;
}

interface MessagePayload {
  content: string;
  senderId: number;
  senderName?: string;
  senderRole?: string;
  timestamp?: string;
}

// Função para enviar notificação para um usuário específico
export const sendUserNotification = async (
  userId: number, 
  notification: NotificationPayload
) => {
  try {
    // Enviar para o canal privado do usuário
    await pusherServer.trigger(
      `private-user-${userId}`,
      'notification',
      notification
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação para o usuário:', error);
    return false;
  }
};

// Função para enviar notificação global para todos os usuários
export const sendGlobalNotification = async (notification: NotificationPayload) => {
  try {
    // Enviar para o canal global
    await pusherServer.trigger(
      'global',
      'notification',
      notification
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação global:', error);
    return false;
  }
};

// Função para enviar notificação para todos os usuários de uma escola
export const sendSchoolNotification = async (
  schoolId: number,
  notification: NotificationPayload
) => {
  try {
    // Enviar para o canal da escola
    await pusherServer.trigger(
      `private-school-${schoolId}`,
      'notification',
      notification
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar notificação para a escola:', error);
    return false;
  }
};

// Função para enviar mensagem privada entre usuários
export const sendPrivateMessage = async (
  senderId: number,
  receiverId: number,
  message: MessagePayload
) => {
  try {
    // Enviar para o canal privado do destinatário
    await pusherServer.trigger(
      `private-user-${receiverId}`,
      'message',
      {
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }
    );
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem privada:', error);
    return false;
  }
};

// Função para autenticar canais privados
export const authorizeChannel = (
  socketId: string,
  channel: string,
  userData: { id: number; role: string }
) => {
  // Verificar se o usuário está tentando acessar seu próprio canal
  if (channel.startsWith('private-user-')) {
    const channelUserId = parseInt(channel.replace('private-user-', ''), 10);
    
    // Se o canal não pertence ao usuário autenticado
    if (channelUserId !== userData.id && userData.role !== 'admin') {
      return { auth: '' }; // Não autorizar
    }
  }
  
  // Verificar se o usuário está tentando acessar um canal de escola
  if (channel.startsWith('private-school-')) {
    const channelSchoolId = parseInt(channel.replace('private-school-', ''), 10);
    
    // Verificar se o usuário pertence a essa escola ou é admin
    if (userData.role !== 'admin' && userData.role !== 'school') {
      return { auth: '' }; // Não autorizar
    }
  }
  
  // Para canais autorizados, gere o token de autenticação
  return pusherServer.authorizeChannel(socketId, channel);
};

export default pusherServer;