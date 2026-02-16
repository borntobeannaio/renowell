import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  Plus,
  Trash2,
  Globe,
  Link,
  RefreshCw,
  User,
  Users,
  Paperclip,
  ExternalLink,
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ru } from "date-fns/locale";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useEmployees } from "@/hooks/useEmployees";

export function CalendarModule() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const { events, isLoading, deleteEvent, syncCalendars } = useCalendarEvents();
  const navigate = useNavigate();
  const { data: currentProfile } = useCurrentProfile();
  const profileId = currentProfile?.id;
  const { data: employees = [] } = useEmployees();

  // Build profile id -> name map
  const profileNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    employees.forEach((e) => {
      if (e.profile_id) map[e.profile_id] = e.full_name;
    });
    return map;
  }, [employees]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    return events
      .filter((e) => isSameDay(new Date(e.start_time), selectedDate))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [events, selectedDate]);

  // Days with events for dots
  const daysWithEvents = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    const set = new Set<string>();
    days.forEach((day) => {
      if (events.some((e) => isSameDay(new Date(e.start_time), day))) {
        set.add(day.toDateString());
      }
    });
    return set;
  }, [events, currentMonth]);

  // Upcoming events (for empty day state)
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.start_time) >= now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, 5);
  }, [events]);

  const formatTime = (iso: string) => format(new Date(iso), "HH:mm");

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return (parts[0]?.[0] || "") + (parts[1]?.[0] || "");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            Календарь
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Встречи и события
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={syncCalendars.isPending}
            onClick={() => syncCalendars.mutate()}
          >
            <RefreshCw className={`w-4 h-4 ${syncCalendars.isPending ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Обновить</span>
          </Button>
          {currentProfile && !currentProfile.ics_url && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate("/profile#ics")}
            >
              <Link className="w-4 h-4" />
              <span className="hidden sm:inline">Подключить календарь</span>
            </Button>
          )}
          <Button onClick={() => navigate(`/calendar/new?date=${format(selectedDate, "yyyy-MM-dd")}`)} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Новая встреча</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Calendar grid */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              locale={ru}
              className="pointer-events-auto"
              components={{
                DayContent: ({ date }) => {
                  const hasEvent = daysWithEvents.has(date.toDateString());
                  return (
                    <div className="relative flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {hasEvent && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  );
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Day events */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {format(selectedDate, "d MMMM, EEEE", { locale: ru })}
              {dayEvents.length > 0 && (
                <Badge variant="secondary">{dayEvents.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Загрузка...
              </p>
            ) : dayEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-6">Пока пусто</p>

                {/* Show upcoming if this day is empty */}
                {upcoming.length > 0 && (
                  <div className="text-left">
                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                      Ближайшие встречи
                    </p>
                    <div className="space-y-2">
                      {upcoming.map((e) => (
                        <button
                          key={e.id}
                          onClick={() => {
                            setSelectedDate(new Date(e.start_time));
                            setCurrentMonth(new Date(e.start_time));
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                        >
                          <div className="text-xs text-muted-foreground w-20 flex-shrink-0">
                            {format(new Date(e.start_time), "d MMM", { locale: ru })}
                            <br />
                            {formatTime(e.start_time)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {e.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {e.is_online
                                ? "Онлайн"
                                : e.location || "Место не указано"}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">
                            {event.title}
                          </h3>
                          {event.source === "external" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 flex-shrink-0">
                              <Globe className="w-3 h-3" />
                              Внешний
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(event.start_time)} —{" "}
                            {formatTime(event.end_time)}
                          </span>
                          {event.is_online ? (
                            <span className="flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              Онлайн
                            </span>
                          ) : event.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {event.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {event.source !== "external" && event.creator_id === profileId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteEvent.mutate(event.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Organizer */}
                    {event.organizer && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Организатор: {event.organizer}</span>
                      </div>
                    )}

                    {/* ICS Attendees */}
                    {event.attendees?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span>Участники ({event.attendees.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {event.attendees.slice(0, 8).map((att, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                              {att.name || att.email}
                              {att.status === "accepted" && <span className="text-green-500">✓</span>}
                              {att.status === "tentative" && <span className="text-yellow-500">?</span>}
                              {att.status === "declined" && <span className="text-red-500">✗</span>}
                            </Badge>
                          ))}
                          {event.attendees.length > 8 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{event.attendees.length - 8}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Internal participants (profile-based) */}
                    {event.participant_ids?.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                        <div className="flex -space-x-2">
                          {event.participant_ids.slice(0, 5).map((pid) => {
                            const name = profileNameMap[pid] || "?";
                            return (
                              <Avatar
                                key={pid}
                                className="w-7 h-7 border-2 border-background"
                              >
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>
                            );
                          })}
                          {event.participant_ids.length > 5 && (
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                              +{event.participant_ids.length - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {event.participant_ids.length}{" "}
                          {event.participant_ids.length === 1 ? "участник" : "участников"}
                        </span>
                      </div>
                    )}

                    {/* Meeting URL */}
                    {event.url && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ссылка на встречу
                        </a>
                      </div>
                    )}

                    {/* Attachments */}
                    {event.attachments?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1.5 mb-1 text-xs text-muted-foreground">
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Вложения</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {event.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate"
                            >
                              {att.filename}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
