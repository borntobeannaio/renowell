import { useEffect, useRef, useState, useCallback } from "react";
import { useEndCall } from "@/hooks/useCalls";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Users,
  Monitor,
  MonitorOff,
} from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, options: JitsiMeetOptions) => JitsiMeetAPI;
  }
}

interface JitsiMeetOptions {
  roomName: string;
  width?: string | number;
  height?: string | number;
  parentNode?: HTMLElement;
  userInfo?: {
    displayName?: string;
    email?: string;
  };
  configOverwrite?: {
    startWithAudioMuted?: boolean;
    startWithVideoMuted?: boolean;
    prejoinPageEnabled?: boolean;
    disableDeepLinking?: boolean;
    enableClosePage?: boolean;
    hideConferenceSubject?: boolean;
    hideConferenceTimer?: boolean;
    toolbarButtons?: string[];
    enableLobby?: boolean;
    disableInviteFunctions?: boolean;
    enableNoisyMicDetection?: boolean;
    remoteVideoMenu?: {
      disableKick?: boolean;
    };
  };
  interfaceConfigOverwrite?: {
    SHOW_JITSI_WATERMARK?: boolean;
    SHOW_WATERMARK_FOR_GUESTS?: boolean;
    SHOW_BRAND_WATERMARK?: boolean;
    TOOLBAR_BUTTONS?: string[];
    DISABLE_JOIN_LEAVE_NOTIFICATIONS?: boolean;
    HIDE_INVITE_MORE_HEADER?: boolean;
    MOBILE_APP_PROMO?: boolean;
    SHOW_CHROME_EXTENSION_BANNER?: boolean;
    FILM_STRIP_MAX_HEIGHT?: number;
  };
  lang?: string;
}

interface JitsiMeetAPI {
  dispose: () => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  isAudioMuted: () => Promise<boolean>;
  isVideoMuted: () => Promise<boolean>;
  getNumberOfParticipants: () => number;
  addListener: (event: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
}

interface VideoCallProps {
  channelName: string;
  callId: string;
  callType: "video" | "audio";
  onEnd: () => void;
}

// Helper to wait for Jitsi API to load
function waitForJitsiAPI(maxWait = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (window.JitsiMeetExternalAPI) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > maxWait) {
        clearInterval(checkInterval);
        reject(new Error("Jitsi API не загрузился. Попробуйте обновить страницу."));
      }
    }, 100);
  });
}

export function VideoCall({ channelName, callId, callType, onEnd }: VideoCallProps) {
  const [jitsiApi, setJitsiApi] = useState<JitsiMeetAPI | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(callType === "audio");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [participantCount, setParticipantCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const endCall = useEndCall();
  const apiRef = useRef<JitsiMeetAPI | null>(null);

  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  const callIdRef = useRef(callId);
  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  const handleEndCall = useCallback(async () => {
    if (apiRef.current) {
      apiRef.current.dispose();
      apiRef.current = null;
    }
    try {
      await endCall.mutateAsync(callIdRef.current);
    } catch (e) {
      console.error("Error ending call:", e);
    }
    onEndRef.current();
  }, [endCall]);

  useEffect(() => {
    let mounted = true;
    let api: JitsiMeetAPI | null = null;

    const initJitsi = async () => {
      if (!containerRef.current) return;

      try {
        setIsConnecting(true);
        setError(null);

        console.log("Waiting for Jitsi API...");
        await waitForJitsiAPI();
        console.log("Jitsi API loaded");

        if (!mounted || !containerRef.current) return;

        const domain = "meet.jit.si";
        const roomName = `renowell_${channelName.replace(/[^a-zA-Z0-9]/g, "_")}`;
        
        console.log("Creating Jitsi conference:", roomName);
        
        const options: JitsiMeetOptions = {
          roomName,
          width: "100%",
          height: "100%",
          parentNode: containerRef.current,
          userInfo: {
            displayName: "Участник",
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: callType === "audio",
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            enableClosePage: false,
            hideConferenceSubject: true,
            hideConferenceTimer: false,
            enableLobby: false,
            disableInviteFunctions: true,
            enableNoisyMicDetection: false,
            remoteVideoMenu: {
              disableKick: true,
            },
            // Show toolbar inside Jitsi iframe
            toolbarButtons: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'settings',
              'videoquality',
              'tileview',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            HIDE_INVITE_MORE_HEADER: true,
            MOBILE_APP_PROMO: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
          },
          lang: "ru",
        };

        api = new window.JitsiMeetExternalAPI(domain, options);
        apiRef.current = api;
        
        if (mounted) {
          setJitsiApi(api);
        }

        api.addListener("videoConferenceJoined", () => {
          console.log("Joined Jitsi conference");
          if (mounted) {
            setIsConnecting(false);
            setParticipantCount(api?.getNumberOfParticipants() || 1);
          }
        });

        api.addListener("participantJoined", () => {
          if (mounted && api) {
            setParticipantCount(api.getNumberOfParticipants());
          }
        });

        api.addListener("participantLeft", () => {
          if (mounted && api) {
            setParticipantCount(api.getNumberOfParticipants());
          }
        });

        api.addListener("audioMuteStatusChanged", (data: unknown) => {
          const { muted } = data as { muted: boolean };
          if (mounted) setIsAudioMuted(muted);
        });

        api.addListener("videoMuteStatusChanged", (data: unknown) => {
          const { muted } = data as { muted: boolean };
          if (mounted) setIsVideoMuted(muted);
        });

        api.addListener("screenSharingStatusChanged", (data: unknown) => {
          const { on } = data as { on: boolean };
          if (mounted) setIsScreenSharing(on);
        });

        // If Jitsi decides to close itself (e.g. network / iframe issues), do NOT end the call in backend
        // to avoid UI restart loops. Just close the UI.
        api.addListener("readyToClose", () => {
          console.log("Jitsi readyToClose event");
          if (mounted) {
            api?.dispose();
            apiRef.current = null;
            setJitsiApi(null);
            setIsConnecting(false);
            setError("Соединение Jitsi было закрыто. Попробуйте открыть звонок ещё раз.");
            onEndRef.current();
          }
        });

        api.addListener("videoConferenceLeft", () => {
          console.log("Left Jitsi conference");
          if (mounted) {
            api?.dispose();
            apiRef.current = null;
            setJitsiApi(null);
            setIsConnecting(false);
            onEndRef.current();
          }
        });

      } catch (err) {
        console.error("Jitsi init error:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Ошибка подключения к видеозвонку");
          setIsConnecting(false);
        }
      }
    };

    initJitsi();

    return () => {
      mounted = false;
      if (api) {
        console.log("Disposing Jitsi API");
        api.dispose();
      }
    };
  }, [channelName, callType]);

  const toggleAudio = () => {
    jitsiApi?.executeCommand("toggleAudio");
  };

  const toggleVideo = () => {
    jitsiApi?.executeCommand("toggleVideo");
  };

  const toggleScreenShare = () => {
    jitsiApi?.executeCommand("toggleShareScreen");
  };

  const panelClasses = isFullscreen
    ? "fixed inset-0 z-[100]"
    : "fixed bottom-24 right-4 md:right-6 z-[100] w-[500px] h-[600px] rounded-2xl overflow-hidden";

  return (
    <div className={`${panelClasses} bg-gray-900 shadow-2xl flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800/80">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {isConnecting ? "Подключение..." : `${participantCount} участников`}
          </span>
          {isScreenSharing && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              Экран
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={handleEndCall}
            className="p-1.5 rounded-lg bg-red-500 hover:bg-red-600 transition-colors"
            title="Завершить звонок"
          >
            <PhoneOff className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative bg-gray-900">
        <div ref={containerRef} className="absolute inset-0" />
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
              <p className="text-sm">Подключение к звонку...</p>
              <p className="text-xs text-gray-400 mt-1">Разрешите доступ к камере и микрофону</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-3 bg-red-500/20 text-red-400 text-center text-sm">
          {error}
          <button 
            onClick={() => window.location.reload()} 
            className="ml-2 underline hover:no-underline"
          >
            Обновить страницу
          </button>
        </div>
      )}

      {/* Mini controls bar - supplementary to Jitsi's own controls */}
      <div className="flex items-center justify-center gap-2 p-2 bg-gray-800/80">
        <button
          onClick={toggleAudio}
          className={`p-2 rounded-full transition-colors ${
            isAudioMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
          title={isAudioMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {isAudioMuted ? (
            <MicOff className="w-4 h-4 text-white" />
          ) : (
            <Mic className="w-4 h-4 text-white" />
          )}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-2 rounded-full transition-colors ${
            isVideoMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
          title={isVideoMuted ? "Включить камеру" : "Выключить камеру"}
        >
          {isVideoMuted ? (
            <VideoOff className="w-4 h-4 text-white" />
          ) : (
            <Video className="w-4 h-4 text-white" />
          )}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-2 rounded-full transition-colors ${
            isScreenSharing ? "bg-green-500 hover:bg-green-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
          title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-4 h-4 text-white" />
          ) : (
            <Monitor className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
