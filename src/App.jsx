import React, { useState, useEffect, useRef } from 'react';
import { auth } from './firebaseClient';
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  deleteUser,
} from 'firebase/auth';
import emailjs from '@emailjs/browser';
import { askAiAssistant } from './services/aiService';
import {
  fetchUserConversations,
  subscribeToUserConversations,
  createDirectConversation,
  createGroupConversation,
  addConversationMember,
  removeConversationMember,
  updateConversation,
  fetchMembers as fetchMembersFromFirestore,
  subscribeToMembers,
  markAsRead as markConversationAsRead,
  hideConversationForUser,
  unhideConversationForUser,
  fetchMessages,
  fetchAllMessagesForGallery,
  fetchOlderMessages as fetchOlderMessagesPage,
  subscribeToMessages,
  sendMessage as sendMessageToFirestore,
  updateMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  subscribeToReactions,
  subscribeToConversationReactions,
  fetchReactionsForConversation,
  addReaction,
  removeReaction,
} from './services/chatService';
import {
  fetchProfile,
  ensureProfile,
  updateProfile as updateUserProfile,
  fetchAllOtherUsers,
  sendFriendRequest as sendFriendRequestToFirestore,
  acceptFriendRequest as acceptFriendRequestInFirestore,
  removeFriendship,
  fetchFriendshipDocs,
  fetchIncomingRequests,
  subscribeToIncomingRequests,
} from './services/userService';
import { initPresence, subscribeToAllPresence, setTyping, subscribeToAllTyping } from './services/presenceService';
import { uploadAvatar, uploadGroupAvatar, uploadWallpaper, uploadConversationMedia } from './services/storageService';
import { 
  MessageSquare, Users, UserPlus, Settings, LogOut, Send, 
  Check, Clock, Plus, KeyRound, Sparkles, X, ChevronLeft, 
  MailCheck, Trash2, AlertTriangle, Image as ImageIcon, 
  Mic, Square, Camera, Palette, RotateCcw, MoreVertical, 
  UserCheck, UserX, MessageCircle, Smile, Edit2, CornerUpLeft, 
  CheckCheck, AlertCircle, ChevronDown, Crown, User, UserMinus, 
  Eye, EyeOff, Bot, HelpCircle, Flame, Lock, Archive, ShieldCheck, 
  BarChart2, ExternalLink, Play, Tag, Share2, FileText
} from 'lucide-react';

const EMAILJS_SERVICE_ID = 'service_l1fiok5';
const EMAILJS_TEMPLATE_ID = 'template_lbuqucn';
const EMAILJS_PUBLIC_KEY = '5nZrVHZgApUZf00Z4';

const DEFAULT_5_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];
const EMOJI_PALETTE = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','😉','😌','😍',
  '🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩',
  '🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭',
  '😮‍💨','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🫡',
  '🤔','🫢','🫣','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱',
  '😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈',
  '👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻',
  '😼','😽','🙀','😿','😾','👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌',
  '🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎',
  '✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','❤️',
  '🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓',
  '💗','💖','💘','💝','🔥','✨','🎉','🎊','🚀','💯'
];

const FAVICON_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="28" cy="36" r="15" fill="%230f172a"/><path d="M12 88 C12 62 44 62 44 88 Z" fill="%230f172a"/><circle cx="72" cy="36" r="15" fill="%230f172a"/><path d="M56 88 C56 62 88 62 88 88 Z" fill="%230f172a"/><path d="M38 28 C38 18 64 18 64 28 C64 35 55 37 49 41 L43 45 L45 39 C39 39 38 34 38 28 Z" fill="%230f172a"/><rect x="43" y="24" width="16" height="2.5" rx="1.2" fill="%23ffffff"/><rect x="43" y="29" width="16" height="2.5" rx="1.2" fill="%23ffffff"/></svg>`;
const parseSafeDate = (val) => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
};
// A fresh AudioContext starts life 'suspended' until a user gesture unlocks
// it, and creating a brand new one on every single notification made that
// unlock unreliable. Keeping one shared context (created once, primed on the
// very first user interaction — see the priming effect in App()) makes the
// pop sound play consistently, including while the tab is in the background.
let sharedNotificationAudioCtx = null;
const getSharedNotificationAudioContext = () => {
  if (sharedNotificationAudioCtx) return sharedNotificationAudioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    sharedNotificationAudioCtx = new AudioContextClass();
  } catch {
    sharedNotificationAudioCtx = null;
  }
  return sharedNotificationAudioCtx;
};

const playPopNotificationSound = () => {
  try {
    const ctx = getSharedNotificationAudioContext();
    if (!ctx) return;

    const fireTone = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(fireTone).catch(() => {});
    } else {
      fireTone();
    }
  } catch (err) {}
};

const uploadMediaToFirebaseStorage = async (file, conversationId) => {
  return uploadConversationMedia(conversationId, file);
};

const extractYouTubeId = (text) => {
  if (!text) return null;
  // Added `shorts\/` alongside the existing patterns (watch?v=, youtu.be/,
  // embed/, etc.) — Shorts URLs look like
  // youtube.com/shorts/VIDEO_ID and didn't match any existing branch before,
  // so they never got a thumbnail.
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = text.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const renderMessageTextWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0284c7', textDecoration: 'underline', wordBreak: 'break-all' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Single source of truth for classifying a message's content. Previously
// several places in the app treated ANY message starting with "https://" as
// an uploaded photo — which meant a plain link the user pasted (or even a
// YouTube link, which should get its own preview card) rendered as a broken
// <img> tag instead of a normal clickable link. Real uploaded media always
// carries an explicit "[IMAGE]:" / "[VIEW-ONCE]:" / "[AUDIO]:" / "[POLL]:"
// prefix (see confirmSendImageMessage, startVoiceRecording, createPollMessage),
// so only those prefixes should ever be treated as non-text content.
const getMessageKind = (content) => {
  if (!content) return 'text';
  if (content.startsWith('[SYSTEM]:')) return 'system';
  if (content.startsWith('[IMAGE]:')) return 'image';
  if (content.startsWith('[VIEW-ONCE]:')) return 'view-once';
  if (content.startsWith('[AUDIO]:')) return 'audio';
  if (content.startsWith('[POLL]:')) return 'poll';
  if (extractYouTubeId(content)) return 'youtube';
  return 'text';
};

// Short human label used for reply-quote previews, the top toast, and push
// notification bodies — kept consistent everywhere via getMessageKind so a
// plain pasted link is never mislabeled as "Photo" again.
const getMessagePreviewLabel = (content) => {
  const kind = getMessageKind(content);
  if (kind === 'image' || kind === 'view-once') return '📷 Photo';
  if (kind === 'audio') return '🎤 Voice note';
  if (kind === 'poll') return '📊 Poll';
  if (kind === 'youtube') return '▶️ YouTube link';
  return content || '';
};

// crypto.randomUUID() only exists in "secure contexts" (HTTPS or
// localhost) — on a plain-HTTP LAN address (a very common local-dev setup,
// e.g. testing on a phone via http://192.168.x.x:3000) it's undefined. A
// naive fallback like a timestamp+random string is NOT a valid UUID, and
// inserting that into a Postgres `uuid`-typed column (conversations.id)
// throws "invalid input syntax for type uuid" — silently breaking group/
// chat creation with no obvious cause. This fallback always produces a
// properly formatted RFC4122 v4 UUID, so it works everywhere.
const generateUuidV4 = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Firebase throws raw strings like "Firebase: Error (auth/invalid-credential)."
// — this maps the error CODE (stable across SDK versions, unlike the
// message text) to the plain classic wording users actually expect.
const getFirebaseAuthErrorMessage = (err) => {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid credentials.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign back in, then try again.';
    default:
      return code ? 'Something went wrong. Please try again.' : (err?.message || 'Something went wrong. Please try again.');
  }
};

const formatLastSeen = (isoString) => {
  if (!isoString) return 'offline';
  const diffSecs = Math.floor((new Date() - new Date(isoString)) / 1000);
  if (diffSecs < 60) return 'last seen just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `last seen ${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `last seen ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'last seen yesterday';
  return `last seen ${diffDays}d ago`;
};

const formatChatTimestamp = (isoString) => {
  if (!isoString) return '';
  const date = parseSafeDate(isoString); // <-- Change new Date(isoString) to parseSafeDate(isoString)
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (isYesterday) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
};

const getMessageDateLabel = (isoString) => {
  if (!isoString) return '';
  const date = parseSafeDate(isoString); // <-- Change new Date(isoString) to parseSafeDate(isoString)
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [onlinePresenceState, setOnlinePresenceState] = useState({});
  const [userLastSeen, setUserLastSeen] = useState({});

  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);

  const [currentSessionPassword, setCurrentSessionPassword] = useState(() => {
    return localStorage.getItem('svpp_user_session_pwd') || '';
  });
  const [archivePin, setArchivePin] = useState(() => {
    return localStorage.getItem('svpp_user_archive_pin') || '1234';
  });
  const [showSavedPassword, setShowSavedPassword] = useState(false);
  const [showArchivePin, setShowArchivePin] = useState(false);

  const [nicknames, setNicknames] = useState({});
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameTargetUser, setNicknameTargetUser] = useState(null);
  const [reactionDetailsTarget, setReactionDetailsTarget] = useState(null);
  const [tappedMessageId, setTappedMessageId] = useState(null);

  const [activeTab, setActiveTab] = useState('chats');
  const [chatFilter, setChatFilter] = useState('all');

  const [allUsers, setAllUsers] = useState([]);
  const [friendships, setFriendships] = useState([]); 
  const [conversations, setConversations] = useState([]);
  const [archivedConvIds, setArchivedConvIds] = useState(() => {
    try {
      const saved = localStorage.getItem('svpp_archived_convs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [enteredArchivePin, setEnteredArchivePin] = useState('');
  const [isArchiveUnlocked, setIsArchiveUnlocked] = useState(false);
  const [chatDropdownOpenId, setChatDropdownOpenId] = useState(null);
  const [chatDropdownPos, setChatDropdownPos] = useState({ top: 0, right: 0, bottom: null });
  const [hoveredChatRowId, setHoveredChatRowId] = useState(null);

  const [activeConversation, setActiveConversation] = useState(null);
  const [activeConvMembers, setActiveConvMembers] = useState([]);
   
  const [messagesCache, setMessagesCache] = useState({});
  const [messages, setMessages] = useState([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [requests, setRequests] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);

  const [unreadCounts, setUnreadCounts] = useState({});

  const [typingUsers, setTypingUsers] = useState({});
  const [convTypingMap, setConvTypingMap] = useState({});
  const [snapchatBanner, setSnapchatBanner] = useState(null);

  // Message dropdown menus state (WhatsApp style)
  const [openMessageMenuId, setOpenMessageMenuId] = useState(null);
  // Tracks whether the currently open message options dropdown should render
  // above its trigger (when there isn't enough room below in the viewport)
  const [messageMenuFlipUp, setMessageMenuFlipUp] = useState(false);

  // Forward Modal state
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // Media Gallery state
  const [showMediaGalleryModal, setShowMediaGalleryModal] = useState(false);
  const [galleryMedia, setGalleryMedia] = useState({ images: [], audios: [], links: [], loading: false });
   
  const lastTypingBroadcastTimeRef = useRef(0);
  const typingStopTimerRef = useRef(null);
  const receiverTypingTimersRef = useRef({});
  const globalTypingChannelRef = useRef(null);
  const snapchatBannerTimeoutRef = useRef(null);
  const titleBlinkIntervalRef = useRef(null);
  const activeConversationRef = useRef(null);
  const deletedChatIdsRef = useRef(new Set());
  const isStartingChatRef = useRef(false);
  // Tracks last_message_at per conversation (ms) so the conversations
  // subscription can tell "a new message just arrived" apart from any other
  // field on the conversation doc changing (e.g. someone else's read
  // receipt), without needing a separate global messages listener.
  const lastSeenMessageAtRef = useRef({});
  // Firestore paginates "load older messages" by document snapshot, not by
  // numeric offset — this holds that cursor for whichever conversation is
  // currently open.
  const oldestMessageDocRef = useRef(null);
  // loadActiveMembers() is triggered from several places at once (markAsRead,
  // multiple realtime listeners). Without ordering, an earlier-fired but
  // slower network response can resolve AFTER a later-fired but faster one,
  // silently overwriting fresh "seen" data with stale data — which is why a
  // message's seen tick only ever seemed to "catch up" a cycle late. This
  // counter lets each response check it is still the most recent request
  // before applying itself.
  const activeMembersRequestIdRef = useRef(0);

  const [showAiModal, setShowAiModal] = useState(false);
   
  const [aiChats, setAiChats] = useState(() => {
    try {
      const saved = localStorage.getItem('svpp_ai_chats_data');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 1, title: 'Chat 1', messages: [{ id: 1, sender: 'ai', text: 'Hi! I am your Meta AI Assistant. Ask me anything in Chat 1!' }] },
      { id: 2, title: 'Chat 2', messages: [{ id: 1, sender: 'ai', text: 'Hello! Welcome to Chat 2. What can I help you with here?' }] },
      { id: 3, title: 'Chat 3', messages: [{ id: 1, sender: 'ai', text: 'Hi there! This is Chat 3. Ready for your questions!' }] }
    ];
  });
  const [activeAiChatId, setActiveAiChatId] = useState(1);

  useEffect(() => {
    localStorage.setItem('svpp_ai_chats_data', JSON.stringify(aiChats));
  }, [aiChats]);

  const currentAiChat = aiChats.find(c => c.id === activeAiChatId) || aiChats[0];
  const aiMessages = currentAiChat.messages;

  const updateActiveChatMessages = (newMsgsUpdater) => {
    setAiChats(prev => prev.map(c => {
      if (c.id === activeAiChatId) {
        const updatedMsgs = typeof newMsgsUpdater === 'function' ? newMsgsUpdater(c.messages) : newMsgsUpdater;
        return { ...c, messages: updatedMsgs };
      }
      return c;
    }));
  };

  const [aiInput, setAiInput] = useState('');
  const [isAiResponding, setIsAiResponding] = useState(false);
  const aiChatEndRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const [chatBg, setChatBg] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_wallpaper_config');
      return saved ? JSON.parse(saved) : { type: 'color', value: '#efeae2' };
    } catch {
      return { type: 'color', value: '#efeae2' };
    }
  });

  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [reactions, setReactions] = useState([]);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState(null);
  const [showExtendedReactions, setShowExtendedReactions] = useState(false);
  const [showComposerEmojiPicker, setShowComposerEmojiPicker] = useState(false);
  const [sendingStatuses, setSendingStatuses] = useState({});

  const [pendingImageUpload, setPendingImageUpload] = useState(null);
  const [isViewOnceChecked, setIsViewOnceChecked] = useState(false);
  const [viewOnceViewerData, setViewOnceViewerData] = useState(null);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const [quickEmojis, setQuickEmojis] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_quick_reactions');
      return saved ? JSON.parse(saved) : DEFAULT_5_REACTIONS;
    } catch {
      return DEFAULT_5_REACTIONS;
    }
  });

  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [profilePreviewTarget, setProfilePreviewTarget] = useState(null);

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [changeOption, setChangeOption] = useState('both');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newArchivePinInput, setNewArchivePinInput] = useState('');
  const [settingsMsg, setSettingsMsg] = useState({ text: '', type: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const [deleteStep, setDeleteStep] = useState('idle');
  const [generatedDeleteOtp, setGeneratedDeleteOtp] = useState('');
  const [enteredDeleteOtp, setEnteredDeleteOtp] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const groupAvatarInputRef = useRef(null);
  const bgImageInputRef = useRef(null);

  // Desktop shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNewChatModal(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowGroupModal(true);
      } else if (e.key === 'Escape') {
        setShowAiModal(false);
        setShowSettingsModal(false);
        setShowNewChatModal(false);
        setShowGroupModal(false);
        setShowGroupInfoModal(false);
        setShowAddMemberModal(false);
        setShowPollModal(false);
        setShowForwardModal(false);
        setShowMediaGalleryModal(false);
        setOpenMessageMenuId(null);
        setActiveReactionPickerMsgId(null);
        setShowExtendedReactions(false);
        setChatDropdownOpenId(null);
        setProfilePreviewTarget(null);
        setReactionDetailsTarget(null);
        setPendingImageUpload(null);
        setViewOnceViewerData(null);
        if (isMobile && activeConversation) {
          setActiveConversation(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, activeConversation]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    if (!profile?.id) return;
    try {
      const savedNicks = localStorage.getItem(`svpp_nicknames_${profile.id}`);
      if (savedNicks) setNicknames(JSON.parse(savedNicks));
       
      if (profile.nicknames_map) {
        setNicknames(prev => ({ ...prev, ...profile.nicknames_map }));
      }
    } catch {
      setNicknames({});
    }
  }, [profile?.id]);

  const saveNicknameForUser = async (targetUserId, nick) => {
    if (!profile?.id) return;
    const updated = { ...nicknames, [targetUserId]: nick.trim() };
    if (!nick.trim()) delete updated[targetUserId];
    setNicknames(updated);
     
    localStorage.setItem(`svpp_nicknames_${profile.id}`, JSON.stringify(updated));

    try {
      await updateUserProfile(profile.id, { nicknames_map: updated });
    } catch (err) {
      console.error('Failed to sync nickname to Firestore:', err);
    }

    setShowNicknameModal(false);
    setNicknameInput('');
    setNicknameTargetUser(null);
  };

  const getDisplayName = (userObj) => {
    if (!userObj) return 'User';
    if (userObj.id && nicknames[userObj.id]) return nicknames[userObj.id];
    return userObj.username || userObj.user_name || userObj.email?.split('@')[0] || 'User';
  };

  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = FAVICON_SVG;

    // WhatsApp-style native-app chrome: a teal browser/status-bar tint and
    // proper safe-area support so the header/sidebar don't sit under a
    // phone's notch or home-indicator when added to the home screen.
    const upsertMetaTag = (attrName, attrValue, content) => {
      let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attrName, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
      return tag;
    };
    upsertMetaTag('name', 'theme-color', '#008069');
    upsertMetaTag('name', 'apple-mobile-web-app-capable', 'yes');
    upsertMetaTag('name', 'apple-mobile-web-app-status-bar-style', 'black-translucent');
    upsertMetaTag('name', 'mobile-web-app-capable', 'yes');
    upsertMetaTag('name', 'viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');

    const styleTag = document.createElement('style');
    styleTag.innerHTML = `
      @keyframes typingDot {
        0%, 80%, 100% { transform: scale(0.3); opacity: 0.3; }
        40% { transform: scale(1); opacity: 1; }
      }
      .typing-dot {
        width: 6px;
        height: 6px;
        background-color: #54656f;
        border-radius: 50%;
        display: inline-block;
        animation: typingDot 1.4s infinite ease-in-out both;
      }
      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }
      .typing-dot:nth-child(3) { animation-delay: 0s; }
       
      @keyframes slideDownToast {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
      }
      .snap-toast {
        animation: slideDownToast 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes metaAiRotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .meta-ai-ring {
        background: conic-gradient(#0084ff, #44bec7, #ffc300, #fa3c4c, #d696bb, #0084ff);
        animation: metaAiRotate 4s linear infinite;
      }

      @keyframes waveBar {
        0%, 100% { height: 8px; }
        50% { height: 24px; }
      }
      .wave-bar {
        width: 4px;
        background-color: #00a884;
        border-radius: 2px;
        animation: waveBar 1.2s infinite ease-in-out;
      }
      .wave-bar:nth-child(2) { animation-delay: 0.2s; }
      .wave-bar:nth-child(3) { animation-delay: 0.4s; }
      .wave-bar:nth-child(4) { animation-delay: 0.6s; }
      .wave-bar:nth-child(5) { animation-delay: 0.8s; }

      /* ---------------------------------------------------------------- */
      /* Site-wide smoothness pass: hover feedback, transitions, scroll   */
      /* ---------------------------------------------------------------- */

      /* Chevron / arrow-mark hover: no circle badge, just a clean, smoothly
         color-shifting + slightly enlarging arrow. Uses currentColor so the
         SVG stroke animates together with the button's color transition. */
      .chevron-hover-btn {
        color: #54656f;
        transition: color 0.18s ease, transform 0.18s ease, background-color 0.18s ease;
      }
      .chevron-hover-btn:hover {
        color: #00a884;
        transform: scale(1.18);
        background-color: rgba(0, 168, 132, 0.08);
        border-radius: 4px;
      }
      .chevron-hover-btn:active {
        transform: scale(0.96);
      }
      .chevron-hover-icon {
        transition: color 0.18s ease, transform 0.18s ease;
      }

      /* Universal smooth hover/press feedback for every real <button> in the
         app. Uses filter/transform instead of background-color so it never
         fights with each button's own inline background color. */
      button {
        transition: filter 0.16s ease, transform 0.12s ease, opacity 0.16s ease, box-shadow 0.16s ease;
      }
      button:hover:not(:disabled) {
        filter: brightness(0.96);
      }
      button:active:not(:disabled) {
        transform: scale(0.97);
      }
      button:disabled {
        cursor: default;
      }

      /* Helper class for clickable non-button rows/cards (chat rows, user
         rows, modal rows, emoji tiles, etc.) to get the same smooth,
         inline-style-safe hover feedback. */
      .hover-dim {
        transition: filter 0.16s ease, transform 0.12s ease;
      }
      .hover-dim:hover {
        filter: brightness(0.97);
      }
      .hover-dim:active {
        transform: scale(0.99);
      }

      /* Smooth scrolling everywhere scrollable, plus a slim, unobtrusive,
         smoothly-fading custom scrollbar (WebKit browsers). */
      html {
        scroll-behavior: smooth;
      }
      *::-webkit-scrollbar {
        width: 7px;
        height: 7px;
      }
      *::-webkit-scrollbar-track {
        background: transparent;
      }
      *::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.16);
        border-radius: 8px;
        transition: background-color 0.2s ease;
      }
      *::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.32);
      }

      /* Smooth open/close animation for dropdown-style floating menus. */
      @keyframes floatingMenuPop {
        from { opacity: 0; transform: translateY(-4px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      [data-floating-ui="message-options-menu"] {
        animation: floatingMenuPop 0.14s ease-out;
      }

      /* Chat-list "⋮" menu: rock-solid (no animation, no filter/transform
         effects on the option buttons) so hovering never makes it blink
         and clicks always register. */
      [data-floating-ui="chat-dots-menu"] button {
        transition: background-color 0.12s ease !important;
        filter: none !important;
        transform: none !important;
      }
      [data-floating-ui="chat-dots-menu"] button:hover:not(:disabled) {
        background-color: #f0f2f5 !important;
      }

      /* Glowing green online indicator — used instead of literal
         "online"/"offline" text wherever a presence status is shown. */
      @keyframes onlineDotGlowPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.55); }
        50% { box-shadow: 0 0 0 5px rgba(37, 211, 102, 0); }
      }
      .online-glow-dot {
        animation: onlineDotGlowPulse 1.8s ease-out infinite;
      }

      /* Smooth fade-in for modal/lightbox backdrops instead of an instant
         snap-into-existence. */
      @keyframes modalBackdropFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal-fade-in {
        animation: modalBackdropFadeIn 0.16s ease-out;
      }
    `;
    document.head.appendChild(styleTag);
    return () => {
      if (document.head.contains(styleTag)) document.head.removeChild(styleTag);
    };
  }, []);

  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((acc, count) => acc + (count || 0), 0);
    const activeTypingList = Object.values(typingUsers);

    if (activeTypingList.length > 0) {
      const typingName = activeTypingList.map((u) => getDisplayName(u)).join(', ');
      document.title = `${typingName} is typing... • svpp-chat`;
    } else if (totalUnread > 0) {
      document.title = `(${totalUnread}) new message${totalUnread > 1 ? 's' : ''} • svpp-chat`;
    } else {
      document.title = 'svpp-chat';
    }
  }, [unreadCounts, typingUsers, nicknames]);

  // Blink the browser tab title while there are unread messages and the tab
  // is not the one the user is currently looking at — a strong visual cue
  // (like WhatsApp Web's unread badge) that pulls their attention back.
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((acc, count) => acc + (count || 0), 0);
    const baseUnreadTitle = `(${totalUnread}) new message${totalUnread > 1 ? 's' : ''} • svpp-chat`;
    const attentionTitle = `💬 New Message${totalUnread > 1 ? 's' : ''}!`;

    const stopBlinking = () => {
      if (titleBlinkIntervalRef.current) {
        clearInterval(titleBlinkIntervalRef.current);
        titleBlinkIntervalRef.current = null;
      }
    };

    const startBlinkingIfNeeded = () => {
      stopBlinking();
      if (totalUnread <= 0 || document.visibilityState === 'visible') return;
      let showingAttentionTitle = false;
      titleBlinkIntervalRef.current = setInterval(() => {
        showingAttentionTitle = !showingAttentionTitle;
        document.title = showingAttentionTitle ? attentionTitle : baseUnreadTitle;
      }, 1000);
    };

    const handleBlinkVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        stopBlinking();
        document.title = totalUnread > 0 ? baseUnreadTitle : 'svpp-chat';
      } else {
        startBlinkingIfNeeded();
      }
    };

    startBlinkingIfNeeded();
    document.addEventListener('visibilitychange', handleBlinkVisibilityChange);

    return () => {
      stopBlinking();
      document.removeEventListener('visibilitychange', handleBlinkVisibilityChange);
    };
  }, [unreadCounts]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const primeNotificationAudio = () => {
      const ctx = getSharedNotificationAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', primeNotificationAudio);
      window.removeEventListener('keydown', primeNotificationAudio);
      window.removeEventListener('touchstart', primeNotificationAudio);
    };
    window.addEventListener('pointerdown', primeNotificationAudio, { once: true });
    window.addEventListener('keydown', primeNotificationAudio, { once: true });
    window.addEventListener('touchstart', primeNotificationAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', primeNotificationAudio);
      window.removeEventListener('keydown', primeNotificationAudio);
      window.removeEventListener('touchstart', primeNotificationAudio);
    };
  }, []);

  useEffect(() => {
    // Firebase's onAuthStateChanged fires once immediately with the current
    // user (or null) and again on every future sign-in/sign-out — this one
    // listener replaces both the old getSession() one-time check AND the
    // onAuthStateChange subscription.
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        loadProfile(firebaseUser);
      } else {
        setProfile(null);
        setActiveConversation(null);
        setConversations([]);
        setMessages([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadProfile = async (firebaseUser) => {
    try {
      // Pass firebaseUser directly rather than reading the `user` state
      // variable here — this callback runs in the SAME tick as
      // setUser(firebaseUser) above, before the component has re-rendered,
      // so `user` in this closure is still last render's value (null, on a
      // fresh sign-in). Reading it here was silently creating brand-new
      // profiles with a blank username AND a blank email — which is exactly
      // why the sidebar fell back to showing "User".
      const data = await ensureProfile(firebaseUser.uid, {
        username: firebaseUser.email?.split('@')[0] || '',
        email: firebaseUser.email,
      });

      // Self-heal a profile doc that was already created blank by the
      // earlier stale-closure bug (ensureProfile only sets these defaults
      // on FIRST creation, so an existing broken doc would otherwise stay
      // broken forever even after this fix).
      if (data && (!data.username || !data.email) && firebaseUser.email) {
        const patch = {
          username: data.username || firebaseUser.email.split('@')[0],
          email: data.email || firebaseUser.email,
        };
        await updateUserProfile(firebaseUser.uid, patch);
        Object.assign(data, patch);
      }

      setProfile(data);
      setNewUsername(data?.username || '');
      await syncSocialGraph(firebaseUser.uid);
    } catch (err) {
      // Previously this had no try/catch at all: if ensureProfile ever threw
      // (e.g. a Firestore permission-denied error from security rules not
      // being set up yet), the rejection vanished silently and `profile`
      // stayed null forever — which is also exactly why the credentials
      // screen crashed with "Cannot read properties of null (reading 'id')"
      // the moment it tried profile.id. Surfacing this clearly instead.
      console.error('Failed to load profile:', err);
      alert(
        'Could not load your profile: ' + err.message +
        (err.code === 'permission-denied'
          ? '\n\nThis usually means Firestore security rules are blocking reads/writes for signed-in users — check your Firestore rules.'
          : '')
      );
    }
  };

  const syncSocialGraph = async (userId) => {
    await Promise.all([
      fetchUsers(userId),
      fetchFriendships(userId),
      fetchConversations(userId),
      fetchRequests(userId),
    ]);
  };

  // A user is considered online for this long after their last RTDB
  // heartbeat before the UI treats a missing update as possibly stale. RTDB's
  // onDisconnect() means this is now a safety margin, not the primary
  // mechanism — the server itself flips someone offline the instant their
  // socket drops, whether the tab was closed cleanly or the laptop lid was
  // shut. This replaces the whole heartbeat-worker + visibilitychange +
  // beforeunload + stale-check-interval system the Supabase version needed,
  // because none of that was ever a substitute for real server-side
  // disconnect detection — it was working around not having it.
  const PRESENCE_STALE_THRESHOLD_MS = 150000;

  useEffect(() => {
    // Gate on the Firebase auth user id directly — it's available the
    // instant sign-in resolves, with no Firestore round-trip in front of it.
    const presenceUserId = user?.uid;
    if (!presenceUserId) return;

    // initPresence arms the RTDB onDisconnect() hook and marks this user
    // online; it returns a cleanup function that marks them offline again on
    // unmount (e.g. sign-out while the app stays open).
    const cleanupPresence = initPresence(presenceUserId);

    // One listener for everyone's presence, rather than one per friend —
    // cheaper, and it's what drives every green dot in the UI.
    const unsubscribeAll = subscribeToAllPresence((statusMap) => {
      setOnlinePresenceState(statusMap);
      setUserLastSeen((prev) => {
        const next = { ...prev };
        Object.entries(statusMap).forEach(([uid, entry]) => {
          if (entry?.last_changed) next[uid] = entry.last_changed;
        });
        return next;
      });
    });

    return () => {
      unsubscribeAll();
      cleanupPresence();
    };
  }, [user?.uid]);

  const handleSignOut = async () => {
    await signOut(auth);
    localStorage.removeItem('svpp_user_session_pwd');
  };

  const getUserStatusType = (userId) => {
    if (userId === profile?.id) return 'online';
    const entry = onlinePresenceState[userId];
    if (!entry || entry.state !== 'online') return 'offline';

    // RTDB's onDisconnect already guarantees this flips to 'offline' the
    // instant the socket drops, so last_changed staleness is a defensive
    // fallback only (e.g. a listener hiccup), not the primary check.
    if (!entry.last_changed) return 'online';
    const age = Date.now() - entry.last_changed;
    return age < PRESENCE_STALE_THRESHOLD_MS ? 'online' : 'offline';
  };

  // Conversation list, unread counts, and new-message notifications all stay
  // live from ONE subscription — this replaces the old separate listeners
  // on the messages, conversations, and conversation_members tables, because
  // last_message / last_message_at / last_message_sender_id / unread_count
  // are all denormalized onto the conversation doc itself (see chatService)
  // and update automatically whenever anything relevant happens.
  useEffect(() => {
    if (!profile?.id) return;

    const unsubscribeConversations = subscribeToUserConversations(profile.id, (convList) => {
      convList.forEach((c) => {
        const newAtMs = c.last_message_at?.toMillis ? c.last_message_at.toMillis() : null;
        const prevAtMs = lastSeenMessageAtRef.current[c.id];
        const isGenuinelyNewMessage = newAtMs != null && prevAtMs !== undefined && newAtMs > prevAtMs;
        lastSeenMessageAtRef.current[c.id] = newAtMs;

        if (!isGenuinelyNewMessage) return;
        if (!c.last_message_sender_id || c.last_message_sender_id === profile.id) return;

        const isMsgInCurrentActiveChat = activeConversationRef.current?.id === c.id;
        playPopNotificationSound();

        const senderInfo = c.memberProfiles?.[c.last_message_sender_id] || null;
        const senderName = getDisplayName(senderInfo) || 'Someone';

        setSnapchatBanner({
          username: senderName,
          avatar_url: senderInfo?.avatar_url,
          content: c.last_message,
          convId: c.id,
        });
        clearTimeout(snapchatBannerTimeoutRef.current);
        snapchatBannerTimeoutRef.current = setTimeout(() => setSnapchatBanner(null), 3800);

        if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          new Notification(`New message from ${senderName}`, {
            body: getMessagePreviewLabel(c.last_message),
            icon: FAVICON_SVG,
          });
        }

        if (isMsgInCurrentActiveChat) {
          markAsRead(c.id);
        }

        if (activeConversationRef.current?.id === c.id) {
          loadActiveMembers(c.id);
        }
      });

      // A message you JUST sent has last_message_at as a pending
      // serverTimestamp() — it reads back as null in THIS client's own local
      // snapshot for the brief moment before the server assigns the real
      // value and syncs it back down. Treating that null as epoch-0 (as
      // before) sorted the conversation to the very bottom for that instant,
      // then it jumped back to the top a moment later — the "goes down then
      // comes back up" glitch. A null timestamp here can only mean "a write
      // I just made hasn't round-tripped yet", so treat it as now (most
      // recent), which is where it belongs regardless.
      const toMillis = (ts) => (ts ? (ts.toMillis ? ts.toMillis() : new Date(ts).getTime()) : Date.now());
      setConversations([...convList].sort((a, b) => toMillis(b.last_message_at) - toMillis(a.last_message_at)));

      const newUnread = {};
      convList.forEach((c) => {
        newUnread[c.id] = activeConversationRef.current?.id === c.id ? 0 : (c.unread_count?.[profile.id] || 0);
      });
      setUnreadCounts(newUnread);
    });

    // Friend requests stay live too — replaces the old friend_requests
    // table listener.
    const unsubscribeRequests = subscribeToIncomingRequests(profile.id, (data) => setRequests(data));

    return () => {
      unsubscribeConversations();
      unsubscribeRequests();
    };
  }, [profile?.id, nicknames]);

  useEffect(() => {
    if (!profile?.id) return;

    // One RTDB listener covers typing state across every conversation —
    // both the active chat's "X is typing" and the sidebar's per-conversation
    // typing hint come from this same snapshot.
    const unsubscribeTyping = subscribeToAllTyping((typingMap) => {
      const newConvTypingMap = {};
      const activeTypingUsers = {};

      Object.entries(typingMap).forEach(([convId, usersTyping]) => {
        const entries = Object.entries(usersTyping || {}).filter(([uid]) => uid !== profile.id);
        if (entries.length === 0) return;

        newConvTypingMap[convId] = entries[0][1]?.username;

        if (activeConversationRef.current?.id === convId) {
          entries.forEach(([uid, data]) => {
            activeTypingUsers[uid] = { userId: uid, convId, username: data.username, isTyping: true };
          });
        }
      });

      setConvTypingMap(newConvTypingMap);
      setTypingUsers(activeTypingUsers);
    });

    return () => {
      unsubscribeTyping();
    };
  }, [profile?.id]);

  const sendCredentialsToMail = async ({ targetEmail, uname, pwd, actionType }) => {
    const templateParams = {
      to_name: uname || targetEmail,
      to_email: targetEmail,
      email: targetEmail,
      recipient: targetEmail,
      action_type: actionType,
      username: uname || profile?.username || 'Unchanged',
      password: pwd || 'Unchanged',
    };

    return await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );
  };

  const fetchUsers = async (myId) => {
    const data = await fetchAllOtherUsers(myId);
    if (data) {
      setAllUsers(data);
      setUserLastSeen(prev => {
        const next = { ...prev };
        data.forEach(u => {
          if (!u.last_seen) return;
          const existing = next[u.id];
          // Only adopt the DB value if it's actually newer than what we
          // already have from live presence — the DB write lags a few
          // seconds behind the real-time heartbeat, so blindly overwriting
          // here could regress an accurate "online"/"just now" status back
          // to a stale timestamp.
          if (!existing || new Date(u.last_seen).getTime() > new Date(existing).getTime()) {
            next[u.id] = u.last_seen;
          }
        });
        return next;
      });
    }
  };

  const fetchFriendships = async (myId) => {
    const data = await fetchFriendshipDocs(myId);
    if (data) setFriendships(data);
  };

  const fetchRequests = async (myId) => {
    const data = await fetchIncomingRequests(myId);
    if (data) setRequests(data);
  };

  const fetchConversations = async (myId) => {
    const convList = await fetchUserConversations(myId);

    if (!convList || convList.length === 0) {
      setConversations([]);
      setUnreadCounts({});
      return;
    }

    // last_message_at is a Firestore Timestamp (or a resolving server
    // sentinel briefly after creation) — .toMillis() handles the normal
    // case, with a plain Date fallback for anything already coerced. A null
    // value can only mean a just-made write hasn't round-tripped yet, so
    // treat it as now rather than epoch-0 (see the realtime version above
    // for why that distinction matters).
    const toMillis = (ts) => {
      if (!ts) return Date.now();
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      return new Date(ts).getTime();
    };

    const sortedConvs = [...convList].sort(
      (a, b) => toMillis(b.last_message_at) - toMillis(a.last_message_at)
    );
    setConversations(sortedConvs);

    // unread_count is maintained server-side by sendMessage/markAsRead
    // (incremented per-member on send, reset to 0 on read) — no need to
    // scan every message the way the embedded-join version had to.
    const newUnread = {};
    convList.forEach((c) => {
      newUnread[c.id] = activeConversationRef.current?.id === c.id ? 0 : (c.unread_count?.[myId] || 0);
    });
    setUnreadCounts(newUnread);
  };

  const getRelationStatus = (otherUserId) => {
    const rel = friendships.find(
      (f) => (f.sender_id === otherUserId && f.receiver_id === profile?.id) ||
             (f.sender_id === profile?.id && f.receiver_id === otherUserId)
    );
    if (!rel) return 'none';
    if (rel.status === 'accepted') return 'accepted';
    if (rel.status === 'pending') {
      return rel.sender_id === profile?.id ? 'sent' : 'received';
    }
    return 'none';
  };

  const confirmedFriends = allUsers.filter((u) => getRelationStatus(u.id) === 'accepted');

  const sendFriendRequest = async (receiverId) => {
    setFriendships((prev) => [
      ...prev,
      { id: Date.now(), sender_id: profile.id, receiver_id: receiverId, status: 'pending' }
    ]);

    try {
      await sendFriendRequestToFirestore(profile.id, receiverId);
    } catch (error) {
      fetchFriendships(profile.id);
      alert(error.message);
    }
  };

  const acceptRequest = async (requestId, senderId) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setFriendships((prev) =>
      prev.map((f) => (f.id === requestId ? { ...f, status: 'accepted' } : f))
    );

    await acceptFriendRequestInFirestore(requestId);
    const senderProfile = allUsers.find((u) => u.id === senderId) || { id: senderId, username: 'Friend' };
    await handleStartDirectChat(senderProfile, true);
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Unfriend this user?')) return;

    await removeFriendship(profile.id, friendId);

    await syncSocialGraph(profile.id);
  };

  const markAsRead = async (convId) => {
    if (!profile?.id || !convId) return;
    const now = new Date().toISOString();

    setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));

    setActiveConvMembers((prev) =>
      prev.map((m) => (m.user_id === profile.id ? { ...m, last_read_at: now } : m))
    );

    await markConversationAsRead(convId, profile.id);

    loadActiveMembers(convId);
    fetchConversations(profile.id);
  };

  const MESSAGES_PAGE_SIZE = 30;

  const handleSelectConversation = (c) => {
    if (activeConversation?.id === c.id) return;
    setActiveConversation(c);
    setTypingUsers({});
    setSelectedMessageIds([]);
    setMessages(messagesCache[c.id] || []);
    // Reset pagination state for the newly opened conversation — otherwise
    // a stale true/false value from the previously open chat could hide or
    // wrongly show the "tap for older messages" affordance here.
    setHasMoreMessages(false);
    setLoadingOlderMessages(false);
    markAsRead(c.id);

    fetchMessages(c.id, MESSAGES_PAGE_SIZE).then(({ messages: pageRows, oldestDoc, hasMore }) => {
      oldestMessageDocRef.current = oldestDoc;
      const withProfiles = pageRows.map((m) => ({ ...m, profiles: c.memberProfiles?.[m.sender_id] || null }));
      const visible = withProfiles.filter((m) => !m.is_deleted_for_everyone && !m.deleted_for?.includes(profile.id));
      setMessagesCache((cache) => ({ ...cache, [c.id]: visible }));
      if (activeConversationRef.current?.id === c.id) {
        setMessages(visible);
        setHasMoreMessages(hasMore);
        setTimeout(() => scrollToBottom('auto'), 20);
      }
      fetchActiveConvReactions(visible.map((m) => m.id));
    });
  };

  const toggleArchiveChat = (convId, e) => {
    e.stopPropagation();
    setChatDropdownOpenId(null);
    let updated;
    if (archivedConvIds.includes(convId)) {
      updated = archivedConvIds.filter((id) => id !== convId);
    } else {
      updated = [...archivedConvIds, convId];
    }
    setArchivedConvIds(updated);
    localStorage.setItem('svpp_archived_convs', JSON.stringify(updated));
  };

  const handleOpenArchiveSection = () => {
    if (isArchiveUnlocked) {
      setShowArchiveModal(true);
    } else {
      setEnteredArchivePin('');
      setShowArchiveModal(true);
    }
  };

  const verifyArchivePin = () => {
    if (enteredArchivePin.trim() === archivePin.trim()) {
      setIsArchiveUnlocked(true);
      setEnteredArchivePin('');
    } else {
      alert('Incorrect Archive PIN.');
    }
  };

  const handleStartDirectChat = async (friend, isInitialAccept = false) => {
    if (isStartingChatRef.current || !friend?.id) return;
    isStartingChatRef.current = true;

    try {
      // Double-check against current conversations state
      let existing = conversations.find(
        (c) => !c.is_group && c.conversation_members?.some((m) => m.user_id === friend.id)
      );

      if (existing) {
        await unhideConversationForUser(existing.id, profile.id);

        const unhiddenConv = {
          ...existing,
          conversation_members: existing.conversation_members.map((m) =>
            m.user_id === profile.id ? { ...m, hidden_at: null, last_read_at: new Date().toISOString() } : m
          ),
        };

        handleSelectConversation(unhiddenConv);
        setConversations((prev) => [unhiddenConv, ...prev.filter((c) => c.id !== unhiddenConv.id)]);
        setShowNewChatModal(false);
        setProfilePreviewTarget(null);
        setActiveTab('chats');
        return;
      }

      let newConversationId;
      try {
        newConversationId = await createDirectConversation(profile, friend);
      } catch (error) {
        alert('Could not start conversation: ' + error.message);
        return;
      }

      await sendMessageToFirestore(
        newConversationId,
        isInitialAccept ? friend.id : profile.id,
        'hi',
        [profile.id, friend.id]
      );

      const now = new Date().toISOString();
      const builtConv = {
        id: newConversationId,
        is_group: false,
        created_at: now,
        conversation_members: [
          { conversation_id: newConversationId, user_id: profile.id, profiles: profile, hidden_at: null, last_read_at: now },
          { conversation_id: newConversationId, user_id: friend.id, profiles: friend, hidden_at: null, last_read_at: null }
        ]
      };

      handleSelectConversation(builtConv);
      setConversations((prev) => [builtConv, ...prev.filter((c) => c.id !== builtConv.id)]);
      setShowNewChatModal(false);
      setProfilePreviewTarget(null);
      setActiveTab('chats');
      fetchConversations(profile.id);
    } finally {
      isStartingChatRef.current = false;
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name before creating the group.');
      return;
    }
    if (selectedGroupUsers.length === 0) {
      alert('Please select at least one friend to add to the group.');
      return;
    }

    const memberProfilesList = selectedGroupUsers
      .map((uid) => allUsers.find((u) => u.id === uid))
      .filter(Boolean);

    let newConversationId;
    try {
      newConversationId = await createGroupConversation(profile, memberProfilesList, groupName.trim());
    } catch (error) {
      alert('Failed to create group: ' + error.message);
      return;
    }

    setShowGroupModal(false);
    setGroupName('');
    setSelectedGroupUsers([]);
    fetchConversations(profile.id);
  };

  // Whether a given user id currently has admin rights in a group — the
  // creator is always implicitly an admin even if somehow missing from the
  // admin_ids array (defensive, avoids ever locking a creator out).
  const isGroupAdmin = (conv, userId) => {
    if (!conv || !userId) return false;
    if (conv.created_by === userId) return true;
    return Array.isArray(conv.admin_ids) && conv.admin_ids.includes(userId);
  };

  // Posts a small centered [SYSTEM]: announcement into the active
  // conversation (reuses the existing system-message rendering already in
  // the message list) — used for admin/permission changes so every member
  // sees a clear record of what changed and by whom.
  const postSystemMessageToActiveConversation = async (text) => {
    if (!activeConversation) return;
    try {
      await sendMessageToFirestore(
        activeConversation.id,
        profile.id,
        `[SYSTEM]:${text}`,
        activeConversation.memberIds || []
      );
    } catch (err) {}
  };

  const handleToggleAdminOnlyMessaging = async () => {
    if (!activeConversation?.is_group || !isGroupAdmin(activeConversation, profile.id)) return;
    const nextValue = !activeConversation.only_admins_can_message;

    setActiveConversation((prev) => ({ ...prev, only_admins_can_message: nextValue }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, only_admins_can_message: nextValue } : c))
    );

    try {
      await updateConversation(activeConversation.id, { only_admins_can_message: nextValue });
    } catch (error) {
      alert('Failed to update group setting: ' + error.message);
      setActiveConversation((prev) => ({ ...prev, only_admins_can_message: !nextValue }));
      return;
    }

    await postSystemMessageToActiveConversation(
      nextValue
        ? `${getDisplayName(profile)} changed the group settings to only allow admins to send messages`
        : `${getDisplayName(profile)} changed the group settings to allow all members to send messages`
    );
  };

  const handleMakeGroupAdmin = async (targetUserId, targetDisplayName) => {
    if (!activeConversation?.is_group || !isGroupAdmin(activeConversation, profile.id)) return;
    const currentAdmins = Array.isArray(activeConversation.admin_ids) ? activeConversation.admin_ids : [];
    if (currentAdmins.includes(targetUserId)) return;
    const updatedAdmins = [...currentAdmins, targetUserId];

    setActiveConversation((prev) => ({ ...prev, admin_ids: updatedAdmins }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, admin_ids: updatedAdmins } : c))
    );

    try {
      await updateConversation(activeConversation.id, { admin_ids: updatedAdmins });
    } catch (error) {
      alert('Failed to promote member: ' + error.message);
      setActiveConversation((prev) => ({ ...prev, admin_ids: currentAdmins }));
      return;
    }

    await postSystemMessageToActiveConversation(`${getDisplayName(profile)} made ${targetDisplayName || 'a member'} a group admin`);
  };

  const handleRemoveGroupAdmin = async (targetUserId, targetDisplayName) => {
    if (!activeConversation?.is_group || !isGroupAdmin(activeConversation, profile.id)) return;
    if (targetUserId === activeConversation.created_by) {
      alert('The group creator cannot be removed as admin.');
      return;
    }
    const currentAdmins = Array.isArray(activeConversation.admin_ids) ? activeConversation.admin_ids : [];
    const updatedAdmins = currentAdmins.filter((id) => id !== targetUserId);

    setActiveConversation((prev) => ({ ...prev, admin_ids: updatedAdmins }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversation.id ? { ...c, admin_ids: updatedAdmins } : c))
    );

    try {
      await updateConversation(activeConversation.id, { admin_ids: updatedAdmins });
    } catch (error) {
      alert('Failed to remove admin: ' + error.message);
      setActiveConversation((prev) => ({ ...prev, admin_ids: currentAdmins }));
      return;
    }

    await postSystemMessageToActiveConversation(`${getDisplayName(profile)} removed ${targetDisplayName || 'a member'} as group admin`);
  };

  const handleRemoveMember = async (targetUserId, targetUsername) => {
    if (!window.confirm(`Remove ${targetUsername || 'this user'} from the group?`)) return;
    try {
      await removeConversationMember(activeConversation.id, targetUserId, activeConversation.admin_ids || []);
      loadActiveMembers(activeConversation.id);
      fetchConversations(profile.id);
    } catch (error) {
      alert('Failed to remove member: ' + error.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    await removeConversationMember(activeConversation.id, profile.id, activeConversation.admin_ids || []);

    setActiveConversation(null);
    setShowGroupInfoModal(false);
    fetchConversations(profile.id);
  };

  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    try {
      const publicUrl = await uploadGroupAvatar(activeConversation.id, file);
      await updateConversation(activeConversation.id, { avatar_url: publicUrl });

      setActiveConversation((prev) => ({ ...prev, avatar_url: publicUrl }));
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversation.id ? { ...c, avatar_url: publicUrl } : c))
      );
    } catch (err) {
      alert('Failed to update group picture: ' + err.message);
    } finally {
      e.target.value = null;
    }
  };

  const handleAddMemberToExistingGroup = async (friendId) => {
    if (!activeConversation) return;
    const friendProfile = allUsers.find((u) => u.id === friendId) || confirmedFriends.find((u) => u.id === friendId);
    if (!friendProfile) return;
    try {
      await addConversationMember(activeConversation.id, friendProfile);
    } catch (error) {
      alert('Failed to add member: ' + error.message);
      return;
    }

    if (error) {
      alert('Could not add member: ' + error.message);
    } else {
      loadActiveMembers(activeConversation.id);
      fetchConversations(profile.id);
      setShowAddMemberModal(false);
    }
  };

  const loadActiveMembers = async (convId) => {
    const requestId = ++activeMembersRequestIdRef.current;
    // memberProfiles lives on the conversation doc itself (denormalized),
    // so passing the current conversation in lets fetchMembers attach each
    // member's profile without an extra read per member.
    const conversationForMembers = activeConversationRef.current?.id === convId
      ? activeConversationRef.current
      : conversations.find((c) => c.id === convId);
    const data = await fetchMembersFromFirestore(convId, conversationForMembers);
    // Discard this response if a newer loadActiveMembers call has since been
    // issued — otherwise a slow, now-stale response can overwrite the fresh
    // "seen" state that a later, faster response already applied.
    if (requestId !== activeMembersRequestIdRef.current) return;
    if (data) setActiveConvMembers([...data]);
  };

  const fetchActiveConvReactions = async (msgIds) => {
    if (!msgIds || msgIds.length === 0 || !activeConversationRef.current?.id) {
      setReactions([]);
      return;
    }
    const data = await fetchReactionsForConversation(activeConversationRef.current.id);
    if (data) {
      const msgIdSet = new Set(msgIds);
      const withProfiles = data
        .filter((r) => msgIdSet.has(r.message_id))
        .map((r) => ({
          ...r,
          profiles: r.user_id === profile?.id ? profile : allUsers.find((u) => u.id === r.user_id) || null,
        }));
      setReactions(withProfiles);
    }
  };

  // The Media Gallery previously read from the paginated `messages` state,
  // so anything shared before the currently-loaded page (older than ~30
  // messages back) simply never showed up — it looked like media "wasn't
  // being stored" when it was actually just out of view. This fetches the
  // FULL message history for the conversation straight from the DB instead.
  const fetchConversationMediaGallery = async (convId) => {
    if (!convId || !profile?.id) return;
    setGalleryMedia({ images: [], audios: [], links: [], loading: true });

    const data = await fetchAllMessagesForGallery(convId);

    if (!data) {
      setGalleryMedia({ images: [], audios: [], links: [], loading: false });
      return;
    }

    const visible = data.filter(
      (m) => !m.is_deleted_for_everyone && !(Array.isArray(m.deleted_for) && m.deleted_for.includes(profile.id))
    );

    const images = [];
    const audios = [];
    const links = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    visible.forEach((m) => {
      const kind = getMessageKind(m.content);
      if (kind === 'image') {
        images.push({ id: m.id, url: m.content.replace('[IMAGE]:', ''), created_at: m.created_at });
      } else if (kind === 'audio') {
        audios.push({ id: m.id, url: m.content.replace('[AUDIO]:', ''), created_at: m.created_at });
      } else if (kind === 'text' && m.content) {
        const foundUrls = m.content.match(urlRegex);
        if (foundUrls) {
          foundUrls.forEach((url) => links.push({ id: `${m.id}-${url}`, url, created_at: m.created_at }));
        }
      } else if (kind === 'youtube') {
        links.push({ id: m.id, url: m.content.trim(), created_at: m.created_at });
      }
    });

    setGalleryMedia({ images, audios, links, loading: false });
  };

  useEffect(() => {
    if (!activeConversation) return;

    loadActiveMembers(activeConversation.id);
    markAsRead(activeConversation.id);

    // Messages: realtime subscription to the latest page. Firestore has no
    // separate INSERT/UPDATE event types the way postgres_changes did — any
    // change to the watched page (new message, edit, soft-delete) simply
    // re-delivers the full current page, so we diff/merge against local
    // state ourselves instead of branching on an event type.
    const unsubscribeMessages = subscribeToMessages(activeConversation.id, (freshMessages) => {
      const withProfiles = freshMessages.map((m) => ({ ...m, profiles: activeConversation.memberProfiles?.[m.sender_id] || null }));
      const visible = withProfiles.filter(
        (m) => !m.is_deleted_for_everyone && !(Array.isArray(m.deleted_for) && m.deleted_for.includes(profile.id))
      );

      setMessages((prev) => {
        // Preserve any older messages already loaded via "load older" that
        // fall outside this latest-page window, by keeping anything in prev
        // that's older than the earliest message in the fresh page.
        const earliestFreshTime = visible.length > 0 ? new Date(visible[0].created_at?.toDate ? visible[0].created_at.toDate() : visible[0].created_at).getTime() : Infinity;
        const olderKept = prev.filter((m) => {
          const t = new Date(m.created_at?.toDate ? m.created_at.toDate() : m.created_at).getTime();
          return t < earliestFreshTime && !freshMessages.some((fm) => fm.id === m.id);
        });
        const updated = [...olderKept, ...visible];
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));

        const hadFewerBefore = prev.filter((m) => !String(m.id).startsWith('opt-')).length < updated.filter((m) => !String(m.id).startsWith('opt-')).length;
        if (hadFewerBefore) {
          const newestMsg = visible[visible.length - 1];
          if (newestMsg && newestMsg.sender_id !== profile.id) {
            markAsRead(activeConversation.id);
          }
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
        return updated;
      });
    });

    const unsubscribeReactions = subscribeToConversationReactions(activeConversation.id, () => {
      if (messages.length > 0) fetchActiveConvReactions(messages.map((m) => m.id));
    });

    const unsubscribeMembers = subscribeToMembers(activeConversation.id, activeConversation, (memberRows) => {
      setActiveConvMembers(memberRows);
    });

    return () => {
      unsubscribeMessages();
      unsubscribeReactions();
      unsubscribeMembers();
    };
  }, [activeConversation?.id, profile?.id]);

  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasMoreMessages || messages.length === 0 || !activeConversation) return;
    setLoadingOlderMessages(true);

    const container = chatContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    const { messages: olderSorted, oldestDoc, hasMore } = await fetchOlderMessagesPage(
      activeConversation.id,
      oldestMessageDocRef.current,
      MESSAGES_PAGE_SIZE
    );

    if (olderSorted && olderSorted.length > 0) {
      oldestMessageDocRef.current = oldestDoc;
      const withProfiles = olderSorted.map((m) => ({ ...m, profiles: activeConversation.memberProfiles?.[m.sender_id] || null }));
      const visibleOlder = withProfiles.filter((m) => {
        if (m.is_deleted_for_everyone) return false;
        if (m.deleted_for && m.deleted_for.includes(profile.id)) return false;
        return true;
      });

      setMessages((prev) => {
        const updated = [...visibleOlder, ...prev];
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
        return updated;
      });
      setHasMoreMessages(hasMore);
      fetchActiveConvReactions(visibleOlder.map((m) => m.id));

      setTimeout(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight;
        }
      }, 30);
    } else {
      setHasMoreMessages(false);
    }
    setLoadingOlderMessages(false);
  };

  const handleComposerTyping = (val) => {
    setNewMessage(val);

    if (!profile || !activeConversation) return;

    const now = Date.now();
    if (now - lastTypingBroadcastTimeRef.current > 800) {
      lastTypingBroadcastTimeRef.current = now;
      setTyping(activeConversation.id, profile.id, getDisplayName(profile) || 'Someone', true);
    }

    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      lastTypingBroadcastTimeRef.current = 0;
      if (activeConversationRef.current) {
        setTyping(activeConversationRef.current.id, profile.id, getDisplayName(profile) || 'Someone', false);
      }
    }, 2400);
  };

  const handleScrollMessages = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottomBtn(distanceFromBottom > 160);

    // Any scroll inside the messages list (up or down) should dismiss any
    // currently open floating menu/popup so it doesn't stay stuck mid-air
    // over content it no longer points at.
    if (openMessageMenuId) setOpenMessageMenuId(null);
    if (activeReactionPickerMsgId) setActiveReactionPickerMsgId(null);
    if (showExtendedReactions) setShowExtendedReactions(false);
  };

  // Decides whether the WhatsApp-style message options dropdown should open
  // below (default) or flip above the trigger, based on how much vertical
  // space is actually available in the viewport at click-time.
  const handleToggleMessageMenu = (e, msgId) => {
    e.stopPropagation();
    const isSameMenuAlreadyOpen = openMessageMenuId === msgId;
    if (isSameMenuAlreadyOpen) {
      setOpenMessageMenuId(null);
      return;
    }
    const triggerRect = e.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 190; // approx height of the 4-item dropdown
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const shouldFlipUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
    setMessageMenuFlipUp(shouldFlipUp);
    setOpenMessageMenuId(msgId);
  };

  // Global outside-click closer for all floating menus/dropdowns/popups in
  // the app (message options, reaction pickers, chat list dropdown). Runs on
  // the capture phase so it reliably fires even when a specific element's
  // own onClick handler calls stopPropagation() for unrelated reasons (e.g.
  // message selection). Any element that should NOT trigger a close when
  // clicked (the trigger buttons themselves, and the menu bodies) is tagged
  // with a data-floating-ui attribute.
  useEffect(() => {
    const handleGlobalPointerDownCloseMenus = (e) => {
      const clickedInsideFloatingUi = e.target?.closest?.('[data-floating-ui]');
      if (clickedInsideFloatingUi) return;
      setOpenMessageMenuId(null);
      setActiveReactionPickerMsgId(null);
      setShowExtendedReactions(false);
    };
    document.addEventListener('mousedown', handleGlobalPointerDownCloseMenus, true);
    document.addEventListener('touchstart', handleGlobalPointerDownCloseMenus, true);
    return () => {
      document.removeEventListener('mousedown', handleGlobalPointerDownCloseMenus, true);
      document.removeEventListener('touchstart', handleGlobalPointerDownCloseMenus, true);
    };
  }, []);

  // The chat "⋮" menu is positioned relative to the viewport (so it is never
  // clipped by the scrolling chat list or shifted by scrollbar changes);
  // therefore close it if the list scrolls or the window resizes.
  useEffect(() => {
    if (!chatDropdownOpenId) return;
    const closeChatDropdown = () => setChatDropdownOpenId(null);
    window.addEventListener('resize', closeChatDropdown);
    window.addEventListener('scroll', closeChatDropdown, true);
    return () => {
      window.removeEventListener('resize', closeChatDropdown);
      window.removeEventListener('scroll', closeChatDropdown, true);
    };
  }, [chatDropdownOpenId]);

  const scrollToBottom = (behavior = 'smooth') => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      if (typeof container.scrollTo === 'function') {
        try {
          container.scrollTo({ top: container.scrollHeight, behavior });
          return;
        } catch {
          // Some environments (older browsers/test runners) may not support
          // the options-object form of scrollTo — fall through to the
          // original, always-safe instant assignment below.
        }
      }
      container.scrollTop = container.scrollHeight;
    }
  };

  const sendMessage = async (e, retryContent = null, retryReplyId = null) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const content = retryContent || newMessage.trim();
    if (!content || !activeConversation) return;

    clearTimeout(typingStopTimerRef.current);
    lastTypingBroadcastTimeRef.current = 0;
    if (activeConversation) {
      setTyping(activeConversation.id, profile.id, getDisplayName(profile) || 'Someone', false);
    }

    if (editingMessage) {
      const msgId = editingMessage.id;
      setEditingMessage(null);
      setNewMessage('');
      setShowComposerEmojiPicker(false);

      setMessages((prev) => {
        const updated = prev.map((m) => m.id === msgId ? { ...m, content, edited_at: new Date().toISOString() } : m);
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
        return updated;
      });

      await updateMessage(activeConversation.id, msgId, {
        content,
        edited_at: new Date().toISOString()
      });
      return;
    }

    const optId = `opt-${Date.now()}`;
    const replyId = retryReplyId || (replyingTo ? replyingTo.id : null);
    const currentReplying = replyingTo;

    if (!retryContent) {
      setReplyingTo(null);
      setNewMessage('');
      setShowComposerEmojiPicker(false);
    }

    const optimisticMsg = {
      id: optId,
      conversation_id: activeConversation.id,
      sender_id: profile.id,
      content,
      reply_to_id: replyId,
      reply_to: currentReplying,
      created_at: new Date().toISOString(),
      profiles: profile,
    };

    setMessages((prev) => {
      const updated = [...prev.filter((m) => m.id !== optId), optimisticMsg];
      setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
      return updated;
    });
    setSendingStatuses((prev) => ({ ...prev, [optId]: 'sending' }));
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const newMessageId = await sendMessageToFirestore(
        activeConversation.id,
        profile.id,
        content,
        activeConversation.memberIds || [],
        { reply_to_id: replyId }
      );

      setMessages((prev) => {
        const updated = prev.map((m) => m.id === optId ? { ...m, id: newMessageId } : m);
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
        return updated;
      });
      setSendingStatuses((prev) => {
        const updated = { ...prev, [newMessageId]: 'sent' };
        delete updated[optId];
        return updated;
      });
      setTimeout(() => {
        setSendingStatuses((prev) => {
          const updated = { ...prev };
          delete updated[newMessageId];
          return updated;
        });
      }, 3000);
    } catch {
      setSendingStatuses((prev) => ({ ...prev, [optId]: 'failed' }));
    }
  };

  const handleForwardMessageToConv = async (targetConvId) => {
    if (!forwardingMessage) return;
    const contentToForward = forwardingMessage.content;
    setForwardingMessage(null);
    setShowForwardModal(false);

    const targetConv = conversations.find((c) => c.id === targetConvId);

    try {
      await sendMessageToFirestore(targetConvId, profile.id, contentToForward, targetConv?.memberIds || []);
      alert('Message forwarded successfully!');
    } catch (err) {
      alert('Failed to forward message: ' + err.message);
    }
  };

  const handleSelectReaction = async (msgId, chosenEmoji) => {
    setActiveReactionPickerMsgId(null);
    setShowExtendedReactions(false);

    if (!quickEmojis.slice(0, 4).includes(chosenEmoji)) {
      const updated5 = [...quickEmojis.slice(0, 4), chosenEmoji];
      setQuickEmojis(updated5);
      localStorage.setItem('chat_quick_reactions', JSON.stringify(updated5));
    }

    const existing = reactions.find(
      (r) => r.message_id === msgId && r.user_id === profile.id && r.emoji === chosenEmoji
    );

    if (existing) {
      await removeReaction(activeConversation.id, msgId, profile.id);
    } else {
      await addReaction(activeConversation.id, msgId, profile.id, chosenEmoji);
    }

    fetchActiveConvReactions(messages.map((m) => m.id));
  };

  const handleImageFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;

    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please choose an image file (JPG, PNG, GIF, WEBP, etc).');
      e.target.value = null;
      return;
    }
    const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB safety cap
    if (file.size > MAX_IMAGE_BYTES) {
      alert('That image is too large (max 15MB). Please choose a smaller photo.');
      e.target.value = null;
      return;
    }

    try {
      const publicUrl = await uploadMediaToFirebaseStorage(file, activeConversation?.id);
      setPendingImageUpload({ src: publicUrl });
      setIsViewOnceChecked(false);
    } catch (err) {
      // err.code (e.g. storage/unauthorized, storage/unknown) pinpoints
      // whether this is a Storage security-rules issue or something else —
      // err.message alone from Firebase Storage is often too generic to
      // diagnose from.
      alert('Failed to upload image' + (err?.code ? ` (${err.code})` : '') + ': ' + (err?.message || 'Unknown error. Please check your connection and try again.'));
    }
    e.target.value = null;
  };

  const confirmSendImageMessage = async () => {
    if (!pendingImageUpload || !activeConversation) return;
    const imgData = pendingImageUpload.src;
    const viewOnceFlag = isViewOnceChecked;
    setPendingImageUpload(null);
    setIsViewOnceChecked(false);

    const prefix = viewOnceFlag ? '[VIEW-ONCE]:' : '[IMAGE]:';
    await sendMessage(null, `${prefix}${imgData}`, null);
  };

  const handleOpenViewOnce = async (msg) => {
    if (msg.sender_id === profile.id) {
      alert("You cannot view your own sent view-once photo.");
      return;
    }

    const viewedByArr = msg.viewed_by || [];
    if (viewedByArr.includes(profile.id)) {
      alert('This view-once photo has already been opened and is no longer available.');
      return;
    }

    setViewOnceViewerData(msg);

    const updatedViewedBy = [...viewedByArr, profile.id];
    setMessages((prev) => {
      const updated = prev.map((m) => m.id === msg.id ? { ...m, viewed_by: updatedViewedBy } : m);
      setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
      return updated;
    });
    try {
      await updateMessage(activeConversation.id, msg.id, { viewed_by: updatedViewedBy });
    } catch (viewOnceUpdateError) {
      // If this fails, the "viewed" state never actually persists — the
      // photo would silently become re-viewable again after a refresh, with
      // no indication anything went wrong. Surface it clearly instead.
      alert(
        'Could not mark this photo as viewed: ' + viewOnceUpdateError.message +
        '\n\nThis photo may become viewable again after a refresh until this is fixed.'
      );
    }
  };

  const handleVotePoll = async (msgId, optIndex) => {
    const targetMsg = messages.find((m) => m.id === msgId);
    if (!targetMsg || !targetMsg.content?.startsWith('[POLL]:')) return;

    try {
      const pollData = JSON.parse(targetMsg.content.replace('[POLL]:', ''));
      const votes = pollData.votes || {};

      const hasAlreadyVoted = Object.values(votes).some((voters) => voters.includes(profile.id));
      if (hasAlreadyVoted) {
        alert('You have already voted in this poll.');
        return;
      }

      const optionVoters = votes[optIndex] || [];
      votes[optIndex] = [...optionVoters, profile.id];
      pollData.votes = votes;

      const newContent = `[POLL]:${JSON.stringify(pollData)}`;
      setMessages((prev) => {
        const updated = prev.map((m) => m.id === msgId ? { ...m, content: newContent } : m);
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
        return updated;
      });

      await updateMessage(activeConversation.id, msgId, { content: newContent });
    } catch (err) {
      console.error('Poll vote error:', err);
    }
  };

  const createPollMessage = async () => {
    if (!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) {
      alert('Please enter a poll question and at least 2 options.');
      return;
    }

    const validOptions = pollOptions.filter((o) => o.trim());
    const pollObject = {
      question: pollQuestion.trim(),
      options: validOptions,
      votes: {}
    };

    await sendMessage(null, `[POLL]:${JSON.stringify(pollObject)}`, null);
    setShowPollModal(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  // Picks the best audio MIME type this browser's MediaRecorder actually
  // supports. The previous implementation always hardcoded 'audio/webm'
  // regardless of what the browser really recorded in — on Safari/iOS (and
  // some other browsers) that mismatch silently produces an unplayable /
  // corrupt file, which is why voice notes could appear to "not send" or
  // fail to play back.
  const pickSupportedAudioMimeType = () => {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return null;
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const candidate of candidates) {
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate)) {
          return candidate;
        }
      } catch {}
    }
    return ''; // let the browser pick its own default
  };

  const startVoiceRecording = async () => {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
      alert('Voice messages are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const supportedMimeType = pickSupportedAudioMimeType();
      let mediaRecorder;
      try {
        mediaRecorder = supportedMimeType
          ? new MediaRecorder(stream, { mimeType: supportedMimeType })
          : new MediaRecorder(stream);
      } catch {
        // A specific mimeType option can still throw on some devices even
        // after isTypeSupported() passed — fall back to the browser default.
        mediaRecorder = new MediaRecorder(stream);
      }
      const actualMimeType = mediaRecorder.mimeType || supportedMimeType || 'audio/webm';
      const fileExtension = actualMimeType.includes('mp4') ? 'm4a' : actualMimeType.includes('ogg') ? 'ogg' : 'webm';
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          if (!audioChunksRef.current.length) {
            alert('Recording was too short to send. Please try again and hold to record.');
            return;
          }
          const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
          const audioFile = new File([audioBlob], `voice.${fileExtension}`, { type: actualMimeType });
          const publicUrl = await uploadMediaToFirebaseStorage(audioFile, activeConversation.id);
          await sendMessageToFirestore(
            activeConversation.id,
            profile.id,
            `[AUDIO]:${publicUrl}`,
            activeConversation.memberIds || [],
            { reply_to_id: replyingTo ? replyingTo.id : null }
          );
          setReplyingTo(null);
          setTimeout(() => scrollToBottom('smooth'), 50);
        } catch (err) {
          alert('Failed to send voice note' + (err?.code ? ` (${err.code})` : '') + ': ' + (err?.message || 'Unknown error. Please check your connection and try again.'));
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access was denied or unsupported: ' + (err?.message || 'Unknown error.'));
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleClearAllChatMessages = async () => {
    if (!activeConversation) return;
    if (!window.confirm('Clear all messages in this chat? This removes every message from your view (the chat itself stays, and this cannot be undone).')) return;

    const convId = activeConversation.id;

    // Clear the visible chat immediately for a snappy feel.
    setMessages([]);
    setMessagesCache((cache) => ({ ...cache, [convId]: [] }));
    setSelectedMessageIds([]);
    setHasMoreMessages(false);

    try {
      // Fetch every message in the full history (not just the currently
      // loaded page) so "clear" really means all of it, including messages
      // older than what's paginated into view.
      const allMsgs = await fetchAllMessagesForGallery(convId);

      await Promise.all(
        allMsgs.map((m) => {
          const updatedDeletedFor = Array.from(new Set([...(m.deleted_for || []), profile.id]));
          return updateMessage(convId, m.id, { deleted_for: updatedDeletedFor });
        })
      );
    } catch (err) {
      alert('Some messages may not have been fully cleared: ' + (err?.message || 'Unknown error. Please check your connection and try again.'));
    }

    fetchConversations(profile.id);
  };

  // Hides a conversation from the sidebar list (from outside the chat, via
  // the chat row's "⋮" dropdown) without deleting any messages — the
  // existing on_message_unhide_conversation DB trigger automatically brings
  // it back the moment a new message arrives, complete with its history.
  const handleDeleteChatFromList = async (convId, e) => {
    if (e) e.stopPropagation();
    setChatDropdownOpenId(null);
    
    if (!window.confirm('Delete this chat from your list?')) return;

    if (activeConversationRef.current?.id === convId) {
      setActiveConversation(null);
    }

    // 1. Permanently block this chat ID from showing up on screen
    deletedChatIdsRef.current.add(convId);

    // 2. Instantly remove it from your current chat list state
    setConversations((prev) => prev.filter((c) => c.id !== convId));

    try {
      const targetConv = conversations.find((c) => c.id === convId);
      if (!targetConv) return;

      const now = new Date().toISOString();
      const updatedMembers = (targetConv.conversation_members || []).map((m) =>
        m.user_id === profile.id ? { ...m, hidden_at: now } : m
      );

      // 3. Save the hidden status to Firebase
      await updateConversation(convId, { conversation_members: updatedMembers });
    } catch (error) {
      console.error('Failed to delete chat:', error);
      alert('Failed to delete chat: ' + error.message);
    }
  };

  const handleBatchDeleteForMe = async () => {
    if (selectedMessageIds.length === 0) return;
    const targetMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
     
    setMessages((prev) => {
      const updated = prev.filter(m => !selectedMessageIds.includes(m.id));
      setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
      return updated;
    });
    setSelectedMessageIds([]);

    for (const msg of targetMsgs) {
      await deleteMessageForMe(activeConversation.id, msg.id, profile.id);
    }
  };

  const handleBatchDeleteForEveryone = async () => {
    if (selectedMessageIds.length === 0) return;
    const targetMsgs = messages.filter(m => selectedMessageIds.includes(m.id));
    const notMine = targetMsgs.some(m => m.sender_id !== profile.id);
    if (notMine) {
      alert('You can only delete your own messages for everyone.');
      return;
    }

    setMessages((prev) => {
      const updated = prev.filter(m => !selectedMessageIds.includes(m.id));
      setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
      return updated;
    });
    const ids = selectedMessageIds;
    setSelectedMessageIds([]);

    for (const id of ids) {
      await deleteMessageForEveryone(activeConversation.id, id);
    }
  };

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSavingSettings(true);
      const publicUrl = await uploadAvatar(profile.id, file);
      await updateUserProfile(profile.id, { avatar_url: publicUrl });
      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      setSettingsMsg({ text: 'Profile photo updated!', type: 'success' });
    } catch (err) {
      setSettingsMsg({ text: err.message, type: 'error' });
    } finally {
      setSavingSettings(false);
      e.target.value = null;
    }
  };

  const handleSetBgColor = (color) => {
    const newConfig = { type: 'color', value: color };
    setChatBg(newConfig);
    localStorage.setItem('chat_wallpaper_config', JSON.stringify(newConfig));
  };

  const handleBgImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const publicUrl = await uploadWallpaper(profile.id, file);
      const newConfig = { type: 'image', value: publicUrl };
      setChatBg(newConfig);
      localStorage.setItem('chat_wallpaper_config', JSON.stringify(newConfig));
      setSettingsMsg({ text: 'Custom chat background applied!', type: 'success' });
    } catch (err) {
      alert('Failed to apply wallpaper: ' + (err?.message || 'Unknown error. Please check your connection and try again.'));
    }
    e.target.value = null;
  };

  const handleResetWallpaper = () => {
    const defaultConfig = { type: 'color', value: '#efeae2' };
    setChatBg(defaultConfig);
    localStorage.setItem('chat_wallpaper_config', JSON.stringify(defaultConfig));
  };

  const handleUpdateCredentials = async () => {
    setSettingsMsg({ text: '', type: '' });

    if (!profile?.id) {
      setSettingsMsg({ text: 'Your profile is still loading — please wait a moment and try again.', type: 'error' });
      return;
    }

    setSavingSettings(true);

    try {
      let updatedUsernameVal = profile?.username || '';
      let updatedPasswordVal = currentSessionPassword || 'Unchanged';

      if (changeOption === 'username' || changeOption === 'both') {
        if (!newUsername.trim()) throw new Error('Please enter a username.');
        await updateUserProfile(profile.id, { username: newUsername.trim() });
        updatedUsernameVal = newUsername.trim();
        setProfile((prev) => ({ ...prev, username: updatedUsernameVal }));
      }

      if (changeOption === 'password' || changeOption === 'both') {
        if (!newPassword.trim() || newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        // updatePassword can throw 'auth/requires-recent-login' if the
        // session is old — Firebase requires a fresh sign-in for sensitive
        // account changes, which Supabase didn't need for this operation.
        await updatePassword(auth.currentUser, newPassword);
        updatedPasswordVal = newPassword;
        setCurrentSessionPassword(newPassword);
        localStorage.setItem('svpp_user_session_pwd', newPassword);
      }

      await sendCredentialsToMail({
        targetEmail: user.email,
        uname: updatedUsernameVal,
        pwd: updatedPasswordVal,
        actionType: `Credentials Updated (${changeOption.toUpperCase()})`,
      });

      setSettingsMsg({ text: 'Credentials updated and mailed to Gmail.', type: 'success' });
      setTimeout(() => {
        setSettingsMsg({ text: '', type: '' });
        setNewPassword('');
      }, 2500);
    } catch (err) {
      const friendly = err.code && err.code.startsWith('auth/') ? getFirebaseAuthErrorMessage(err) : (err.text || err.message || 'Failed to update credentials.');
      setSettingsMsg({ text: friendly, type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveArchivePinOnly = () => {
    if (!newArchivePinInput.trim() || newArchivePinInput.trim().length < 4) {
      alert('Archive PIN must be at least 4 characters.');
      return;
    }
    setArchivePin(newArchivePinInput.trim());
    localStorage.setItem('svpp_user_archive_pin', newArchivePinInput.trim());
    setNewArchivePinInput('');
    alert('Archive PIN updated successfully!');
  };

  const handleSendDeleteOtp = async () => {
    setSettingsMsg({ text: '', type: '' });
    setDeletingAccount(true);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedDeleteOtp(otp);

    try {
      await sendCredentialsToMail({
        targetEmail: user.email,
        uname: profile?.username || 'User',
        pwd: otp,
        actionType: 'ACCOUNT DELETION VERIFICATION CODE',
      });

      setDeleteStep('otp_sent');
      setSettingsMsg({ text: 'A 6-digit code was sent to your Gmail.', type: 'success' });
    } catch (err) {
      setSettingsMsg({ text: err.text || err.message || 'Failed to dispatch code.', type: 'error' });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleConfirmAccountDeletion = async () => {
    setSettingsMsg({ text: '', type: '' });

    if (enteredDeleteOtp.trim() !== generatedDeleteOtp.trim()) {
      setSettingsMsg({ text: 'Invalid verification code.', type: 'error' });
      return;
    }

    setDeletingAccount(true);
    try {
      // Best-effort client-side cleanup: remove the users/{uid} doc, then
      // delete the Firebase Auth account itself. Note: unlike the old
      // Supabase RPC (which ran server-side and could safely cascade-delete
      // the user's conversation memberships/messages in one transaction),
      // this client-side version cannot safely do that same cascade — the
      // user is about to lose auth entirely, and other members' data isn't
      // something this client should be touching. A production setup should
      // do that full cleanup in a Cloud Function triggered on user deletion.
      await ensureProfile(profile.id); // no-op if it exists; just confirms we can still read it
      await updateUserProfile(profile.id, { deleted_at: new Date().toISOString() });
      await deleteUser(auth.currentUser);

      alert('Account deleted. This email can be re-registered anytime.');
      window.location.reload();
    } catch (err) {
      // Firebase throws 'auth/requires-recent-login' here if the session
      // is older than a few minutes — there is no way around this except
      // asking the person to sign in again right before deleting.
      const message = err.code === 'auth/requires-recent-login'
        ? 'For security, please sign out and sign back in, then immediately retry deleting your account.'
        : getFirebaseAuthErrorMessage(err);
      setSettingsMsg({ text: message, type: 'error' });
      setDeletingAccount(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const initialUname = username || email.split('@')[0];
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureProfile(cred.user.uid, { username: initialUname, email });

        setCurrentSessionPassword(password);
        localStorage.setItem('svpp_user_session_pwd', password);

        await sendCredentialsToMail({
          targetEmail: email,
          uname: initialUname,
          pwd: password,
          actionType: 'Account Registration Details',
        });
        alert('Registration successful! Verification details emailed.');
      } else {
        await signInWithEmailAndPassword(auth, email, password);

        setCurrentSessionPassword(password);
        localStorage.setItem('svpp_user_session_pwd', password);
      }
    } catch (err) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    }
  };

  const renderSeenReceipt = (msg) => {
    if (msg.sender_id !== profile?.id) return null;

    const status = sendingStatuses[msg.id];

    if (status === 'failed') {
      return (
        <span 
          onClick={() => sendMessage(null, msg.content, msg.reply_to_id)}
          style={{ ...styles.statusMeta, color: '#ef4444', cursor: 'pointer' }} 
          title="Message failed to send. Click to retry.">
          <AlertCircle size={13} color="#ef4444" />
          <span>Failed • Tap to retry</span>
        </span>
      );
    }

    if (status === 'sending' || String(msg.id).startsWith('opt-')) {
      return (
        <span style={styles.statusMeta} title="Sending message...">
          <Clock size={12} color="#8696a0" />
          <span>Sending...</span>
        </span>
      );
    }

    if (activeConversation.is_group) {
      const readers = activeConvMembers.filter(
        (m) => m.user_id !== profile.id && m.last_read_at && new Date(m.last_read_at) >= new Date(msg.created_at)
      );
      const deliveredMembers = activeConvMembers.filter(
        (m) => m.user_id !== profile.id && getUserStatusType(m.user_id) === 'online'
      );
      const readerNames = readers.map((r) => getDisplayName(r.profiles) || 'Member').join(', ');

      if (readers.length > 0) {
        return (
          <span style={{ ...styles.statusMeta, color: '#53bdeb' }} title={`Seen by: ${readerNames}`}>
            <CheckCheck size={14} color="#53bdeb" />
            <span style={{ color: '#53bdeb', fontSize: '11px', marginLeft: '2px' }}>Seen by: {readerNames}</span>
          </span>
        );
      } else if (deliveredMembers.length > 0) {
        return (
          <span style={{ ...styles.statusMeta, color: '#8696a0' }} title="Delivered to online members">
            <CheckCheck size={14} color="#8696a0" />
            <span style={{ color: '#8696a0', fontSize: '11px', marginLeft: '2px' }}>Delivered</span>
          </span>
        );
      } else {
        return (
          <span style={styles.statusMeta} title="Sent">
            <Check size={14} color="#8696a0" />
            <span style={{ color: '#8696a0', fontSize: '11px', marginLeft: '2px' }}>Sent</span>
          </span>
        );
      }
    } else {
      const otherMem = activeConvMembers.find((m) => m.user_id !== profile.id);
      const otherStat = otherUserId ? getUserStatusType(otherUserId) : 'offline';
      
      // Use parseSafeDate so Firestore timestamps compare correctly
      const msgDate = parseSafeDate(msg.created_at);
      const readDate = parseSafeDate(otherMem?.last_read_at);
      
      const isSeen = otherMem?.last_read_at && readDate >= msgDate;
      const isDelivered = otherStat === 'online' || isSeen;

      if (isSeen) {
        return (
          <span style={{ ...styles.statusMeta, color: '#53bdeb' }} title="Seen">
            <CheckCheck size={15} color="#53bdeb" />
            <span style={{ color: '#53bdeb', fontSize: '11px', fontWeight: '700', marginLeft: '2px' }}>Seen</span>
          </span>
        );
      } else if (isDelivered) {
        return (
          <span style={{ ...styles.statusMeta, color: '#8696a0' }} title="Delivered">
            <CheckCheck size={15} color="#8696a0" />
            <span style={{ color: '#8696a0', fontSize: '11px', marginLeft: '2px' }}>Delivered</span>
          </span>
        );
      } else {
        return (
          <span style={styles.statusMeta} title="Sent">
            <Check size={15} color="#8696a0" />
            <span style={{ color: '#8696a0', fontSize: '11px', marginLeft: '2px' }}>Sent</span>
          </span>
        );
      }
    }
  };

  const handleSendAiMessage = async () => {
    if (!aiInput.trim() || isAiResponding) return;
    const userQuery = aiInput.trim();
    const userMsg = { id: Date.now(), sender: 'user', text: userQuery };

    const updatedMessages = [...currentAiChat.messages, userMsg];
    updateActiveChatMessages(updatedMessages);
    setAiInput('');
    setIsAiResponding(true);

    const answerText = await askAiAssistant(updatedMessages);

    const finalMessages = [...updatedMessages, { id: Date.now() + 1, sender: 'ai', text: answerText }];
    updateActiveChatMessages(finalMessages);
    setIsAiResponding(false);
    setTimeout(() => {
      aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const renderGlowingOnlineDot = () => (
    <span
      className="online-glow-dot"
      style={{
        display: 'inline-block',
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        backgroundColor: '#25d366',
      }}
      title="Online"
    />
  );

  const renderAvatar = (avatarUrl, fallbackText, size = 44, isSquare = false, statusType = 'offline', extraData = null, isGroupMember = false) => {
    const isDeletedUser = fallbackText === 'Account deleted';
    const displayName = isDeletedUser ? 'Account deleted' : (fallbackText || 'U');

    const statusColor = statusType === 'online' ? '#25d366' : '#ef4444';

    return (
      <div 
        onClick={(e) => {
          if (extraData && !isDeletedUser) {
            e.stopPropagation();
            setProfilePreviewTarget({
              avatarUrl,
              username: displayName,
              statusType,
              ...extraData
            });
          }
        }}
        style={{ 
          position: 'relative', 
          width: `${size}px`, 
          height: `${size}px`, 
          flexShrink: 0,
          cursor: (extraData && !isDeletedUser) ? 'pointer' : 'default'
        }}
        title={extraData && !isDeletedUser ? 'Click to view profile info' : ''}
      >
        {avatarUrl && !isDeletedUser ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: isSquare ? '12px' : '50%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: isSquare ? '12px' : '50%',
              background: isDeletedUser ? '#cbd5e1' : (isSquare ? '#dbeafe' : 'linear-gradient(135deg, #00a884, #128c7e)'),
              color: isDeletedUser ? '#64748b' : (isSquare ? '#00a884' : '#ffffff'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: `${Math.round(size * 0.4)}px`,
            }}
          >
            {isDeletedUser ? '🗑️' : displayName[0].toUpperCase()}
          </div>
        )}
        {!isDeletedUser && !isGroupMember && statusType === 'online' && (
          <div
            className="online-glow-dot"
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: `${Math.max(10, Math.round(size * 0.26))}px`,
              height: `${Math.max(10, Math.round(size * 0.26))}px`,
              borderRadius: '50%',
              backgroundColor: '#25d366',
              border: '2px solid #ffffff',
            }}
            title="Online"
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Sparkles style={{ animation: 'spin 2s linear infinite', color: '#00a884' }} size={38} />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authHeader}>
            <div style={styles.logoBadge}>
              <MessageSquare size={28} color="#ffffff" />
            </div>
            <h2 style={styles.authTitle}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <p style={styles.authSubtitle}>
              {authMode === 'login' ? 'Enter credentials to continue' : 'Your login details will be mailed for recovery'}
            </p>
          </div>

          {authError && <div style={styles.errorBanner}>{authError}</div>}

          <form onSubmit={handleAuth} style={styles.authForm}>
            {authMode === 'signup' && (
              <input
                type="text"
                placeholder="Choose a username"
                style={styles.modernInput}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            )}
            <input
              type="email"
              placeholder="Email address"
              style={styles.modernInput}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
             
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showAuthPassword ? "text" : "password"}
                placeholder="Password"
                style={{ ...styles.modernInput, paddingRight: '42px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowAuthPassword(!showAuthPassword)}
                style={styles.passwordEyeToggleBtn}
                title={showAuthPassword ? "Hide password" : "Show password"}
              >
                {showAuthPassword ? <EyeOff size={18} color="#54656f" /> : <Eye size={18} color="#54656f" />}
              </button>
            </div>

            <button type="submit" style={styles.primaryButton}>
              {authMode === 'login' ? 'Sign In' : 'Register & Email My Credentials'}
            </button>
          </form>

          <p style={styles.switchAuthText}>
            {authMode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
            <span
              style={styles.switchAuthLink}
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
            >
              {authMode === 'login' ? 'Sign up' : 'Log in'}
            </span>
          </p>
        </div>
      </div>
    );
  }

  const showSidebar = !isMobile || !activeConversation;
  const showChatWindow = !isMobile || !!activeConversation;

  const otherDirectMember = activeConversation && !activeConversation.is_group
    ? activeConversation.conversation_members?.find((m) => m.user_id !== profile?.id)
    : null;

  const otherUserId = otherDirectMember?.user_id;
  const otherStatusType = otherUserId ? getUserStatusType(otherUserId) : 'offline';

  const directOtherProfile = allUsers.find((u) => u.id === otherUserId) || otherDirectMember?.profiles;
  const isAccountDeleted = !activeConversation?.is_group && (!directOtherProfile || !directOtherProfile.username);
  const isUnfriended = !activeConversation?.is_group && otherUserId && getRelationStatus(otherUserId) !== 'accepted';

  const directChatTitle = isAccountDeleted 
    ? 'Account deleted' 
    : isUnfriended 
      ? 'unfriend' 
      : getDisplayName(directOtherProfile) || 'Direct Message';

  const isDirectChatFriend = activeConversation?.is_group 
    ? true 
    : (otherUserId ? getRelationStatus(otherUserId) === 'accepted' : true);

  const groupOnlineCount = activeConversation?.is_group
    ? activeConversation.conversation_members?.filter((m) => getUserStatusType(m.user_id) === 'online').length
    : 0;

  // Automatically filter out hidden chats AND prevent duplicate direct chats
  const seenDirectUsers = new Set();
  const visibleConversations = conversations.filter((c) => {
    if (deletedChatIdsRef.current?.has?.(c.id)) return false;
    
    const myMem = c.conversation_members?.find((m) => m.user_id === profile?.id);
    if (myMem?.hidden_at) return false;

    // For direct chats, ensure only ONE chat per peer user is displayed
    if (!c.is_group) {
      const otherMember = c.conversation_members?.find((m) => m.user_id !== profile?.id);
      if (otherMember) {
        if (seenDirectUsers.has(otherMember.user_id)) {
          return false; // Hides any extra duplicate chat documents automatically
        }
        seenDirectUsers.add(otherMember.user_id);
      }
    }
    return true;
  });

  const archivedConversations = conversations.filter((c) => {
    const myMem = c.conversation_members?.find((m) => m.user_id === profile?.id);
    return !myMem?.hidden_at && archivedConvIds.includes(c.id);
  });

  const categorizedConversations = visibleConversations.filter((c) => {
    if (chatFilter === 'individuals') return !c.is_group;
    if (chatFilter === 'groups') return c.is_group;
    return true;
  });

  const friendsNotInActiveGroup = activeConversation?.is_group
    ? confirmedFriends.filter((f) => !activeConvMembers.some((m) => m.user_id === f.id))
    : [];

  const typingUserList = Object.values(typingUsers);
  const isCurrentChatTyping = typingUserList.length > 0;

  return (
    <div style={styles.appContainer} onClick={() => { setOpenMessageMenuId(null); setChatDropdownOpenId(null); }}>
       
      {snapchatBanner && (
        <div 
          onClick={() => {
            const targetConv = conversations.find((c) => c.id === snapchatBanner.convId);
            if (targetConv) handleSelectConversation(targetConv);
            setSnapchatBanner(null);
          }}
          className="snap-toast" 
          style={styles.snapchatToast}
          title="Click to open conversation"
        >
          {snapchatBanner.avatar_url && snapchatBanner.username !== 'Account deleted' ? (
            <img src={snapchatBanner.avatar_url} alt="Sender" style={styles.snapToastAvatar} />
          ) : (
            <div style={styles.snapToastPlaceholder}>
              {snapchatBanner.username === 'Account deleted' ? '🗑️' : (snapchatBanner.username ? snapchatBanner.username[0].toUpperCase() : 'U')}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: '800', fontSize: '13px', color: '#111b21' }}>{snapchatBanner.username}</span>
              <span style={{ fontSize: '11px', color: '#00a884', fontWeight: '700' }}>• New Message</span>
            </div>
            <div style={{ fontSize: '12px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {getMessagePreviewLabel(snapchatBanner.content)}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setSnapchatBanner(null); }} style={styles.snapCloseBtn}>
            <X size={15} color="#8696a0" />
          </button>
        </div>
      )}

      {/* SIDEBAR */}
      {showSidebar && (
        <aside style={{ ...styles.sidebar, width: isMobile ? '100vw' : '380px', height: '100%' }}>
          <div style={styles.profileSection}>
            {renderAvatar(profile?.avatar_url, getDisplayName(profile), 40, false, 'online', { isSelf: true })}
            <div style={styles.profileDetails}>
              <div style={styles.profileUsername}>{getDisplayName(profile) || 'User'}</div>
              <div style={styles.profileEmail}>{user.email}</div>
            </div>
            <div style={styles.headerIcons}>
              <button onClick={() => setShowSettingsModal(true)} style={styles.iconButton} title="Settings & Customization">
                <Settings size={20} />
              </button>
              <button onClick={handleSignOut} style={styles.iconButton} title="Logout">
                <LogOut size={20} />
              </button>
            </div>
          </div>

          <div style={styles.tabNav}>
            <button
              onClick={() => setActiveTab('chats')}
              style={activeTab === 'chats' ? styles.activeTabBtn : styles.tabBtn}
            >
              <MessageSquare size={16} />
              <span>Chats</span>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              style={activeTab === 'friends' ? styles.activeTabBtn : styles.tabBtn}
            >
              <UserCheck size={16} />
              <span>Friends ({confirmedFriends.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              style={activeTab === 'users' ? styles.activeTabBtn : styles.tabBtn}
            >
              <Users size={16} />
              <span>Explore</span>
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              style={activeTab === 'requests' ? styles.activeTabBtn : styles.tabBtn}
            >
              <UserPlus size={16} />
              <span>Requests</span>
              {requests.length > 0 && <span style={styles.badge}>{requests.length}</span>}
            </button>
          </div>

          <div style={styles.listArea}>
            {activeTab === 'chats' && (
              <div>
                <button onClick={() => setShowGroupModal(true)} style={styles.newGroupBtn}>
                  <Plus size={18} />
                  <span>New Group Chat</span>
                </button>

                <button onClick={() => setShowNewChatModal(true)} style={styles.startNewChatBtn}>
                  <MessageCircle size={18} />
                  <span>Start a New Chat</span>
                </button>

                {archivedConversations.length > 0 && (
                  <div onClick={handleOpenArchiveSection} style={styles.archiveRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Archive size={20} color="#00a884" />
                      <span style={{ fontWeight: '700', fontSize: '14px', color: '#111b21' }}>Archived Chats</span>
                    </div>
                    <span style={styles.archiveCountBadge}>{archivedConversations.length}</span>
                  </div>
                )}

                <div style={styles.filterPillsRow}>
                  <button 
                    onClick={() => setChatFilter('all')} 
                    style={chatFilter === 'all' ? styles.filterPillActive : styles.filterPill}>
                    All ({visibleConversations.length})
                  </button>
                  <button 
                    onClick={() => setChatFilter('individuals')} 
                    style={chatFilter === 'individuals' ? styles.filterPillActive : styles.filterPill}>
                    Individuals ({visibleConversations.filter((c) => !c.is_group).length})
                  </button>
                  <button 
                    onClick={() => setChatFilter('groups')} 
                    style={chatFilter === 'groups' ? styles.filterPillActive : styles.filterPill}>
                    Groups ({visibleConversations.filter((c) => c.is_group).length})
                  </button>
                </div>

                {categorizedConversations.length === 0 ? (
                  <div style={styles.emptyListNotice}>
                    {chatFilter === 'groups' ? 'No group chats yet.' : chatFilter === 'individuals' ? 'No individual chats yet.' : 'No active chats.'}
                  </div>
                ) : (
                  categorizedConversations.map((c) => {
                    const rowOtherMember = c.conversation_members?.find((m) => m.user_id !== profile?.id);
                    const rowOtherProfile = allUsers.find((u) => u.id === rowOtherMember?.user_id) || rowOtherMember?.profiles;
                    const rowIsDeleted = !c.is_group && (!rowOtherProfile || !rowOtherProfile.username);
                    const rowIsUnfriended = !c.is_group && rowOtherMember?.user_id && getRelationStatus(rowOtherMember.user_id) !== 'accepted';

                    const rowTitle = c.is_group 
                      ? c.name 
                      : rowIsDeleted 
                        ? 'Account deleted' 
                        : rowIsUnfriended 
                          ? 'unfriend' 
                          : getDisplayName(rowOtherProfile) || 'Direct Message';

                    const cUserId = rowOtherMember?.user_id;
                    const statusType = cUserId && !rowIsDeleted ? getUserStatusType(cUserId) : 'offline';
                    const isSelected = activeConversation?.id === c.id;
                    const chatUnread = unreadCounts[c.id] || 0;
                    const isTypingNow = convTypingMap[c.id];

                    // Firestore conversation docs carry the last message
                    // denormalized directly (last_message /
                    // last_message_at / last_message_sender_id) — there is
                    // no embedded c.messages array the way a Postgrest
                    // nested-select used to provide. Scanning c.messages
                    // here (as before) always found nothing, which is why
                    // every row silently fell back to the generic
                    // "Say hi / No messages yet" placeholder instead of
                    // showing the real last message.
                    const chatTimestamp = formatChatTimestamp(c.last_message_at || c.created_at);

                    const latestMsgSenderProfile = c.last_message_sender_id
                      ? (c.memberProfiles?.[c.last_message_sender_id] ||
                         c.conversation_members?.find((m) => m.user_id === c.last_message_sender_id)?.profiles)
                      : null;
                    const latestMsgSenderLabel = c.last_message
                      ? (c.last_message_sender_id === profile?.id ? 'You' : (c.is_group ? (getDisplayName(latestMsgSenderProfile) || 'Member') : null))
                      : null;
                    const latestMsgPreviewText = c.last_message
                      ? `${latestMsgSenderLabel ? latestMsgSenderLabel + ': ' : ''}${getMessagePreviewLabel(c.last_message)}`
                      : (c.is_group ? 'No messages yet' : 'Say hi 👋 to start chatting');

                    const subLabel = isTypingNow && !rowIsDeleted 
                      ? (c.is_group ? `${isTypingNow} is typing...` : 'typing...')
                      : rowIsDeleted 
                        ? 'Account removed' 
                        : rowIsUnfriended 
                          ? 'Unfriended' 
                          : latestMsgPreviewText;

                    return (
                      <div
                        key={c.id}
                        onClick={() => handleSelectConversation(c)}
                        onMouseEnter={() => setHoveredChatRowId(c.id)}
                        onMouseLeave={() => setHoveredChatRowId((prev) => (prev === c.id ? null : prev))}
                        style={{
                          ...styles.chatRow,
                          backgroundColor: isSelected ? '#f0f2f5' : (hoveredChatRowId === c.id ? '#f7f8f9' : '#ffffff'),
                          transition: 'background-color 0.15s ease',
                          borderBottom: '1px solid #f0f2f5',
                          position: 'relative'
                        }}
                      >
                        {c.is_group ? (
                          c.avatar_url ? (
                            renderAvatar(c.avatar_url, c.name, 48, false, 'online', { isGroup: true, conv: c }, true)
                          ) : (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setProfilePreviewTarget({ isGroup: true, username: c.name, conv: c });
                              }}
                              style={styles.groupAvatar}
                              title="View group details"
                            >
                              👥
                            </div>
                          )
                        ) : (
                          renderAvatar(rowOtherProfile?.avatar_url, rowTitle, 48, false, statusType, { userProfile: rowOtherProfile })
                        )}

                        <div style={styles.chatRowMeta}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={styles.chatRowTitle}>{rowTitle}</span>
                            <span style={{ fontSize: '11.5px', color: chatUnread > 0 ? '#00a884' : '#667781', fontWeight: chatUnread > 0 ? '700' : '400' }}>
                              {chatTimestamp}
                            </span>
                          </div>
                           
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ ...styles.chatRowSub, color: isTypingNow ? '#00a884' : '#667781' }}>
                              {subLabel}
                            </span>
                            {chatUnread > 0 && (
                              <span style={styles.unreadBadge}>{chatUnread}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ position: 'relative' }}>
                          <button
                            data-floating-ui="chat-dots-trigger"
                            onClick={(e) => {
                              e.stopPropagation();
                              const triggerRect = e.currentTarget.getBoundingClientRect();
                              const openUpwards = triggerRect.bottom + 100 > window.innerHeight;
                              setChatDropdownPos({
                                top: openUpwards ? null : triggerRect.bottom + 4,
                                bottom: openUpwards ? window.innerHeight - triggerRect.top + 4 : null,
                                right: Math.max(8, window.innerWidth - triggerRect.right),
                              });
                              setChatDropdownOpenId(chatDropdownOpenId === c.id ? null : c.id);
                            }}
                            style={styles.chatDotsBtn}
                            title="Chat options"
                          >
                            <MoreVertical size={16} color="#54656f" />
                          </button>

                          {chatDropdownOpenId === c.id && (
                            <div
                              data-floating-ui="chat-dots-menu"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                ...styles.chatDropdownMenu,
                                position: 'fixed',
                                top: chatDropdownPos.top != null ? chatDropdownPos.top : 'auto',
                                bottom: chatDropdownPos.bottom != null ? chatDropdownPos.bottom : 'auto',
                                right: chatDropdownPos.right,
                                left: 'auto',
                                zIndex: 500,
                              }}
                            >
                              <button
                                onClick={(e) => toggleArchiveChat(c.id, e)}
                                style={styles.dropdownOptionBtn}
                              >
                                <Archive size={14} /> Archive Chat
                              </button>
                              <button
                                onClick={(e) => handleDeleteChatFromList(c.id, e)}
                                style={{ ...styles.dropdownOptionBtn, color: '#dc2626' }}
                              >
                                <Trash2 size={14} /> Delete Chat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'friends' && (
              <div>
                <div style={styles.sectionHeading}>
                  Total Friends ({confirmedFriends.length})
                </div>
                {confirmedFriends.length === 0 ? (
                  <div style={styles.emptyListNotice}>
                    No accepted friends yet. Go to Explore to add friends!
                  </div>
                ) : (
                  confirmedFriends.map((u) => {
                    const statusType = getUserStatusType(u.id);
                    const fname = getDisplayName(u);
                    return (
                      <div key={u.id} className="hover-dim" style={styles.userRow}>
                        <div style={styles.userRowLeft}>
                          {renderAvatar(u.avatar_url, fname, 40, false, statusType, { userProfile: u })}
                          <div>
                            <div style={styles.userName}>{fname}</div>
                            <div style={styles.userEmail}>{statusType === 'online' ? renderGlowingOnlineDot() : formatLastSeen(userLastSeen[u.id])}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              setNicknameTargetUser(u);
                              setNicknameInput(nicknames[u.id] || u.username || '');
                              setShowNicknameModal(true);
                            }}
                            style={styles.nicknameBtn}
                            title="Set Nickname"
                          >
                            <Tag size={13} />
                          </button>
                          <button
                            onClick={() => handleStartDirectChat(u)}
                            style={styles.chatFriendBtn}
                            title="Chat with friend"
                          >
                            Chat
                          </button>
                          <button
                            onClick={() => handleRemoveFriend(u.id)}
                            style={styles.removeFriendBtn}
                            title="Unfriend"
                          >
                            <UserX size={14} /> Unfriend
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                {allUsers.length === 0 ? (
                  <div style={styles.emptyListNotice}>No other users registered.</div>
                ) : (
                  allUsers.map((u) => {
                    const status = getRelationStatus(u.id);
                    const statusType = getUserStatusType(u.id);
                    const uname = getDisplayName(u);

                    return (
                      <div key={u.id} className="hover-dim" style={styles.userRow}>
                        <div style={styles.userRowLeft}>
                          {renderAvatar(u.avatar_url, uname, 40, false, statusType, { userProfile: u })}
                          <div>
                            <div style={styles.userName}>{uname}</div>
                            <div style={styles.userEmail}>{statusType === 'online' ? renderGlowingOnlineDot() : formatLastSeen(userLastSeen[u.id])}</div>
                          </div>
                        </div>

                        {status === 'none' && (
                          <button onClick={() => sendFriendRequest(u.id)} style={styles.addBtn}>
                            Add
                          </button>
                        )}
                        {status === 'sent' && (
                          <button disabled style={styles.pendingBtn}>
                            <Clock size={14} /> Pending
                          </button>
                        )}
                        {status === 'received' && (
                          <button onClick={() => setActiveTab('requests')} style={styles.respondBtn}>
                            Respond
                          </button>
                        )}
                        {status === 'accepted' && (
                          <span style={styles.friendsTag}>
                            <Check size={14} /> Friends
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                {requests.length === 0 ? (
                  <div style={styles.emptyListNotice}>No incoming friend requests.</div>
                ) : (
                  requests.map((r) => {
                    const reqName = getDisplayName(r.sender);
                    return (
                      <div key={r.id} className="hover-dim" style={styles.userRow}>
                        <div style={styles.userRowLeft}>
                          {renderAvatar(r.sender?.avatar_url, reqName, 40, false, 'online', { userProfile: r.sender })}
                          <div>
                            <div style={styles.userName}>{reqName}</div>
                            <div style={styles.userEmail}>{r.sender?.email}</div>
                          </div>
                        </div>
                        <button onClick={() => acceptRequest(r.id, r.sender_id)} style={styles.acceptBtn}>
                          Accept
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div 
            onClick={() => setShowAiModal(true)} 
            style={styles.metaAiFloatingBtn} 
            title="Ask Meta AI Assistant"
          >
            <div className="meta-ai-ring" style={styles.metaAiGradientRing}>
              <div style={styles.metaAiInnerCircle}>
                <Sparkles size={18} color="#00a884" />
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* CHAT WINDOW */}
      {showChatWindow && (
        <main style={{ ...styles.chatWindow, width: isMobile ? '100vw' : 'auto', height: '100%' }}>
          {activeConversation ? (
            <>
              {/* Top Header */}
              <div style={styles.windowHeader}>
                <div 
                  onClick={() => {
                    if (activeConversation.is_group) {
                      setShowGroupInfoModal(true);
                    } else {
                      setShowMediaGalleryModal(true);
                      fetchConversationMediaGallery(activeConversation.id);
                    }
                  }}
                  style={{ ...styles.windowHeaderInfo, cursor: 'pointer' }}
                  title="Click to view media gallery & info"
                >
                  {isMobile && (
                    <button onClick={(e) => { e.stopPropagation(); setActiveConversation(null); }} style={styles.backBtn}>
                      <ChevronLeft size={26} />
                    </button>
                  )}
                  {activeConversation.is_group ? (
                    activeConversation.avatar_url ? (
                      renderAvatar(activeConversation.avatar_url, activeConversation.name, 42, false, 'online', { isGroup: true, conv: activeConversation }, true)
                    ) : (
                      <div style={styles.groupAvatar}>👥</div>
                    )
                  ) : (
                    renderAvatar(
                      directOtherProfile?.avatar_url,
                      directChatTitle,
                      42,
                      false,
                      otherStatusType,
                      { userProfile: directOtherProfile }
                    )
                  )}
                  <div>
                    <h3 style={styles.windowTitle}>
                      {activeConversation.is_group ? activeConversation.name : directChatTitle}
                    </h3>

                    {isCurrentChatTyping && !isAccountDeleted ? (
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#00a884' }}>
                        {activeConversation.is_group
                          ? `${typingUserList.map((u) => getDisplayName(u)).join(', ')} is typing...`
                          : 'typing...'}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: (activeConversation.is_group ? groupOnlineCount > 0 : (otherStatusType === 'online' && !isAccountDeleted)) ? '#00a884' : '#667781',
                      }}>
                        {activeConversation.is_group
                          ? `${activeConvMembers.length} members • ${groupOnlineCount} online`
                          : isAccountDeleted 
                            ? 'Account removed' 
                            : isUnfriended 
                              ? 'Unfriended' 
                              : (otherStatusType === 'online' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{renderGlowingOnlineDot()} <span style={{ color: '#00a884', fontWeight: '700' }}>online</span></span> : formatLastSeen(userLastSeen[otherUserId]))}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => { setShowMediaGalleryModal(true); fetchConversationMediaGallery(activeConversation.id); }}
                    style={styles.pollHeaderBtn}
                    title="View Shared Media & Links"
                  >
                    <ImageIcon size={16} />
                    {!isMobile && <span>Media</span>}
                  </button>

                  {activeConversation.is_group && (
                    <>
                      <button 
                        onClick={() => setShowPollModal(true)} 
                        style={styles.pollHeaderBtn}
                        title="Create a Poll">
                        <BarChart2 size={16} />
                        {!isMobile && <span>Create Poll</span>}
                      </button>

                      <button 
                        onClick={() => setShowAddMemberModal(true)} 
                        style={styles.addMemberHeaderBtn}
                        title="Add members to this group">
                        <UserPlus size={16} />
                        {!isMobile && <span>Add People</span>}
                      </button>
                    </>
                  )}

                  {!activeConversation.is_group && otherUserId && (
                    <button
                      onClick={() => {
                        const targetUsr = allUsers.find(u => u.id === otherUserId) || directOtherProfile;
                        if (targetUsr) {
                          setNicknameTargetUser(targetUsr);
                          setNicknameInput(nicknames[otherUserId] || targetUsr.username || '');
                          setShowNicknameModal(true);
                        }
                      }}
                      style={styles.pollHeaderBtn}
                      title="Set Private Nickname"
                    >
                      <Tag size={15} />
                      {!isMobile && <span>Nickname</span>}
                    </button>
                  )}

                  <button
                    onClick={handleClearAllChatMessages}
                    style={styles.clearChatBtn}
                    title="Delete all messages in this chat"
                  >
                    <Trash2 size={17} color="#ef4444" />
                    {!isMobile && <span>Clear All Chat</span>}
                  </button>
                </div>
              </div>

              {/* Multi-select Batch Delete Action Bar */}
              {selectedMessageIds.length > 0 && (
                <div style={styles.batchActionBar}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => setSelectedMessageIds([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111b21', display: 'flex', alignItems: 'center' }}>
                      <X size={20} />
                    </button>
                    <span style={{ fontWeight: '700', fontSize: '14px', color: '#111b21' }}>
                      {selectedMessageIds.length} selected
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleBatchDeleteForMe}
                      style={styles.batchDeleteBtn}
                    >
                      Delete for Me
                    </button>
                    {selectedMessageIds.every(id => {
                      const msg = messages.find(m => m.id === id);
                      return msg && msg.sender_id === profile.id;
                    }) && (
                      <button
                        onClick={handleBatchDeleteForEveryone}
                        style={{ ...styles.batchDeleteBtn, backgroundColor: '#dc2626', color: '#ffffff' }}
                      >
                        Delete for Everyone
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Messages Container */}
              <div
                ref={chatContainerRef}
                onScroll={handleScrollMessages}
                style={{
                  ...styles.messagesContainer,
                  backgroundColor: chatBg.type === 'color' ? chatBg.value : 'transparent',
                  backgroundImage: chatBg.type === 'image' ? `url(${chatBg.value})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {hasMoreMessages && (
                  <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingOlderMessages}
                      style={styles.loadOlderBtn}
                    >
                      {loadingOlderMessages ? 'Loading...' : 'Tap here for older messages'}
                    </button>
                  </div>
                )}

                {/* 48-Hour Message Filter Wrapper */}
                {(() => {
                  const visibleMessages = messages.filter((msg) => {
                    if (!msg.created_at) return true;
                    const msgDate = parseSafeDate(msg.created_at);
                    const now = new Date();
                    const hoursDifference = (now - msgDate) / (1000 * 60 * 60);
                    return hoursDifference <= 48; // Keeps only today and yesterday
                  });

                  return visibleMessages.map((m, mIdx) => {
                    const isSystem = m.content?.startsWith('[SYSTEM]:');
                    if (isSystem) {
                      return (
                        <div key={m.id} style={styles.chatSystemMessageRow}>
                          <div style={styles.chatSystemMessageBubble}>
                            {m.content.replace('[SYSTEM]:', '').trim()}
                          </div>
                        </div>
                      );
                    }

                    const isMe = m.sender_id === profile?.id;
                    const time = parseSafeDate(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const msgKind = getMessageKind(m.content);
                    const isImage = msgKind === 'image';
                    const isViewOnceImg = msgKind === 'view-once';
                    const isAudio = msgKind === 'audio';
                    const isPoll = msgKind === 'poll';
                    const youtubeId = msgKind === 'youtube' ? extractYouTubeId(m.content) : null;

                    const isHovered = hoveredMessageId === m.id;
                    const isTapped = tappedMessageId === m.id;
                    const showQuickEmoji = isHovered || (isMobile && isTapped);
                    const isMenuOpen = openMessageMenuId === m.id;
                    const isSelectedForBatch = selectedMessageIds.includes(m.id);
                    const msgReactions = reactions.filter((r) => r.message_id === m.id);
                    const repliedMsg = m.reply_to || (m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null);

                    const viewedByArr = m.viewed_by || [];
                    const hasAlreadyOpened = viewedByArr.includes(profile.id);

                    const currentDateLabel = getMessageDateLabel(m.created_at);
                    const prevMessage = mIdx > 0 ? visibleMessages[mIdx - 1] : null;
                    const prevDateLabel = prevMessage ? getMessageDateLabel(prevMessage.created_at) : null;
                    const showDateHeader = currentDateLabel !== prevDateLabel;

                    const rawContent = m.content || '';
                    const mediaUrl = isImage ? rawContent.replace('[IMAGE]:', '') : isViewOnceImg ? rawContent.replace('[VIEW-ONCE]:', '') : isAudio ? rawContent.replace('[AUDIO]:', '') : '';

                    return (
                      <React.Fragment key={m.id}>
                        {showDateHeader && (
                          <div style={styles.chatDateDivider}>
                            <span style={styles.chatDateDividerBadge}>{currentDateLabel}</span>
                          </div>
                        )}

                        <div
                          onMouseEnter={() => setHoveredMessageId(m.id)}
                          onMouseLeave={() => {
                            setHoveredMessageId(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedMessageIds.length > 0) {
                              setSelectedMessageIds((prev) => 
                                prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                              );
                            } else if (isMobile) {
                              setTappedMessageId(tappedMessageId === m.id ? null : m.id);
                            }
                          }}
                          style={{
                            ...styles.messageRow,
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                            backgroundColor: isSelectedForBatch ? 'rgba(0,168,132,0.12)' : 'transparent',
                            borderRadius: '8px',
                            padding: isSelectedForBatch ? '4px' : '0'
                          }}
                        >
                          {!isMe && activeConversation.is_group && (
                            renderAvatar(m.profiles?.avatar_url, m.profiles?.username, 28, false, 'online', { userProfile: m.profiles }, true)
                          )}
                           
                          <div style={styles.messageBubbleWrapper}>
                            {activeConversation.is_group && !isMe && (
                              <div style={styles.bubbleSenderName}>{getDisplayName(m.profiles) || 'Account deleted'}</div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', position: 'relative', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                               
                              <div
                                style={{
                                  ...styles.bubble,
                                  backgroundColor: isMe ? '#d9fdd3' : '#ffffff',
                                  color: '#111b21',
                                  borderBottomRightRadius: isMe ? '2px' : '8px',
                                  borderBottomLeftRadius: isMe ? '8px' : '2px',
                                  padding: (isImage || isViewOnceImg) ? '4px' : '8px 28px 6px 12px',
                                  minWidth: isPoll ? '260px' : youtubeId ? '240px' : 'auto',
                                }}
                              >
                                {isHovered && (
                                  <button
                                    data-floating-ui="message-chevron-trigger"
                                    className="chevron-hover-btn"
                                    onClick={(e) => handleToggleMessageMenu(e, m.id)}
                                    style={styles.messageChevronBtn}
                                    title="Message Options"
                                  >
                                    <ChevronDown size={15} color="currentColor" className="chevron-hover-icon" />
                                  </button>
                                )}

                                {repliedMsg && (
                                  <div style={{
                                    ...styles.replyQuoteBox,
                                    borderLeftColor: isMe ? '#00a884' : '#128c7e',
                                    backgroundColor: isMe ? 'rgba(0,168,132,0.1)' : '#f0f2f5'
                                  }}>
                                    <div style={{ fontSize: '11px', fontWeight: '700', color: isMe ? '#00a884' : '#128c7e' }}>
                                      {getDisplayName(repliedMsg.profiles) || 'User'}
                                    </div>
                                    <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                                      {getMessagePreviewLabel(repliedMsg.content)}
                                    </div>
                                  </div>
                                )}

                                {isViewOnceImg ? (
                                  <div 
                                    onClick={() => handleOpenViewOnce(m)}
                                    style={{
                                      ...styles.viewOnceBubbleCard,
                                      opacity: (hasAlreadyOpened || isMe) ? 0.6 : 1,
                                      cursor: isMe ? 'default' : 'pointer'
                                    }}
                                    title={isMe ? "You sent this view-once photo" : "Tap to open"}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ ...styles.viewOnceIconBadge, backgroundColor: (hasAlreadyOpened || isMe) ? '#94a3b8' : '#ef4444' }}>
                                        <Flame size={16} color="#ffffff" />
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: '700', fontSize: '13.5px', color: '#111b21' }}>
                                          {isMe ? 'Photo (View Once Sent)' : hasAlreadyOpened ? 'Photo Expired' : 'Photo (View Once)'}
                                        </div>
                                        <div style={{ fontSize: '11.5px', color: '#667781' }}>
                                          {isMe ? 'Cannot be opened' : hasAlreadyOpened ? 'Expired' : 'Tap to open'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : isImage ? (
                                  <img
                                    src={mediaUrl}
                                    alt="Shared"
                                    onClick={() => setPreviewImage({ src: mediaUrl, title: 'Shared Photo' })}
                                    style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', display: 'block', cursor: 'pointer' }}
                                  />
                                ) : isAudio ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', minWidth: '200px' }}>
                                    <audio controls src={mediaUrl} style={{ height: '32px', width: '160px' }} />
                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '24px' }}>
                                      <div className="wave-bar" style={{ animationDuration: '0.8s' }}></div>
                                      <div className="wave-bar" style={{ animationDuration: '1.1s' }}></div>
                                      <div className="wave-bar" style={{ animationDuration: '0.6s' }}></div>
                                      <div className="wave-bar" style={{ animationDuration: '0.9s' }}></div>
                                    </div>
                                  </div>
                                ) : isPoll ? (
                                  (() => {
                                    try {
                                      const pollObj = JSON.parse(m.content.replace('[POLL]:', ''));
                                      const votes = pollObj.votes || {};
                                      const totalVotes = Object.values(votes).reduce((acc, vArr) => acc + vArr.length, 0);
                                      const userVotedIndex = Object.keys(votes).find((idx) => votes[idx]?.includes(profile.id));

                                      return (
                                        <div style={{ padding: '4px 0' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '14.5px', color: '#111b21', marginBottom: '8px' }}>
                                            <BarChart2 size={16} color="#00a884" />
                                            <span>{pollObj.question}</span>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {pollObj.options.map((opt, oIdx) => {
                                              const optVoters = votes[oIdx] || [];
                                              const count = optVoters.length;
                                              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                                              const isChosen = userVotedIndex !== undefined && Number(userVotedIndex) === oIdx;

                                              return (
                                                <div
                                                  key={oIdx}
                                                  onClick={() => {
                                                    if (userVotedIndex === undefined) handleVotePoll(m.id, oIdx);
                                                  }}
                                                  style={{
                                                    ...styles.pollOptionBox,
                                                    borderColor: isChosen ? '#00a884' : '#cbd5e1',
                                                    backgroundColor: isChosen ? '#f0fdf4' : '#ffffff',
                                                    cursor: userVotedIndex === undefined ? 'pointer' : 'default'
                                                  }}
                                                >
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', fontWeight: '600', color: '#111b21', zIndex: 2, position: 'relative' }}>
                                                    <span>{opt} {isChosen && '✓'}</span>
                                                    <span style={{ fontSize: '12px', color: '#667781' }}>{count} vote{count !== 1 ? 's' : ''} ({pct}%)</span>
                                                  </div>
                                                  <div style={{ ...styles.pollProgressBar, width: `${pct}%`, backgroundColor: isChosen ? '#dcfce7' : '#f1f5f9' }} />
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <div style={{ fontSize: '11px', color: '#667781', marginTop: '6px', textAlign: 'right' }}>
                                            {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                                          </div>
                                        </div>
                                      );
                                    } catch {
                                      return <div>[Invalid Poll]</div>;
                                    }
                                  })()
                                ) : youtubeId ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div 
                                      onClick={() => window.open(`https://www.youtube.com/watch?v=${youtubeId}`, '_blank')}
                                      style={styles.youtubeCardWrapper}
                                    >
                                      <div style={{ position: 'relative', width: '100%', height: '140px', backgroundColor: '#000000' }}>
                                        <img
                                          src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                                          alt="YouTube Thumbnail"
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={styles.youtubePlayOverlay}>
                                          <Play size={24} color="#ffffff" fill="#ffffff" />
                                        </div>
                                      </div>
                                      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#111b21', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          YouTube Video • Watch on YouTube
                                        </span>
                                        <ExternalLink size={14} color="#54656f" />
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '14px', wordBreak: 'break-word' }}>{renderMessageTextWithLinks(m.content)}</div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '14.2px', lineHeight: '19px', wordBreak: 'break-word' }}>
                                    {renderMessageTextWithLinks(m.content)}
                                  </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '2px' }}>
                                  {m.edited_at && (
                                    <span style={{ fontSize: '9px', fontStyle: 'italic', color: '#667781' }}>edited</span>
                                  )}
                                  <span style={{ fontSize: '10.5px', color: '#667781' }}>{time}</span>
                                  {isMe && renderSeenReceipt(m)}
                                </div>
                              </div>

                              {/* WhatsApp Quick Emoji Hover Bar */}
                              <div style={{
                                ...styles.quickHoverBar,
                                opacity: showQuickEmoji ? 1 : 0,
                                pointerEvents: showQuickEmoji ? 'auto' : 'none',
                                transform: showQuickEmoji ? 'scale(1)' : 'scale(0.92)',
                                transition: 'opacity 0.08s ease, transform 0.08s ease',
                                marginInline: '6px'
                              }}>
                                <button 
                                  data-floating-ui="reaction-picker-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const isOpeningSameMessage = activeReactionPickerMsgId === m.id;
                                    setActiveReactionPickerMsgId(isOpeningSameMessage ? null : m.id);
                                    setShowExtendedReactions(false);
                                  }} 
                                  style={styles.quickIconBtn} 
                                  title="React">
                                  <Smile size={14} />
                                </button>
                              </div>

                              {/* WhatsApp Vertical Dropdown Menu */}
                              {isMenuOpen && (
                                <div
                                  data-floating-ui="message-options-menu"
                                  style={{
                                    ...styles.whatsappDropdownMenu,
                                    [isMe ? 'left' : 'right']: '-140px',
                                    ...(messageMenuFlipUp
                                      ? { top: 'auto', bottom: '28px' }
                                      : { top: '28px', bottom: 'auto' }),
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => { setReplyingTo(m); setEditingMessage(null); setOpenMessageMenuId(null); }}
                                    style={styles.whatsappDropItem}
                                  >
                                    <CornerUpLeft size={14} /> Reply
                                  </button>
                                  <button
                                    onClick={() => { setForwardingMessage(m); setShowForwardModal(true); setOpenMessageMenuId(null); }}
                                    style={styles.whatsappDropItem}
                                  >
                                    <Share2 size={14} /> Forward
                                  </button>
                                  {isMe && !isImage && !isViewOnceImg && !isAudio && !isPoll && (
                                    <button
                                      onClick={() => { setEditingMessage(m); setNewMessage(m.content); setReplyingTo(null); setOpenMessageMenuId(null); }}
                                      style={styles.whatsappDropItem}
                                    >
                                      <Edit2 size={14} /> Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setSelectedMessageIds([m.id]); setOpenMessageMenuId(null); }}
                                    style={{ ...styles.whatsappDropItem, color: '#dc2626' }}
                                  >
                                    <Trash2 size={14} /> Delete
                                  </button>
                                </div>
                              )}

                              {activeReactionPickerMsgId === m.id && (
                                <div 
                                  data-floating-ui="reaction-picker-popup"
                                  style={{ ...styles.whatsappReactionPopup, [isMe ? 'right' : 'left']: 0 }}
                                >
                                  <div style={styles.whatsappReactionInner}>
                                    {quickEmojis.map((emoji) => (
                                      <button 
                                        key={emoji} 
                                        onClick={() => handleSelectReaction(m.id, emoji)}
                                        style={styles.reactionEmojiBtn}>
                                        {emoji}
                                      </button>
                                    ))}

                                    <button 
                                      onClick={() => setShowExtendedReactions(!showExtendedReactions)} 
                                      style={styles.reactionEmojiBtn} 
                                      title="More emojis">
                                      <Plus size={14} color="#64748b" />
                                    </button>
                                  </div>

                                  {showExtendedReactions && (
                                    <div style={styles.extendedReactionGrid}>
                                      {EMOJI_PALETTE.map((customEmoji) => (
                                        <span 
                                          key={customEmoji} 
                                          onClick={() => handleSelectReaction(m.id, customEmoji)}
                                          className="hover-dim" style={styles.gridEmojiSpan}>
                                          {customEmoji}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {msgReactions.length > 0 && (
                              <div style={{ ...styles.reactionBadgeRow, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                {Array.from(new Set(msgReactions.map((r) => r.emoji))).map((em) => {
                                  const count = msgReactions.filter((r) => r.emoji === em).length;
                                  const hasReacted = msgReactions.some((r) => r.emoji === em && r.user_id === profile.id);
                                  return (
                                    <span 
                                      key={em} 
                                      className="hover-dim"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReactionDetailsTarget({
                                          messageId: m.id,
                                          emoji: em,
                                          reactors: msgReactions.filter(r => r.emoji === em)
                                        });
                                      }}
                                      style={{
                                        ...styles.reactionPill,
                                        borderColor: hasReacted ? '#00a884' : '#e9edef',
                                        backgroundColor: hasReacted ? '#d9fdd3' : '#ffffff'
                                      }}
                                      title="Click to see who reacted"
                                    >
                                      {em} {count > 1 ? count : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}

                {isCurrentChatTyping && !isAccountDeleted && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 2px' }}>
                    {typingUserList[0]?.avatarUrl ? (
                      <img
                        src={typingUserList[0].avatarUrl}
                        alt="Typing"
                        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ ...styles.groupAvatar, width: '28px', height: '28px', fontSize: '12px' }}>
                        {typingUserList[0]?.username ? typingUserList[0].username[0].toUpperCase() : 'U'}
                      </div>
                    )}
                    <div style={styles.typingBubble}>
                      <span className="typing-dot" />
                      <span className="typing-dot" style={{ margin: '0 3px' }} />
                      <span className="typing-dot" />
                      {activeConversation.is_group && (
                        <span style={{ fontSize: '11px', color: '#00a884', fontWeight: '700', marginLeft: '6px' }}>
                          {typingUserList.map((u) => getDisplayName(u)).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {showScrollBottomBtn && (
                <button 
                  onClick={() => scrollToBottom('smooth')} 
                  style={styles.floatingDownBtn}
                  title="Scroll to latest messages">
                  <ChevronDown size={22} color="#54656f" />
                </button>
              )}

              {/* Safe Reply Banner */}
              {replyingTo && (
                <div style={styles.replyBanner}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <CornerUpLeft size={16} color="#00a884" />
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#00a884' }}>
                      Replying to {getDisplayName(replyingTo.profiles) || 'User'}:
                    </span>
                    <span style={{ fontSize: '13px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getMessagePreviewLabel(replyingTo.content)}
                    </span>
                  </div>
                  <button onClick={() => setReplyingTo(null)} style={styles.bannerCloseBtn}><X size={15} /></button>
                </div>
              )}

              {editingMessage && (
                <div style={{ ...styles.replyBanner, borderLeftColor: '#f59e0b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <Edit2 size={16} color="#f59e0b" />
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#f59e0b' }}>Editing message</span>
                    <span style={{ fontSize: '13px', color: '#667781', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editingMessage.content}
                    </span>
                  </div>
                  <button onClick={() => { setEditingMessage(null); setNewMessage(''); }} style={styles.bannerCloseBtn}><X size={15} /></button>
                </div>
              )}

              {showComposerEmojiPicker && (
                <div style={styles.composerEmojiDrawer}>
                  {EMOJI_PALETTE.map((emoji) => (
                    <span 
                      key={emoji} 
                      onClick={() => handleComposerTyping(newMessage + emoji)}
                      className="hover-dim" style={styles.gridEmojiSpan}>
                      {emoji}
                    </span>
                  ))}
                </div>
              )}

              {/* Composer Input Bar */}
              <div style={styles.inputContainer}>
                {(!activeConversation?.is_group && (!isDirectChatFriend || isAccountDeleted)) ? (
                  <div style={styles.notFriendsGateBanner}>
                    <AlertTriangle size={18} color="#b45309" />
                    <span>{isAccountDeleted ? 'Account deleted' : 'unfriend'}. You can no longer chat with this user!</span>
                  </div>
                ) : (activeConversation?.is_group && activeConversation.only_admins_can_message && !isGroupAdmin(activeConversation, profile.id)) ? (
                  <div style={styles.notFriendsGateBanner}>
                    <Lock size={18} color="#b45309" />
                    <span>Only admins can send messages in this group.</span>
                  </div>
                ) : isRecording ? (
                  <div style={styles.recordingBar}>
                    <div style={styles.recordingPulse}></div>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626' }}>
                      Recording Voice Message...
                    </span>
                    <button onClick={stopVoiceRecording} style={styles.stopRecordBtn}>
                      <Square size={16} color="#ffffff" />
                      <span>Send Audio</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={sendMessage} style={styles.composerForm}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageFileSelected}
                    />

                    <button
                      type="button"
                      onClick={() => setShowComposerEmojiPicker(!showComposerEmojiPicker)}
                      style={styles.composerIconBtn}
                      title="Insert emoji"
                    >
                      <Smile size={22} color="#54656f" />
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={styles.composerIconBtn}
                      title="Send photo"
                    >
                      <ImageIcon size={22} color="#54656f" />
                    </button>

                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      style={styles.composerIconBtn}
                      title="Hold to record voice message"
                    >
                      <Mic size={22} color="#54656f" />
                    </button>

                    <input
                      type="text"
                      placeholder={editingMessage ? 'Edit message...' : 'Type a message'}
                      style={styles.composerInput}
                      value={newMessage}
                      onChange={(e) => handleComposerTyping(e.target.value)}
                    />

                    <button
                      type="button"
                      onClick={(e) => sendMessage(e)}
                      onTouchEnd={(e) => sendMessage(e)}
                      disabled={!newMessage.trim()}
                      style={{
                        ...styles.sendBtn,
                        opacity: newMessage.trim() ? 1 : 0.4,
                        cursor: newMessage.trim() ? 'pointer' : 'default',
                      }}
                    >
                      <Send size={18} />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div style={styles.emptyStateContainer}>
              <div style={styles.emptyStateIcon}>
                <MessageSquare size={52} color="#00a884" />
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '400', color: '#41525d', margin: '0 0 8px' }}>svpp-chat for Web</h3>
              <p style={{ color: '#667781', fontSize: '14px', maxWidth: '360px', textAlign: 'center', lineHeight: '1.6' }}>
                Send and receive messages in real-time. Fast, secure, and equipped with smart Generative AI.
              </p>
            </div>
          )}
        </main>
      )}

      {/* MEDIA GALLERY MODAL */}
      {showMediaGalleryModal && activeConversation && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setShowMediaGalleryModal(false)}>
          <div style={{ ...styles.modalBox, maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={20} color="#00a884" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Shared Media & Links</h4>
              </div>
              <button onClick={() => setShowMediaGalleryModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
              Photos, voice notes, and links shared in this conversation:
            </p>
            <div style={{ ...styles.modalScrollList, maxHeight: '360px' }}>
              {galleryMedia.loading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
                  Loading shared media…
                </div>
              ) : (galleryMedia.images.length === 0 && galleryMedia.audios.length === 0 && galleryMedia.links.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
                  No media shared in this chat yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {galleryMedia.images.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#54656f', marginBottom: '8px' }}>
                        Photos ({galleryMedia.images.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {galleryMedia.images.map(item => (
                          <img
                            key={item.id}
                            src={item.url}
                            alt="Shared media"
                            onClick={() => {
                              setPreviewImage({ src: item.url, title: 'Shared Photo' });
                              setShowMediaGalleryModal(false);
                            }}
                            style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {galleryMedia.audios.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#54656f', marginBottom: '8px' }}>
                        Voice notes ({galleryMedia.audios.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {galleryMedia.audios.map(item => (
                          <div key={item.id} style={styles.modalFriendRow}>
                            <Mic size={16} color="#00a884" />
                            <audio controls src={item.url} style={{ flex: 1, height: '32px' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {galleryMedia.links.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#54656f', marginBottom: '8px' }}>
                        Links ({galleryMedia.links.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {galleryMedia.links.map(item => (
                          <a
                            key={item.id}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover-dim"
                            style={{ ...styles.modalFriendRow, textDecoration: 'none', color: '#0284c7', fontSize: '13px', wordBreak: 'break-all' }}
                          >
                            <ExternalLink size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowMediaGalleryModal(false)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* FORWARD MESSAGE MODAL */}
      {showForwardModal && forwardingMessage && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setShowForwardModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={20} color="#00a884" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Forward Message To...</h4>
              </div>
              <button onClick={() => setShowForwardModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
              Select a chat to forward this message:
            </p>
            <div style={styles.modalScrollList}>
              {visibleConversations.map((c) => {
                const otherMem = c.conversation_members?.find(m => m.user_id !== profile?.id)?.profiles;
                const title = c.is_group ? c.name : getDisplayName(otherMem) || 'Chat';
                return (
                  <div
                    key={c.id}
                    onClick={() => handleForwardMessageToConv(c.id)}
                    className="hover-dim" style={styles.modalFriendRow}
                  >
                    {renderAvatar(c.is_group ? c.avatar_url : otherMem?.avatar_url, title, 36, false, 'online')}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {title}
                      </div>
                    </div>
                    <button style={styles.openChatBtn}>Forward</button>
                  </div>
                );
              })}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowForwardModal(false)} style={styles.secondaryBtn}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* REACTION DETAILS MODAL */}
      {reactionDetailsTarget && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setReactionDetailsTarget(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>{reactionDetailsTarget.emoji}</span>
                <h4 style={{ margin: 0, fontSize: '17px', color: '#111b21' }}>
                  Reactions ({reactionDetailsTarget.reactors.length})
                </h4>
              </div>
              <button onClick={() => setReactionDetailsTarget(null)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <div style={styles.modalScrollList}>
              {reactionDetailsTarget.reactors.map((r) => {
                const reactorName = getDisplayName(r.profiles);
                return (
                  <div key={r.id || r.user_id} className="hover-dim" style={styles.modalFriendRow}>
                    {renderAvatar(r.profiles?.avatar_url, reactorName, 36, false, 'online', { userProfile: r.profiles })}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {reactorName} {r.user_id === profile.id ? '(You)' : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: '18px' }}>{r.emoji}</span>
                  </div>
                );
              })}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setReactionDetailsTarget(null)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POLL MODAL */}
      {showPollModal && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setShowPollModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '18px', color: '#111b21' }}>Create Group Poll</h4>
              <button onClick={() => setShowPollModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input
                type="text"
                placeholder="Ask a question..."
                style={styles.modernInput}
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
              />
              <span style={styles.fieldLabel}>Options:</span>
              {pollOptions.map((opt, oIdx) => (
                <input
                  key={oIdx}
                  type="text"
                  placeholder={`Option ${oIdx + 1}`}
                  style={styles.modernInput}
                  value={opt}
                  onChange={(e) => {
                    const copy = [...pollOptions];
                    copy[oIdx] = e.target.value;
                    setPollOptions(copy);
                  }}
                />
              ))}
              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={() => setPollOptions([...pollOptions, ''])}
                  style={styles.secondaryBtn}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} /> Add Option
                </button>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={() => setShowPollModal(false)} style={styles.secondaryBtn}>Cancel</button>
                <button onClick={createPollMessage} style={styles.primaryButton}>Send Poll</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NICKNAME MODAL */}
      {showNicknameModal && nicknameTargetUser && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setShowNicknameModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '18px', color: '#111b21' }}>
                Set Nickname for {nicknameTargetUser.username || 'User'}
              </h4>
              <button onClick={() => setShowNicknameModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
              This nickname is private and will be visible only to you.
            </p>
            <input
              type="text"
              placeholder="Enter private nickname..."
              style={styles.modernInput}
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNicknameForUser(nicknameTargetUser.id, nicknameInput); }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => saveNicknameForUser(nicknameTargetUser.id, '')} style={styles.secondaryBtn}>Clear</button>
              <button onClick={() => saveNicknameForUser(nicknameTargetUser.id, nicknameInput)} style={styles.primaryButton}>Save Nickname</button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE PIN MODAL */}
      {showArchiveModal && (
        <div className="modal-fade-in" style={styles.modalBackdrop} onClick={() => setShowArchiveModal(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Archive size={20} color="#00a884" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Archived Chats</h4>
              </div>
              <button onClick={() => setShowArchiveModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            {!isArchiveUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '10px 0' }}>
                <p style={{ fontSize: '13.5px', color: '#667781', margin: 0 }}>
                  Enter your Archive PIN to unlock archived conversations (Default PIN: 1234):
                </p>
                <input
                  type="password"
                  placeholder="Enter Archive PIN"
                  maxLength={6}
                  style={styles.modernInput}
                  value={enteredArchivePin}
                  onChange={(e) => setEnteredArchivePin(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') verifyArchivePin(); }}
                />
                <button onClick={verifyArchivePin} style={styles.primaryButton}>Unlock Archive</button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
                  Select any chat to open or unarchive:
                </p>
                <div style={styles.modalScrollList}>
                  {archivedConversations.map((c) => {
                    const otherMember = c.conversation_members?.find((m) => m.user_id !== profile?.id)?.profiles;
                    const title = c.is_group ? c.name : getDisplayName(otherMember) || 'Account deleted';
                    return (
                      <div key={c.id} className="hover-dim" style={styles.modalFriendRow}>
                        {renderAvatar(c.is_group ? c.avatar_url : otherMember?.avatar_url, title, 38, false, 'offline')}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {title}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => {
                              handleSelectConversation(c);
                              setShowArchiveModal(false);
                            }}
                            style={styles.openChatBtn}
                          >
                            Open
                          </button>
                          <button
                            onClick={(e) => toggleArchiveChat(c.id, e)}
                            style={styles.removeFriendBtn}
                            title="Unarchive"
                          >
                            <Archive size={14} /> Unarchive
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW ONCE CONFIRMATION MODAL */}
      {pendingImageUpload && (
        <div className="modal-fade-in" style={styles.lightboxBackdrop} onClick={() => setPendingImageUpload(null)}>
          <div style={styles.viewOnceModalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '17px', color: '#111b21' }}>Send Photo</h4>
              <button onClick={() => setPendingImageUpload(null)} style={styles.closeBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
              <img src={pendingImageUpload.src} alt="Preview" style={styles.viewOncePreviewImg} />
            </div>
            <label style={styles.viewOnceCheckboxRow}>
              <input
                type="checkbox"
                checked={isViewOnceChecked}
                onChange={(e) => setIsViewOnceChecked(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#00a884', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#111b21' }}>
                View Once Mode ({activeConversation?.is_group ? 'All members can view 1 time each' : 'Recipient can view 1 time'})
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setPendingImageUpload(null)} style={styles.secondaryBtn}>Cancel</button>
              <button onClick={confirmSendImageMessage} style={styles.primaryButton}>Send Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* OPEN VIEW ONCE LIGHTBOX */}
      {viewOnceViewerData && (
        <div className="modal-fade-in" style={styles.lightboxBackdrop} onClick={() => setViewOnceViewerData(null)}>
          <div style={styles.lightboxContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.lightboxHeader}>
              <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Flame size={16} color="#ef4444" /> View-Once Photo (Expires after viewing)
              </span>
              <button onClick={() => setViewOnceViewerData(null)} style={styles.lightboxCloseBtn}>
                <X size={22} color="#fff" />
              </button>
            </div>
            <img 
              src={viewOnceViewerData.content.replace('[VIEW-ONCE]:', '')} 
              alt="View Once" 
              style={styles.lightboxImage} 
            />
          </div>
        </div>
      )}

      {/* META AI ASSISTANT MODAL */}
      {showAiModal && (
        <div 
          className="modal-fade-in"
          style={{
            ...styles.lightboxBackdrop,
            padding: isMobile ? '0' : '20px'
          }} 
          onClick={() => setShowAiModal(false)}
        >
          <div 
            style={{
              ...styles.aiAssistantModalBox,
              width: isMobile ? '100vw' : '95%',
              maxWidth: isMobile ? '100vw' : '720px',
              height: isMobile ? '100dvh' : '760px',
              maxHeight: isMobile ? '100dvh' : '88vh',
              borderRadius: isMobile ? '0' : '20px',
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.aiModalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="meta-ai-ring" style={{ width: '36px', height: '36px', borderRadius: '50%', padding: '2px' }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} color="#00a884" />
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: '#111b21' }}>Meta AI Assistant</div>
                  <div style={{ fontSize: '11px', color: '#00a884' }}>Online • AI Assistant ({currentAiChat.title})</div>
                </div>
              </div>
              <button onClick={() => setShowAiModal(false)} style={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.aiChatTabsRow}>
              {aiChats.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveAiChatId(c.id)}
                  style={c.id === activeAiChatId ? styles.aiChatTabActive : styles.aiChatTabBtn}
                >
                  {c.title}
                </button>
              ))}
              <button 
                onClick={() => {
                  updateActiveChatMessages([{ id: Date.now(), sender: 'ai', text: `Cleared ${currentAiChat.title}. How can I help?` }]);
                }}
                style={styles.aiClearChatBtn}
                title="Clear current chat"
              >
                Clear
              </button>
            </div>

            <div style={styles.aiMessageThread}>
              {aiMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    margin: '6px 0' 
                  }}
                >
                  <div style={{
                    ...styles.aiBubble,
                    backgroundColor: msg.sender === 'user' ? '#d9fdd3' : '#f0f2f5',
                    color: '#111b21',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isAiResponding && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '6px 0' }}>
                  <div style={{ ...styles.aiBubble, backgroundColor: '#f0f2f5', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span className="typing-dot" />
                    <span className="typing-dot" style={{ margin: '0 2px' }} />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            <div style={styles.aiComposerBar}>
              <input
                type="text"
                placeholder="Ask anything or ask about svpp-chat..."
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendAiMessage(); }}
                style={styles.aiInput}
              />
              <button onClick={handleSendAiMessage} disabled={isAiResponding} style={styles.aiSendBtn}>
                <Send size={16} color="#ffffff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {profilePreviewTarget && (
        <div className="modal-fade-in" style={styles.lightboxBackdrop} onClick={() => setProfilePreviewTarget(null)}>
          <div style={styles.profilePopoverBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.profilePopoverHead}>
              <span style={{ fontWeight: '700', fontSize: '16px', color: '#111b21' }}>
                {profilePreviewTarget.username}
              </span>
              <button onClick={() => setProfilePreviewTarget(null)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              {profilePreviewTarget.avatarUrl ? (
                <img
                  src={profilePreviewTarget.avatarUrl}
                  alt="Profile"
                  onClick={() => {
                    setPreviewImage({ src: profilePreviewTarget.avatarUrl, title: profilePreviewTarget.username });
                    setProfilePreviewTarget(null);
                  }}
                  style={styles.profilePopoverImg}
                  title="Click to see full screen"
                />
              ) : (
                <div style={styles.profilePopoverPlaceholder}>
                  {profilePreviewTarget.username ? profilePreviewTarget.username[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>

            <div style={styles.profilePopoverActions}>
              {profilePreviewTarget.userProfile && profilePreviewTarget.userProfile.id !== profile.id && (
                <button
                  onClick={() => {
                    handleStartDirectChat(profilePreviewTarget.userProfile);
                  }}
                  style={styles.primaryButton}
                >
                  <MessageSquare size={16} style={{ marginRight: '6px' }} /> Message
                </button>
              )}
              {profilePreviewTarget.isGroup && (
                <button
                  onClick={() => {
                    handleSelectConversation(profilePreviewTarget.conv);
                    setShowGroupInfoModal(true);
                    setProfilePreviewTarget(null);
                  }}
                  style={styles.primaryButton}
                >
                  <Users size={16} style={{ marginRight: '6px' }} /> View Group Info
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {previewImage && (
        <div className="modal-fade-in" style={styles.lightboxBackdrop} onClick={() => setPreviewImage(null)}>
          <div style={styles.lightboxContainer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.lightboxHeader}>
              <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>
                {previewImage.title || 'Photo'}
              </span>
              <button onClick={() => setPreviewImage(null)} style={styles.lightboxCloseBtn}>
                <X size={22} color="#fff" />
              </button>
            </div>
            <img src={previewImage.src} alt="Enlarged" style={styles.lightboxImage} />
          </div>
        </div>
      )}

      {showGroupInfoModal && activeConversation?.is_group && (
        <div className="modal-fade-in" style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '18px' }}>Group Info</h4>
              <button onClick={() => setShowGroupInfoModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '10px 0 16px', borderBottom: '1px solid #f1f5f9' }}>
              <input
                type="file"
                ref={groupAvatarInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleGroupAvatarUpload}
              />
              <div style={{ position: 'relative' }}>
                {activeConversation.avatar_url ? (
                  renderAvatar(activeConversation.avatar_url, activeConversation.name, 72, false, 'online', { isGroup: true, conv: activeConversation }, true)
                ) : (
                  <div style={{ ...styles.groupAvatar, width: '72px', height: '72px', fontSize: '32px' }}>👥</div>
                )}
                <button
                  type="button"
                  onClick={() => groupAvatarInputRef.current?.click()}
                  style={styles.avatarCameraBadge}
                  title="Change group profile photo"
                >
                  <Camera size={15} color="#ffffff" />
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: '800', fontSize: '17px', color: '#111b21' }}>{activeConversation.name}</div>
                <div style={{ fontSize: '12px', color: '#667781' }}>{activeConvMembers.length} group members</div>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  ...styles.credentialsViewerCard,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  marginBottom: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={16} color="#00a884" />
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#111b21' }}>Only admins send messages</div>
                    <div style={{ fontSize: '11.5px', color: '#667781' }}>
                      {activeConversation.only_admins_can_message ? 'Only group admins can send messages' : 'All members can send messages'}
                    </div>
                  </div>
                </div>
                {isGroupAdmin(activeConversation, profile.id) ? (
                  <button
                    onClick={handleToggleAdminOnlyMessaging}
                    style={{
                      ...styles.filterPillActive,
                      backgroundColor: activeConversation.only_admins_can_message ? '#d9fdd3' : '#f0f2f5',
                      color: activeConversation.only_admins_can_message ? '#00a884' : '#54656f',
                      border: '1px solid ' + (activeConversation.only_admins_can_message ? '#00a884' : '#e9edef'),
                    }}
                    title="Toggle admin-only messaging"
                  >
                    {activeConversation.only_admins_can_message ? 'On' : 'Off'}
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#8696a0' }}>Admins only setting</span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={styles.sectionHeading}>Members</span>
                <button 
                  onClick={() => {
                    setShowGroupInfoModal(false);
                    setShowAddMemberModal(true);
                  }}
                  style={styles.addMemberLinkBtn}
                >
                  <Plus size={14} /> Add Members
                </button>
              </div>

              <div style={styles.modalScrollList}>
                {activeConvMembers.map((m) => {
                  const isOwner = activeConversation.created_by === m.user_id;
                  const isSelf = m.user_id === profile.id;
                  const amIGroupOwner = activeConversation.created_by === profile.id;
                  const amIGroupAdmin = isGroupAdmin(activeConversation, profile.id);
                  const isMemberAdmin = isGroupAdmin(activeConversation, m.user_id);
                  const memName = getDisplayName(m.profiles);

                  return (
                    <div key={m.user_id} className="hover-dim" style={styles.modalFriendRow}>
                      {renderAvatar(m.profiles?.avatar_url, memName, 38, false, 'online', { userProfile: m.profiles }, true)}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{memName}</span>
                          {isSelf && <span style={{ fontSize: '11px', color: '#667781' }}>(You)</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {isOwner && (
                          <div style={styles.groupOwnerBadge} title="Group Creator & Admin">
                            <Crown size={12} color="#b45309" />
                            <span>Owner</span>
                          </div>
                        )}

                        {!isOwner && isMemberAdmin && (
                          <div style={styles.groupAdminBadge} title="Group Admin">
                            <ShieldCheck size={12} color="#00a884" />
                            <span>Admin</span>
                          </div>
                        )}

                        {amIGroupAdmin && !isSelf && !isMemberAdmin && (
                          <button
                            onClick={() => handleMakeGroupAdmin(m.user_id, memName)}
                            style={styles.makeAdminBtn}
                            title="Make this member a group admin"
                          >
                            <ShieldCheck size={14} /> Make Admin
                          </button>
                        )}

                        {amIGroupAdmin && !isSelf && isMemberAdmin && !isOwner && (
                          <button
                            onClick={() => handleRemoveGroupAdmin(m.user_id, memName)}
                            style={styles.removeMemberBtn}
                            title="Remove admin rights from this member"
                          >
                            <ShieldCheck size={14} /> Remove Admin
                          </button>
                        )}

                        {amIGroupOwner && !isSelf && (
                          <button
                            onClick={() => handleRemoveMember(m.user_id, m.profiles?.username)}
                            style={styles.removeMemberBtn}
                            title="Remove member from group"
                          >
                            <UserMinus size={14} /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={handleLeaveGroup} style={styles.leaveGroupBtn}>
                <LogOut size={16} /> Leave Group
              </button>
              <button onClick={() => setShowGroupInfoModal(false)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showNewChatModal && (
        <div className="modal-fade-in" style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={20} color="#00a884" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Start a New Chat</h4>
              </div>
              <button onClick={() => setShowNewChatModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
              Select an accepted friend to open a conversation:
            </p>

            <div style={styles.modalScrollList}>
              {confirmedFriends.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
                  No accepted friends yet. Head to Explore to add friends first!
                </div>
              ) : (
                confirmedFriends.map((f) => {
                  const fname = getDisplayName(f);
                  return (
                    <div
                      key={f.id}
                      onClick={() => handleStartDirectChat(f)}
                      className="hover-dim" style={styles.modalFriendRow}
                    >
                      {renderAvatar(f.avatar_url, fname, 38, false, getUserStatusType(f.id), { userProfile: f })}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21' }}>{fname}</div>
                        <div style={{ fontSize: '12px', color: '#667781' }}>{getUserStatusType(f.id) === 'online' ? renderGlowingOnlineDot() : formatLastSeen(userLastSeen[f.id])}</div>
                      </div>
                      <button style={styles.openChatBtn}>Chat</button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowNewChatModal(false)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showAddMemberModal && activeConversation?.is_group && (
        <div className="modal-fade-in" style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="#00a884" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Add People to Group</h4>
              </div>
              <button onClick={() => setShowAddMemberModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px' }}>
              Select friends to add to <b>{activeConversation.name}</b>:
            </p>

            <div style={styles.modalScrollList}>
              {friendsNotInActiveGroup.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
                  All of your friends are already in this group!
                </div>
              ) : (
                friendsNotInActiveGroup.map((friend) => {
                  const frName = getDisplayName(friend);
                  return (
                    <div key={friend.id} className="hover-dim" style={styles.modalFriendRow}>
                      {renderAvatar(friend.avatar_url, frName, 38, false, getUserStatusType(friend.id), { userProfile: friend })}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#111b21' }}>{frName}</div>
                        <div style={{ fontSize: '12px', color: '#667781' }}>{getUserStatusType(friend.id) === 'online' ? renderGlowingOnlineDot() : formatLastSeen(userLastSeen[friend.id])}</div>
                      </div>
                      <button onClick={() => handleAddMemberToExistingGroup(friend.id)} style={styles.openChatBtn}>
                        Add
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowAddMemberModal(false)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="modal-fade-in" style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '18px' }}>Create Group Chat</h4>
              <button onClick={() => setShowGroupModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>
            <input
              type="text"
              placeholder="Group name..."
              style={styles.modernInput}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
            <div style={styles.modalListLabel}>Select Friends:</div>
            <div style={styles.modalScrollList}>
              {confirmedFriends.map((u) => {
                const uname = getDisplayName(u);
                return (
                  <label key={u.id} className="hover-dim" style={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={selectedGroupUsers.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedGroupUsers([...selectedGroupUsers, u.id]);
                        else setSelectedGroupUsers(selectedGroupUsers.filter((id) => id !== u.id));
                      }}
                    />
                    <span style={{ fontSize: '15px' }}>{uname}</span>
                  </label>
                );
              })}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowGroupModal(false)} style={styles.secondaryBtn}>Cancel</button>
              <button onClick={createGroupChat} style={styles.primaryButton}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="modal-fade-in" style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '18px' }}>Settings & Customization</h4>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setDeleteStep('idle');
                  setSettingsMsg({ text: '', type: '' });
                }}
                style={styles.closeBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.settingsTabRow}>
              <button
                onClick={() => setSettingsTab('profile')}
                style={settingsTab === 'profile' ? styles.settingsTabActive : styles.settingsTab}
              >
                Profile
              </button>
              <button
                onClick={() => setSettingsTab('credentials')}
                style={settingsTab === 'credentials' ? styles.settingsTabActive : styles.settingsTab}
              >
                Credentials
              </button>
              <button
                onClick={() => setSettingsTab('wallpaper')}
                style={settingsTab === 'wallpaper' ? styles.settingsTabActive : styles.settingsTab}
              >
                Wallpaper
              </button>
              <button
                onClick={() => setSettingsTab('danger')}
                style={settingsTab === 'danger' ? styles.settingsTabActive : styles.settingsTab}
              >
                Delete
              </button>
            </div>

            {settingsMsg.text && (
              <div
                style={{
                  ...styles.statusMessage,
                  backgroundColor: settingsMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                  color: settingsMsg.type === 'error' ? '#b91c1c' : '#15803d',
                }}
              >
                {settingsMsg.text}
              </div>
            )}

            {settingsTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '10px 0' }}>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleProfilePhotoUpload}
                />
                <div style={{ position: 'relative' }}>
                  {renderAvatar(profile?.avatar_url, getDisplayName(profile), 80, false, 'online', { isSelf: true })}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    style={styles.avatarCameraBadge}
                    title="Change Profile Photo"
                  >
                    <Camera size={16} color="#ffffff" />
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#667781', textAlign: 'center', margin: 0 }}>
                  Upload a custom photo for your account avatar.
                </p>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={savingSettings}
                  style={styles.primaryButton}
                >
                  <Camera size={16} style={{ marginRight: '6px' }} />
                  {savingSettings ? 'Uploading...' : 'Upload New Photo'}
                </button>
              </div>
            )}

            {settingsTab === 'credentials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={styles.credentialsViewerCard}>
                  <div style={{ fontWeight: '800', fontSize: '13.5px', color: '#111b21', marginBottom: '8px' }}>
                    Your Login Details & Archive PIN
                  </div>
                  <div style={styles.credentialRow}>
                    <span style={{ color: '#667781', fontSize: '12px' }}>Username:</span>
                    <span style={{ fontWeight: '700', color: '#111b21', fontSize: '13px' }}>{getDisplayName(profile) || 'User'}</span>
                  </div>
                  <div style={styles.credentialRow}>
                    <span style={{ color: '#667781', fontSize: '12px' }}>Email:</span>
                    <span style={{ fontWeight: '600', color: '#111b21', fontSize: '12.5px' }}>{user.email}</span>
                  </div>
                  <div style={styles.credentialRow}>
                    <span style={{ color: '#667781', fontSize: '12px' }}>Password:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '700', color: '#111b21', fontSize: '13px' }}>
                        {currentSessionPassword ? (showSavedPassword ? currentSessionPassword : '••••••••••••') : '••••••••'}
                      </span>
                      {currentSessionPassword && (
                        <button 
                          type="button" 
                          onClick={() => setShowSavedPassword(!showSavedPassword)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                        >
                          {showSavedPassword ? <EyeOff size={14} color="#00a884" /> : <Eye size={14} color="#00a884" />}
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={styles.credentialRow}>
                    <span style={{ color: '#667781', fontSize: '12px' }}>Archive PIN:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '700', color: '#111b21', fontSize: '13px' }}>
                        {showArchivePin ? archivePin : '••••'}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setShowArchivePin(!showArchivePin)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                      >
                        {showArchivePin ? <EyeOff size={14} color="#00a884" /> : <Eye size={14} color="#00a884" />}
                      </button>
                    </div>
                  </div>
                </div>

                <span style={styles.fieldLabel}>Update Username & Password:</span>
                <div style={styles.optionSelectorGroup}>
                  <button
                    type="button"
                    onClick={() => setChangeOption('username')}
                    style={changeOption === 'username' ? styles.optionSelectedBtn : styles.optionBtn}
                  >
                    Username
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeOption('password')}
                    style={changeOption === 'password' ? styles.optionSelectedBtn : styles.optionBtn}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeOption('both')}
                    style={changeOption === 'both' ? styles.optionSelectedBtn : styles.optionBtn}
                  >
                    Both
                  </button>
                </div>

                {(changeOption === 'username' || changeOption === 'both') && (
                  <div>
                    <label style={styles.fieldLabel}>New Username</label>
                    <input
                      type="text"
                      placeholder="Enter new username"
                      style={styles.modernInput}
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                    />
                  </div>
                )}

                {(changeOption === 'password' || changeOption === 'both') && (
                  <div>
                    <label style={styles.fieldLabel}>New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password (min 6 chars)"
                      style={styles.modernInput}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleUpdateCredentials}
                  disabled={savingSettings}
                  style={styles.primaryButton}
                >
                  {savingSettings ? 'Updating...' : 'Save & Email New Credentials'}
                </button>

                <div style={{ borderTop: '1px solid #e9edef', paddingTop: '10px', marginTop: '4px' }}>
                  <label style={styles.fieldLabel}>Change Archive PIN Separately</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="New Archive PIN"
                      maxLength={6}
                      style={styles.modernInput}
                      value={newArchivePinInput}
                      onChange={(e) => setNewArchivePinInput(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleSaveArchivePinOnly}
                      style={{ ...styles.primaryButton, width: '140px', flexShrink: 0 }}
                    >
                      Save PIN
                    </button>
                  </div>
                </div>

                <div style={styles.emailBackupNotice}>
                  <MailCheck size={16} color="#00a884" style={{ flexShrink: '0', marginTop: '2px' }} />
                  <span>
                    Credentials updates are mailed directly to <b>{user.email}</b>.
                  </span>
                </div>
              </div>
            )}

            {settingsTab === 'wallpaper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <span style={styles.fieldLabel}>Preset Colors:</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { name: 'WhatsApp Classic', color: '#efeae2' },
                    { name: 'Pure White', color: '#ffffff' },
                    { name: 'Soft Gray', color: '#f0f2f5' },
                    { name: 'Warm Cream', color: '#fef3c7' },
                    { name: 'Pale Rose', color: '#ffe4e6' },
                    { name: 'Dark Slate', color: '#0f172a' },
                  ].map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => handleSetBgColor(p.color)}
                      style={{
                        ...styles.colorPresetBtn,
                        backgroundColor: p.color,
                        outline: chatBg.type === 'color' && chatBg.value === p.color ? '2px solid #00a884' : '1px solid #cbd5e1',
                      }}
                      title={p.name}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={styles.fieldLabel}>Custom Color:</span>
                  <input
                    type="color"
                    value={chatBg.type === 'color' ? chatBg.value : '#efeae2'}
                    onChange={(e) => handleSetBgColor(e.target.value)}
                    style={{ border: 'none', width: '36px', height: '36px', cursor: 'pointer', borderRadius: '6px' }}
                  />
                </div>

                <input
                  type="file"
                  ref={bgImageInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleBgImageUpload}
                />
                <button
                  type="button"
                  onClick={() => bgImageInputRef.current?.click()}
                  style={styles.secondaryBtn}
                >
                  <Palette size={16} style={{ marginRight: '6px' }} />
                  Upload Photo as Chat Wallpaper
                </button>

                <button
                  type="button"
                  onClick={handleResetWallpaper}
                  style={styles.resetBtn}
                >
                  <RotateCcw size={14} style={{ marginRight: '6px' }} />
                  Reset to WhatsApp Default
                </button>
              </div>
            )}

            {settingsTab === 'danger' && (
              <div style={styles.dangerZone}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} color="#dc2626" />
                  <span style={{ fontWeight: '700', fontSize: '14px', color: '#dc2626' }}>
                    Permanently Delete Account
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#667781', margin: '0 0 12px', lineHeight: '1.4' }}>
                  Wipes your profile, messages, and chats completely. An email code is required to confirm. After deletion, this email can be used to register again anytime.
                </p>

                {deleteStep === 'idle' ? (
                  <button
                    type="button"
                    onClick={handleSendDeleteOtp}
                    disabled={deletingAccount}
                    style={styles.deleteInitBtn}
                  >
                    <Trash2 size={16} />
                    {deletingAccount ? 'Sending Code...' : 'Send Deletion Code to Gmail'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Enter 6-digit email code"
                      maxLength={6}
                      style={styles.modernInput}
                      value={enteredDeleteOtp}
                      onChange={(e) => setEnteredDeleteOtp(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setDeleteStep('idle')}
                        style={styles.secondaryBtn}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAccountDeletion}
                        disabled={deletingAccount || enteredDeleteOtp.length < 6}
                        style={styles.deleteConfirmBtn}
                      >
                        {deletingAccount ? 'Deleting...' : 'Confirm & Wipe Account'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loadingContainer: { display: 'flex', height: '100dvh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  appContainer: { display: 'flex', height: '100dvh', width: '100vw', backgroundColor: '#ffffff', color: '#111b21', overflow: 'hidden', position: 'relative' },

  authContainer: { display: 'flex', height: '100dvh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f2f5', padding: '16px' },
  authCard: { width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid #e9edef', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' },
  authHeader: { textAlign: 'center', marginBottom: '28px' },
  logoBadge: { width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #00a884, #128c7e)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 16px rgba(0,168,132,0.25)' },
  authTitle: { fontSize: '24px', fontWeight: '800', margin: '0 0 6px', color: '#111b21' },
  authSubtitle: { fontSize: '14px', color: '#667781', margin: 0, lineHeight: '1.4' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '14px' },
  errorBanner: { padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '14px', marginBottom: '14px', border: '1px solid #fee2e2' },
  modernInput: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f0f2f5', border: '1px solid #e9edef', color: '#111b21', fontSize: '15px', outline: 'none' },
  passwordEyeToggleBtn: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  primaryButton: { width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #00a884 0%, #128c7e 100%)', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  switchAuthText: { textAlign: 'center', fontSize: '14px', color: '#667781', marginTop: '20px' },
  switchAuthLink: { color: '#00a884', fontWeight: '700', cursor: 'pointer' },

  sidebar: { borderRight: '1px solid #e9edef', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', position: 'relative', height: '100dvh', boxSizing: 'border-box' },
  profileSection: { padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e9edef', backgroundColor: '#f0f2f5', flexShrink: 0 },
  profileDetails: { flex: 1, overflow: 'hidden' },
  profileUsername: { fontWeight: '700', fontSize: '15px', color: '#111b21', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  profileEmail: { fontSize: '12px', color: '#667781', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  headerIcons: { display: 'flex', gap: '4px' },
  iconButton: { padding: '8px', background: 'transparent', border: 'none', color: '#54656f', cursor: 'pointer', borderRadius: '50%' },

  tabNav: { display: 'flex', padding: '6px', margin: '8px 12px', backgroundColor: '#f0f2f5', borderRadius: '12px', gap: '2px', flexShrink: 0 },
  tabBtn: { flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', color: '#54656f', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: '600' },
  activeTabBtn: { flex: 1, padding: '9px 4px', backgroundColor: '#ffffff', border: '1px solid #e9edef', color: '#00a884', cursor: 'pointer', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: '700', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' },
  badge: { backgroundColor: '#25d366', color: '#fff', fontSize: '10px', borderRadius: '10px', padding: '1px 5px', fontWeight: 'bold' },

  listArea: { flex: 1, overflowY: 'auto', padding: '0', minHeight: 0, scrollBehavior: 'smooth' },
  newGroupBtn: { width: 'calc(100% - 24px)', boxSizing: 'border-box', margin: '8px 12px 4px', padding: '10px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px dashed #00a884', color: '#00a884', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '600' },
  startNewChatBtn: { width: 'calc(100% - 24px)', boxSizing: 'border-box', margin: '4px 12px 8px', padding: '10px', borderRadius: '10px', backgroundColor: '#00a884', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13.5px', fontWeight: '700' },
   
  archiveRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', margin: '0 12px 8px', backgroundColor: '#f0f2f5', borderRadius: '12px', cursor: 'pointer', border: '1px solid #e9edef' },
  archiveCountBadge: { backgroundColor: '#00a884', color: '#fff', fontSize: '11px', fontWeight: '800', borderRadius: '12px', padding: '2px 8px' },

  filterPillsRow: { display: 'flex', gap: '6px', padding: '6px 12px 10px', borderBottom: '1px solid #f0f2f5' },
  filterPill: { padding: '5px 12px', borderRadius: '18px', backgroundColor: '#f0f2f5', border: 'none', color: '#54656f', fontSize: '12px', fontWeight: '500', cursor: 'pointer' },
  filterPillActive: { padding: '5px 12px', borderRadius: '18px', backgroundColor: '#d9fdd3', border: 'none', color: '#00a884', fontSize: '12px', fontWeight: '700' },

  sectionHeading: { padding: '10px 16px 6px', fontSize: '13px', fontWeight: '700', color: '#54656f' },
  emptyListNotice: { textAlign: 'center', padding: '36px 16px', color: '#8696a0', fontSize: '14px' },

  chatRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f0f2f5', transition: 'background 0.15s ease' },
  groupAvatar: { width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#dfe5e7', color: '#54656f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0, cursor: 'pointer' },
  chatRowMeta: { flex: 1, overflow: 'hidden' },
  chatRowTitle: { display: 'block', fontWeight: '600', fontSize: '15px', color: '#111b21', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  chatRowSub: { display: 'block', fontSize: '13px', color: '#667781', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' },
  unreadBadge: { backgroundColor: '#25d366', color: '#ffffff', fontSize: '11px', fontWeight: '800', borderRadius: '12px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },

  chatDotsBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  chatDropdownMenu: { position: 'absolute', right: '16px', top: '40px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', border: '1px solid #e9edef', zIndex: 50, padding: '4px' },
  dropdownOptionBtn: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', fontSize: '13px', color: '#111b21', fontWeight: '600', cursor: 'pointer', borderRadius: '6px', whiteSpace: 'nowrap' },

  userRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f0f2f5', backgroundColor: '#ffffff' },
  userRowLeft: { display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' },
  userName: { fontWeight: '700', fontSize: '14px', color: '#111b21' },
  userEmail: { fontSize: '12px', color: '#667781' },
  addBtn: { padding: '6px 14px', borderRadius: '8px', background: '#00a884', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  pendingBtn: { padding: '6px 12px', borderRadius: '8px', backgroundColor: '#f0f2f5', color: '#667781', border: '1px solid #e9edef', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' },
  respondBtn: { padding: '6px 12px', borderRadius: '8px', backgroundColor: '#25d366', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  acceptBtn: { padding: '6px 14px', borderRadius: '8px', backgroundColor: '#25d366', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  friendsTag: { fontSize: '12px', color: '#00a884', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' },
  chatFriendBtn: { padding: '6px 12px', borderRadius: '6px', background: '#00a884', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  nicknameBtn: { padding: '6px 10px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700' },
  removeFriendBtn: { padding: '6px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '700' },

  metaAiFloatingBtn: { position: 'absolute', right: '16px', bottom: '16px', width: '48px', height: '48px', cursor: 'pointer', zIndex: 40 },
  metaAiGradientRing: { width: '100%', height: '100%', borderRadius: '50%', padding: '2.5px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)' },
  metaAiInnerCircle: { width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  aiAssistantModalBox: { width: '95%', maxWidth: '720px', height: '760px', maxHeight: '88vh', backgroundColor: '#ffffff', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.25)', overflow: 'hidden' },
  aiChatTabsRow: { display: 'flex', gap: '6px', padding: '8px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e9edef', alignItems: 'center' },
  aiChatTabBtn: { padding: '6px 14px', fontSize: '12.5px', fontWeight: '600', color: '#54656f', backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '8px', cursor: 'pointer' },
  aiChatTabActive: { padding: '6px 14px', fontSize: '12.5px', fontWeight: '700', color: '#00a884', backgroundColor: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '8px', cursor: 'pointer' },
  aiClearChatBtn: { marginLeft: 'auto', padding: '5px 10px', fontSize: '11.5px', fontWeight: '600', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' },

  aiModalHeader: { padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0f2f5', borderBottom: '1px solid #e9edef' },
  aiMessageThread: { flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', scrollBehavior: 'smooth' },
  aiBubble: { maxWidth: '82%', padding: '9px 13px', borderRadius: '12px', fontSize: '13.5px', lineHeight: '1.45', wordBreak: 'break-word', boxShadow: '0 1px 0.5px rgba(0,0,0,0.06)' },
  aiComposerBar: { padding: '10px 14px', display: 'flex', gap: '8px', backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef' },
  aiInput: { flex: 1, padding: '10px 14px', borderRadius: '20px', border: '1px solid #e9edef', outline: 'none', fontSize: '13.5px', backgroundColor: '#ffffff' },
  aiSendBtn: { width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#00a884', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#efeae2', position: 'relative', height: '100dvh', boxSizing: 'border-box', overflow: 'hidden' },
  windowHeader: { height: '60px', minHeight: '60px', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e9edef', backgroundColor: '#f0f2f5', zIndex: 10, flexShrink: 0 },
  windowHeaderInfo: { display: 'flex', alignItems: 'center', gap: '12px', userSelect: 'none' },
  backBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', padding: '4px', marginRight: '4px' },
  windowTitle: { margin: 0, fontSize: '16px', fontWeight: '600', color: '#111b21' },
  pollHeaderBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e9edef', color: '#00a884', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  addMemberHeaderBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #e9edef', color: '#00a884', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  addMemberLinkBtn: { display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#00a884', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  clearChatBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },

  batchActionBar: { position: 'absolute', top: '60px', left: 0, right: 0, backgroundColor: '#ffffff', borderBottom: '1px solid #e9edef', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 25, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  batchDeleteBtn: { padding: '6px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: '700', fontSize: '12.5px', cursor: 'pointer' },

  messagesContainer: { flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' },
  messageRow: { display: 'flex', gap: '8px', width: '100%', margin: '2px 0' },
  messageBubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '75%' },
  bubbleSenderName: { fontSize: '12px', color: '#128c7e', marginBottom: '2px', marginLeft: '4px', fontWeight: '700' },
  bubble: { borderRadius: '8px', fontSize: '14.5px', boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)', position: 'relative' },
   
  chatSystemMessageRow: { display: 'flex', justifyContent: 'center', margin: '8px 0', width: '100%', zIndex: 2 },
  chatSystemMessageBubble: { backgroundColor: '#f0f2f5', color: '#54656f', fontSize: '12px', fontWeight: '600', padding: '5px 14px', borderRadius: '10px', textAlign: 'center', maxWidth: '85%', boxShadow: '0 1px 1px rgba(0,0,0,0.05)', border: '1px solid #e9edef' },

  chatDateDivider: { display: 'flex', justifyContent: 'center', margin: '14px 0 10px', width: '100%', zIndex: 2 },
  chatDateDividerBadge: { backgroundColor: '#e1f3fb', color: '#54656f', fontSize: '11.5px', fontWeight: '700', padding: '5px 12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' },

  replyQuoteBox: { borderLeft: '4px solid', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px' },
  messageChevronBtn: { position: 'absolute', top: '2px', right: '2px', width: '22px', height: '22px', backgroundColor: 'transparent', border: 'none', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 15, padding: 0, color: '#54656f' },
  whatsappDropdownMenu: { position: 'absolute', top: '28px', right: '4px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #e9edef', zIndex: 60, padding: '6px 0', width: '150px', display: 'flex', flexDirection: 'column' },
  whatsappDropItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'none', border: 'none', fontSize: '13.5px', color: '#111b21', fontWeight: '600', cursor: 'pointer', textAlign: 'left', width: '100%' },

  quickHoverBar: { display: 'flex', alignItems: 'center', gap: '2px', backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '16px', padding: '2px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  quickIconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '50%', color: '#54656f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
   
  whatsappReactionPopup: { position: 'absolute', bottom: '100%', paddingBottom: '10px', display: 'flex', zIndex: 50 },
  whatsappReactionInner: { backgroundColor: '#ffffff', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'flex', padding: '6px 8px', gap: '4px', border: '1px solid #e9edef' },
  reactionEmojiBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '2px 5px', borderRadius: '50%' },
  extendedReactionGrid: { position: 'absolute', bottom: '110%', left: 0, width: '220px', height: '140px', backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', overflowY: 'auto', padding: '6px', zIndex: 60, border: '1px solid #e9edef', scrollBehavior: 'smooth' },
  gridEmojiSpan: { fontSize: '18px', padding: '4px', textAlign: 'center', cursor: 'pointer' },

  reactionBadgeRow: { display: 'flex', gap: '4px', marginTop: '1px', flexWrap: 'wrap' },
  reactionPill: { border: '1px solid', borderRadius: '12px', padding: '1px 6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' },
  statusMeta: { fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '4px' },
  typingBubble: { backgroundColor: '#ffffff', borderRadius: '18px', padding: '8px 14px', display: 'inline-flex', alignItems: 'center', boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)' },

  loadOlderBtn: { backgroundColor: '#ffffff', border: '1px solid #e9edef', color: '#00a884', padding: '6px 14px', borderRadius: '16px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.06)' },
  viewOnceBubbleCard: { backgroundColor: '#ffffff', border: '1px solid #e9edef', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', minWidth: '180px' },
  viewOnceIconBadge: { width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  youtubeCardWrapper: { borderRadius: '8px', overflow: 'hidden', border: '1px solid #e9edef', backgroundColor: '#ffffff', cursor: 'pointer', marginBottom: '4px' },
  youtubePlayOverlay: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },

  pollOptionBox: { position: 'relative', border: '1px solid', borderRadius: '8px', padding: '8px 10px', overflow: 'hidden' },
  pollProgressBar: { position: 'absolute', top: 0, bottom: '0', left: 0, zIndex: 1, transition: 'width 0.3s ease' },

  floatingDownBtn: { position: 'absolute', right: '20px', bottom: '80px', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#ffffff', border: '1px solid #e9edef', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25 },

  replyBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef', borderLeft: '4px solid #00a884', flexShrink: 0 },
  bannerCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#54656f' },

  composerEmojiDrawer: { position: 'absolute', bottom: '70px', left: '16px', width: '300px', height: '180px', backgroundColor: '#ffffff', borderRadius: '14px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', overflowY: 'auto', padding: '8px', zIndex: 20, border: '1px solid #e9edef', scrollBehavior: 'smooth' },

  inputContainer: { padding: '10px 16px', backgroundColor: '#f0f2f5', borderTop: '1px solid #e9edef', position: 'relative', flexShrink: 0 },
  composerForm: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', borderRadius: '8px', padding: '4px 6px 4px 10px', boxShadow: '0 1px 0.5px rgba(11,20,26,0.08)' },
  composerIconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  composerInput: { flex: 1, backgroundColor: 'transparent', border: 'none', color: '#111b21', fontSize: '15px', outline: 'none', padding: '8px 4px' },
  sendBtn: { width: '36px', height: '36px', borderRadius: '50%', background: '#00a884', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  notFriendsGateBanner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '12px', color: '#b45309', fontSize: '14px', fontWeight: '600' },

  recordingBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '8px 16px' },
  recordingPulse: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#dc2626', animation: 'pulse 1.5s infinite' },
  stopRecordBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },

  emptyStateContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', backgroundColor: '#f0f2f5' },
  emptyStateIcon: { width: '90px', height: '90px', borderRadius: '50%', backgroundColor: '#d9fdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },

  snapchatToast: { position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ffffff', borderRadius: '16px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.18)', border: '1px solid #e9edef', width: '92%', maxWidth: '380px', zIndex: 300, cursor: 'pointer' },
  snapToastAvatar: { width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' },
  snapToastPlaceholder: { width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#00a884', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' },
  snapCloseBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px' },

  lightboxBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' },
  lightboxContainer: { display: 'flex', flexDirection: 'column', maxWidth: '90vw', maxHeight: '90vh', alignItems: 'center' },
  lightboxHeader: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  lightboxCloseBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' },
  lightboxImage: { maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' },

  viewOnceModalBox: { backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
  viewOncePreviewImg: { maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', borderRadius: '8px' },
  viewOnceCheckboxRow: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', cursor: 'pointer', userSelect: 'none' },

  profilePopoverBox: { backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' },
  profilePopoverHead: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  profilePopoverImg: { width: '170px', height: '170px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' },
  profilePopoverPlaceholder: { width: '170px', height: '170px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#00a884', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', fontWeight: '800' },
  profilePopoverActions: { width: '100%', marginTop: '10px' },

  modalBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalBox: { backgroundColor: '#ffffff', border: '1px solid #e9edef', width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  closeBtn: { background: 'transparent', border: 'none', color: '#54656f', cursor: 'pointer' },

  settingsTabRow: { display: 'flex', gap: '4px', backgroundColor: '#f0f2f5', padding: '4px', borderRadius: '10px', marginBottom: '16px' },
  settingsTab: { flex: 1, padding: '8px 2px', fontSize: '12px', fontWeight: '600', color: '#54656f', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px' },
  settingsTabActive: { flex: 1, padding: '8px 2px', fontSize: '12px', fontWeight: '700', color: '#111b21', backgroundColor: '#ffffff', border: '1px solid #e9edef', cursor: 'pointer', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },

  credentialsViewerCard: { backgroundColor: '#f0f2f5', borderRadius: '12px', padding: '12px 14px', border: '1px solid #e9edef', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '4px' },
  credentialRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  avatarCameraBadge: { position: 'absolute', bottom: '0', right: '0', backgroundColor: '#00a884', border: '2px solid #ffffff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  colorPresetBtn: { width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', border: 'none' },
  resetBtn: { width: '100%', padding: '10px', borderRadius: '10px', backgroundColor: '#f0f2f5', border: '1px solid #e9edef', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px' },

  modalListLabel: { fontSize: '13px', color: '#667781', margin: '14px 0 6px', fontWeight: '600' },
  modalScrollList: { maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', scrollBehavior: 'smooth' },
  modalFriendRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', borderRadius: '10px', backgroundColor: '#f0f2f5', border: '1px solid #e9edef' },
  openChatBtn: { padding: '6px 14px', borderRadius: '8px', background: '#00a884', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700' },
  checkboxItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#111b21', cursor: 'pointer' },
  groupOwnerBadge: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  groupAdminBadge: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#d9fdd3', color: '#00a884', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  makeAdminBtn: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  removeMemberBtn: { display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  leaveGroupBtn: { width: '100%', padding: '10px', borderRadius: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' },
  secondaryBtn: { width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#f0f2f5', color: '#334155', border: '1px solid #e9edef', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteChoiceBtn: { width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#f0f2f5', color: '#111b21', border: '1px solid #e9edef', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  fieldLabel: { fontSize: '13px', color: '#475569', fontWeight: '600', marginBottom: '4px', display: 'block' },
  statusMessage: { padding: '9px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px', fontWeight: '500' },

  optionSelectorGroup: { display: 'flex', gap: '6px', marginTop: '4px' },
  optionBtn: { flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: '600', backgroundColor: '#f0f2f5', color: '#54656f', border: '1px solid #e9edef', borderRadius: '8px', cursor: 'pointer' },
  optionSelectedBtn: { flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: '700', color: '#ffffff', backgroundColor: '#00a884', border: '1px solid #00a884', borderRadius: '8px', cursor: 'pointer' },
  emailBackupNotice: { display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: '#54656f', backgroundColor: '#f0f2f5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e9edef' },

  dangerZone: { border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '12px', padding: '14px' },
  deleteInitBtn: { width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  deleteConfirmBtn: { flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#b91c1c', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
};