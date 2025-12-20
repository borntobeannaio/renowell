import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  Employee,
  NewsItem,
  Protocol,
  Task,
  HRVacation,
  HRDoc,
  Photo,
  KBRubric,
  ChatThread,
  ChatMessage,
  NavigationSection,
  Decision,
} from "@/types";
import {
  mockEmployees,
  mockNews,
  mockProtocols,
  mockTasks,
  mockVacations,
  mockHRDocs,
  mockPhotos,
  mockKBRubrics,
  mockChats,
} from "@/data/mockData";

interface AppState {
  employees: Employee[];
  news: NewsItem[];
  protocols: Protocol[];
  tasks: Task[];
  vacations: HRVacation[];
  hrDocs: HRDoc[];
  photos: Photo[];
  kbRubrics: KBRubric[];
  chats: ChatThread[];
  currentSection: NavigationSection;
  searchQuery: string;
}

interface AppContextType extends AppState {
  setCurrentSection: (section: NavigationSection) => void;
  setSearchQuery: (query: string) => void;
  
  // News actions
  addNews: (news: Omit<NewsItem, "id">) => void;
  
  // Protocol actions
  addProtocol: (protocol: Omit<Protocol, "id">) => void;
  
  // Task actions
  addTask: (task: Omit<Task, "id">) => void;
  updateTaskStatus: (taskId: string, status: Task["status"]) => void;
  updateTaskAssignee: (taskId: string, assignee: string) => void;
  
  // Employee actions
  updateEmployeeBirthday: (employeeId: string, birthday: string) => void;
  
  // Chat actions
  addChat: (chat: Omit<ChatThread, "id" | "messages">) => void;
  addMessage: (chatId: string, message: Omit<ChatMessage, "id">) => void;
  
  // Helper
  createTasksFromDecisions: (protocol: Protocol) => void;
  getEmployeeById: (id: string) => Employee | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const BIRTHDAY_STORAGE_KEY = "portal_birthdays";

function loadBirthdays(): Record<string, string> {
  try {
    const stored = localStorage.getItem(BIRTHDAY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveBirthdays(birthdays: Record<string, string>) {
  localStorage.setItem(BIRTHDAY_STORAGE_KEY, JSON.stringify(birthdays));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const birthdays = loadBirthdays();
    return mockEmployees.map((emp) => ({
      ...emp,
      birthday: birthdays[emp.id] || emp.birthday,
    }));
  });
  const [news, setNews] = useState<NewsItem[]>(mockNews);
  const [protocols, setProtocols] = useState<Protocol[]>(mockProtocols);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [vacations] = useState<HRVacation[]>(mockVacations);
  const [hrDocs] = useState<HRDoc[]>(mockHRDocs);
  const [photos] = useState<Photo[]>(mockPhotos);
  const [kbRubrics] = useState<KBRubric[]>(mockKBRubrics);
  const [chats, setChats] = useState<ChatThread[]>(mockChats);
  const [currentSection, setCurrentSection] = useState<NavigationSection>("news");
  const [searchQuery, setSearchQuery] = useState("");

  const getEmployeeById = (id: string) => employees.find((e) => e.id === id);

  const addNews = (newsItem: Omit<NewsItem, "id">) => {
    const newItem: NewsItem = {
      ...newsItem,
      id: crypto.randomUUID(),
    };
    setNews((prev) => [newItem, ...prev]);
  };

  const addProtocol = (protocol: Omit<Protocol, "id">) => {
    const newProtocol: Protocol = {
      ...protocol,
      id: crypto.randomUUID(),
    };
    setProtocols((prev) => [newProtocol, ...prev]);
    createTasksFromDecisions(newProtocol);
  };

  const createTasksFromDecisions = (protocol: Protocol) => {
    const newTasks = (protocol.decisions || [])
      .filter((d) => d.createTask && d.text.trim())
      .map((d) => ({
        id: crypto.randomUUID(),
        title: d.text,
        assignee: employees.find((e) => e.name === d.responsible)?.id ?? employees[0]?.id ?? "e1",
        due: d.due || new Date().toISOString().slice(0, 10),
        status: "inbox" as const,
        labels: ["protocol", protocol.title],
        origin: { type: "protocol" as const, protocolId: protocol.id },
      }));
    
    if (newTasks.length > 0) {
      setTasks((prev) => [...prev, ...newTasks]);
    }
  };

  const addTask = (task: Omit<Task, "id">) => {
    const newTask: Task = {
      ...task,
      id: crypto.randomUUID(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const updateTaskStatus = (taskId: string, status: Task["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status } : t))
    );
  };

  const updateTaskAssignee = (taskId: string, assignee: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assignee } : t))
    );
  };

  const updateEmployeeBirthday = (employeeId: string, birthday: string) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === employeeId ? { ...e, birthday } : e))
    );
    const birthdays = loadBirthdays();
    birthdays[employeeId] = birthday;
    saveBirthdays(birthdays);
  };

  const addChat = (chat: Omit<ChatThread, "id" | "messages">) => {
    const newChat: ChatThread = {
      ...chat,
      id: crypto.randomUUID(),
      messages: [
        {
          id: crypto.randomUUID(),
          author: "system",
          text: "Чат создан",
          ts: Date.now(),
        },
      ],
    };
    setChats((prev) => [newChat, ...prev]);
  };

  const addMessage = (chatId: string, message: Omit<ChatMessage, "id">) => {
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [
                ...c.messages,
                { ...message, id: crypto.randomUUID() },
              ],
            }
          : c
      )
    );
  };

  return (
    <AppContext.Provider
      value={{
        employees,
        news,
        protocols,
        tasks,
        vacations,
        hrDocs,
        photos,
        kbRubrics,
        chats,
        currentSection,
        searchQuery,
        setCurrentSection,
        setSearchQuery,
        addNews,
        addProtocol,
        addTask,
        updateTaskStatus,
        updateTaskAssignee,
        updateEmployeeBirthday,
        addChat,
        addMessage,
        createTasksFromDecisions,
        getEmployeeById,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
