import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Building,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Users,
  GripVertical,
} from "lucide-react";
import { ProtocolItemData } from "./ProtocolItemEditor";
import { DroppableSection } from "./DroppableSection";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import type { SortableHandleProps } from "./SortableProtocolSection";

interface CompanyGroup {
  id: string;
  companyName: string;
  items: ProtocolItemData[];
}

interface TenderSectionProps {
  sectionId: string;
  companyGroups: CompanyGroup[];
  employees: {
    id: string;
    full_name: string;
    position: string;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
    department: string | null;
    birthday: string | null;
    profile_id: string | null;
  }[];
  defaultResponsible: string | null;
  onChangeDefaultResponsible: (responsible: string | null) => void;
  onUpdateItem: (companyId: string, itemId: string, updates: Partial<ProtocolItemData>) => void;
  onRemoveItem: (companyId: string, itemId: string) => void;
  onAddItem: (companyId: string) => void;
  onAddCompany: (companyName: string) => void;
  onRemoveCompany: (companyId: string) => void;
  onRenameCompany: (companyId: string, newName: string) => void;
  onRemoveSection?: () => void;
  canEdit?: boolean;
  defaultExpanded?: boolean;
  dragHandle?: SortableHandleProps;
}

export function TenderSection({
  sectionId,
  companyGroups,
  employees,
  defaultResponsible,
  onChangeDefaultResponsible,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onAddCompany,
  onRemoveCompany,
  onRenameCompany,
  onRemoveSection,
  canEdit = true,
  defaultExpanded = true,
  dragHandle,
}: TenderSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState("");

  const totalItems = companyGroups.reduce((sum, g) => sum + g.items.length, 0);

  // Convert responsible string to employee IDs
  const getEmployeeIdsFromResponsible = (responsible: string | null): string[] => {
    if (!responsible) return [];
    const names = responsible.split(", ").map((n) => n.trim());
    return names
      .map((name) => employees.find((e) => e.full_name === name)?.id)
      .filter(Boolean) as string[];
  };

  const handleDefaultResponsibleChange = (ids: string[]) => {
    const responsibleNames = ids
      .map((id) => employees.find((e) => e.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");
    onChangeDefaultResponsible(responsibleNames || null);
  };

  const handleAddCompanySubmit = () => {
    if (newCompanyName.trim()) {
      onAddCompany(newCompanyName.trim());
      setNewCompanyName("");
      setShowAddCompany(false);
    }
  };

  const handleStartEditCompany = (companyId: string, currentName: string) => {
    setEditingCompanyId(companyId);
    setEditingCompanyName(currentName);
  };

  const handleConfirmEditCompany = () => {
    if (editingCompanyId && editingCompanyName.trim()) {
      onRenameCompany(editingCompanyId, editingCompanyName.trim());
    }
    setEditingCompanyId(null);
    setEditingCompanyName("");
  };

  const handleCancelEditCompany = () => {
    setEditingCompanyId(null);
    setEditingCompanyName("");
  };

  return (
    <div className="card-base overflow-visible">
      {/* Main Header */}
      <div className="flex items-center gap-2 p-4 bg-blue-500/5">
        {dragHandle && (
          <button
            type="button"
            className="p-1 hover:bg-secondary rounded transition-colors cursor-grab active:cursor-grabbing"
            aria-label="Переместить секцию"
            {...dragHandle.attributes}
            {...dragHandle.listeners}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-secondary rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        <Building className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-foreground flex-1">Тендеры</span>

        <span className="chip text-xs shrink-0">
          {companyGroups.length} {companyGroups.length === 1 ? "компания" : companyGroups.length >= 2 && companyGroups.length <= 4 ? "компании" : "компаний"}
          {" · "}
          {totalItems} {totalItems === 1 ? "пункт" : totalItems >= 2 && totalItems <= 4 ? "пункта" : "пунктов"}
        </span>

        {onRemoveSection && companyGroups.length === 0 && (
          <button
            onClick={onRemoveSection}
            className="p-2 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            title="Удалить секцию"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Default responsible row */}
      {isExpanded && (
        <div className="px-4 py-3 bg-muted/10 border-b border-border/50 flex items-center gap-3">
          <Users className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground shrink-0">Ответственные по умолчанию:</span>
          <div className="flex-1 max-w-xs">
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={getEmployeeIdsFromResponsible(defaultResponsible)}
              onChange={handleDefaultResponsibleChange}
              placeholder="Выберите ответственных"
              usePortal={true}
            />
          </div>
        </div>
      )}

      {/* Company groups */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {companyGroups.map((company) => (
            <CompanySubSection
              key={company.id}
              company={company}
              employees={employees}
              defaultResponsible={defaultResponsible}
              isEditing={editingCompanyId === company.id}
              editingName={editingCompanyName}
              onEditingNameChange={setEditingCompanyName}
              onStartEdit={() => handleStartEditCompany(company.id, company.companyName)}
              onConfirmEdit={handleConfirmEditCompany}
              onCancelEdit={handleCancelEditCompany}
              onUpdateItem={(itemId, updates) => onUpdateItem(company.id, itemId, updates)}
              onRemoveItem={(itemId) => onRemoveItem(company.id, itemId)}
              onAddItem={() => onAddItem(company.id)}
              onRemoveCompany={() => onRemoveCompany(company.id)}
              canEdit={canEdit}
            />
          ))}

          {/* Add company */}
          {showAddCompany ? (
            <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed border-border">
              <Building className="w-4 h-4 text-blue-600" />
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddCompanySubmit();
                  if (e.key === "Escape") {
                    setShowAddCompany(false);
                    setNewCompanyName("");
                  }
                }}
                className="input-base flex-1"
                placeholder="Название компании"
                autoFocus
              />
              <button
                onClick={handleAddCompanySubmit}
                disabled={!newCompanyName.trim()}
                className="p-1.5 text-green-600 hover:bg-green-500/10 rounded transition-colors disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowAddCompany(false);
                  setNewCompanyName("");
                }}
                className="p-1.5 text-muted-foreground hover:bg-secondary rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddCompany(true)}
              className="w-full py-2.5 border-2 border-dashed border-border hover:border-blue-500/50 rounded-lg text-sm text-muted-foreground hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Добавить компанию
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for each company
interface CompanySubSectionProps {
  company: CompanyGroup;
  employees: {
    id: string;
    full_name: string;
    position: string;
    avatar_url: string | null;
    phone: string | null;
    email: string | null;
    department: string | null;
    birthday: string | null;
    profile_id: string | null;
  }[];
  defaultResponsible: string | null;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onUpdateItem: (itemId: string, updates: Partial<ProtocolItemData>) => void;
  onRemoveItem: (itemId: string) => void;
  onAddItem: () => void;
  onRemoveCompany: () => void;
  canEdit?: boolean;
}

function CompanySubSection({
  company,
  employees,
  defaultResponsible,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onRemoveCompany,
  canEdit = true,
}: CompanySubSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-border/60 rounded-lg overflow-hidden bg-card">
      {/* Company header */}
      <div className="flex items-center gap-2 p-3 bg-blue-500/5 border-b border-border/40">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0.5 hover:bg-secondary rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </button>

        <Building className="w-4 h-4 text-blue-500" />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={editingName}
              onChange={(e) => onEditingNameChange(e.target.value)}
              className="input-base flex-1 py-1 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onConfirmEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <button
              onClick={onConfirmEdit}
              className="p-1 text-green-600 hover:bg-green-500/10 rounded transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-muted-foreground hover:bg-secondary rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <>
            <span className="font-medium text-sm text-foreground flex-1">{company.companyName}</span>
            {canEdit && (
              <button
                onClick={onStartEdit}
                className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                title="Переименовать"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}

        <span className="chip text-xs shrink-0">
          {company.items.length} {company.items.length === 1 ? "пункт" : company.items.length >= 2 && company.items.length <= 4 ? "пункта" : "пунктов"}
        </span>

        {canEdit && company.items.length === 0 && (
          <button
            onClick={onRemoveCompany}
            className="p-1 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Удалить компанию"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Items */}
      {isExpanded && (
        <div className="p-3 space-y-2">
          {company.items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Нет пунктов</p>
          ) : (
            <DroppableSection
              sectionId={`company-${company.id}`}
              items={company.items}
              employees={employees}
              projectDefaultResponsible={defaultResponsible}
              onUpdateItem={onUpdateItem}
              onRemoveItem={onRemoveItem}
              sectionType="tender"
            />
          )}

          <button
            type="button"
            onClick={onAddItem}
            className="w-full py-2 border border-dashed border-border/60 hover:border-blue-500/50 rounded text-xs text-muted-foreground hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить пункт
          </button>
        </div>
      )}
    </div>
  );
}
