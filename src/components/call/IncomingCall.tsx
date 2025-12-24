import { Phone, PhoneOff, Video, Mic } from "lucide-react";
import { useAnswerCall, useDeclineCall } from "@/hooks/useCalls";

interface IncomingCallProps {
  call: {
    id: string;
    caller: {
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    };
    call_type: "video" | "audio";
    participantId: string;
  };
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCall({ call, onAnswer, onDecline }: IncomingCallProps) {
  const answerCall = useAnswerCall();
  const declineCall = useDeclineCall();

  const callerName = [call.caller.first_name, call.caller.last_name]
    .filter(Boolean)
    .join(" ") || "Неизвестный";

  const handleAnswer = async () => {
    await answerCall.mutateAsync({
      callId: call.id,
      participantId: call.participantId,
    });
    onAnswer();
  };

  const handleDecline = async () => {
    await declineCall.mutateAsync({
      callId: call.id,
      participantId: call.participantId,
    });
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95">
        {/* Caller info */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
            {call.caller.avatar_url ? (
              <img
                src={call.caller.avatar_url}
                alt={callerName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-primary">
                {callerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-foreground">{callerName}</h2>
          <div className="flex items-center justify-center gap-2 mt-2 text-muted-foreground">
            {call.call_type === "video" ? (
              <Video className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            <span>
              {call.call_type === "video" ? "Видеозвонок" : "Голосовой звонок"}
            </span>
          </div>
        </div>

        {/* Pulsing animation */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-green-500/40 animate-ping animation-delay-150" />
            <div className="relative w-16 h-16 rounded-full bg-green-500/20" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8">
          <button
            onClick={handleDecline}
            disabled={declineCall.isPending}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Отклонить
            </span>
          </button>

          <button
            onClick={handleAnswer}
            disabled={answerCall.isPending}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center transition-colors shadow-lg animate-pulse">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              Ответить
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
