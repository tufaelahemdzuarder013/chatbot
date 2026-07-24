import React, { useEffect, useRef, useState, useCallback } from "react";
import { User } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot, addDoc, doc, updateDoc, where, setDoc, serverTimestamp } from "firebase/firestore";
import { db, logout } from "../lib/firebase";
import { Message, ChatUser } from "../types";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { LogOut, Search, User as UserIcon } from "lucide-react";
import { cn } from "../lib/utils";

const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join('_');
};

export function ChatRoom({ user }: { user: User }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch users
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: ChatUser[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== user.uid) {
          fetchedUsers.push(doc.data() as ChatUser);
        }
      });
      setUsers(fetchedUsers);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Fetch messages for selected user
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }
    
    const chatId = getChatId(user.uid, selectedUser.uid);
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      orderBy("createdAt", "asc"),
      limit(100)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(fetchedMessages);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });
    return () => unsubscribe();
  }, [selectedUser, user.uid]);

  // Listen for typing status
  useEffect(() => {
    if (!selectedUser) {
      setIsTyping(false);
      return;
    }
    
    const chatId = getChatId(user.uid, selectedUser.uid);
    const unsubscribe = onSnapshot(doc(db, "typing", selectedUser.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.isTyping && data.chatId === chatId && Date.now() - data.updatedAt < 10000) {
          setIsTyping(true);
        } else {
          setIsTyping(false);
        }
      } else {
        setIsTyping(false);
      }
    });

    return () => unsubscribe();
  }, [selectedUser, user.uid]);

  const handleTyping = useCallback((typing: boolean) => {
    if (!selectedUser) return;
    const chatId = getChatId(user.uid, selectedUser.uid);
    setDoc(doc(db, "typing", user.uid), {
      isTyping: typing,
      chatId,
      updatedAt: Date.now()
    }, { merge: true });
  }, [selectedUser, user.uid]);

  const handleSendMessage = async (text?: string, imageUrl?: string, audioUrl?: string) => {
    if ((!text && !imageUrl && !audioUrl) || !selectedUser) return;
    
    const chatId = getChatId(user.uid, selectedUser.uid);
    
    const messageData: Partial<Message> = {
      chatId,
      senderId: user.uid,
      senderName: user.displayName || "Anonymous",
      senderPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || "User"}`,
      createdAt: Date.now(),
      reactions: {}
    };

    if (text) messageData.text = text;
    if (imageUrl) messageData.imageUrl = imageUrl;
    if (audioUrl) messageData.audioUrl = audioUrl;
    
    await addDoc(collection(db, "messages"), messageData);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    const currentReactions = message.reactions || {};
    const newReactions = { ...currentReactions };
    
    if (newReactions[user.uid] === emoji) {
      delete newReactions[user.uid];
    } else {
      newReactions[user.uid] = emoji;
    }

    await updateDoc(doc(db, "messages", messageId), {
      reactions: newReactions
    });
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] font-sans p-4 md:p-8">
      <div className="w-full h-full max-w-6xl mx-auto bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 flex shadow-2xl overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-80 h-full border-r border-white/10 flex flex-col shrink-0 hidden md:flex">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input 
                type="text" 
                placeholder="Search chats..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-4">
            {filteredUsers.map(u => (
              <div 
                key={u.uid}
                onClick={() => setSelectedUser(u)}
                className={cn(
                  "p-4 rounded-2xl flex items-center gap-4 transition-colors cursor-pointer border",
                  selectedUser?.uid === u.uid 
                    ? "bg-white/20 border-white/30 shadow-lg" 
                    : "hover:bg-white/5 border-transparent"
                )}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-white/10 border border-white/20">
                  {u.photoURL ? (
                    <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/50"><UserIcon /></div>
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className={cn("font-semibold text-sm truncate", selectedUser?.uid === u.uid ? "text-white" : "text-white/80")}>
                      {u.displayName || "Unknown User"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center text-white/40 text-sm py-8">No users found</div>
            )}
          </div>
          
          {/* Current User Profile in Sidebar */}
          <div className="p-4 border-t border-white/10 bg-white/5">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shrink-0">
                    <img src={user.photoURL || ""} alt={user.displayName || ""} className="w-full h-full object-cover" />
                  </div>
                  <div className="truncate">
                    <h1 className="font-medium text-white text-sm truncate">{user.displayName}</h1>
                    <span className="text-green-400 text-[10px] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Online
                    </span>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0"
                  title="Sign out"
                >
                  <LogOut size={18} />
                </button>
             </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 h-full flex flex-col bg-transparent">
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <header className="flex items-center justify-between px-6 py-4 bg-white/5 border-b border-white/10 shrink-0 h-20">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 bg-white/10">
                     {selectedUser.photoURL ? (
                        <img src={selectedUser.photoURL} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50"><UserIcon size={20} /></div>
                      )}
                  </div>
                  <div>
                    <h2 className="font-medium text-white">{selectedUser.displayName}</h2>
                  </div>
                </div>
              </header>

              {/* Message Feed */}
              <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/40">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                      <UserIcon size={32} />
                    </div>
                    <p>Start a conversation with {selectedUser.displayName}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center mb-6">
                      <span className="text-white/20 text-[10px] uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full border border-white/10">
                        Encrypted Conversation
                      </span>
                    </div>
                    {messages.map((msg) => (
                      <ChatMessage 
                        key={msg.id} 
                        message={msg} 
                        isMe={msg.senderId === user.uid} 
                        onReact={(emoji) => handleReaction(msg.id, emoji)}
                        currentUserId={user.uid}
                      />
                    ))}
                    {isTyping && (
                      <div className="flex items-center gap-2 text-white/40 text-sm ml-4 mb-2">
                         <div className="flex gap-1">
                           <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                           <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                           <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                         </div>
                         <span>{selectedUser.displayName} is typing...</span>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </>
                )}
              </main>

              {/* Chat Input */}
              <footer className="shrink-0 p-6 pt-0">
                <ChatInput onSend={handleSendMessage} onTypingChange={handleTyping} />
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/50">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-lg">
                <Search size={32} className="text-white/30" />
              </div>
              <h2 className="text-xl font-medium text-white mb-2">Your Messages</h2>
              <p className="text-sm max-w-xs text-center text-white/40">Select a user from the sidebar to start a conversation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
