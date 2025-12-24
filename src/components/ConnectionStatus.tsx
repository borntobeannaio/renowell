import { useState, useEffect, useCallback } from "react";
import { testConnection } from "@/lib/api";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectionStatus() {
  const [status, setStatus] = useState<{
    checking: boolean;
    connected: boolean;
    latency: number | null;
    error: string | null;
    lastCheck: Date | null;
  }>({
    checking: true,
    connected: false,
    latency: null,
    error: null,
    lastCheck: null,
  });

  const checkConnection = useCallback(async () => {
    setStatus(prev => ({ ...prev, checking: true }));
    
    const result = await testConnection();
    
    setStatus({
      checking: false,
      connected: result.success,
      latency: result.latency,
      error: result.error || null,
      lastCheck: new Date(),
    });
  }, []);

  // Check on mount and every 30 seconds
  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  const getLatencyColor = (latency: number) => {
    if (latency < 200) return "text-green-500";
    if (latency < 500) return "text-yellow-500";
    return "text-orange-500";
  };

  const getStatusIcon = () => {
    if (status.checking) {
      return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (!status.connected) {
      return <WifiOff className="h-4 w-4 text-destructive" />;
    }
    if (status.latency && status.latency > 500) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    return <Wifi className={`h-4 w-4 ${getLatencyColor(status.latency || 0)}`} />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={checkConnection}
            disabled={status.checking}
          >
            {getStatusIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-sm">
            <div className="font-medium">
              {status.checking
                ? "Проверка подключения..."
                : status.connected
                ? "Подключено к серверу"
                : "Нет подключения"}
            </div>
            
            {status.connected && status.latency && (
              <div className={getLatencyColor(status.latency)}>
                Задержка: {status.latency}мс
                {status.latency > 500 && " (медленно)"}
              </div>
            )}
            
            {status.error && (
              <div className="text-destructive">{status.error}</div>
            )}
            
            {status.lastCheck && (
              <div className="text-muted-foreground text-xs">
                Проверено: {status.lastCheck.toLocaleTimeString()}
              </div>
            )}
            
            <div className="text-muted-foreground text-xs pt-1">
              Нажмите для повторной проверки
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
