import { ReactionGroup } from "@/hooks/useChatReactions";

interface MessageReactionsProps {
  reactions: ReactionGroup[];
  onToggle: (emoji: string) => void;
  isOwn: boolean; // whether the message is from the current user
}

export function MessageReactions({ reactions, onToggle, isOwn }: MessageReactionsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(r.emoji);
          }}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors border ${
            r.hasOwn
              ? "bg-primary/15 border-primary/30 hover:bg-primary/25"
              : "bg-secondary/60 border-border hover:bg-secondary"
          }`}
        >
          <span>{r.emoji}</span>
          <span className={`font-medium ${r.hasOwn ? "text-primary" : "text-muted-foreground"}`}>
            {r.count}
          </span>
        </button>
      ))}
    </div>
  );
}
