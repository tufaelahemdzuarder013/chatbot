import React, { useState, useRef, useEffect } from "react";
import { Mic, Image as ImageIcon, Send, X, Square, Loader2, Smile } from "lucide-react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥", "😊", "😍"];

export function ChatInput({ 
  onSend,
  onTypingChange
}: { 
  onSend: (text?: string, imageUrl?: string, audioUrl?: string) => Promise<void>;
  onTypingChange?: (isTyping: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ url: string, file: File } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      if (image?.url) URL.revokeObjectURL(image.url);
      if (audioUrl && !audioUrl.startsWith('data:')) URL.revokeObjectURL(audioUrl);
    };
  }, [image, audioUrl]);

  useEffect(() => {
    if (text) {
      onTypingChange?.(true);
      const timeoutId = setTimeout(() => {
        onTypingChange?.(false);
      }, 3000);
      return () => clearTimeout(timeoutId);
    } else {
      onTypingChange?.(false);
    }
  }, [text, onTypingChange]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Create preview
    const url = URL.createObjectURL(file);
    setImage({ url, file });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const url = URL.createObjectURL(file);
          setImage({ url, file });
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const convertBlobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          width = MAX_WIDTH;
          height = img.height * scaleSize;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to highly compressed JPEG to fit in Firestore 1MB limit
        resolve(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !image && !audioUrl) return;
    
    setIsSending(true);
    try {
      let finalImageUrl = undefined;
      let finalAudioUrl = undefined;

      if (image) {
        finalImageUrl = await resizeImage(image.file);
      }

      if (audioUrl) {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        finalAudioUrl = await convertBlobToBase64(blob);
      }

      await onSend(text.trim() || undefined, finalImageUrl, finalAudioUrl);
      
      // Reset
      setText("");
      if (image) {
        URL.revokeObjectURL(image.url);
        setImage(null);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      alert("Failed to send message. Image or audio might be too large.");
    } finally {
      setIsSending(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmojis(false);
  };

  return (
    <div className="relative">
      {/* Emoji Picker Popover */}
      {showEmojis && (
        <div className="absolute bottom-full left-0 mb-2 bg-white/10 backdrop-blur-2xl border border-white/20 p-3 rounded-2xl shadow-2xl flex flex-wrap gap-2 w-64 z-50">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => addEmoji(emoji)}
              className="w-10 h-10 text-2xl hover:bg-white/10 rounded-xl transition-colors flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-400/50 focus-within:border-transparent transition-all">
        {/* Previews */}
        {(image || audioUrl) && (
          <div className="flex flex-wrap gap-2 px-2 pt-2 w-full">
            {image && (
              <div className="relative group">
                <img src={image.url} alt="Preview" className="h-16 w-16 object-cover rounded-lg border border-white/20" />
                <button 
                  type="button"
                  onClick={() => { URL.revokeObjectURL(image.url); setImage(null); }}
                  className="absolute -top-2 -right-2 bg-white/20 backdrop-blur-md text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity border border-white/20"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {audioUrl && (
              <div className="relative flex items-center bg-white/5 backdrop-blur-md rounded-lg pr-8 p-1 border border-white/20">
                <audio src={audioUrl} controls className="h-10 w-48 invert filter opacity-80" />
                <button 
                  type="button"
                  onClick={() => { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }}
                  className="absolute right-2 text-white/60 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors shrink-0"
            disabled={isSending || isRecording}
          >
            <Smile size={22} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors shrink-0"
            disabled={isSending || isRecording}
          >
            <ImageIcon size={22} />
          </button>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageSelect}
          />

          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-red-500/20 text-red-400 rounded-xl px-4 py-3 min-h-[48px] animate-pulse border border-red-500/30">
              <div className="flex items-center gap-2 font-medium text-sm">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                Recording...
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Square size={20} className="fill-red-400" />
              </button>
            </div>
          ) : (
            <div className="flex-1 relative">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Write a message..."
                className="w-full bg-transparent border-none px-2 py-3 min-h-[48px] text-white placeholder-white/30 focus:outline-none resize-none text-sm md:text-base"
                disabled={isSending}
              />
            </div>
          )}

          {!text.trim() && !image && !audioUrl && !isRecording ? (
            <button
              type="button"
              onMouseDown={startRecording}
              className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/60 transition-colors shrink-0"
              disabled={isSending}
            >
              <Mic size={22} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSending || isRecording || (!text.trim() && !image && !audioUrl)}
              className="w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-400 flex items-center justify-center text-white transition-all transform active:scale-95 disabled:opacity-50 disabled:hover:bg-blue-500 shrink-0"
            >
              {isSending ? <Loader2 size={22} className="animate-spin" /> : <Send size={20} />}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
