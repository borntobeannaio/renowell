import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowLeft, CalendarIcon, Save, Loader2, Camera, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { proxyUpload, proxyDelete as storageProxyDelete, proxyGetPublicUrl } from "@/lib/storageProxy";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";
import renowellLogo from "@/assets/renowell-logo-text.png";

interface ProfileData {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  avatar_url: string | null;
  birthday: string | null;
  description: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [birthday, setBirthday] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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
      setPosition(profile.position || "");
      setDescription(profile.description || "");
      setAvatarUrl(profile.avatar_url);
      if (profile.birthday) {
        setBirthday(parseISO(profile.birthday));
      }
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.id) throw new Error("No user");
      const { error } = await proxyUpdate(
        "profiles",
        {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          position: position.trim() || null,
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
          description: description.trim() || null,
          avatar_url: avatarUrl,
        },
        [{ column: "id", operator: "eq", value: profile.id }]
      );
      if (error) throw new Error(error.message);

      // Sync to linked employee
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      await proxyUpdate(
        "employees",
        {
          full_name: fullName || "Пользователь",
          position: position.trim() || "Сотрудник",
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
          avatar_url: avatarUrl,
        },
        [{ column: "profile_id", operator: "eq", value: profile.id }]
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Профиль сохранён");
    },
    onError: () => {
      toast.error("Ошибка сохранения профиля");
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

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old avatar if exists (via storage proxy)
      if (avatarUrl) {
        const oldPath = avatarUrl.split("/").slice(-2).join("/").split("?")[0];
        await storageProxyDelete("avatars", [oldPath]);
      }

      // Upload new avatar via storage proxy
      const { error: uploadError } = await proxyUpload("avatars", fileName, file, { upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL via storage proxy
      const { data: urlData, error: urlError } = await proxyGetPublicUrl("avatars", fileName);

      if (urlError) throw new Error(urlError.message);

      const newAvatarUrl = `${urlData?.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(newAvatarUrl);

      // Update profile with new avatar URL via db proxy
      const { error: updateError } = await proxyUpdate(
        "profiles",
        { avatar_url: newAvatarUrl },
        [{ column: "id", operator: "eq", value: profile?.id }]
      );

      if (updateError) throw new Error(updateError.message);

      // Sync avatar to linked employee via db proxy
      if (profile?.id) {
        await proxyUpdate(
          "employees",
          { avatar_url: newAvatarUrl },
          [{ column: "profile_id", operator: "eq", value: profile.id }]
        );
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Аватар обновлён");
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("Ошибка загрузки аватара");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate();
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";

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
              {avatarUrl ? (
                <img
                  src={avatarUrl}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Label htmlFor="lastName">Фамилия</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Иванов"
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
                    captionLayout="dropdown-buttons"
                    fromYear={1950}
                    toYear={new Date().getFullYear()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
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

            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
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
        </div>
      </main>
    </div>
  );
}
