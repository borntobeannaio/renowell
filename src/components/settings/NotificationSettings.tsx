import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Mail, Bell, Info, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { TelegramLinkDialog } from "./TelegramLinkDialog";

interface ProfileWithNotifications {
  id: string;
  user_id: string;
  telegram_chat_id: string | null;
  notify_telegram: boolean;
  notify_email: boolean;
  notify_push: boolean;
  push_subscription: object | null;
}

interface Employee {
  id: string;
  email: string | null;
  profile_id: string | null;
}

export function NotificationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  
  const {
    permission,
    isSubscribed,
    isLoading: pushLoading,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  // Fetch profile with notification settings
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await proxySelect<ProfileWithNotifications>("profiles", {
        select: "id, user_id, telegram_chat_id, notify_telegram, notify_email, notify_push, push_subscription",
        filters: [{ column: "user_id", operator: "eq", value: user.id }],
        limit: 1,
      });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
  });

  // Fetch employee email
  const { data: employee } = useQuery({
    queryKey: ["employee-email", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await proxySelect<Employee>("employees", {
        select: "id, email, profile_id",
        filters: [{ column: "profile_id", operator: "eq", value: profile.id }],
        limit: 1,
      });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!profile?.id,
  });

  // Update notification settings
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<ProfileWithNotifications>) => {
      if (!profile?.id) throw new Error("No profile");
      const { error } = await proxyUpdate(
        "profiles",
        updates,
        [{ column: "id", operator: "eq", value: profile.id }]
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-notifications"] });
    },
    onError: () => {
      toast.error("Ошибка сохранения настроек");
    },
  });

  const handleTelegramToggle = (checked: boolean) => {
    if (checked && !profile?.telegram_chat_id) {
      setTelegramDialogOpen(true);
      return;
    }
    updateMutation.mutate({ notify_telegram: checked });
  };

  const handleEmailToggle = (checked: boolean) => {
    if (checked && !employee?.email) {
      toast.error("Добавьте email в HR-модуле");
      return;
    }
    updateMutation.mutate({ notify_email: checked });
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      if (permission === "denied") {
        toast.error("Push-уведомления заблокированы браузером");
        return;
      }
      const success = await subscribe();
      if (success) {
        updateMutation.mutate({ notify_push: true });
      }
    } else {
      await unsubscribe();
      updateMutation.mutate({ notify_push: false, push_subscription: null });
    }
  };

  const handleUnlinkTelegram = () => {
    updateMutation.mutate({ 
      telegram_chat_id: null, 
      notify_telegram: false 
    });
    toast.success("Telegram отвязан");
  };

  const handleTelegramLinked = () => {
    queryClient.invalidateQueries({ queryKey: ["profile-notifications"] });
    toast.success("Telegram привязан!");
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasTelegram = !!profile?.telegram_chat_id;
  const hasEmail = !!employee?.email;
  const pushBlocked = permission === "denied";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Уведомления
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Дополнительные каналы доставки
        </p>
      </div>

      <div className="space-y-4">
        {/* Telegram */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-[#0088cc] mt-0.5" />
            <div className="space-y-1">
              <Label className="text-base font-medium">Telegram</Label>
              {hasTelegram ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Привязан</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-muted-foreground hover:text-destructive"
                    onClick={handleUnlinkTelegram}
                  >
                    (Отвязать)
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Не привязан</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTelegramDialogOpen(true)}
                  >
                    Привязать Telegram
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={profile?.notify_telegram ?? false}
            onCheckedChange={handleTelegramToggle}
            disabled={!hasTelegram || updateMutation.isPending}
          />
        </div>

        {/* Email */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label className="text-base font-medium">Email</Label>
              {hasEmail ? (
                <p className="text-sm text-muted-foreground">{employee.email}</p>
              ) : (
                <p className="text-sm text-amber-600">
                  Добавьте email в HR-модуле
                </p>
              )}
            </div>
          </div>
          <Switch
            checked={profile?.notify_email ?? false}
            onCheckedChange={handleEmailToggle}
            disabled={!hasEmail || updateMutation.isPending}
          />
        </div>

        {/* Push */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <Label className="text-base font-medium">Push в браузере</Label>
              {pushBlocked ? (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <X className="w-4 h-4" />
                  <span>Заблокированы браузером</span>
                </div>
              ) : isSubscribed ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Включены</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Не настроены</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePushToggle(true)}
                    disabled={pushLoading}
                  >
                    {pushLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Разрешить уведомления
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Switch
            checked={profile?.notify_push ?? false}
            onCheckedChange={handlePushToggle}
            disabled={pushBlocked || pushLoading || updateMutation.isPending}
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <p>В панели уведомлений всегда отображаются все уведомления</p>
      </div>

      <TelegramLinkDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        profileId={profile?.id}
        onLinked={handleTelegramLinked}
      />
    </div>
  );
}
