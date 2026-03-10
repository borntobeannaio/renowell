import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { proxySelect, proxyUpdate } from "@/lib/dbProxy";

interface TelegramLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: string;
  onLinked: () => void;
}

// Generate a random 6-digit code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function TelegramLinkDialog({
  open,
  onOpenChange,
  profileId,
  onLinked,
}: TelegramLinkDialogProps) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkInterval, setCheckInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Generate code when dialog opens
  useEffect(() => {
    if (open && profileId) {
      const newCode = generateCode();
      setCode(newCode);
      setCopied(false);
      
      // Save code to profile for verification (using description field temporarily)
      // In production, use a separate table for pending verifications
      proxyUpdate(
        "profiles",
        { description: `TELEGRAM_VERIFY:${newCode}` },
        [{ column: "id", operator: "eq", value: profileId }]
      );
    } else {
      // Clean up interval when dialog closes
      if (checkInterval) {
        clearInterval(checkInterval);
        setCheckInterval(null);
      }
    }
  }, [open, profileId]);

  // Start polling when code is generated
  useEffect(() => {
    if (!open || !profileId || !code) return;

    const interval = setInterval(async () => {
      setIsChecking(true);
      try {
        const { data } = await proxySelect<{ telegram_chat_id: string | null }>("profiles", {
          select: "telegram_chat_id",
          filters: [{ column: "id", operator: "eq", value: profileId }],
          limit: 1,
        });

        if (data?.[0]?.telegram_chat_id) {
          // Clean up verification code
          await proxyUpdate(
            "profiles",
            { description: null },
            [{ column: "id", operator: "eq", value: profileId }]
          );
          
          clearInterval(interval);
          setCheckInterval(null);
          onLinked();
          onOpenChange(false);
        }
      } catch (error) {
        console.error("Error checking Telegram link:", error);
      } finally {
        setIsChecking(false);
      }
    }, 3000);

    setCheckInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [open, profileId, code]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Код скопирован");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const botUsername = "renowell_bot";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Привязка Telegram</DialogTitle>
          <DialogDescription>
            Отправьте код боту для привязки аккаунта
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Ваш код привязки</Label>
            <div className="flex items-center gap-2">
              <Input
                value={code}
                readOnly
                className="font-mono text-lg tracking-widest text-center"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyCode}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Инструкция</Label>
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>
                Откройте бота{" "}
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  @{botUsername}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Отправьте боту код: <span className="font-mono font-bold">{code}</span></li>
              <li>Дождитесь подтверждения привязки</li>
            </ol>
          </div>

          {isChecking && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Проверка привязки...</span>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
