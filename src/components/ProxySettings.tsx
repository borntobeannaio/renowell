import { useState, useEffect } from "react";
import { Settings, Save, X, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { setExternalProxyUrl, getConfiguredProxyUrl } from "@/lib/dbProxy";

export function ProxySettings() {
  const [open, setOpen] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("");
  const [useProxy, setUseProxy] = useState(false);

  useEffect(() => {
    const savedUrl = getConfiguredProxyUrl();
    if (savedUrl) {
      setProxyUrl(savedUrl);
      setUseProxy(true);
    }
  }, []);

  const handleSave = () => {
    if (useProxy && proxyUrl.trim()) {
      setExternalProxyUrl(proxyUrl.trim());
      toast.success("Прокси настроен. Перезагрузите страницу для применения.");
    } else {
      setExternalProxyUrl(null);
      toast.success("Прокси отключён. Перезагрузите страницу для применения.");
    }
    setOpen(false);
  };

  const handleToggle = (checked: boolean) => {
    setUseProxy(checked);
    if (!checked) {
      setExternalProxyUrl(null);
    }
  };

  const isProxyActive = !!getConfiguredProxyUrl();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Настройки прокси"
        >
          <Settings className={`h-4 w-4 ${isProxyActive ? "text-primary" : "text-muted-foreground"}`} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Настройки прокси
          </DialogTitle>
          <DialogDescription>
            Используйте внешний прокси для ускорения загрузки данных в вашем регионе.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="use-proxy" className="text-sm font-medium">
              Использовать внешний прокси
            </Label>
            <Switch
              id="use-proxy"
              checked={useProxy}
              onCheckedChange={handleToggle}
            />
          </div>

          {useProxy && (
            <div className="space-y-2">
              <Label htmlFor="proxy-url" className="text-sm font-medium">
                URL прокси-сервера
              </Label>
              <Input
                id="proxy-url"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="https://functions.yandexcloud.net/..."
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Укажите URL вашего Yandex Cloud Function или другого прокси-сервера
              </p>
            </div>
          )}

          {isProxyActive && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 text-primary text-sm">
              <Globe className="h-4 w-4" />
              <span>Прокси активен</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="h-4 w-4 mr-2" />
            Отмена
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}