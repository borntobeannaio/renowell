import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Modal } from "@/components/ui/Modal";
import { Lightbox } from "@/components/ui/Lightbox";
import {
  Users,
  Calendar,
  FileText,
  Image,
  Mail,
  Phone,
  Cake,
  X,
} from "lucide-react";
import { Employee } from "@/types";

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
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            <Icon className="w-4 h-4" />
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
  const { employees, getEmployeeById, updateEmployeeBirthday } = useApp();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [birthdayInput, setBirthdayInput] = useState("");

  const openEmployeeCard = (emp: Employee) => {
    setSelectedEmployee(emp);
    setBirthdayInput(emp.birthday || "");
  };

  const handleSaveBirthday = () => {
    if (selectedEmployee && birthdayInput) {
      updateEmployeeBirthday(selectedEmployee.id, birthdayInput);
      setSelectedEmployee({ ...selectedEmployee, birthday: birthdayInput });
    }
  };

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
              <img
                src={emp.avatar}
                alt={emp.name}
                className="w-12 h-12 rounded-full bg-secondary"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground truncate">
                  {emp.name}
                </h4>
                <p className="text-sm text-muted-foreground truncate">
                  {emp.role}
                </p>
                <p className="text-xs text-muted-foreground">{emp.dept}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Modal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        title="Карточка сотрудника"
      >
        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img
                src={selectedEmployee.avatar}
                alt={selectedEmployee.name}
                className="w-20 h-20 rounded-full bg-secondary"
              />
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {selectedEmployee.name}
                </h3>
                <p className="text-muted-foreground">{selectedEmployee.role}</p>
                <span className="chip mt-2">{selectedEmployee.dept}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-foreground">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <a
                  href={`mailto:${selectedEmployee.email}`}
                  className="hover:text-primary transition-colors"
                >
                  {selectedEmployee.email}
                </a>
              </div>
              <div className="flex items-center gap-3 text-foreground">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a
                  href={`tel:${selectedEmployee.phone}`}
                  className="hover:text-primary transition-colors"
                >
                  {selectedEmployee.phone}
                </a>
              </div>
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
                  disabled={!birthdayInput}
                >
                  Сохранить
                </button>
              </div>
              {selectedEmployee.birthday && (
                <p className="text-sm text-muted-foreground mt-2">
                  Текущее значение: {selectedEmployee.birthday}
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
                  {v.from} — {v.to}
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
