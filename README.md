# Портал Renowell

# Internal Portal — MVP (Phase 1)

## Goal

A single internal portal for the team: News, Meeting Protocols, Tasks, HR/Office, Knowledge Base, and Chats. MVP runs without a backend (local state + mock data) and is ready to plug in APIs later.

## Roles

* **Admin** — full access (create/delete all entities).
* **Editor** — create/edit content (news, protocols, tasks).
* **Employee** — view, chat, edit own profile fields (e.g., birthday).

> For MVP you may treat everyone as **Editor**, but keep the role structure in code.

## Navigation / Sections

* **News** — feed with type filter (news/congrats) and creation form.
* **Meeting Protocols** — create protocol (date, topic, attendees, agenda). Each **Decision** has toggle **“Create task”**; the **Due date** field appears **only when the toggle is ON**; saving the protocol auto-creates tasks.
* **Task Tracker** — three columns (Inbox / Doing / Done), HTML5 drag-and-drop, quick assignee/status controls, “New task” modal.
* **HR & Office** — employees (open **employee card** with contacts and birthday; birthday persists in `localStorage`), vacations, HR docs, photo gallery (grid + lightbox).
* **Knowledge Base** — rubrics → documents → lightweight preview (text).
* **Chats** — threads list; messages pane; **create chat** (direct or group); send via button and **Enter** (Shift+Enter = newline); auto-scroll to latest.
* **Search** — not in the sidebar; opened from the header search bar **“Search”** button; results have an **Open** button that routes to the proper section.

## UI/UX

* Consistent spacing: cards `16px`; inputs/selects/buttons `px-3 py-2`; input height ≈ `40px`.
* Mobile: fixed bottom nav bar with large touch targets.
* States: clear hover/active; subtle chips for tags/status.
* Palette (can align to brand later): primary `#4f46e5` (or `#7c14da`), accents `#ffb857`, `#b6d929`, `#2974d9`; background `#f8fafc`, border `#e2e8f0`.
* Responsive: ≥768px shows left sidebar; <768px shows bottom nav.

## Data Models (TypeScript)

```ts
type ID = string; type DateISO = string;

interface Employee {
  id: ID; name: string; role: string; dept: string;
  email: string; phone: string; birthday?: DateISO;
}

interface NewsItem {
  id: ID;
  kind: "news" | "congrats"; // store as localized string if needed
  title: string; body: string; author: string;
  date: DateISO; tags: string[]; attachments?: FileRef[];
}

interface Protocol {
  id: ID; date: DateISO; title: string;
  attendees: string[];  // free-text names for MVP
  agenda: string[];
  decisions: Decision[]; links: FileRef[];
}

interface Decision {
  text: string;
  responsible: string;   // (MVP: name string; later: Employee.id)
  createTask?: boolean;  // toggle
  due?: DateISO;         // visible only when createTask === true
}

type TaskStatus = "inbox" | "doing" | "done";
interface Task {
  id: ID; title: string; assignee: ID; due: DateISO;
  status: TaskStatus; labels: string[];
  origin?: { type: "protocol"; protocolId: ID } | null;
}

interface HRVacation { id: ID; userId: ID; from: DateISO; to: DateISO; status: "approved"|"pending"; }
interface HRDoc { id: ID; title: string; type: "pdf"|"docx"|"xlsx"|"link"; updated: DateISO; url?: string; }
interface Photo { id: ID; url: string; title?: string; }
interface KBRubric { id: ID; title: string; docs: KBDoc[]; }
interface KBDoc { id: ID; title: string; type: "md"|"pdf"|"docx"; updated: DateISO; body: string; }
interface FileRef { id: ID; name?: string; url?: string; mime?: string; }

interface ChatThread { id: ID; title: string; participants?: ID[]; messages: ChatMessage[]; }
interface ChatMessage { id: ID; author: string; text: string; ts: number; }
```

## Acceptance Criteria (Key Flows)

1. **News**

   * Create publication (type, date, title, body, tags).
   * Appears in the feed; filter by type works.
2. **Protocol**

   * Form with date, topic, attendees (comma-separated), agenda (comma-separated).
   * Each decision has **Create task** toggle; **Due date** shows **only when ON**.
   * Saving adds protocol to the list; tasks are auto-created for toggled decisions (status `inbox`, `origin` links to protocol).
3. **Task Tracker**

   * Card drag-and-drop between columns updates status.
   * Inline controls for assignee and status.
   * “New task” modal creates a task.
4. **HR & Office**

   * Employee list; **employee card** opens; birthday can be set and persisted in `localStorage`.
   * Tabs for Vacations, Documents, Photo gallery (with lightbox).
5. **Chats**

   * Threads list; messages pane auto-scrolls to bottom.
   * Send message via button and **Enter**; **Shift+Enter** inserts newline; ignore empty messages.
   * Create new chat: **Direct** (choose employee) or **Group** (checkboxes); system message “Chat created” on creation.
6. **Search**

   * Header search input; clicking **Search** opens results view.
   * Each result has **Open** to navigate to the correct section.
7. **Mobile**

   * Bottom nav is present and usable; DnD optional on mobile.

## State & Architecture

* **MVP:** in-memory state (React state/Context or Zustand). Birthdays persisted to `localStorage`.
* **Layers:**

  * UI (React + Tailwind).
  * Domain helpers (e.g., `createProtocol()`, `createTasksFromDecisions()`).
  * Adapters layer reserved for future REST/GraphQL.
* TypeScript everywhere.

## Components (Core)

* `Header` (title/subtitle/actions, search in app header), `Modal`, `Lightbox`, `TabBtn`.
* Modules: `NewsModule`, `ProtocolsModule`, `TasksModule`, `HRModule` (`HREmployees`, `HRVacations`, `HRDocs`, `HRPhotos`), `KBModule`, `ChatModule`, `SearchModule`.

## Non-Functional

* SPA, no backend (MVP), Lighthouse ~90+ desktop.
* Responsive from 320px.
* A11y: sensible contrasts, aria labels on key controls.
* No external fonts/CDNs required (optional).

## Example — Create tasks from protocol decisions

```ts
function createTasksFromDecisions(p: Protocol, employees: Employee[]): Task[] {
  return (p.decisions || [])
    .filter(d => d.createTask && d.text.trim())
    .map(d => ({
      id: crypto.randomUUID(),
      title: d.text,
      assignee: employees.find(e => e.name === d.responsible)?.id ?? employees[0]?.id ?? "u1",
      due: d.due || new Date().toISOString().slice(0,10),
      status: "inbox",
      labels: ["protocol", p.title],
      origin: { type: "protocol", protocolId: p.id },
    }))
}
```

## Seed Data / Imports (Future)

* Employees from XLSX (`ФИО, Должность, Отдел, Почта, Номер телефона, ДР`), mapped to `Employee`.
* Projects can later be parsed from PDF protocols (regex/heuristics); **MVP uses a manual list**.

## MVP Checklist

* [ ] Consistent paddings and input heights across the app.
* [ ] Protocol decision **toggle** creates tasks; Due appears only when toggle is ON.
* [ ] Kanban drag-and-drop + inline status/assignee.
* [ ] Chats: Enter to send, Shift+Enter newline, auto-scroll.
* [ ] Search from header; **Open** routes correctly.
* [ ] Mobile bottom navigation.
* [ ] Employee card: birthday persists to `localStorage`.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0c20bd3b-13c6-4401-a76b-dee9b432d23c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
