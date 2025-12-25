import { useEffect, useRef, useState, useCallback } from "react";
import { useEndCall } from "@/hooks/useCalls";
import {
  PhoneOff,
  Maximize2,
  Users,
  ExternalLink,
} from "lucide-react";

interface VideoCallProps {
  channelName: string;
  callId: string;
  callType: "video" | "audio";
  onEnd: () => void;
}

export function VideoCall({ channelName, callId, callType, onEnd }: VideoCallProps) {
  const [isConnecting, setIsConnecting] = useState(true);
  const [jitsiWindow, setJitsiWindow] = useState<Window | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endCall = useEndCall();
  const checkIntervalRef = useRef<number | null>(null);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const callIdRef = useRef(callId);
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  const handleEndCall = useCallback(async () => {
    if (jitsiWindow && !jitsiWindow.closed) {
      jitsiWindow.close();
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }
    try {
      await endCall.mutateAsync(callIdRef.current);
    } catch (e) {
      console.error("Error ending call:", e);
    }
    onEndRef.current();
  }, [endCall, jitsiWindow]);

  const openJitsiCall = useCallback(() => {
    // Create a sanitized room name
    const roomName = `renowell_${channelName.replace(/[^a-zA-Z0-9]/g, "_")}`;
    
    // Build Jitsi URL with config options
    const configParams = new URLSearchParams({
      'config.startWithAudioMuted': 'false',
      'config.startWithVideoMuted': callType === 'audio' ? 'true' : 'false',
      'config.prejoinPageEnabled': 'false',
      'config.disableDeepLinking': 'true',
      'interfaceConfig.SHOW_JITSI_WATERMARK': 'false',
      'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS': 'false',
      'interfaceConfig.MOBILE_APP_PROMO': 'false',
    });

    const jitsiUrl = `https://meet.jit.si/${roomName}#${configParams.toString()}`;
    
    // Open in a new window
    const width = 900;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    const newWindow = window.open(
      jitsiUrl,
      'jitsi_call',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`
    );

    if (newWindow) {
      setJitsiWindow(newWindow);
      setIsConnecting(false);
      setError(null);

      // Check if window is closed periodically
      checkIntervalRef.current = window.setInterval(() => {
        if (newWindow.closed) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
          }
          // Don't auto-end call when window is closed, just update UI
          setJitsiWindow(null);
        }
      }, 1000);
    } else {
      setError("Не удалось открыть окно звонка. Разрешите всплывающие окна.");
      setIsConnecting(false);
    }
  }, [channelName, callType]);

  useEffect(() => {
    openJitsiCall();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [openJitsiCall]);

  // Focus on Jitsi window
  const focusJitsiWindow = () => {
    if (jitsiWindow && !jitsiWindow.closed) {
      jitsiWindow.focus();
    } else {
      // Reopen if closed
      openJitsiCall();
    }
  };

  return (
    <div className="fixed bottom-20 right-4 md:right-6 z-[100] w-[320px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-secondary/50">
        <div className="flex items-center gap-2 text-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isConnecting ? "Открытие звонка..." : "Звонок активен"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error ? (
          <div className="text-center">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <button
              onClick={openJitsiCall}
              className="btn-primary text-sm"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Звонок открыт в отдельном окне
            </p>
            <button
              onClick={focusJitsiWindow}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть окно звонка
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-3 bg-secondary/50 border-t border-border">
        <button
          onClick={handleEndCall}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity text-sm"
        >
          <PhoneOff className="w-4 h-4" />
          Завершить звонок
        </button>
      </div>
    </div>
  );
}
