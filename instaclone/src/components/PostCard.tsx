import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Send, MoreHorizontal, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Post, Comment, UserProfile } from '../types';
import { db, auth, collection, doc, setDoc, deleteDoc, increment, updateDoc, onSnapshot, query, where, orderBy, serverTimestamp } from '../firebase';
import CommentSection from './CommentSection';

interface PostCardProps {
  post: Post;
  user: UserProfile | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, user }) => {
  const [isLiked, setIsLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);

  useEffect(() => {
    if (!user) return;
    const likeDocRef = doc(db, `posts/${post.id}/likes/${user.uid}`);
    const unsubscribe = onSnapshot(likeDocRef, (doc) => {
      setIsLiked(doc.exists());
    });
    return () => unsubscribe();
  }, [post.id, user]);

  useEffect(() => {
    const postRef = doc(db, `posts/${post.id}`);
    const unsubscribe = onSnapshot(postRef, (doc) => {
      if (doc.exists()) {
        setLikesCount(doc.data().likesCount);
      }
    });
    return () => unsubscribe();
  }, [post.id]);

  const handleLike = async () => {
    if (!user) return;
    const likeDocRef = doc(db, `posts/${post.id}/likes/${user.uid}`);
    const postRef = doc(db, `posts/${post.id}`);

    try {
      if (isLiked) {
        await deleteDoc(likeDocRef);
        await updateDoc(postRef, { likesCount: increment(-1) });
      } else {
        await setDoc(likeDocRef, { userId: user.uid, postId: post.id });
        await updateDoc(postRef, { likesCount: increment(1) });

        // Create notification for the post author
        if (post.authorId !== user.uid) {
          const notificationRef = doc(collection(db, 'notifications'));
          await setDoc(notificationRef, {
            id: notificationRef.id,
            recipientId: post.authorId,
            senderId: user.uid,
            senderName: user.displayName,
            senderPhoto: user.photoURL,
            type: 'like',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-lg mb-6 overflow-hidden max-w-xl mx-auto w-full shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200">
            {post.authorPhoto ? (
              <img src={post.authorPhoto} alt={post.authorName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User size={20} className="text-gray-400" />
            )}
          </div>
          <span className="font-semibold text-sm">{post.authorName}</span>
        </div>
        <button className="text-gray-500 hover:text-black">
          <MoreHorizontal size={20} />
        </button>
      </div>

      {/* Image */}
      <div 
        className="relative aspect-square bg-gray-50 flex items-center justify-center overflow-hidden"
        onDoubleClick={handleLike}
      >
        <img 
          src={post.imageUrl} 
          alt="Post content" 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center space-x-4 mb-2">
          <button 
            onClick={handleLike}
            className={`transition-transform active:scale-125 ${isLiked ? 'text-red-500' : 'text-gray-700 hover:text-gray-400'}`}
          >
            <Heart size={24} fill={isLiked ? "currentColor" : "none"} />
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className="text-gray-700 hover:text-gray-400"
          >
            <MessageCircle size={24} />
          </button>
          <button className="text-gray-700 hover:text-gray-400">
            <Send size={24} />
          </button>
        </div>

        {/* Likes */}
        <div className="font-semibold text-sm mb-1">
          좋아요 {likesCount.toLocaleString()}개
        </div>

        {/* Caption */}
        <div className="text-sm mb-2">
          <span className="font-semibold mr-2">{post.authorName}</span>
          {post.caption}
        </div>

        {/* Time */}
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
          {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : '방금 전'}
        </div>

        {/* Comments Toggle */}
        <button 
          onClick={() => setShowComments(!showComments)}
          className="text-gray-500 text-sm hover:underline"
        >
          {showComments ? '댓글 숨기기' : `댓글 ${post.commentsCount}개 모두 보기`}
        </button>

        {/* Comments Section */}
        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 border-t border-gray-100 pt-4"
            >
              <CommentSection postId={post.id} postAuthorId={post.authorId} user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PostCard;
