export type ID = string;
export type DateISO = string;

export type UserRole = "admin" | "editor" | "employee";

export interface Employee {
  id: ID;
  name: string;
  role: string;
  dept: string;
  email: string;
  phone: string;
  birthday?: DateISO;
  avatar?: string;
}

export interface NewsItem {
  id: ID;
  kind: "news" | "congrats";
  title: string;
  body: string;
  author: string;
  date: DateISO;
  tags: string[];
  mentionedEmployees?: string[]; // массив имён упомянутых сотрудников
  attachments?: FileRef[];
}

export interface Protocol {
  id: ID;
  date: DateISO;
  title: string;
  attendees: string[];
  agenda: string[];
  decisions: Decision[];
  links: FileRef[];
}

export interface Decision {
  text: string;
  responsible: string;
  createTask?: boolean;
  due?: DateISO;
}

export type TaskStatus = "inbox" | "doing" | "done";

export interface Task {
  id: ID;
  title: string;
  assignee: ID;
  due: DateISO;
  status: TaskStatus;
  labels: string[];
  origin?: { type: "protocol"; protocolId: ID } | null;
}

export interface HRVacation {
  id: ID;
  userId: ID;
  from: DateISO;
  to: DateISO;
  status: "approved" | "pending";
}

export interface HRDoc {
  id: ID;
  title: string;
  type: "pdf" | "docx" | "xlsx" | "link";
  updated: DateISO;
  url?: string;
}

export interface Photo {
  id: ID;
  url: string;
  title?: string;
}

export interface KBRubric {
  id: ID;
  title: string;
  docs: KBDoc[];
}

export interface KBDoc {
  id: ID;
  title: string;
  type: "md" | "pdf" | "docx";
  updated: DateISO;
  body: string;
}

export interface FileRef {
  id: ID;
  name?: string;
  url?: string;
  mime?: string;
}

export interface ChatThread {
  id: ID;
  title: string;
  type: "direct" | "group";
  participants: ID[];
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: ID;
  author: string;
  text: string;
  ts: number;
}

export type NavigationSection =
  | "news"
  | "protocols"
  | "tasks"
  | "hr"
  | "knowledge"
  | "calendar"
  | "chats"
  | "search"
  | "brandhub"
  | "about";
