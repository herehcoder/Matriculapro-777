import { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePusher } from '@/hooks/use-pusher';
import { type NotificationPayload } from '@/lib/pusher';
import { apiRequest } from '@/lib/queryClient';

interface NotificationCenterProps {
  userId: number;
  schoolId?: number;
}

export function NotificationCenter({ userId, schoolId }: NotificationCenterProps) {
  const { notifications, clearNotifications } = usePusher({
    userId,
    schoolId,
    subscribeToGlobal: true,
  });
  
  const [unreadNotifications, setUnreadNotifications] = useState<NotificationPayload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  useEffect(() => {
    // Load existing unread notifications
    const fetchNotifications = async () => {
      try {
        const response = await apiRequest(`/api/notifications/user/${userId}?read=false`);
        if (response && Array.isArray(response)) {
          setUnreadNotifications(response);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    };
    
    fetchNotifications();
  }, [userId]);
  
  // Update unread notifications when new ones arrive
  useEffect(() => {
    if (notifications.length > 0) {
      setUnreadNotifications(prev => [...notifications, ...prev]);
    }
  }, [notifications]);
  
  const markAllAsRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', 'PATCH');
      
      setUnreadNotifications([]);
      clearNotifications();
      setIsOpen(false);
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'enrollment':
        return '📚';
      case 'lead':
        return '👋';
      case 'payment':
        return '💰';
      default:
        return '📣';
    }
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadNotifications.length > 0 && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center p-0">
              {unreadNotifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-medium">Notificações</h4>
          {unreadNotifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              <Check className="h-4 w-4 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <div className="max-h-80 overflow-y-auto space-y-2">
          {unreadNotifications.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              Nenhuma notificação não lida
            </div>
          ) : (
            unreadNotifications.map((notification, index) => (
              <Card key={index} className="shadow-sm">
                <CardHeader className="py-2 px-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <span className="mr-2">{getNotificationIcon(notification.type)}</span>
                      {notification.title}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="py-1 px-3">
                  <CardDescription className="text-xs">
                    {notification.message}
                  </CardDescription>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}