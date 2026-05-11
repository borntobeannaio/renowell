import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CalendarIcon, Save, Loader2, Camera, User, Lock, Eye, EyeOff, HelpCircle, X, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { proxyInsert } from "@/lib/dbProxy";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Link } from "react-router-dom";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { proxyUpload, proxyDelete as storageProxyDelete, proxyGetPublicUrl } from "@/lib/storageProxy";
import { proxySelect, proxyUpdate, proxyDelete, proxyInsert as dbProxyInsert } from "@/lib/dbProxy";
import { useProxiedAvatarUrl } from "@/lib/avatarProxy";
import { supabase } from "@/integrations/supabase/client";
import renowellLogo from "@/assets/renowell-logo-text.png";

interface ProfileData {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  position: string | null;
  avatar_url: string | null;
  birthday: string | null;
  description: string | null;
  ics_url: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const icsFieldRef = useRef<HTMLDivElement>(null);
  const [showIcsGuide, setShowIcsGuide] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [position, setPosition] = useState("");
  const [birthday, setBirthday] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [icsUrl, setIcsUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await proxySelect<ProfileData>("profiles", {
        select: "*",
        filters: [{ column: "user_id", operator: "eq", value: user.id }],
        limit: 1,
      });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setMiddleName(profile.middle_name || "");
      setPosition(profile.position || "");
      setDescription(profile.description || "");
      setAvatarUrl(profile.avatar_url);
      setIcsUrl(profile.ics_url || "");
      if (profile.birthday) {
        setBirthday(parseISO(profile.birthday));
      }
    }
  }, [profile]);

  // Scroll to ICS field when navigating with #ics hash
  useEffect(() => {
    if (location.hash === "#ics" && icsFieldRef.current) {
      setTimeout(() => {
        icsFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [location.hash, profile]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.id) throw new Error("Профиль ещё загружается. Попробуйте через несколько секунд.");
      
      console.log('[Profile] Updating profile:', profile.id);
      console.log('[Profile] Data:', { firstName, lastName, position, birthday, description });
      
      const { error: profileError } = await proxyUpdate(
        "profiles",
        {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          middle_name: middleName.trim() || null,
          position: position.trim() || null,
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
          description: description.trim() || null,
          avatar_url: avatarUrl,
          ics_url: icsUrl.trim() || null,
        },
        [{ column: "id", operator: "eq", value: profile.id }]
      );
      
      if (profileError) {
        console.error('[Profile] Profile update error:', profileError);
        throw new Error(profileError.message);
      }
      
      console.log('[Profile] Profile updated, syncing employee...');

      // Sync to linked employee (don't fail if employee update fails)
      const fullName = [lastName.trim(), firstName.trim()].filter(Boolean).join(" ");
      const { error: employeeError } = await proxyUpdate(
        "employees",
        {
          full_name: fullName || "Пользователь",
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          position: position.trim() || "Сотрудник",
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
          avatar_url: avatarUrl,
          description: description.trim() || null,
          middle_name: middleName.trim() || null,
        },
        [{ column: "profile_id", operator: "eq", value: profile.id }]
      );
      
      if (employeeError) {
        console.warn('[Profile] Employee sync warning:', employeeError);
      } else {
        console.log('[Profile] Employee synced successfully');
      }

      // If ICS URL was cleared, delete all external calendar events for this profile
      if (!icsUrl.trim() && profile.ics_url) {
        console.log('[Profile] ICS URL removed, deleting external events...');
        const { error: deleteError } = await proxyDelete("calendar_events", [
          { column: "creator_id", operator: "eq", value: profile.id },
          { column: "source", operator: "eq", value: "external" },
        ]);
        if (deleteError) {
          console.warn('[Profile] Failed to delete external events:', deleteError);
        } else {
          console.log('[Profile] External events deleted');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["calendar_events"] });
      toast.success("Профиль сохранён");
    },
    onError: (error: Error) => {
      console.error('[Profile] Save error:', error);
      toast.error(`Ошибка сохранения: ${error.message}`);
    },
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Пожалуйста, выберите изображение");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5 МБ");
      return;
    }

    console.log('[Avatar] Starting upload:', file.name, 'size:', file.size, 'type:', file.type);
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists (via storage proxy)
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").slice(-2).join("/").split("?")[0];
        console.log('[Avatar] Deleting old avatar:', oldPath);
        await storageProxyDelete("avatars", [oldPath]);
      }

      // Upload new avatar via storage proxy
      console.log('[Avatar] Uploading to:', fileName);
      const { data: uploadData, error: uploadError } = await proxyUpload("avatars", fileName, file, { upsert: true });

      if (uploadError) {
        console.error('[Avatar] Upload error:', uploadError);
        toast.error(`Ошибка загрузки: ${uploadError.message}`);
        return;
      }
      
      console.log('[Avatar] Upload success:', uploadData);

      // Get public URL via storage proxy
      const { data: urlData, error: urlError } = await proxyGetPublicUrl("avatars", fileName);

      if (urlError) {
        console.error('[Avatar] URL error:', urlError);
        toast.error(`Ошибка получения URL: ${urlError.message}`);
        return;
      }

      const newAvatarUrl = `${urlData?.publicUrl}?t=${Date.now()}`;
      console.log('[Avatar] New URL:', newAvatarUrl);
      setAvatarUrl(newAvatarUrl);

      // Update profile with new avatar URL via db proxy
      const { error: updateError } = await proxyUpdate(
        "profiles",
        { avatar_url: newAvatarUrl },
        [{ column: "id", operator: "eq", value: profile?.id }]
      );

      if (updateError) {
        console.error('[Avatar] Profile update error:', updateError);
        toast.error(`Ошибка обновления профиля: ${updateError.message}`);
        return;
      }

      // Sync avatar to linked employee via db proxy
      if (profile?.id) {
        const { error: empError } = await proxyUpdate(
          "employees",
          { avatar_url: newAvatarUrl },
          [{ column: "profile_id", operator: "eq", value: profile.id }]
        );
        if (empError) {
          console.warn('[Avatar] Employee sync warning:', empError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Аватар обновлён");
      console.log('[Avatar] Complete!');
    } catch (error) {
      console.error("[Avatar] Unexpected error:", error);
      toast.error(`Ошибка загрузки аватара: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate();
  };

  const handleChangePassword = async () => {
    // Validate inputs
    if (!currentPassword.trim()) {
      toast.error("Введите текущий пароль");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Новый пароль должен содержать минимум 6 символов");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    console.log('[Password] Starting password change for:', user?.email);
    setIsChangingPassword(true);
    
    try {
      // Check current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[Password] No active session');
        toast.error("Сессия истекла. Пожалуйста, войдите заново.");
        setIsChangingPassword(false);
        return;
      }
      
      console.log('[Password] Session valid, verifying current password...');

      // First, verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        console.error('[Password] Current password verification failed:', signInError);
        toast.error("Неверный текущий пароль");
        setIsChangingPassword(false);
        return;
      }

      console.log('[Password] Current password verified, updating...');

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('[Password] Update failed:', updateError);
        toast.error("Ошибка смены пароля: " + updateError.message);
        setIsChangingPassword(false);
        return;
      }

      console.log('[Password] Password changed successfully');
      toast.success("Пароль успешно изменён");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("[Password] Unexpected error:", error);
      toast.error(`Ошибка смены пароля: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const proxiedAvatarUrl = useProxiedAvatarUrl(avatarUrl);
  const initials = `${lastName.charAt(0)}${firstName.charAt(0)}`.toUpperCase() || "U";
  const fullName = [lastName, firstName].filter(Boolean).join(" ") || "Пользователь";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img
            src={renowellLogo}
            alt="Реновель"
            className="h-6 w-auto dark:invert"
          />
          <span className="text-lg font-semibold">Профиль</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-2xl py-8 px-4">
        <div className="space-y-8">
          {/* Avatar & Name */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {proxiedAvatarUrl ? (
                <img
                  src={proxiedAvatarUrl}
                  alt={fullName}
                  className="w-24 h-24 rounded-full object-cover shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <span className="text-3xl font-bold text-primary-foreground">
                    {initials}
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{fullName}</h1>
              <p className="text-muted-foreground">{position || "Сотрудник"}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Иванов"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Имя</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Иван"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Отчество</Label>
                <Input
                  id="middleName"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Иванович"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Должность</Label>
              <Input
                id="position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="Менеджер проектов"
              />
            </div>

            <div className="space-y-2">
              <Label>Дата рождения</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !birthday && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {birthday
                      ? format(birthday, "d MMMM yyyy", { locale: ru })
                      : "Выберите дату"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={birthday}
                    onSelect={setBirthday}
                    disabled={(date) =>
                      date > new Date() || date < new Date("1900-01-01")
                    }
                    captionLayout="dropdown"
                    fromYear={1950}
                    toYear={new Date().getFullYear()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    classNames={{ caption_label: "hidden" }}
                    locale={ru}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">О себе</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Расскажите немного о себе..."
                rows={4}
              />
            </div>

            <div className="space-y-2" ref={icsFieldRef} id="ics">
              <div className="flex items-center justify-between">
                <Label htmlFor="icsUrl" className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  Ссылка на календарь (ICS)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs h-7 text-muted-foreground"
                  onClick={() => setShowIcsGuide(!showIcsGuide)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Инструкция
                </Button>
              </div>

              {showIcsGuide && (
                <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => setShowIcsGuide(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <p className="font-medium">Как получить ссылку ICS из Outlook:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                    <li>Откройте <strong>Outlook Web</strong> → <a href="https://outlook.office.com/calendar" target="_blank" rel="noopener noreferrer" className="text-primary underline">outlook.office.com/calendar</a></li>
                    <li>Нажмите <strong>⚙️ Настройки</strong> (шестерёнка) → <strong>Просмотреть все параметры Outlook</strong></li>
                    <li>Перейдите в <strong>Календарь</strong> → <strong>Общие календари</strong></li>
                    <li>В разделе <strong>«Опубликовать календарь»</strong> выберите ваш календарь и уровень доступа</li>
                    <li>Нажмите <strong>«Опубликовать»</strong></li>
                    <li>Скопируйте ссылку <strong>ICS</strong> (не HTML) и вставьте в поле ниже</li>
                  </ol>
                  <p className="text-xs text-muted-foreground pt-1">
                    Для Google Calendar: Настройки календаря → «Секретный адрес в формате iCal» → скопируйте ссылку.
                  </p>
                </div>
              )}

              <Input
                id="icsUrl"
                name="ics_calendar_link_url"
                type="url"
                autoComplete="one-time-code"
                value={icsUrl}
                onChange={(e) => setIcsUrl(e.target.value)}
                placeholder="https://outlook.office365.com/owa/calendar/..."
              />
              <p className="text-xs text-muted-foreground">
                Вставьте ссылку на ICS-календарь из Outlook или Google Calendar. События будут синхронизироваться автоматически каждые 15 минут.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || isLoading || !profile}
              className="w-full sm:w-auto"
            >
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>

          <Separator className="my-8" />

          {/* Password Change */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Смена пароля</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Текущий пароль</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Повторите новый пароль"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {isChangingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Сменить пароль
              </Button>
            </div>
          </div>

          <Separator className="my-8" />

          {/* Notification Settings */}
          <NotificationSettings />
        </div>
      </main>
    </div>
  );
}
