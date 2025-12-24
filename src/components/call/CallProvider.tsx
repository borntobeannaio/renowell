import { createContext, useContext, useState, ReactNode } from "react";
import { useActiveCall } from "@/hooks/useCalls";
import { VideoCall } from "./VideoCall";
import { IncomingCall } from "./IncomingCall";

interface CallContextType {
  startCall: (params: {
    conversationId?: string;
    participantIds: string[];
    callType: "video" | "audio";
  }) => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within CallProvider");
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const { incomingCall, activeCall, currentProfile } = useActiveCall();
  const [showCallUI, setShowCallUI] = useState(false);
  const [callParams, setCallParams] = useState<{
    channelName: string;
    callId: string;
    callType: "video" | "audio";
  } | null>(null);

  const startCall = async (params: {
    conversationId?: string;
    participantIds: string[];
    callType: "video" | "audio";
  }) => {
    // This will be triggered from the chat component
    // The actual call creation is handled by useCreateCall hook
  };

  const handleIncomingCallAnswer = () => {
    if (incomingCall) {
      setCallParams({
        channelName: incomingCall.channel_name,
        callId: incomingCall.id,
        callType: (incomingCall.call_type === "audio" ? "audio" : "video") as "video" | "audio",
      });
      setShowCallUI(true);
    }
  };

  const handleCallEnd = () => {
    setShowCallUI(false);
    setCallParams(null);
  };

  // Show active call UI if we have one
  const effectiveCallParams = callParams || (activeCall ? {
    channelName: activeCall.channel_name,
    callId: activeCall.id,
    callType: (activeCall.call_type === "audio" ? "audio" : "video") as "video" | "audio",
  } : null);

  const typedIncomingCall = incomingCall ? {
    ...incomingCall,
    call_type: (incomingCall.call_type === "audio" ? "audio" : "video") as "video" | "audio",
  } : null;

  return (
    <CallContext.Provider value={{ startCall }}>
      {children}
      
      {/* Incoming call overlay */}
      {typedIncomingCall && !showCallUI && (
        <IncomingCall
          call={typedIncomingCall}
          onAnswer={handleIncomingCallAnswer}
          onDecline={() => {}}
        />
      )}

      {/* Active call UI */}
      {effectiveCallParams && (showCallUI || activeCall) && (
        <VideoCall
          channelName={effectiveCallParams.channelName}
          callId={effectiveCallParams.callId}
          callType={effectiveCallParams.callType}
          onEnd={handleCallEnd}
        />
      )}
    </CallContext.Provider>
  );
}
