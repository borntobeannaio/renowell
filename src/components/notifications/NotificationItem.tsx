import { useNavigate } from "react-router-dom";
import { Bell, Clock, AlertTriangle, AtSign, X, MessageCircle, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Notification,
  useMarkNotificationRead,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import { useChatContext } from "@/context/ChatContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NotificationItemProps {
  notification: Notification;
  onClose?: () => void;
}

const ICON_MAP: Record<string, typeof Bell> = {
  task_assigned: Bell,
  deadline_week: Clock,
  deadline_day: AlertTriangle,
  mention: AtSign,
  chat_message: MessageCircle,
  chat_created: Users,
};

const ICON_COLOR_MAP: Record<string, string> = {
  task_assigned: "text-primary",
  deadline_week: "text-amber-500",
  deadline_day: "text-destructive",
  mention: "text-blue-500",
  chat_message: "text-green-500",
  chat_created: "text-blue-500",
};

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();
  const deleteNotification = useDeleteNotification();
  const { openChat } = useChatContext();

  const Icon = ICON_MAP[notification.type] || Bell;
  const iconColor = ICON_COLOR_MAP[notification.type] || "text-muted-foreground";

  const handleClick = () => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }

    // Обработка специальных ссылок на чаты (#chat:conversationId)
    if (notification.link?.startsWith("#chat:")) {
      const conversationId = notification.link.replace("#chat:", "");
      openChat(conversationId);
      onClose?.();
      return;
    }

    // Навигация к задаче если есть link или related_task_id
    if (notification.link) {
      navigate(notification.link);
      onClose?.();
    } else if (notification.related_task_id) {
      navigate(`/tasks?task=${notification.related_task_id}`);
      onClose?.();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification.mutate(notification.id);
  };

  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ru,
  });

  return (
    <div
      onClick={handleClick}
      className={cn(
        "flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-accent group",
        !notification.is_read && "bg-primary/5"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center",
          notification.is_read ? "bg-muted" : "bg-primary/10"
        )}
      >
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm leading-tight",
            !notification.is_read ? "font-medium text-foreground" : "text-muted-foreground"
          )}
        >
          {notification.title}
        </p>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">{timeAgo}</p>
      </div>

      {/* Unread indicator & Delete */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {!notification.is_read && (
          <div className="w-2 h-2 rounded-full bg-primary" />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
