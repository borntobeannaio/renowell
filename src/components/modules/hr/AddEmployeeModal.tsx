import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { UserPlus, Copy, Check, AlertTriangle } from "lucide-react";

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CreatedEmployee {
  full_name: string;
  email: string;
  password: string;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess }: AddEmployeeModalProps) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState<CreatedEmployee | null>(null);
  const [copied, setCopied] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    position: "",
    email: "",
    phone: "",
    birthday: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.position || !formData.email) {
      toast.error("Заполните обязательные поля");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: formData.full_name,
            position: formData.position,
            email: formData.email,
            phone: formData.phone || undefined,
            birthday: formData.birthday || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка создания сотрудника");
      }

      // Show password dialog
      setCreatedEmployee({
        full_name: formData.full_name,
        email: formData.email,
        password: data.password,
      });

      toast.success("Сотрудник успешно создан");
      onSuccess();

      // Reset form
      setFormData({
        full_name: "",
        position: "",
        email: "",
        phone: "",
        birthday: "",
      });
    } catch (error) {
      console.error("Error creating employee:", error);
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdEmployee) return;
    
    const text = `Данные для входа в портал Реновель:
Email: ${createdEmployee.email}
Пароль: ${createdEmployee.password}

Рекомендуем сменить пароль после первого входа.`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Данные скопированы");
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClosePasswordDialog = () => {
    setCreatedEmployee(null);
    setCopied(false);
    onClose();
  };

  // Password display dialog
  if (createdEmployee) {
    return (
      <Modal
        isOpen={true}
        onClose={handleClosePasswordDialog}
        title="Сотрудник создан"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/30">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-sm text-warning-foreground">
              Сохраните эти данные! Пароль показывается только один раз.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-muted-foreground text-xs">Сотрудник</Label>
              <p className="font-medium text-foreground">{createdEmployee.full_name}</p>
            </div>
            
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="font-mono text-foreground">{createdEmployee.email}</p>
            </div>
            
            <div>
              <Label className="text-muted-foreground text-xs">Пароль</Label>
              <p className="font-mono text-lg font-semibold text-primary bg-secondary px-3 py-2 rounded">
                {createdEmployee.password}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleCopyCredentials}
              variant="outline"
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Скопировано
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Скопировать данные
                </>
              )}
            </Button>
            <Button onClick={handleClosePasswordDialog} className="flex-1">
              Закрыть
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Добавить сотрудника">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">ФИО *</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Иванов Иван Иванович"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="position">Должность *</Label>
          <Input
            id="position"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            placeholder="Менеджер"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+7 999 123-45-67"
          />
        </div>


        <div className="space-y-2">
          <Label htmlFor="birthday">Дата рождения</Label>
          <Input
            id="birthday"
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={loading}
          >
            Отмена
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? (
              "Создание..."
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Создать
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
