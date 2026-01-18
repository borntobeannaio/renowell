import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ProtocolItem {
  id: string;
  item_text: string;
  responsible: string | null;
  due_date: string | null;
  project_id: string | null;
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
  // Safe base64 conversion for binary font files
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

// Load Cyrillic fonts (stored locally in /public/fonts)
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

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateProtocolPdf(protocol: Protocol, items: ProtocolItem[], projects: Project[]) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const hasCyrillicFont = await ensureCyrillicFonts(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 15;

  // If fonts failed, fall back to transliteration to avoid "tofu" squares
  const t = (text: string) => (hasCyrillicFont ? text : transliterate(text));

  // Header with company name
  doc.setFont(hasCyrillicFont ? "Roboto" : "helvetica", "bold");
  doc.setFontSize(12);
  doc.text(t("компания Реновель"), pageWidth / 2, yPos + 5, { align: "center" });

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

  // Group items by project
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

  // Table data
  const tableData: (string | number)[][] = [];
  let itemNumber = 1;

  Object.entries(itemsByProject).forEach(([projectId, projectItems]) => {
    const projectName = getProjectName(projectId === "no_project" ? null : projectId);

    // Project header row
    tableData.push([`${itemNumber}. ${projectName}`, "", ""]);

    // Items rows
    projectItems.forEach((item, idx) => {
      const itemText = `${itemNumber}.${idx + 1}. ${t(item.item_text)}`;
      const responsible = item.responsible ? t(item.responsible) : "";
      const dueDate = item.due_date || "";
      tableData.push([itemText, responsible, dueDate]);
    });

    itemNumber++;
  });

  const tableHeaders = [t("Задачи/действия"), t("Ответственные"), t("Сроки")];

  autoTable(doc, {
    startY: yPos,
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
      // Make project header rows bold
      if (data.section === "body" && data.column.index === 0) {
        const text = String(data.cell.raw);
        if (/^\d+\.\s/.test(text) && !text.includes(".1.")) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [230, 240, 250];
        }
      }
    },
  });

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

// Simple transliteration function (only used if font can't be loaded)
function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "yo",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    А: "A",
    Б: "B",
    В: "V",
    Г: "G",
    Д: "D",
    Е: "E",
    Ё: "Yo",
    Ж: "Zh",
    З: "Z",
    И: "I",
    Й: "Y",
    К: "K",
    Л: "L",
    М: "M",
    Н: "N",
    О: "O",
    П: "P",
    Р: "R",
    С: "S",
    Т: "T",
    У: "U",
    Ф: "F",
    Х: "Kh",
    Ц: "Ts",
    Ч: "Ch",
    Ш: "Sh",
    Щ: "Shch",
    Ъ: "",
    Ы: "Y",
    Ь: "",
    Э: "E",
    Ю: "Yu",
    Я: "Ya",
  };

  return text
    .split("")
    .map((char) => map[char] || char)
    .join("");
}
