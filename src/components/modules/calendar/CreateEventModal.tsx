import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { useEmployees } from "@/hooks/useEmployees";
import { format } from "date-fns";

interface CreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    location?: string;
    is_online: boolean;
    participant_ids: string[];
  }) => void;
  defaultDate?: Date;
  isSubmitting?: boolean;
}

export function CreateEventModal({
  open,
  onClose,
  onSubmit,
  defaultDate,
  isSubmitting,
}: CreateEventModalProps) {
  const { data: employees = [] } = useEmployees();
  const dateStr = format(defaultDate || new Date(), "yyyy-MM-dd");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dateStr);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!title.trim() || !date || !startTime || !endTime) return;

    // Map employee ids to their profile_ids
    const profileIds = employees
      .filter((e) => selectedEmployeeIds.includes(e.id) && e.profile_id)
      .map((e) => e.profile_id!);

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      start_time: `${date}T${startTime}:00`,
      end_time: `${date}T${endTime}:00`,
      location: location.trim() || undefined,
      is_online: isOnline,
      participant_ids: profileIds,
    });

    // Reset
    setTitle("");
    setDescription("");
    setStartTime("10:00");
    setEndTime("11:00");
    setLocation("");
    setIsOnline(false);
    setSelectedEmployeeIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target?.closest?.("[data-employee-dropdown]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Новая встреча</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Название *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Статус проекта"
            />
          </div>

          <div>
            <Label>Дата *</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Начало *</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label>Конец *</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isOnline} onCheckedChange={setIsOnline} />
            <Label>Онлайн-встреча</Label>
          </div>

          {!isOnline && (
            <div>
              <Label>Место</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Переговорная, адрес..."
              />
            </div>
          )}

          <div>
            <Label>Участники</Label>
            <EmployeeMultiSelect
              employees={employees}
              selectedIds={selectedEmployeeIds}
              onChange={setSelectedEmployeeIds}
              placeholder="Выберите участников"
              usePortal
            />
          </div>

          <div>
            <Label>Описание</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? "Создание..." : "Создать и пригласить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
