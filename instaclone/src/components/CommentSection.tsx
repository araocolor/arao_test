import React, { useState, useEffect } from 'react';
import { Send, User, CornerDownRight, Heart } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Comment, UserProfile } from '../types';
import { db, collection, doc, setDoc, query, where, orderBy, onSnapshot, serverTimestamp, increment, updateDoc } from '../firebase';

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  user: UserProfile | null;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, postAuthorId, user }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(fetchedComments);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    const commentsRef = collection(db, `posts/${postId}/comments`);
    const newCommentRef = doc(commentsRef);

    const commentData = {
      id: newCommentRef.id,
      postId,
      authorId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      text: newComment.trim(),
      parentId: replyTo ? replyTo.id : null,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(newCommentRef, commentData);
      await updateDoc(doc(db, `posts/${postId}`), { commentsCount: increment(1) });

      // Create notification for the post author or parent comment author
      const recipientId = replyTo ? replyTo.authorId : postAuthorId;
      if (recipientId !== user.uid) {
        const notificationRef = doc(collection(db, 'notifications'));
        await setDoc(notificationRef, {
          id: notificationRef.id,
          recipientId,
          senderId: user.uid,
          senderName: user.displayName,
          senderPhoto: user.photoURL,
          type: 'comment',
          postId,
          read: false,
          createdAt: serverTimestamp()
        });
      }

      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="space-y-4">
      {/* Comment List */}
      <div className="max-h-64 overflow-y-auto space-y-4 pr-2">
        {rootComments.length === 0 ? (
          <p className="text-gray-400 text-xs text-center py-4">첫 번째 댓글을 남겨보세요.</p>
        ) : (
          rootComments.map(comment => (
            <div key={comment.id} className="space-y-3">
              <CommentItem 
                comment={comment} 
                onReply={() => setReplyTo(comment)} 
              />
              {/* Replies */}
              <div className="ml-8 space-y-3 border-l-2 border-gray-100 pl-4">
                {getReplies(comment.id).map(reply => (
                  <CommentItem 
                    key={reply.id} 
                    comment={reply} 
                    isReply 
                    onReply={() => setReplyTo(comment)} 
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      {user ? (
        <form onSubmit={handleSubmit} className="relative">
          {replyTo && (
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded-t-lg border-x border-t border-gray-200 text-xs text-gray-500">
              <span>@{replyTo.authorName}님에게 답글 남기는 중...</span>
              <button 
                type="button" 
                onClick={() => setReplyTo(null)}
                className="text-gray-400 hover:text-black"
              >
                취소
              </button>
            </div>
          )}
          <div className="flex items-center space-x-2 border border-gray-200 rounded-lg p-2 bg-white shadow-sm">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? "답글 달기..." : "댓글 달기..."}
              className="flex-1 text-sm outline-none bg-transparent"
            />
            <button 
              type="submit"
              disabled={!newComment.trim()}
              className="text-blue-500 font-semibold text-sm disabled:opacity-50 hover:text-blue-600 transition-colors"
            >
              게시
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-gray-400 text-center">로그인 후 댓글을 남길 수 있습니다.</p>
      )}
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  onReply: () => void;
  isReply?: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onReply, isReply }) => {
  return (
    <div className="flex items-start space-x-3 group">
      <div className={`flex-shrink-0 rounded-full overflow-hidden bg-gray-100 border border-gray-200 ${isReply ? 'w-6 h-6' : 'w-8 h-8'}`}>
        {comment.authorPhoto ? (
          <img src={comment.authorPhoto} alt={comment.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <User size={isReply ? 14 : 18} className="text-gray-400 m-auto mt-1" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-sm text-gray-900">{comment.authorName}</span>
          <span className="text-sm text-gray-800 break-words">{comment.text}</span>
        </div>
        <div className="flex items-center space-x-3 mt-1 text-[10px] text-gray-500">
          <span>{comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : '방금 전'}</span>
          <button 
            onClick={onReply}
            className="font-semibold hover:text-black transition-colors"
          >
            답글 달기
          </button>
        </div>
      </div>
      <button className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
        <Heart size={12} />
      </button>
    </div>
  );
};

export default CommentSection;
