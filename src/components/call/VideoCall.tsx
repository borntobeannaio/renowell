import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!containerRef.current || !window.JitsiMeetExternalAPI) {
      if (!window.JitsiMeetExternalAPI) {
        setError("Jitsi API не загружен");
        setIsConnecting(false);
      }
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      const domain = "meet.jit.si";
      const options: JitsiMeetOptions = {
        roomName: `renowell_${channelName}`,
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
          hideConferenceTimer: true,
          enableLobby: false,
          disableInviteFunctions: true,
          enableNoisyMicDetection: false,
          remoteVideoMenu: {
            disableKick: true,
          },
          toolbarButtons: [],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          TOOLBAR_BUTTONS: [],
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          HIDE_INVITE_MORE_HEADER: true,
          MOBILE_APP_PROMO: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          FILM_STRIP_MAX_HEIGHT: 0,
        },
        lang: "ru",
      };

      const api = new window.JitsiMeetExternalAPI(domain, options);
      setJitsiApi(api);

      api.addListener("videoConferenceJoined", () => {
        console.log("Joined Jitsi conference");
        setIsConnecting(false);
        setParticipantCount(api.getNumberOfParticipants());
      });

      api.addListener("participantJoined", () => {
        setParticipantCount(api.getNumberOfParticipants());
      });

      api.addListener("participantLeft", () => {
        setParticipantCount(api.getNumberOfParticipants());
      });

      api.addListener("audioMuteStatusChanged", (data: { muted: boolean }) => {
        setIsAudioMuted(data.muted);
      });

      api.addListener("videoMuteStatusChanged", (data: { muted: boolean }) => {
        setIsVideoMuted(data.muted);
      });

      api.addListener("screenSharingStatusChanged", (data: { on: boolean }) => {
        setIsScreenSharing(data.on);
      });

      api.addListener("readyToClose", () => {
        handleEndCall();
      });

      return () => {
        api.dispose();
      };
    } catch (err) {
      console.error("Jitsi init error:", err);
      setError(err instanceof Error ? err.message : "Ошибка подключения");
      setIsConnecting(false);
    }
  }, [channelName, callType]);

  const toggleAudio = () => {
    if (jitsiApi) {
      jitsiApi.executeCommand("toggleAudio");
    }
  };

  const toggleVideo = () => {
    if (jitsiApi) {
      jitsiApi.executeCommand("toggleVideo");
    }
  };

  const toggleScreenShare = () => {
    if (jitsiApi) {
      jitsiApi.executeCommand("toggleShareScreen");
    }
  };

  const handleEndCall = async () => {
    jitsiApi?.dispose();
    await endCall.mutateAsync(callId);
    onEnd();
  };

  const panelClasses = isFullscreen
    ? "fixed inset-0 z-[100]"
    : "fixed bottom-24 right-4 md:right-6 z-[100] w-[400px] h-[500px] rounded-2xl overflow-hidden";

  return (
    <div className={`${panelClasses} bg-gray-900 shadow-2xl flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/50">
        <div className="flex items-center gap-2 text-white">
          <Users className="w-5 h-5" />
          <span className="font-medium">
            {isConnecting ? "Подключение..." : `${participantCount} участников`}
          </span>
          {isScreenSharing && (
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
              Демонстрация экрана
            </span>
          )}
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Jitsi container */}
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
              <p>Подключение к звонку...</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/20 text-red-400 text-center text-sm">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 p-4 bg-gray-800/50">
        <button
          onClick={toggleAudio}
          className={`p-3 rounded-full transition-colors ${
            isAudioMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
          title={isAudioMuted ? "Включить микрофон" : "Выключить микрофон"}
        >
          {isAudioMuted ? (
            <MicOff className="w-5 h-5 text-white" />
          ) : (
            <Mic className="w-5 h-5 text-white" />
          )}
        </button>

        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              isVideoMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
            }`}
            title={isVideoMuted ? "Включить камеру" : "Выключить камеру"}
          >
            {isVideoMuted ? (
              <VideoOff className="w-5 h-5 text-white" />
            ) : (
              <Video className="w-5 h-5 text-white" />
            )}
          </button>
        )}

        {/* Screen share button */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full transition-colors ${
            isScreenSharing ? "bg-green-500 hover:bg-green-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
          title={isScreenSharing ? "Остановить демонстрацию" : "Демонстрация экрана"}
        >
          {isScreenSharing ? (
            <MonitorOff className="w-5 h-5 text-white" />
          ) : (
            <Monitor className="w-5 h-5 text-white" />
          )}
        </button>

        <button
          onClick={handleEndCall}
          className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
          title="Завершить звонок"
        >
          <PhoneOff className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
