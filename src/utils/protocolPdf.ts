import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ProtocolItem {
  id: string;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  project_id?: string | null;
  section_id?: string | null;
  kpi?: string | null;
  status?: string | null;
  status_date?: string | null;
  sort_order?: number | null;
}

interface ProtocolSection {
  id: string;
  protocol_id: string;
  section_type: string;
  entity_id: string | null;
  entity_name: string | null;
  default_responsible: string | null;
  sort_order: number | null;
}

interface Protocol {
  id: string;
  number: number;
  date: string;
  title: string;
  organizer: string | null;
  attendees: string[];
}

interface Project {
  id: string;
  name: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

async function loadFontToVfs(doc: jsPDF, fileName: string, vfsName: string, family: string, style: "normal" | "bold") {
  const res = await fetch(`/fonts/${fileName}`);
  if (!res.ok) {
    throw new Error(`Failed to load font file: ${fileName}`);
  }
  const buffer = await res.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  doc.addFileToVFS(vfsName, base64);
  doc.addFont(vfsName, family, style);
}

async function ensureCyrillicFonts(doc: jsPDF): Promise<boolean> {
  try {
    await loadFontToVfs(doc, "Roboto-Regular.ttf", "Roboto-Regular.ttf", "Roboto", "normal");
    await loadFontToVfs(doc, "Roboto-Bold.ttf", "Roboto-Bold.ttf", "Roboto", "bold");
    doc.setFont("Roboto", "normal");
    return true;
  } catch (error) {
    console.error("Failed to load Cyrillic fonts:", error);
    doc.setFont("helvetica", "normal");
    return false;
  }
}

const SECTION_TYPE_TITLES: Record<string, string> = {
  project: "Проекты",
  tender: "Тендеры/задачи",
  hr: "Подбор персонала/задачи",
  business: "Бизнес процессы/задачи",
  goals: "ЦЕЛИ",
};

function getSectionTitle(section: ProtocolSection, projects: Project[], t: (s: string) => string): string {
  switch (section.section_type) {
    case "project":
      if (section.entity_id) {
        const project = projects.find((p) => p.id === section.entity_id);
        return project ? t(project.name) : t("Неизвестный проект");
      }
      return t("Без проекта");
    case "tender":
    case "hr":
    case "business":
    case "goals":
      return section.entity_name ? t(section.entity_name) : t(SECTION_TYPE_TITLES[section.section_type] || "Секция");
    default:
      return t("Секция");
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export async function generateProtocolPdf(
  protocol: Protocol,
  items: ProtocolItem[],
  projects: Project[],
  sections?: ProtocolSection[]
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const hasCyrillicFont = await ensureCyrillicFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 15;

  const t = (text: string) => (hasCyrillicFont ? text : transliterate(text));

  // Header
  doc.setFont(hasCyrillicFont ? "Roboto" : "helvetica", "bold");
  doc.setFontSize(12);
  doc.text(t("КОМПАНИЯ РЕНОВЕЛЬ"), pageWidth / 2, yPos + 5, { align: "center" });
  yPos += 15;

  // Protocol title
  doc.setFontSize(18);
  doc.text(t(`Протокол совещания № ${protocol.number}`), pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Meta
  doc.setFont(hasCyrillicFont ? "Roboto" : "helvetica", "normal");
  doc.setFontSize(11);
  const formattedDate = new Date(protocol.date).toLocaleDateString("ru-RU");
  doc.text(t(`Дата: ${formattedDate}`), margin, yPos);
  yPos += 8;

  if (protocol.organizer) {
    doc.text(t(`Организатор: ${protocol.organizer}`), margin, yPos);
    yPos += 8;
  }

  doc.text(t(`Тип/цель совещания: ${protocol.title}`), margin, yPos);
  yPos += 8;

  if (protocol.attendees.length > 0) {
    const attendeesText = protocol.attendees.join(", ");
    const lines = doc.splitTextToSize(t(`Участники: ${attendeesText}`), pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 6 + 5;
  }

  yPos += 5;

  // Use sections if available, otherwise fall back to old grouping
  if (sections && sections.length > 0) {
    generateSectionBasedPdf(doc, sections, items, projects, t, hasCyrillicFont, yPos, margin, pageWidth);
  } else {
    generateLegacyPdf(doc, items, projects, t, hasCyrillicFont, yPos, margin, pageWidth);
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont(hasCyrillicFont ? "Roboto" : "helvetica", "normal");
    doc.text(t(`Страница ${i} из ${pageCount}`), pageWidth / 2, doc.internal.pageSize.getHeight() - 10, {
      align: "center",
    });
  }

  const fileName = `Протокол_${protocol.number}_${protocol.date}.pdf`;
  doc.save(fileName);
}

function generateSectionBasedPdf(
  doc: jsPDF,
  sections: ProtocolSection[],
  items: ProtocolItem[],
  projects: Project[],
  t: (s: string) => string,
  hasCyrillicFont: boolean,
  startY: number,
  margin: number,
  pageWidth: number
) {
  const sortedSections = [...sections].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  
  // Group sections by type for rendering
  const projectSections = sortedSections.filter((s) => s.section_type === "project");
  const otherSections = sortedSections.filter((s) => s.section_type !== "project");
  
  let yPos = startY;

  // Render project sections first (main table)
  if (projectSections.length > 0) {
    yPos = renderProjectsTable(doc, projectSections, items, projects, t, hasCyrillicFont, yPos, margin, pageWidth);
  }

  // Group other sections by type
  const sectionsByType: Record<string, ProtocolSection[]> = {};
  otherSections.forEach((section) => {
    if (!sectionsByType[section.section_type]) {
      sectionsByType[section.section_type] = [];
    }
    sectionsByType[section.section_type].push(section);
  });

  // Render each section type
  const sectionOrder = ["tender", "hr", "business", "goals"];
  for (const type of sectionOrder) {
    const typeSections = sectionsByType[type];
    if (typeSections && typeSections.length > 0) {
      yPos = renderSectionTypeTable(doc, type, typeSections, items, t, hasCyrillicFont, yPos, margin, pageWidth);
    }
  }
}

function renderProjectsTable(
  doc: jsPDF,
  sections: ProtocolSection[],
  items: ProtocolItem[],
  projects: Project[],
  t: (s: string) => string,
  hasCyrillicFont: boolean,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  const tableData: (string | number)[][] = [];
  let itemNumber = 1;

  sections.forEach((section) => {
    const sectionItems = items
      .filter((item) => item.section_id === section.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    
    const sectionTitle = getSectionTitle(section, projects, t);
    const sectionResponsible = section.default_responsible ? t(section.default_responsible) : "";

    // Section header row
    tableData.push([`${itemNumber}. ${sectionTitle}`, sectionResponsible, ""]);

    // Items
    sectionItems.forEach((item, idx) => {
      const itemText = `${itemNumber}.${idx + 1}. ${t(item.item_text)}`;
      const responsible = item.responsible ? t(item.responsible) : "";
      const dueDate = formatDate(item.due_date);
      tableData.push([itemText, responsible, dueDate]);
    });

    itemNumber++;
  });

  if (tableData.length === 0) return startY;

  const tableHeaders = [t("Задачи/действия/проблемы"), t("Ответственные"), t("Сроки")];

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "normal",
    },
    headStyles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "bold",
      fillColor: [5, 42, 110],
      textColor: [255, 255, 255],
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const text = String(data.cell.raw);
        if (/^\d+\.\s/.test(text) && !text.includes(".1.") && !text.includes(".2.")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [230, 240, 250];
        }
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function renderSectionTypeTable(
  doc: jsPDF,
  sectionType: string,
  sections: ProtocolSection[],
  items: ProtocolItem[],
  t: (s: string) => string,
  hasCyrillicFont: boolean,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  // Check if we need a new page
  if (startY > doc.internal.pageSize.getHeight() - 50) {
    doc.addPage();
    startY = 20;
  }

  // Section type header
  doc.setFont(hasCyrillicFont ? "Roboto" : "helvetica", "bold");
  doc.setFontSize(14);
  doc.text(t(SECTION_TYPE_TITLES[sectionType] || sectionType), margin, startY);
  startY += 10;

  if (sectionType === "goals") {
    return renderGoalsTable(doc, sections, items, t, hasCyrillicFont, startY, margin, pageWidth);
  }

  // Standard table for tender/hr/business
  const tableData: (string | number)[][] = [];
  let itemNumber = 1;

  sections.forEach((section) => {
    const sectionItems = items
      .filter((item) => item.section_id === section.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const sectionTitle = section.entity_name ? t(section.entity_name) : "";
    const sectionResponsible = section.default_responsible ? t(section.default_responsible) : "";

    if (sectionTitle) {
      tableData.push([`${itemNumber}`, sectionTitle, sectionResponsible, ""]);
    }

    sectionItems.forEach((item, idx) => {
      const itemText = sectionTitle 
        ? `${itemNumber}.${idx + 1}. ${t(item.item_text)}`
        : `${itemNumber + idx}. ${t(item.item_text)}`;
      const responsible = item.responsible ? t(item.responsible) : "";
      const dueDate = formatDate(item.due_date);
      tableData.push(["", itemText, responsible, dueDate]);
    });

    itemNumber++;
  });

  if (tableData.length === 0) return startY;

  const tableHeaders = ["№", t("Задачи/действия"), t("Ответственные"), t("Сроки")];

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "normal",
    },
    headStyles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "bold",
      fillColor: [5, 42, 110],
      textColor: [255, 255, 255],
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0 && data.cell.raw) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function renderGoalsTable(
  doc: jsPDF,
  sections: ProtocolSection[],
  items: ProtocolItem[],
  t: (s: string) => string,
  hasCyrillicFont: boolean,
  startY: number,
  margin: number,
  pageWidth: number
): number {
  const tableData: string[][] = [];

  sections.forEach((section) => {
    const sectionItems = items
      .filter((item) => item.section_id === section.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    sectionItems.forEach((item) => {
      tableData.push([
        t(item.item_text),
        item.responsible ? t(item.responsible) : "",
        item.kpi ? t(item.kpi) : "",
        formatDate(item.due_date),
        item.status ? t(item.status) : "",
      ]);
    });
  });

  if (tableData.length === 0) return startY;

  const tableHeaders = [t("ЗАДАЧИ"), t("ОТВЕТСТВЕННЫЕ"), t("KPI"), t("СРОКИ"), t("СТАТУС")];

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "normal",
    },
    headStyles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "bold",
      fillColor: [5, 42, 110],
      textColor: [255, 255, 255],
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 20 },
      4: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  return (doc as any).lastAutoTable.finalY + 15;
}

function generateLegacyPdf(
  doc: jsPDF,
  items: ProtocolItem[],
  projects: Project[],
  t: (s: string) => string,
  hasCyrillicFont: boolean,
  startY: number,
  margin: number,
  pageWidth: number
) {
  // Group items by project (legacy behavior)
  const itemsByProject: Record<string, ProtocolItem[]> = {};
  items.forEach((item) => {
    const key = item.project_id || "no_project";
    if (!itemsByProject[key]) itemsByProject[key] = [];
    itemsByProject[key].push(item);
  });

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return t("Без проекта");
    const project = projects.find((p) => p.id === projectId);
    if (!project) return t("Неизвестный проект");
    return t(project.name);
  };

  const tableData: (string | number)[][] = [];
  let itemNumber = 1;

  Object.entries(itemsByProject).forEach(([projectId, projectItems]) => {
    const projectName = getProjectName(projectId === "no_project" ? null : projectId);
    tableData.push([`${itemNumber}. ${projectName}`, "", ""]);

    projectItems.forEach((item, idx) => {
      const itemText = `${itemNumber}.${idx + 1}. ${t(item.item_text)}`;
      const responsible = item.responsible ? t(item.responsible) : "";
      const dueDate = formatDate(item.due_date);
      tableData.push([itemText, responsible, dueDate]);
    });

    itemNumber++;
  });

  const tableHeaders = [t("Задачи/действия"), t("Ответственные"), t("Сроки")];

  autoTable(doc, {
    startY,
    head: [tableHeaders],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "normal",
    },
    headStyles: {
      font: hasCyrillicFont ? "Roboto" : "helvetica",
      fontStyle: "bold",
      fillColor: [5, 42, 110],
      textColor: [255, 255, 255],
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const text = String(data.cell.raw);
        if (/^\d+\.\s/.test(text) && !text.includes(".1.")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [230, 240, 250];
        }
      }
    },
  });
}

function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
    щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "Yo", Ж: "Zh", З: "Z",
    И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R",
    С: "S", Т: "T", У: "U", Ф: "F", Х: "Kh", Ц: "Ts", Ч: "Ch", Ш: "Sh",
    Щ: "Shch", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "Yu", Я: "Ya",
  };

  return text
    .split("")
    .map((char) => map[char] || char)
    .join("");
}
