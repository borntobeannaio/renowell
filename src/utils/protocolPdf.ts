import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export async function generateProtocolPdf(
  protocol: Protocol,
  items: ProtocolItem[],
  projects: Project[]
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Add Cyrillic font support - using built-in helvetica for now
  // For production, you'd want to embed a Cyrillic font
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Header - Company name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('KOMPANIYA RENOVELL', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;

  // Protocol title
  doc.setFontSize(18);
  doc.text(`Protokol soveshchaniya № ${protocol.number}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;

  // Date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const formattedDate = new Date(protocol.date).toLocaleDateString('ru-RU');
  doc.text(`Data: ${formattedDate}`, margin, yPos);
  
  yPos += 8;

  // Organizer
  if (protocol.organizer) {
    doc.text(`Organizator: ${transliterate(protocol.organizer)}`, margin, yPos);
    yPos += 8;
  }

  // Meeting type
  doc.text(`Tip soveshchaniya: ${transliterate(protocol.title)}`, margin, yPos);
  yPos += 8;

  // Attendees
  if (protocol.attendees.length > 0) {
    const attendeesText = protocol.attendees.map(a => transliterate(a)).join(', ');
    const lines = doc.splitTextToSize(`Uchastniki: ${attendeesText}`, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 6 + 5;
  }

  yPos += 5;

  // Group items by project
  const itemsByProject: Record<string, ProtocolItem[]> = {};
  items.forEach(item => {
    const key = item.project_id || 'no_project';
    if (!itemsByProject[key]) itemsByProject[key] = [];
    itemsByProject[key].push(item);
  });

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return 'Bez proekta';
    return projects.find(p => p.id === projectId)?.name || 'Neizvestnyy proekt';
  };

  // Create table data
  const tableData: (string | number)[][] = [];
  let itemNumber = 1;

  Object.entries(itemsByProject).forEach(([projectId, projectItems]) => {
    const projectName = transliterate(getProjectName(projectId === 'no_project' ? null : projectId));
    
    // Add project header row
    tableData.push([`${itemNumber}. ${projectName}`, '', '']);
    
    // Add items
    projectItems.forEach((item, idx) => {
      const itemText = `${itemNumber}.${idx + 1}. ${transliterate(item.item_text)}`;
      const responsible = item.responsible ? transliterate(item.responsible) : '';
      const dueDate = item.due_date || '';
      tableData.push([itemText, responsible, dueDate]);
    });
    
    itemNumber++;
  });

  // Add table
  autoTable(doc, {
    startY: yPos,
    head: [['Zadachi/deystviya', 'Otvetstvennyye', 'Sroki']],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [5, 42, 110], // Primary color #052A6E
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    didParseCell: (data) => {
      // Make project header rows bold
      if (data.section === 'body' && data.column.index === 0) {
        const text = String(data.cell.raw);
        if (/^\d+\.\s/.test(text) && !text.includes('.1.')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [230, 240, 250];
        }
      }
    },
  });

  // Footer with page number
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Stranitsa ${i} iz ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const fileName = `Protokol_${protocol.number}_${protocol.date}.pdf`;
  doc.save(fileName);
}

// Simple transliteration function for Cyrillic to Latin
function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
  };
  
  return text.split('').map(char => map[char] || char).join('');
}
