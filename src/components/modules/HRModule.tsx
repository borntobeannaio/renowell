import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { Lightbox } from "@/components/ui/Lightbox";
import { formatDisplayDate } from "@/utils/dateFormat";
import {
  Users,
  Calendar,
  FileText,
  Image,
  Mail,
  Phone,
  Cake,
  User,
} from "lucide-react";

interface DbEmployee {
  id: string;
  full_name: string;
  position: string;
  phone: string | null;
  email: string | null;
  department: string | null;
  avatar_url: string | null;
  birthday: string | null;
}

type HRTab = "employees" | "vacations" | "docs" | "photos";

export function HRModule() {
  const [activeTab, setActiveTab] = useState<HRTab>("employees");

  const tabs: { id: HRTab; label: string; icon: React.ElementType }[] = [
    { id: "employees", label: "Сотрудники", icon: Users },
    { id: "vacations", label: "Отпуска", icon: Calendar },
    { id: "docs", label: "Документы", icon: FileText },
    { id: "photos", label: "Фотогалерея", icon: Image },
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
      {activeTab === "photos" && <PhotosTab />}
    </div>
  );
}

function EmployeesTab() {
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<DbEmployee | null>(null);
  const [birthdayInput, setBirthdayInput] = useState("");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as DbEmployee[];
    },
  });

  const updateBirthdayMutation = useMutation({
    mutationFn: async ({ id, birthday }: { id: string; birthday: string }) => {
      const { error } = await supabase
        .from('employees')
        .update({ birthday })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const openEmployeeCard = (emp: DbEmployee) => {
    setSelectedEmployee(emp);
    setBirthdayInput(emp.birthday || "");
  };

  const handleSaveBirthday = () => {
    if (selectedEmployee && birthdayInput) {
      updateBirthdayMutation.mutate({ id: selectedEmployee.id, birthday: birthdayInput });
      setSelectedEmployee({ ...selectedEmployee, birthday: birthdayInput });
    }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {employees.map((emp) => (
          <button
            key={emp.id}
            onClick={() => openEmployeeCard(emp)}
            className="card-base p-4 text-left hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              {emp.avatar_url ? (
                <img
                  src={emp.avatar_url}
                  alt={emp.full_name}
                  className="w-12 h-12 rounded-full bg-secondary object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">
                  {emp.full_name}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {emp.position}
                </p>
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
              {selectedEmployee.avatar_url ? (
                <img
                  src={selectedEmployee.avatar_url}
                  alt={selectedEmployee.full_name}
                  className="w-20 h-20 rounded-full bg-secondary object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-10 h-10 text-primary" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedEmployee.full_name}
                </h3>
                <p className="text-muted-foreground">{selectedEmployee.position}</p>
                {selectedEmployee.department && (
                  <span className="chip mt-2">{selectedEmployee.department}</span>
                )}
              </div>
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
            </div>

            <div className="pt-4 border-t border-border">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Cake className="w-4 h-4" />
                День рождения
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={birthdayInput}
                  onChange={(e) => setBirthdayInput(e.target.value)}
                  className="input-base flex-1"
                />
                <button
                  onClick={handleSaveBirthday}
                  className="btn-primary"
                  disabled={!birthdayInput || updateBirthdayMutation.isPending}
                >
                  {updateBirthdayMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
              {selectedEmployee.birthday && (
                <p className="text-sm text-muted-foreground mt-2">
                  Текущее значение: {formatDisplayDate(selectedEmployee.birthday)}
                </p>
              )}
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

function PhotosTab() {
  const { photos } = useApp();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => setLightboxIndex(index)}
            className="aspect-square rounded-lg overflow-hidden bg-secondary hover:opacity-90 transition-opacity"
          >
            <img
              src={photo.url}
              alt={photo.title || "Фото"}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {photos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Нет фотографий
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i || 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) => Math.min(photos.length - 1, (i || 0) + 1))
          }
        />
      )}
    </>
  );
}
