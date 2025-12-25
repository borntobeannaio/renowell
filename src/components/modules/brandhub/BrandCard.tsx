import { useState, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./CopyButton";

interface BrandCardProps {
  title: string;
  children: ReactNode;
  copyText?: string;
  expandable?: boolean;
  defaultExpanded?: boolean;
  icon?: ReactNode;
  className?: string;
  headerClassName?: string;
}

export function BrandCard({
  title,
  children,
  copyText,
  expandable = false,
  defaultExpanded = true,
  icon,
  className = "",
  headerClassName = ""
}: BrandCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-lg ${className}`}>
      <CardHeader 
        className={`pb-2 ${expandable ? "cursor-pointer" : ""} ${headerClassName}`}
        onClick={expandable ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base md:text-lg">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {copyText && <CopyButton text={copyText} />}
            {expandable && (
              <span className="text-muted-foreground">
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      {(!expandable || expanded) && (
        <CardContent className="pt-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
