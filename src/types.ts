export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string;
  lastSeen?: number;
}

export interface Message {
  id: string;
  chatId: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  receiverId?: string;
  read?: boolean;
  createdAt: number;
  reactions?: Record<string, string>; // userId -> emoji
}
