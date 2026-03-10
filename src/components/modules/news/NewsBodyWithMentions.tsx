import { useEmployees, getEmployeeDisplayName } from "@/hooks/useEmployees";

interface NewsBodyWithMentionsProps {
  body: string;
}

export function NewsBodyWithMentions({ body }: NewsBodyWithMentionsProps) {
  const { data: employees = [] } = useEmployees();

  // Парсим текст и подсвечиваем упоминания
  const renderBodyWithMentions = () => {
    const MENTION_REGEX = /@([А-Яа-яЁёA-Za-z]+\s[А-Яа-яЁёA-Za-z]+)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = MENTION_REGEX.exec(body)) !== null) {
      // Текст до упоминания
      if (match.index > lastIndex) {
        parts.push(body.slice(lastIndex, match.index));
      }

      const mentionName = match[1];
      const employee = employees.find(
        (e) => e.full_name.toLowerCase() === mentionName.toLowerCase()
      );

      // Подсвеченное упоминание
      parts.push(
        <span
          key={match.index}
          className={`font-medium ${
            employee
              ? "text-primary bg-primary/10 px-1 rounded"
              : "text-muted-foreground"
          }`}
          title={employee ? `${employee.position}` : "Сотрудник не найден"}
        >
          @{mentionName}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Остаток текста
    if (lastIndex < body.length) {
      parts.push(body.slice(lastIndex));
    }

    return parts.length > 0 ? parts : body;
  };

  return <p className="text-muted-foreground mb-3">{renderBodyWithMentions()}</p>;
}
