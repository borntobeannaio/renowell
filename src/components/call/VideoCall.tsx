import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";
import { useEndCall } from "@/hooks/useCalls";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Maximize2,
  Minimize2,
  Users,
} from "lucide-react";

interface VideoCallProps {
  channelName: string;
  callId: string;
  callType: "video" | "audio";
  onEnd: () => void;
}

export function VideoCall({ channelName, callId, callType, onEnd }: VideoCallProps) {
  const [client, setClient] = useState<IAgoraRTCClient | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(callType === "audio");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const endCall = useEndCall();

  const handleUserJoined = useCallback((user: IAgoraRTCRemoteUser) => {
    console.log("User joined:", user.uid);
    setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
  }, []);

  const handleUserLeft = useCallback((user: IAgoraRTCRemoteUser) => {
    console.log("User left:", user.uid);
    setRemoteUsers((prev) => prev.filter((u) => u.uid !== user.uid));
  }, []);

  const handleUserPublished = useCallback(
    async (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
      if (!client) return;
      
      await client.subscribe(user, mediaType);
      console.log("Subscribed to", user.uid, mediaType);

      if (mediaType === "video") {
        setRemoteUsers((prev) => [...prev.filter((u) => u.uid !== user.uid), user]);
      }
      if (mediaType === "audio") {
        user.audioTrack?.play();
      }
    },
    [client]
  );

  const handleUserUnpublished = useCallback(
    (user: IAgoraRTCRemoteUser, mediaType: "video" | "audio") => {
      console.log("User unpublished:", user.uid, mediaType);
      if (mediaType === "video") {
        setRemoteUsers((prev) => [...prev]);
      }
    },
    []
  );

  useEffect(() => {
    const initAgora = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        // Get Agora credentials
        const { data, error: fnError } = await supabase.functions.invoke("agora-token", {
          body: { channelName, uid: 0 },
        });

        if (fnError) throw fnError;
        if (!data?.appId) throw new Error("Failed to get Agora credentials");

        // Create client
        const agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
        setClient(agoraClient);

        // Set up event handlers
        agoraClient.on("user-joined", handleUserJoined);
        agoraClient.on("user-left", handleUserLeft);
        agoraClient.on("user-published", handleUserPublished);
        agoraClient.on("user-unpublished", handleUserUnpublished);

        // Join channel
        await agoraClient.join(data.appId, channelName, data.token, null);
        console.log("Joined channel:", channelName);

        // Create and publish local tracks
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(audioTrack);

        if (callType === "video") {
          const videoTrack = await AgoraRTC.createCameraVideoTrack();
          setLocalVideoTrack(videoTrack);
          await agoraClient.publish([audioTrack, videoTrack]);
        } else {
          await agoraClient.publish([audioTrack]);
        }

        setIsConnecting(false);
      } catch (err) {
        console.error("Agora init error:", err);
        setError(err instanceof Error ? err.message : "Failed to connect");
        setIsConnecting(false);
      }
    };

    initAgora();

    return () => {
      localAudioTrack?.close();
      localVideoTrack?.close();
      client?.leave();
    };
  }, [channelName, callType]);

  // Play local video
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && !isVideoMuted) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack, isVideoMuted]);

  const toggleAudio = async () => {
    if (localAudioTrack) {
      await localAudioTrack.setEnabled(!isAudioMuted);
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrack) {
      await localVideoTrack.setEnabled(isVideoMuted);
      setIsVideoMuted(!isVideoMuted);
    } else if (isVideoMuted && client) {
      // Create video track if switching to video
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      setLocalVideoTrack(videoTrack);
      await client.publish([videoTrack]);
      setIsVideoMuted(false);
    }
  };

  const handleEndCall = async () => {
    localAudioTrack?.close();
    localVideoTrack?.close();
    await client?.leave();
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
            {isConnecting ? "Подключение..." : `${remoteUsers.length + 1} участников`}
          </span>
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
        >
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Video grid */}
      <div className="flex-1 p-2 grid gap-2" style={{
        gridTemplateColumns: remoteUsers.length === 0 ? "1fr" : remoteUsers.length === 1 ? "1fr 1fr" : "repeat(2, 1fr)",
        gridTemplateRows: remoteUsers.length <= 2 ? "1fr" : "repeat(2, 1fr)",
      }}>
        {/* Local video */}
        <div className="relative bg-gray-800 rounded-lg overflow-hidden">
          {callType === "video" && !isVideoMuted ? (
            <div ref={localVideoRef} className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center">
                <span className="text-2xl font-bold text-white">Вы</span>
              </div>
            </div>
          )}
          <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
            Вы {isAudioMuted && "(микрофон выкл)"}
          </div>
        </div>

        {/* Remote users */}
        {remoteUsers.map((user) => (
          <RemoteUser key={user.uid} user={user} />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/20 text-red-400 text-center text-sm">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 p-4 bg-gray-800/50">
        <button
          onClick={toggleAudio}
          className={`p-4 rounded-full transition-colors ${
            isAudioMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
          }`}
        >
          {isAudioMuted ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </button>

        {callType === "video" && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-600 hover:bg-gray-500"
            }`}
          >
            {isVideoMuted ? (
              <VideoOff className="w-6 h-6 text-white" />
            ) : (
              <Video className="w-6 h-6 text-white" />
            )}
          </button>
        )}

        <button
          onClick={handleEndCall}
          className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}

function RemoteUser({ user }: { user: IAgoraRTCRemoteUser }) {
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user.videoTrack && videoRef.current) {
      user.videoTrack.play(videoRef.current);
    }
  }, [user.videoTrack]);

  return (
    <div className="relative bg-gray-800 rounded-lg overflow-hidden">
      {user.videoTrack ? (
        <div ref={videoRef} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center">
            <span className="text-2xl font-bold text-white">{String(user.uid).charAt(0)}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
        Участник {user.uid}
      </div>
    </div>
  );
}
