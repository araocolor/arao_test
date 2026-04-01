import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  email: string;
  role?: 'user' | 'admin';
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  imageUrl: string;
  caption: string;
  likesCount: number;
  commentsCount: number;
  createdAt: Timestamp;
}

export interface Like {
  userId: string;
  postId: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  parentId: string | null;
  createdAt: Timestamp;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  type: 'like' | 'comment';
  postId: string;
  read: boolean;
  createdAt: Timestamp;
}
