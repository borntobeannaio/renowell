import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeMultiSelect } from "@/components/ui/EmployeeMultiSelect";
import { useEmployees } from "@/hooks/useEmployees";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { format } from "date-fns";

export default function CreateEvent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
  const defaultDate = dateParam || format(new Date(), "yyyy-MM-dd");

  const { data: employees = [] } = useEmployees();
  const { createEvent } = useCalendarEvents();
  const { data: currentProfile } = useCurrentProfile();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!title.trim() || !date || !startTime || !endTime || !currentProfile?.id) return;

    const profileIds = employees
      .filter((e) => selectedEmployeeIds.includes(e.id) && e.profile_id)
      .map((e) => e.profile_id!);

    createEvent.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        start_time: `${date}T${startTime}:00`,
        end_time: `${date}T${endTime}:00`,
        location: location.trim() || undefined,
        is_online: isOnline,
        creator_id: currentProfile.id,
        participant_ids: profileIds,
      },
      { onSuccess: () => navigate("/calendar") }
    );
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate("/calendar")}
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к календарю
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarPlus className="w-5 h-5 text-primary" />
              Новая встреча
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate("/calendar")}>
                Отмена
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || createEvent.isPending}
              >
                {createEvent.isPending ? "Создание..." : "Создать и пригласить"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
