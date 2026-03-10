import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";
import { Loader2 } from "lucide-react";

interface DbEmployee {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  position: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
  birthday: string | null;
  profile_id: string | null;
  description: string | null;
}

interface DbProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  position: string | null;
  birthday: string | null;
}

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DbEmployee | null;
  onSuccess: () => void;
}

export function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
}: EditEmployeeModalProps) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (employee && isOpen) {
      // Use separate name fields if available, fallback to parsing full_name
      if (employee.last_name || employee.first_name) {
        setLastName(employee.last_name || "");
        setFirstName(employee.first_name || "");
        setMiddleName(employee.middle_name || "");
      } else {
        const nameParts = (employee.full_name || "").trim().split(/\s+/);
        setLastName(nameParts[0] || "");
        setFirstName(nameParts[1] || "");
        setMiddleName(employee.middle_name || nameParts[2] || "");
      }
      setPosition(employee.position || "");
      setPhone(employee.phone || "");
      setBirthday(employee.birthday || "");

      if (employee.profile_id) {
        loadProfileData(employee.profile_id);
      }
    }
  }, [employee, isOpen]);

  const loadProfileData = async (profileId: string) => {
    setLoadingProfile(true);
    try {
      const { data } = await proxySelect<DbProfile>("profiles", {
        select: "id, first_name, last_name, middle_name, position, birthday",
        filters: [{ column: "id", operator: "eq", value: profileId }],
        limit: 1,
      });
      if (data && data.length > 0) {
        const profile = data[0];
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.middle_name) setMiddleName(profile.middle_name);
        if (profile.position) setPosition(profile.position);
        if (profile.birthday) setBirthday(profile.birthday);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    try {
      const fullName = [lastName.trim(), firstName.trim(), middleName.trim()].filter(Boolean).join(" ");

      if (employee.profile_id) {
        const { error: profileError } = await proxyUpdate(
          "profiles",
          {
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            middle_name: middleName.trim() || null,
            position: position || null,
            birthday: birthday || null,
          },
          [{ column: "id", operator: "eq", value: employee.profile_id }]
        );

        if (profileError) {
          throw new Error(profileError.message);
        }
      }

      const employeeUpdateData: Record<string, unknown> = {
        phone: phone || null,
        middle_name: middleName.trim() || null,
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        full_name: fullName || "Пользователь",
      };

      if (!employee.profile_id) {
        employeeUpdateData.position = position;
        employeeUpdateData.birthday = birthday || null;
      }

      const { error: employeeError } = await proxyUpdate(
        "employees",
        employeeUpdateData,
        [{ column: "id", operator: "eq", value: employee.id }]
      );

      if (employeeError) {
        throw new Error(employeeError.message);
      }

      toast({
        title: "Успешно",
        description: "Данные сотрудника обновлены",
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating employee:", error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось обновить данные",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLastName("");
    setFirstName("");
    setMiddleName("");
    setPosition("");
    setPhone("");
    setBirthday("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Редактировать сотрудника">
      {loadingProfile ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lastName">Фамилия *</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Иванов"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Имя *</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Иван"
                required
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
            <Label htmlFor="position">Должность *</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Менеджер"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthday">Дата рождения</Label>
            <Input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Отмена
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                "Сохранить"
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
