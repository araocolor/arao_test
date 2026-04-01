import React, { useState, useEffect } from 'react';
import { 
  Instagram, 
  Home, 
  Search, 
  PlusSquare, 
  Heart, 
  User as UserIcon, 
  LogOut, 
  Image as ImageIcon,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  addDoc, 
  updateDoc,
  serverTimestamp 
} from './firebase';
import { UserProfile, Post, Notification } from './types';
import PostCard from './components/PostCard';
import { formatDistanceToNow } from 'date-fns';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPostImage, setNewPostImage] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize logic for mobile preview
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to low-capacity JPEG for database storage
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setNewPostImage(dataUrl);
        setImagePreview(dataUrl);
        setError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, `users/${firebaseUser.uid}`);
        const userDoc = await getDoc(userDocRef);
        
        const userData: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || 'Anonymous',
          photoURL: firebaseUser.photoURL,
          email: firebaseUser.email || '',
          role: userDoc.exists() ? userDoc.data().role : 'user'
        };

        if (!userDoc.exists()) {
          await setDoc(userDocRef, userData);
        }
        setUser(userData);
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
      setPosts(fetchedPosts);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'posts');
    });
    
    return () => unsubscribe();
  }, [isAuthReady]);

  useEffect(() => {
    if (!user) return;
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef, 
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(fetchedNotifications);
    });
    
    return () => unsubscribe();
  }, [user]);

  const markNotificationsAsRead = async () => {
    if (!user || notifications.length === 0) return;
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    try {
      await Promise.all(unreadNotifications.map(n => 
        updateDoc(doc(db, `notifications/${n.id}`), { read: true })
      ));
    } catch (err) {
      console.error("Error marking notifications as read:", err);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error:", err);
      setError("로그인에 실패했습니다.");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPostImage.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const postsRef = collection(db, 'posts');
    const newPostRef = doc(postsRef);

    const postData = {
      id: newPostRef.id,
      authorId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      imageUrl: newPostImage.trim(),
      caption: newPostCaption.trim(),
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(newPostRef, postData);
      setShowCreateModal(false);
      setNewPostImage('');
      setImagePreview(null);
      setNewPostCaption('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 h-16 flex items-center px-4 md:px-8">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Instagram size={28} className="text-gray-900" />
            <span className="text-xl font-bold tracking-tight hidden sm:block">InstaClone</span>
          </div>

          {/* Search Bar (Desktop) */}
          <div className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-1.5 w-64 border border-transparent focus-within:border-gray-300 transition-all">
            <Search size={18} className="text-gray-400 mr-2" />
            <input 
              type="text" 
              placeholder="검색" 
              className="bg-transparent outline-none text-sm w-full"
            />
          </div>

          {/* Icons */}
          <div className="flex items-center space-x-4 md:space-x-6">
            <button className="text-gray-900 hover:scale-110 transition-transform"><Home size={26} /></button>
            <button 
              onClick={() => user ? setShowCreateModal(true) : handleLogin()}
              className="text-gray-900 hover:scale-110 transition-transform"
            >
              <PlusSquare size={26} />
            </button>
            
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markNotificationsAsRead();
                }}
                className="text-gray-900 hover:scale-110 transition-transform relative"
              >
                <Heart size={26} />
                {notifications.some(n => !n.read) && (
                  <span className="absolute -top-1 -right-1 bg-red-500 w-2 h-2 rounded-full border border-white" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowNotifications(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-100 font-semibold text-sm">알림</div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm">알림이 없습니다.</div>
                        ) : (
                          notifications.map(notification => (
                            <div 
                              key={notification.id} 
                              className={`p-4 flex items-start space-x-3 hover:bg-gray-50 transition-colors ${!notification.read ? 'bg-blue-50/30' : ''}`}
                            >
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                                {notification.senderPhoto ? (
                                  <img src={notification.senderPhoto} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <UserIcon size={20} className="m-auto mt-2 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-900">
                                  <span className="font-semibold">{notification.senderName}</span>님이 
                                  {notification.type === 'like' ? ' 회원님의 게시물을 좋아합니다.' : ' 회원님의 게시물에 댓글을 남겼습니다.'}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                  {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={20} className="text-gray-400" />
                  )}
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-500 transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={22} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm"
              >
                로그인
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 pb-20 md:pb-8 px-4 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Feed */}
        <div className="lg:col-span-2 space-y-6">
          {posts.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                <ImageIcon size={32} className="text-gray-300" />
              </div>
              <h2 className="text-xl font-semibold">아직 게시물이 없습니다.</h2>
              <p className="text-gray-500 text-sm">첫 번째 게시물을 올려보세요!</p>
              <button 
                onClick={() => user ? setShowCreateModal(true) : handleLogin()}
                className="text-blue-500 font-semibold hover:underline"
              >
                게시물 올리기
              </button>
            </div>
          ) : (
            posts.map(post => (
              <PostCard key={post.id} post={post} user={user} />
            ))
          )}
        </div>

        {/* Sidebar (Desktop Only) */}
        <aside className="hidden lg:block space-y-6 sticky top-24 h-fit">
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-full overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={32} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-sm">{user.displayName}</div>
                  <div className="text-gray-500 text-xs">{user.email}</div>
                </div>
              </div>
              <button className="text-blue-500 text-xs font-semibold hover:text-blue-700">전환</button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold text-sm">회원님을 위한 추천</span>
              <button className="text-gray-900 text-xs font-semibold">모두 보기</button>
            </div>
            
            {/* Mock Suggestions */}
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <UserIcon size={16} className="text-gray-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs">user_suggestion_{i}</div>
                    <div className="text-gray-500 text-[10px]">Instagram 신규 가입</div>
                  </div>
                </div>
                <button className="text-blue-500 text-xs font-semibold hover:text-blue-700">팔로우</button>
              </div>
            ))}
          </div>

          <footer className="text-[10px] text-gray-400 space-y-4">
            <div className="flex flex-wrap gap-x-2">
              <span>소개</span><span>도움말</span><span>홍보 센터</span><span>API</span><span>채용 정보</span><span>개인정보처리방침</span><span>약관</span><span>위치</span><span>언어</span><span>Meta Verified</span>
            </div>
            <div>© 2026 INSTACLONE FROM META</div>
          </footer>
        </aside>
      </main>

      {/* Create Post Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-black"><X size={24} /></button>
                <h3 className="font-semibold">새 게시물 만들기</h3>
                <button 
                  form="create-post-form"
                  type="submit"
                  disabled={isSubmitting || !newPostImage.trim()}
                  className="text-blue-500 font-semibold disabled:opacity-50 hover:text-blue-700"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : '공유하기'}
                </button>
              </div>

              <form id="create-post-form" onSubmit={handleCreatePost} className="p-6 space-y-6">
                {error && (
                  <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm flex items-center">
                    <AlertCircle size={18} className="mr-2" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">이미지 업로드</label>
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer relative min-h-[200px]">
                    {imagePreview ? (
                      <div className="relative w-full aspect-square">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setImagePreview(null);
                            setNewPostImage('');
                          }}
                          className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-2 text-gray-400">
                        <ImageIcon size={48} />
                        <span className="text-sm">클릭하여 사진 선택</span>
                        <span className="text-[10px] uppercase tracking-widest">모바일 최적화 자동 리사이징</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">문구 입력</label>
                  <textarea 
                    value={newPostCaption}
                    onChange={(e) => setNewPostCaption(e.target.value)}
                    placeholder="문구 입력..."
                    rows={4}
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all text-sm resize-none"
                  />
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden h-14 flex items-center justify-around z-50">
        <button className="text-gray-900"><Home size={26} /></button>
        <button className="text-gray-900"><Search size={26} /></button>
        <button 
          onClick={() => user ? setShowCreateModal(true) : handleLogin()}
          className="text-gray-900"
        >
          <PlusSquare size={26} />
        </button>
        <button className="text-gray-900"><Heart size={26} /></button>
        <button className="text-gray-900">
          <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden border border-gray-300">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={18} className="m-auto mt-1 text-gray-400" />
            )}
          </div>
        </button>
      </nav>
    </div>
  );
}
