import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { proxySelect } from "@/lib/dbProxy";

import { Modal } from "@/components/ui/Modal";
import { ProxiedAvatar } from "@/components/ui/ProxiedAvatar";
import { Button } from "@/components/ui/button";
import { formatDisplayDate } from "@/utils/dateFormat";
import { useHRPermissions } from "@/hooks/useHRPermissions";
import { AddEmployeeModal } from "@/components/modules/hr/AddEmployeeModal";
import { EditEmployeeModal } from "@/components/modules/hr/EditEmployeeModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DbEmployee, getEmployeeDisplayName, getEmployeeFullDisplayName } from "@/hooks/useEmployees";
import {
  Users,
  Calendar,
  FileText,
  Mail,
  Phone,
  Cake,
  User,
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";

type HRTab = "employees" | "vacations" | "docs";

export function HRModule() {
  const [activeTab, setActiveTab] = useState<HRTab>("employees");

  const tabs: { id: HRTab; label: string; icon: React.ElementType }[] = [
    { id: "employees", label: "Сотрудники", icon: Users },
    { id: "vacations", label: "Отпуска", icon: Calendar },
    { id: "docs", label: "Документы", icon: FileText },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-thin">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === "employees" && <EmployeesTab />}
      {activeTab === "vacations" && <VacationsTab />}
      {activeTab === "docs" && <DocsTab />}
    </div>
  );
}

function EmployeesTab() {
  const [selectedEmployee, setSelectedEmployee] = useState<DbEmployee | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<DbEmployee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<DbEmployee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { canAddEmployee, canEditEmployee, canDeleteEmployee } = useHRPermissions();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await proxySelect<DbEmployee>('employees', {
        select: '*',
        order: [{ column: 'full_name', ascending: true }],
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const handleEmployeeCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const handleEmployeeUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    setSelectedEmployee(null);
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("delete-employee", {
        body: { employee_id: deletingEmployee.id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Сотрудник ${getEmployeeDisplayName(deletingEmployee)} удалён`);
      setDeletingEmployee(null);
      setSelectedEmployee(null);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    } catch (err) {
      console.error("Delete employee error:", err);
      toast.error(`Ошибка удаления: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const openEmployeeCard = (emp: DbEmployee) => {
    setSelectedEmployee(emp);
  };

  const handleEditClick = (e: React.MouseEvent, emp: DbEmployee) => {
    e.stopPropagation();
    setEditingEmployee(emp);
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Загрузка сотрудников...
      </div>
    );
  }

  return (
    <>
      {canAddEmployee && (
        <div className="flex justify-end mb-4">
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Добавить сотрудника
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <button
            key={emp.id}
            onClick={() => openEmployeeCard(emp)}
            className="card-base p-4 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <ProxiedAvatar url={emp.avatar_url} alt={getEmployeeDisplayName(emp)} size="sm" />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">
                  {getEmployeeDisplayName(emp)}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {emp.position}
                </p>
                {emp.birthday && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Cake className="w-3 h-3" />
                    {formatDisplayDate(emp.birthday)}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {employees.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Нет сотрудников
        </div>
      )}

      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Карточка сотрудника"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <ProxiedAvatar url={selectedEmployee.avatar_url} alt={selectedEmployee.full_name} size="md" />
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedEmployee.full_name}
                </h3>
                <p className="text-muted-foreground">{selectedEmployee.position}</p>
                {selectedEmployee.department && (
                  <span className="chip mt-2">{selectedEmployee.department}</span>
                )}
              </div>
              {canEditEmployee && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedEmployee(null);
                      setEditingEmployee(selectedEmployee);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Редактировать
                  </Button>
                  {canDeleteEmployee && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeletingEmployee(selectedEmployee)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Удалить
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {selectedEmployee.email && (
                <div className="flex items-center gap-3 text-foreground">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={`mailto:${selectedEmployee.email}`}
                    className="hover:text-primary transition-colors"
                  >
                    {selectedEmployee.email}
                  </a>
                </div>
              )}
              {selectedEmployee.phone && (
                <div className="flex items-center gap-3 text-foreground">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a
                    href={`tel:${selectedEmployee.phone}`}
                    className="hover:text-primary transition-colors"
                  >
                    {selectedEmployee.phone}
                  </a>
                </div>
              )}
              {selectedEmployee.birthday && (
                <div className="flex items-center gap-3 text-foreground">
                  <Cake className="w-4 h-4 text-muted-foreground" />
                  <span>{formatDisplayDate(selectedEmployee.birthday)}</span>
                </div>
              )}
              {selectedEmployee.description && (
                <div className="pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {selectedEmployee.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleEmployeeCreated}
      />

      <EditEmployeeModal
        isOpen={!!editingEmployee}
        onClose={() => setEditingEmployee(null)}
        employee={editingEmployee}
        onSuccess={handleEmployeeUpdated}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deletingEmployee}
        onClose={() => setDeletingEmployee(null)}
        title="Удалить сотрудника"
      >
        {deletingEmployee && (
          <div className="space-y-4">
            <p className="text-foreground">
              Вы уверены, что хотите удалить сотрудника{" "}
              <strong>{deletingEmployee.full_name}</strong>?
            </p>
            <p className="text-sm text-destructive">
              Это действие необратимо. Будут удалены: аккаунт пользователя, профиль и запись сотрудника.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeletingEmployee(null)}
                disabled={isDeleting}
              >
                Отмена
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteEmployee}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Удалить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
function VacationsTab() {
  const { vacations, getEmployeeById } = useApp();

  return (
    <div className="space-y-4">
      {vacations.map((v) => {
        const emp = getEmployeeById(v.userId);
        return (
          <div key={v.id} className="card-base p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">
                  {emp?.name || "Сотрудник"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDisplayDate(v.from)} — {formatDisplayDate(v.to)}
                </p>
              </div>
            </div>
            <span
              className={
                v.status === "approved" ? "chip-success" : "chip-accent"
              }
            >
              {v.status === "approved" ? "Одобрено" : "На рассмотрении"}
            </span>
          </div>
        );
      })}

      {vacations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Нет заявок на отпуск
        </div>
      )}
    </div>
  );
}

function DocsTab() {
  const { hrDocs } = useApp();

  const typeIcons: Record<string, string> = {
    pdf: "📄",
    docx: "📝",
    xlsx: "📊",
    link: "🔗",
  };

  return (
    <div className="space-y-3">
      {hrDocs.map((doc) => (
        <div
          key={doc.id}
          className="card-base p-4 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typeIcons[doc.type] || "📄"}</span>
            <div>
              <p className="font-medium text-foreground">{doc.title}</p>
              <p className="text-sm text-muted-foreground">
                Обновлено: {doc.updated}
              </p>
            </div>
          </div>
          <span className="chip">{doc.type.toUpperCase()}</span>
        </div>
      ))}

      {hrDocs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Нет документов
        </div>
      )}
    </div>
  );
}
