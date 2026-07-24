import React, { useState } from "react";
import { Message } from "../types";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { Smile } from "lucide-react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const ChatMessage: React.FC<{ 
  message: Message; 
  isMe: boolean; 
  onReact: (emoji: string) => void | Promise<void>;
  currentUserId: string;
}> = ({ 
  message, 
  isMe, 
  onReact,
  currentUserId 
}) => {
  const [showReactors, setShowReactors] = useState(false);

  const reactionCounts = Object.entries(message.reactions || {}).reduce((acc, [userId, emojiValue]) => {
    const emoji = emojiValue as string;
    if (!acc[emoji]) acc[emoji] = { count: 0, includesMe: false };
    acc[emoji].count++;
    if (userId === currentUserId) acc[emoji].includesMe = true;
    return acc;
  }, {} as Record<string, { count: number, includesMe: boolean }>);

  return (
    <div className={cn("flex w-full gap-3 group", isMe ? "justify-end" : "justify-start")}>
      {!isMe && (
        <img 
          src={message.senderPhoto} 
          alt={message.senderName} 
          className="w-8 h-8 rounded-full self-end border border-white/20 shrink-0 object-cover"
        />
      )}
      
      <div className={cn("flex flex-col max-w-[85%] md:max-w-[70%]", isMe ? "items-end" : "items-start")}>
        {!isMe && <span className="text-xs text-white/60 mb-1 ml-1 font-medium">{message.senderName}</span>}
        
        <div className="relative flex items-center gap-2">
          {/* Reaction trigger (visible on hover for non-mobile) */}
          {isMe && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-full mr-2 z-10 hidden md:flex">
              <ReactionMenu onReact={onReact} />
            </div>
          )}

          <div className={cn(
            "relative px-4 py-2.5 text-sm md:text-base break-words shadow-sm",
            isMe 
              ? "bg-blue-600/30 border border-blue-400/30 text-white rounded-2xl rounded-br-none" 
              : "bg-white/10 border border-white/10 text-white rounded-2xl rounded-bl-none"
          )}>
            {message.imageUrl && (
              <div className="bg-white/5 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden mb-2">
                <img 
                  src={message.imageUrl} 
                  alt="Uploaded" 
                  className="max-w-full object-contain"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            )}
            
            {message.audioUrl && (
              <audio controls src={message.audioUrl} className="w-full max-w-[240px] md:max-w-[300px] h-10 mb-2 filter invert opacity-80" />
            )}
            
            {message.text && (
              <div className="whitespace-pre-wrap">{message.text}</div>
            )}
            
            <div className={cn(
              "text-[10px] mt-1 select-none",
              isMe ? "text-white/60 text-right" : "text-white/40"
            )}>
              {format(message.createdAt, "h:mm a")}
            </div>
          </div>
          
          {/* Reaction trigger for other's messages */}
          {!isMe && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-full ml-2 z-10 hidden md:flex">
              <ReactionMenu onReact={onReact} />
            </div>
          )}
        </div>

        {/* Reaction Display */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1 z-10", isMe ? "justify-end mr-1" : "justify-start ml-1")}>
            {Object.entries(reactionCounts).map(([emoji, data]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shadow-sm transition-transform hover:scale-110 backdrop-blur-md",
                  data.includesMe ? "border-blue-400/50 bg-blue-500/20 text-white" : "border-white/20 bg-white/10 text-white/80"
                )}
              >
                <span>{emoji}</span>
                {data.count > 1 && <span className="font-medium text-white/60">{data.count}</span>}
              </button>
            ))}
          </div>
        )}
        
        {/* Mobile Reaction Trigger (always visible on mobile under the message) */}
        <div className="md:hidden mt-1 text-white/40">
           <button onClick={() => setShowReactors(!showReactors)} className="p-1 hover:text-white/60">
             <Smile size={16} />
           </button>
           {showReactors && (
             <div className={cn("mt-1 flex gap-1", isMe ? "justify-end" : "justify-start")}>
               <ReactionMenu onReact={(e) => { onReact(e); setShowReactors(false); }} />
             </div>
           )}
        </div>

      </div>
    </div>
  );
}

function ReactionMenu({ onReact }: { onReact: (emoji: string) => void }) {
  return (
    <div className="flex items-center bg-white/20 backdrop-blur-xl border border-white/20 shadow-xl rounded-full px-2 py-1 gap-1">
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className="hover:scale-125 hover:bg-white/20 p-1 rounded-full transition-transform text-lg"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
