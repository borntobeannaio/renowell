import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { formatDisplayDate } from "@/utils/dateFormat";

// Типы календарей для цветовой дифференциации
type CalendarType = "team" | "personal" | "project" | "external";

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  calendarType: CalendarType;
  participants: { id: string; name: string; initials: string }[];
  location?: string;
  isOnline?: boolean;
  description?: string;
}

// Цветовая схема для разных типов календарей
const calendarColors: Record<CalendarType, { bg: string; text: string; dot: string; label: string }> = {
  team: { 
    bg: "bg-blue-500/10 dark:bg-blue-400/20", 
    text: "text-blue-700 dark:text-blue-300", 
    dot: "bg-blue-500",
    label: "Командные" 
  },
  personal: { 
    bg: "bg-green-500/10 dark:bg-green-400/20", 
    text: "text-green-700 dark:text-green-300", 
    dot: "bg-green-500",
    label: "Личные" 
  },
  project: { 
    bg: "bg-purple-500/10 dark:bg-purple-400/20", 
    text: "text-purple-700 dark:text-purple-300", 
    dot: "bg-purple-500",
    label: "Проектные" 
  },
  external: { 
    bg: "bg-orange-500/10 dark:bg-orange-400/20", 
    text: "text-orange-700 dark:text-orange-300", 
    dot: "bg-orange-500",
    label: "Внешние" 
  },
};

// Моковые данные встреч
const mockEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Еженедельный статус проекта",
    date: new Date(),
    startTime: "10:00",
    endTime: "11:00",
    calendarType: "team",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "2", name: "Мария Сидорова", initials: "МС" },
      { id: "3", name: "Алексей Козлов", initials: "АК" },
    ],
    location: "Переговорная А",
    isOnline: false,
  },
  {
    id: "2",
    title: "1-on-1 с руководителем",
    date: new Date(),
    startTime: "14:00",
    endTime: "14:30",
    calendarType: "personal",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "4", name: "Елена Новикова", initials: "ЕН" },
    ],
    isOnline: true,
  },
  {
    id: "3",
    title: "Демо спринта",
    date: new Date(Date.now() + 86400000), // завтра
    startTime: "15:00",
    endTime: "16:30",
    calendarType: "project",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "2", name: "Мария Сидорова", initials: "МС" },
      { id: "3", name: "Алексей Козлов", initials: "АК" },
      { id: "5", name: "Дмитрий Волков", initials: "ДВ" },
      { id: "6", name: "Анна Белова", initials: "АБ" },
    ],
    location: "Zoom",
    isOnline: true,
  },
  {
    id: "4",
    title: "Встреча с клиентом",
    date: new Date(Date.now() + 86400000 * 2), // послезавтра
    startTime: "11:00",
    endTime: "12:00",
    calendarType: "external",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "7", name: "Клиент", initials: "КЛ" },
    ],
    location: "Офис клиента",
    isOnline: false,
  },
  {
    id: "5",
    title: "Планирование квартала",
    date: new Date(Date.now() + 86400000 * 3),
    startTime: "09:00",
    endTime: "12:00",
    calendarType: "team",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "2", name: "Мария Сидорова", initials: "МС" },
      { id: "4", name: "Елена Новикова", initials: "ЕН" },
    ],
    location: "Большая переговорная",
    isOnline: false,
  },
  {
    id: "6",
    title: "Ретроспектива",
    date: new Date(Date.now() + 86400000 * 4),
    startTime: "16:00",
    endTime: "17:00",
    calendarType: "project",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "2", name: "Мария Сидорова", initials: "МС" },
      { id: "3", name: "Алексей Козлов", initials: "АК" },
    ],
    isOnline: true,
  },
  {
    id: "7",
    title: "Обед с коллегой",
    date: new Date(Date.now() + 86400000 * 5),
    startTime: "13:00",
    endTime: "14:00",
    calendarType: "personal",
    participants: [
      { id: "1", name: "Иван Петров", initials: "ИП" },
      { id: "5", name: "Дмитрий Волков", initials: "ДВ" },
    ],
    location: "Кафе рядом с офисом",
    isOnline: false,
  },
  {
    id: "8",
    title: "Технический обзор",
    date: new Date(),
    startTime: "16:00",
    endTime: "17:00",
    calendarType: "project",
    participants: [
      { id: "3", name: "Алексей Козлов", initials: "АК" },
      { id: "5", name: "Дмитрий Волков", initials: "ДВ" },
    ],
    isOnline: true,
  },
];

// Фильтры календарей
const calendarFilters: { type: CalendarType; label: string }[] = [
  { type: "team", label: "Командные" },
  { type: "personal", label: "Личные" },
  { type: "project", label: "Проектные" },
  { type: "external", label: "Внешние" },
];

export function CalendarModule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [activeFilters, setActiveFilters] = useState<CalendarType[]>(["team", "personal", "project", "external"]);

  const filteredEvents = useMemo(() => {
    return mockEvents.filter(event => activeFilters.includes(event.calendarType));
  }, [activeFilters]);

  const eventsForSelectedDate = useMemo(() => {
    return filteredEvents
      .filter(event => isSameDay(event.date, selectedDate))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filteredEvents, selectedDate]);

  const daysWithEvents = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    
    return days.reduce((acc, day) => {
      const dayEvents = filteredEvents.filter(event => isSameDay(event.date, day));
      if (dayEvents.length > 0) {
        acc[day.toISOString()] = dayEvents.map(e => e.calendarType);
      }
      return acc;
    }, {} as Record<string, CalendarType[]>);
  }, [filteredEvents, currentMonth]);

  const toggleFilter = (type: CalendarType) => {
    setActiveFilters(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const goToPreviousMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-primary" />
            Календарь
          </h1>
          <p className="text-muted-foreground mt-1">Встречи и события</p>
        </div>
        <Button variant="outline" onClick={goToToday}>
          Сегодня
        </Button>
      </div>

      {/* Фильтры календарей */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {calendarFilters.map(({ type, label }) => {
              const colors = calendarColors[type];
              const isActive = activeFilters.includes(type);
              return (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleFilter(type)}
                  className={`gap-2 ${isActive ? colors.bg : "opacity-50"}`}
                >
                  <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
                  <span className={isActive ? colors.text : "text-muted-foreground"}>
                    {label}
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Календарь */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base font-medium">
                {format(currentMonth, "LLLL yyyy", { locale: ru })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ru}
              className="pointer-events-auto"
              modifiers={{
                hasEvents: (date) => {
                  const key = date.toISOString().split('T')[0];
                  return Object.keys(daysWithEvents).some(k => k.startsWith(key));
                }
              }}
              modifiersStyles={{
                hasEvents: {
                  fontWeight: 'bold',
                }
              }}
              components={{
                DayContent: ({ date }) => {
                  const key = date.toISOString();
                  const eventTypes = daysWithEvents[key];
                  return (
                    <div className="relative flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {eventTypes && eventTypes.length > 0 && (
                        <div className="absolute -bottom-1 flex gap-0.5">
                          {[...new Set(eventTypes)].slice(0, 3).map((type, i) => (
                            <span 
                              key={i} 
                              className={`w-1 h-1 rounded-full ${calendarColors[type].dot}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              }}
            />
          </CardContent>
        </Card>

        {/* События выбранного дня */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>События на {formatDisplayDate(selectedDate.toISOString())}</span>
              <Badge variant="secondary" className="ml-2">
                {eventsForSelectedDate.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {eventsForSelectedDate.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Нет событий на этот день</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {eventsForSelectedDate.map((event) => {
                    const colors = calendarColors[event.calendarType];
                    return (
                      <div
                        key={event.id}
                        className={`p-4 rounded-xl border ${colors.bg} border-border/50 hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span className={`text-xs font-medium ${colors.text}`}>
                                {calendarColors[event.calendarType].label}
                              </span>
                            </div>
                            <h3 className="font-semibold text-foreground mb-2">
                              {event.title}
                            </h3>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{event.startTime} — {event.endTime}</span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-1">
                                  {event.isOnline ? (
                                    <Video className="w-4 h-4" />
                                  ) : (
                                    <MapPin className="w-4 h-4" />
                                  )}
                                  <span>{event.location}</span>
                                </div>
                              )}
                              {event.isOnline && !event.location && (
                                <div className="flex items-center gap-1">
                                  <Video className="w-4 h-4" />
                                  <span>Онлайн</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Участники */}
                        <div className="mt-4 pt-4 border-t border-border/50">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Участники:
                            </span>
                            <div className="flex -space-x-2">
                              {event.participants.slice(0, 5).map((participant) => (
                                <Avatar 
                                  key={participant.id} 
                                  className="w-7 h-7 border-2 border-background"
                                >
                                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {participant.initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {event.participants.length > 5 && (
                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                                  +{event.participants.length - 5}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Ближайшие события */}
      <Card>
        <CardHeader>
          <CardTitle>Ближайшие события</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents
              .filter(event => event.date >= new Date())
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .slice(0, 6)
              .map((event) => {
                const colors = calendarColors[event.calendarType];
                return (
                  <div
                    key={event.id}
                    className={`p-4 rounded-xl border ${colors.bg} border-border/50 hover:shadow-md transition-all duration-200 cursor-pointer`}
                    onClick={() => setSelectedDate(event.date)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <span className="text-xs text-muted-foreground">
                        {formatDisplayDate(event.date.toISOString())}
                      </span>
                    </div>
                    <h4 className="font-medium text-foreground line-clamp-1 mb-1">
                      {event.title}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{event.startTime}</span>
                      <span className="text-muted-foreground/50">•</span>
                      <div className="flex -space-x-1">
                        {event.participants.slice(0, 3).map((p) => (
                          <Avatar key={p.id} className="w-5 h-5 border border-background">
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                              {p.initials}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
