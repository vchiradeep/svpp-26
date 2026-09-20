import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import { askAiAssistant } from './services/aiService';
import { fetchUserConversations } from './services/chatService';
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

const playPopNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
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
  } catch (err) {}
};

const uploadMediaToSupabaseStorage = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
   
  const { error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('chat-media')
    .getPublicUrl(fileName);

  return data.publicUrl;
};

const extractYouTubeId = (text) => {
  if (!text) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
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
  const date = new Date(isoString);
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
  const date = new Date(isoString);
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
  const [session, setSession] = useState(null);
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
   
  const lastTypingBroadcastTimeRef = useRef(0);
  const typingStopTimerRef = useRef(null);
  const receiverTypingTimersRef = useRef({});
  const globalTypingChannelRef = useRef(null);
  const snapchatBannerTimeoutRef = useRef(null);
  const activeConversationRef = useRef(null);

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
      await supabase
        .from('profiles')
        .update({ nicknames_map: updated })
        .eq('id', profile.id);
    } catch (err) {
      console.error('Failed to sync nickname to Supabase:', err);
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
      [data-floating-ui="message-options-menu"],
      [data-floating-ui="chat-dots-menu"] {
        animation: floatingMenuPop 0.14s ease-out;
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveConversation(null);
        setConversations([]);
        setMessages([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setNewUsername(data.username || '');
    }
    syncSocialGraph(userId);
  };

  const syncSocialGraph = async (userId) => {
    await Promise.all([
      fetchUsers(userId),
      fetchFriendships(userId),
      fetchConversations(userId),
      fetchRequests(userId),
    ]);
  };

  useEffect(() => {
    if (!profile?.id) return;

    const presenceChannel = supabase.channel('global-presence', {
      config: { presence: { key: profile.id } }
    });

    const updatePresence = async (isOnline) => {
      const now = new Date().toISOString();
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: now })
          .eq('id', profile.id);
      } catch (err) {}

      presenceChannel.track({
        online_at: now,
        isOnline: isOnline,
      });
    };

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlinePresenceState(state);
         
        setUserLastSeen(prev => {
          const next = { ...prev };
          Object.keys(state).forEach(uid => {
            const presences = state[uid];
            if (presences && presences.length > 0) {
              const latest = presences[presences.length - 1];
              if (latest?.online_at) {
                next[uid] = latest.online_at;
              }
            }
          });
          return next;
        });
      })
      .on('presence', { event: 'join' }, () => {
        setOnlinePresenceState(presenceChannel.presenceState());
      })
      .on('presence', { event: 'leave' }, () => {
        setOnlinePresenceState(presenceChannel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          updatePresence(true);
        }
      });

    const handleVisibility = () => {
      updatePresence(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const heartbeatInterval = setInterval(() => {
      if (presenceChannel && document.visibilityState === 'visible') {
        updatePresence(true);
      }
    }, 4000);

    const handleUnload = () => {
      try {
        const now = new Date().toISOString();
        supabase.from('profiles').update({ last_seen: now }).eq('id', profile.id);
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence(false);
      presenceChannel.unsubscribe();
    };
  }, [profile?.id]);

  const handleSignOut = async () => {
    if (profile?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', profile.id);
      } catch (e) {}
    }
    await supabase.auth.signOut();
    localStorage.removeItem('svpp_user_session_pwd');
  };

  const getUserStatusType = (userId) => {
    if (userId === profile?.id) return 'online';
    const userPresences = onlinePresenceState[userId];
    if (!userPresences || userPresences.length === 0) return 'offline';

    const now = new Date().getTime();
    const isAnyOnline = userPresences.some((p) => {
      if (!p.isOnline) return false;
      if (!p.online_at) return true;
      const age = now - new Date(p.online_at).getTime();
      return age < 20000;
    });
    return isAnyOnline ? 'online' : 'offline';
  };

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`social-sync:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        syncSocialGraph(profile.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        fetchConversations(profile.id);
        if (activeConversationRef.current) {
          loadActiveMembers(activeConversationRef.current.id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations(profile.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers(profile.id);
        fetchConversations(profile.id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new;
        const convId = newMsg.conversation_id;
        const isMsgInCurrentActiveChat = activeConversationRef.current?.id === convId;

        if (newMsg.sender_id !== profile.id) {
          playPopNotificationSound();

          const { data: senderInfo } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          if (senderInfo) {
            const senderName = getDisplayName(senderInfo) || 'Someone';
             
            setSnapchatBanner({
              username: senderName,
              avatar_url: senderInfo.avatar_url,
              content: newMsg.content,
              convId: convId,
            });

            clearTimeout(snapchatBannerTimeoutRef.current);
            snapchatBannerTimeoutRef.current = setTimeout(() => {
              setSnapchatBanner(null);
            }, 3800);

            if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
              new Notification(`New message from ${senderName}`, {
                body: newMsg.content?.startsWith('https://') ? '📷 Photo' : newMsg.content,
                icon: FAVICON_SVG,
              });
            }
          }

          if (isMsgInCurrentActiveChat) {
            markAsRead(convId);
          } else {
            setUnreadCounts((prev) => ({
              ...prev,
              [convId]: (prev[convId] || 0) + 1,
            }));
          }
        }

        setConversations((prevConvs) => {
          const targetIndex = prevConvs.findIndex(c => c.id === convId);
          if (targetIndex === -1) {
            fetchConversations(profile.id);
            return prevConvs;
          }
          const target = prevConvs[targetIndex];
          const updatedMsgs = [...(target.messages || []), newMsg];
          const updatedConv = {
            ...target,
            messages: updatedMsgs,
            latestMsgTime: new Date(newMsg.created_at).getTime()
          };
          const others = prevConvs.filter(c => c.id !== convId);
          return [updatedConv, ...others].sort((a, b) => b.latestMsgTime - a.latestMsgTime);
        });

        fetchConversations(profile.id);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_members' }, () => {
        if (activeConversationRef.current) {
          loadActiveMembers(activeConversationRef.current.id);
        }
        fetchConversations(profile.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, nicknames]);

  useEffect(() => {
    if (!profile?.id) return;

    const typingChannel = supabase.channel('global-typing-channel', {
      config: { broadcast: { self: false } }
    });
    globalTypingChannelRef.current = typingChannel;

    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload || payload.userId === profile.id) return;

        const { convId, userId, username, isTyping } = payload;

        if (receiverTypingTimersRef.current[userId]) {
          clearTimeout(receiverTypingTimersRef.current[userId]);
        }

        if (isTyping) {
          setConvTypingMap((prev) => ({ ...prev, [convId]: username }));

          if (activeConversationRef.current?.id === convId) {
            setTypingUsers((prev) => ({ ...prev, [userId]: payload }));
          }

          receiverTypingTimersRef.current[userId] = setTimeout(() => {
            setConvTypingMap((prev) => {
              const copy = { ...prev };
              delete copy[convId];
              return copy;
            });
            setTypingUsers((prev) => {
              const copy = { ...prev };
              delete copy[userId];
              return copy;
            });
          }, 3200);
        } else {
          setConvTypingMap((prev) => {
            const copy = { ...prev };
            delete copy[convId];
            return copy;
          });
          setTypingUsers((prev) => {
            const copy = { ...prev };
            delete copy[userId];
            return copy;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
      globalTypingChannelRef.current = null;
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
    const { data } = await supabase.from('profiles').select('*').neq('id', myId);
    if (data) {
      setAllUsers(data);
      const seenMap = {};
      data.forEach(u => {
        if (u.last_seen) seenMap[u.id] = u.last_seen;
      });
      setUserLastSeen(prev => ({ ...prev, ...seenMap }));
    }
  };

  const fetchFriendships = async (myId) => {
    const { data } = await supabase
      .from('friend_requests')
      .select('*')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`);
    if (data) setFriendships(data);
  };

  const fetchRequests = async (myId) => {
    const { data } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!sender_id(*)')
      .eq('receiver_id', myId)
      .eq('status', 'pending');
    if (data) setRequests(data);
  };

  const fetchConversations = async (myId) => {
    const convList = await fetchUserConversations(myId);

    const { data: memberRows } = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at, last_read_at')
      .eq('user_id', myId);

    if (!convList || convList.length === 0) {
      setConversations([]);
      setUnreadCounts({});
      return;
    }

    const sortedConvs = convList.map((c) => {
      const msgs = c.messages || [];
      const latestMsgTime = msgs.length > 0 
        ? Math.max(...msgs.map((m) => new Date(m.created_at).getTime()))
        : new Date(c.created_at).getTime();
      return { ...c, latestMsgTime };
    }).sort((a, b) => b.latestMsgTime - a.latestMsgTime);

    setConversations(sortedConvs);

    const newUnread = {};
    convList.forEach((c) => {
      const myMem = (memberRows || []).find((m) => m.conversation_id === c.id);
      const lastRead = myMem?.last_read_at || '1970-01-01';
      if (activeConversationRef.current?.id === c.id) {
        newUnread[c.id] = 0;
      } else {
        const unread = (c.messages || []).filter((m) => m.sender_id !== myId && new Date(m.created_at) > new Date(lastRead)).length;
        newUnread[c.id] = unread;
      }
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

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: profile.id,
      receiver_id: receiverId,
      status: 'pending',
    });

    if (error) {
      fetchFriendships(profile.id);
      alert(error.message);
    }
  };

  const acceptRequest = async (requestId, senderId) => {
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    setFriendships((prev) =>
      prev.map((f) => (f.id === requestId ? { ...f, status: 'accepted' } : f))
    );

    await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
    const senderProfile = allUsers.find((u) => u.id === senderId) || { id: senderId, username: 'Friend' };
    await handleStartDirectChat(senderProfile, true);
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Unfriend this user?')) return;

    await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${profile.id})`);

    await syncSocialGraph(profile.id);
  };

  const markAsRead = async (convId) => {
    if (!profile?.id || !convId) return;
    const now = new Date().toISOString();

    setUnreadCounts((prev) => ({ ...prev, [convId]: 0 }));

    setActiveConvMembers((prev) =>
      prev.map((m) => (m.user_id === profile.id ? { ...m, last_read_at: now } : m))
    );

    await supabase
      .from('conversation_members')
      .update({ last_read_at: now })
      .match({ conversation_id: convId, user_id: profile.id });
     
    loadActiveMembers(convId);
    fetchConversations(profile.id);
  };

  const handleSelectConversation = (c) => {
    if (activeConversation?.id === c.id) return;
    setActiveConversation(c);
    setTypingUsers({});
    setSelectedMessageIds([]);
    setMessages(messagesCache[c.id] || []);
    markAsRead(c.id);

    supabase
      .from('messages')
      .select('*, profiles(id, username, avatar_url)')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .range(0, 35)
      .then(({ data }) => {
        if (data) {
          const sorted = data.reverse();
          const visible = sorted.filter((m) => !m.is_deleted_for_everyone && !m.deleted_for?.includes(profile.id));
          setMessagesCache((cache) => ({ ...cache, [c.id]: visible }));
          if (activeConversationRef.current?.id === c.id) {
            setMessages(visible);
            setTimeout(() => scrollToBottom('auto'), 20);
          }
          fetchActiveConvReactions(visible.map((m) => m.id));
        }
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
    let existing = conversations.find(
      (c) => !c.is_group && c.conversation_members?.some((m) => m.user_id === friend.id)
    );

    if (existing) {
      await supabase
        .from('conversation_members')
        .update({ hidden_at: null, last_read_at: new Date().toISOString() })
        .eq('conversation_id', existing.id)
        .eq('user_id', profile.id);

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

    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({ is_group: false })
      .select()
      .single();

    if (convErr || !newConv) {
      alert('Could not start conversation: ' + (convErr?.message || 'Error'));
      return;
    }

    const now = new Date().toISOString();
    await supabase.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: profile.id, hidden_at: null, last_read_at: now },
      { conversation_id: newConv.id, user_id: friend.id, hidden_at: null, last_read_at: '1970-01-01' }
    ]);

    await supabase.from('messages').insert({
      conversation_id: newConv.id,
      sender_id: isInitialAccept ? friend.id : profile.id,
      content: 'hi',
    });

    const builtConv = {
      ...newConv,
      conversation_members: [
        { conversation_id: newConv.id, user_id: profile.id, profiles: profile, hidden_at: null, last_read_at: now },
        { conversation_id: newConv.id, user_id: friend.id, profiles: friend, hidden_at: null, last_read_at: '1970-01-01' }
      ]
    };

    handleSelectConversation(builtConv);
    setConversations((prev) => [builtConv, ...prev.filter((c) => c.id !== builtConv.id)]);
    setShowNewChatModal(false);
    setProfilePreviewTarget(null);
    setActiveTab('chats');
    fetchConversations(profile.id);
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedGroupUsers.length === 0) return;
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ 
        is_group: true, 
        name: groupName.trim(), 
        created_by: profile.id
      })
      .select()
      .single();

    if (conv) {
      const now = new Date().toISOString();
      const membersToInsert = [profile.id, ...selectedGroupUsers].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        hidden_at: null,
        last_read_at: uid === profile.id ? now : '1970-01-01',
      }));
      await supabase.from('conversation_members').insert(membersToInsert);
      setShowGroupModal(false);
      setGroupName('');
      setSelectedGroupUsers([]);
      fetchConversations(profile.id);
    }
  };

  const handleRemoveMember = async (targetUserId, targetUsername) => {
    if (!window.confirm(`Remove ${targetUsername || 'this user'} from the group?`)) return;
    const { error } = await supabase
      .from('conversation_members')
      .delete()
      .match({ conversation_id: activeConversation.id, user_id: targetUserId });

    if (error) {
      alert('Failed to remove member: ' + error.message);
    } else {
      loadActiveMembers(activeConversation.id);
      fetchConversations(profile.id);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    await supabase
      .from('conversation_members')
      .delete()
      .match({ conversation_id: activeConversation.id, user_id: profile.id });

    setActiveConversation(null);
    setShowGroupInfoModal(false);
    fetchConversations(profile.id);
  };

  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    try {
      const publicUrl = await uploadMediaToSupabaseStorage(file);
      const { error } = await supabase
        .from('conversations')
        .update({ avatar_url: publicUrl })
        .eq('id', activeConversation.id);

      if (error) throw error;

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
    const { error } = await supabase.from('conversation_members').insert({
      conversation_id: activeConversation.id,
      user_id: friendId,
      hidden_at: null,
      last_read_at: '1970-01-01'
    });

    if (error) {
      alert('Could not add member: ' + error.message);
    } else {
      loadActiveMembers(activeConversation.id);
      fetchConversations(profile.id);
      setShowAddMemberModal(false);
    }
  };

  const loadActiveMembers = async (convId) => {
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id, hidden_at, last_read_at, profiles(id, username, avatar_url)')
      .eq('conversation_id', convId);
    if (data) setActiveConvMembers([...data]);
  };

  const fetchActiveConvReactions = async (msgIds) => {
    if (!msgIds || msgIds.length === 0) {
      setReactions([]);
      return;
    }
    const { data } = await supabase
      .from('message_reactions')
      .select('*, profiles(id, username, avatar_url)')
      .in('message_id', msgIds);
    if (data) setReactions(data);
  };

  useEffect(() => {
    if (!activeConversation) return;

    loadActiveMembers(activeConversation.id);
    markAsRead(activeConversation.id);

    const channel = supabase.channel(`chat:${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!payload.new.is_deleted_for_everyone && !payload.new.deleted_for?.includes(profile.id)) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', payload.new.sender_id)
                .single();

              setMessages((prev) => {
                const existingOptIndex = prev.findIndex(
                  (m) => String(m.id).startsWith('opt-') && m.sender_id === payload.new.sender_id && m.content === payload.new.content
                );
                if (existingOptIndex !== -1) {
                  const copy = [...prev];
                  copy[existingOptIndex] = { ...payload.new, profiles: senderProfile };
                  setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: copy }));
                  return copy;
                }
                if (prev.some((m) => m.id === payload.new.id)) return prev;
                const updated = [...prev, { ...payload.new, profiles: senderProfile }];
                setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
                return updated;
              });

              if (payload.new.sender_id !== profile.id) {
                markAsRead(activeConversation.id);
              }

              setTimeout(() => scrollToBottom('smooth'), 50);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.is_deleted_for_everyone || payload.new.deleted_for?.includes(profile.id)) {
              setMessages((prev) => {
                const updated = prev.filter((m) => m.id !== payload.new.id);
                setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
                return updated;
              });
            } else {
              setMessages((prev) => {
                const updated = prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m));
                setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
                return updated;
              });
            }
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        if (messages.length > 0) fetchActiveConvReactions(messages.map((m) => m.id));
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${activeConversation.id}` },
        () => {
          loadActiveMembers(activeConversation.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation?.id, profile?.id]);

  const loadOlderMessages = async () => {
    if (loadingOlderMessages || !hasMoreMessages || messages.length === 0 || !activeConversation) return;
    setLoadingOlderMessages(true);

    const oldestMsgCreatedAt = messages[0].created_at;
    const container = chatContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;

    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(id, username, avatar_url)')
      .eq('conversation_id', activeConversation.id)
      .lt('created_at', oldestMsgCreatedAt)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!error && data && data.length > 0) {
      const olderSorted = data.reverse();
      const visibleOlder = olderSorted.filter((m) => {
        if (m.is_deleted_for_everyone) return false;
        if (m.deleted_for && m.deleted_for.includes(profile.id)) return false;
        return true;
      });

      setMessages((prev) => {
        const updated = [...visibleOlder, ...prev];
        setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
        return updated;
      });
      setHasMoreMessages(data.length === 30);
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

    if (!globalTypingChannelRef.current || !profile || !activeConversation) return;

    const now = Date.now();
    if (now - lastTypingBroadcastTimeRef.current > 800) {
      lastTypingBroadcastTimeRef.current = now;
      globalTypingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          convId: activeConversation.id,
          userId: profile.id,
          username: getDisplayName(profile) || 'Someone',
          avatarUrl: profile.avatar_url,
          isTyping: true,
        },
      });
    }

    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      lastTypingBroadcastTimeRef.current = 0;
      if (globalTypingChannelRef.current && activeConversationRef.current) {
        globalTypingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: {
            convId: activeConversationRef.current.id,
            userId: profile.id,
            username: getDisplayName(profile) || 'Someone',
            isTyping: false,
          },
        });
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
      setChatDropdownOpenId(null);
    };
    document.addEventListener('mousedown', handleGlobalPointerDownCloseMenus, true);
    document.addEventListener('touchstart', handleGlobalPointerDownCloseMenus, true);
    return () => {
      document.removeEventListener('mousedown', handleGlobalPointerDownCloseMenus, true);
      document.removeEventListener('touchstart', handleGlobalPointerDownCloseMenus, true);
    };
  }, []);

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
    if (globalTypingChannelRef.current && activeConversation) {
      globalTypingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          convId: activeConversation.id,
          userId: profile.id,
          username: getDisplayName(profile) || 'Someone',
          isTyping: false,
        },
      });
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

      await supabase
        .from('messages')
        .update({
          content,
          edited_at: new Date().toISOString()
        })
        .eq('id', msgId);
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
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: profile.id,
          content,
          reply_to_id: replyId,
        })
        .select('*, profiles(id, username, avatar_url)')
        .single();

      if (error) throw error;

      if (data) {
        setMessages((prev) => {
          const updated = prev.map((m) => m.id === optId ? data : m);
          setMessagesCache((cache) => ({ ...cache, [activeConversation.id]: updated }));
          return updated;
        });
        setSendingStatuses((prev) => ({ ...prev, [data.id]: 'sent' }));
        setTimeout(() => {
          setSendingStatuses((prev) => {
            const updated = { ...prev };
            delete updated[optId];
            delete updated[data.id];
            return updated;
          });
        }, 3000);
      }
    } catch {
      setSendingStatuses((prev) => ({ ...prev, [optId]: 'failed' }));
    }
  };

  const handleForwardMessageToConv = async (targetConvId) => {
    if (!forwardingMessage) return;
    const contentToForward = forwardingMessage.content;
    setForwardingMessage(null);
    setShowForwardModal(false);

    try {
      await supabase.from('messages').insert({
        conversation_id: targetConvId,
        sender_id: profile.id,
        content: contentToForward,
      });
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
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').upsert({
        message_id: msgId,
        user_id: profile.id,
        emoji: chosenEmoji
      }, { onConflict: 'message_id,user_id' });
    }

    fetchActiveConvReactions(messages.map((m) => m.id));
  };

  const handleImageFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    try {
      const publicUrl = await uploadMediaToSupabaseStorage(file);
      setPendingImageUpload({ src: publicUrl });
      setIsViewOnceChecked(false);
    } catch {
      alert('Failed to upload image.');
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
    await supabase
      .from('messages')
      .update({ viewed_by: updatedViewedBy })
      .eq('id', msg.id);
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

      await supabase
        .from('messages')
        .update({ content: newContent })
        .eq('id', msgId);
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

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice.webm', { type: 'audio/webm' });
        try {
          const publicUrl = await uploadMediaToSupabaseStorage(audioFile);
          await supabase.from('messages').insert({
            conversation_id: activeConversation.id,
            sender_id: profile.id,
            content: `[AUDIO]:${publicUrl}`,
            reply_to_id: replyingTo ? replyingTo.id : null,
          });
          setReplyingTo(null);
          setTimeout(() => scrollToBottom('smooth'), 50);
        } catch {
          alert('Failed to upload voice note.');
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access was denied or unsupported.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!activeConversation) return;
    if (!window.confirm('Delete this chat from your list? (Reappears upon new messages)')) return;

    const convId = activeConversation.id;
    setActiveConversation(null);

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return {
            ...c,
            conversation_members: c.conversation_members.map((m) =>
              m.user_id === profile.id ? { ...m, hidden_at: new Date().toISOString() } : m
            ),
          };
        }
        return c;
      })
    );

    await supabase
      .from('conversation_members')
      .update({ hidden_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', profile.id);

    fetchConversations(profile.id);
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
      const updatedDeletedFor = [...(msg.deleted_for || []), profile.id];
      await supabase.from('messages').update({ deleted_for: updatedDeletedFor }).eq('id', msg.id);
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
      await supabase.from('messages').update({ is_deleted_for_everyone: true }).eq('id', id);
    }
  };

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSavingSettings(true);
      const publicUrl = await uploadMediaToSupabaseStorage(file);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);
      if (error) throw error;
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
      const publicUrl = await uploadMediaToSupabaseStorage(file);
      const newConfig = { type: 'image', value: publicUrl };
      setChatBg(newConfig);
      localStorage.setItem('chat_wallpaper_config', JSON.stringify(newConfig));
      setSettingsMsg({ text: 'Custom chat background applied!', type: 'success' });
    } catch {
      alert('Failed to apply wallpaper.');
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
    setSavingSettings(true);

    try {
      let updatedUsernameVal = profile?.username || '';
      let updatedPasswordVal = currentSessionPassword || 'Unchanged';

      if (changeOption === 'username' || changeOption === 'both') {
        if (!newUsername.trim()) throw new Error('Please enter a username.');
        const { error: unameErr } = await supabase
          .from('profiles')
          .update({ username: newUsername.trim() })
          .eq('id', profile.id);
        if (unameErr) throw unameErr;
        updatedUsernameVal = newUsername.trim();
        setProfile((prev) => ({ ...prev, username: updatedUsernameVal }));
      }

      if (changeOption === 'password' || changeOption === 'both') {
        if (!newPassword.trim() || newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword });
        if (pwdErr) throw pwdErr;
        updatedPasswordVal = newPassword;
        setCurrentSessionPassword(newPassword);
        localStorage.setItem('svpp_user_session_pwd', newPassword);
      }

      await sendCredentialsToMail({
        targetEmail: session.user.email,
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
      setSettingsMsg({ text: err.text || err.message || 'Failed to update credentials.', type: 'error' });
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
        targetEmail: session.user.email,
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
      const { error } = await supabase.rpc('delete_own_account');
      if (error) throw error;

      await handleSignOut();
      alert('Account deleted. This email can be re-registered anytime.');
      window.location.reload();
    } catch (err) {
      setSettingsMsg({ text: err.message, type: 'error' });
      setDeletingAccount(false);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'signup') {
        const initialUname = username || email.split('@')[0];
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { user_name: initialUname } },
        });
        if (error) throw error;

        setCurrentSessionPassword(password);
        localStorage.setItem('svpp_user_session_pwd', password);

        await sendCredentialsToMail({
          targetEmail: email,
          uname: initialUname,
          pwd: password,
          actionType: 'Account Registration Details',
        });
        alert('Account registered! Verification details emailed.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setCurrentSessionPassword(password);
        localStorage.setItem('svpp_user_session_pwd', password);
      }
    } catch (err) {
      setAuthError(err.message);
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
      const isSeen = otherMem?.last_read_at && new Date(otherMem.last_read_at) >= new Date(msg.created_at);
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
          <span style={{ ...styles.statusMeta, color: '#8696a0' }} title="Sent">
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
        {!isDeletedUser && !isGroupMember && (
          <div
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: `${Math.max(10, Math.round(size * 0.26))}px`,
              height: `${Math.max(10, Math.round(size * 0.26))}px`,
              borderRadius: '50%',
              backgroundColor: statusColor,
              border: '2px solid #ffffff',
            }}
            title={statusType === 'online' ? 'Online' : 'Offline'}
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

  if (!session) {
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

  const visibleConversations = conversations.filter((c) => {
    const myMem = c.conversation_members?.find((m) => m.user_id === profile?.id);
    return !myMem?.hidden_at && !archivedConvIds.includes(c.id);
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
    <div style={styles.appContainer} onClick={() => setOpenMessageMenuId(null)}>
       
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
              {snapchatBanner.content?.startsWith('https://') ? '📷 Photo' : snapchatBanner.content}
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
              <div style={styles.profileEmail}>{session.user.email}</div>
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

                    const latestMsg = c.messages && c.messages.length > 0
                      ? c.messages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                      : null;
                    const chatTimestamp = formatChatTimestamp(latestMsg?.created_at || c.created_at);
                     
                    const subLabel = isTypingNow && !rowIsDeleted 
                      ? (c.is_group ? `${isTypingNow} is typing...` : 'typing...')
                      : c.is_group 
                        ? `${c.conversation_members?.length || 0} members` 
                        : rowIsDeleted 
                          ? 'Account removed' 
                          : rowIsUnfriended 
                            ? 'Unfriended' 
                            : statusType === 'online' 
                              ? '● Online' 
                              : formatLastSeen(userLastSeen[cUserId]);

                    return (
                      <div
                        key={c.id}
                        className="hover-dim"
                        onClick={() => handleSelectConversation(c)}
                        style={{
                          ...styles.chatRow,
                          backgroundColor: isSelected ? '#f0f2f5' : '#ffffff',
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
                            <span style={{ ...styles.chatRowSub, color: isTypingNow ? '#00a884' : statusType === 'online' ? '#00a884' : '#667781' }}>
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
                              setChatDropdownOpenId(chatDropdownOpenId === c.id ? null : c.id);
                            }}
                            style={styles.chatDotsBtn}
                            title="Chat options"
                          >
                            <MoreVertical size={16} color="#54656f" />
                          </button>

                          {chatDropdownOpenId === c.id && (
                            <div data-floating-ui="chat-dots-menu" style={styles.chatDropdownMenu}>
                              <button
                                onClick={(e) => toggleArchiveChat(c.id, e)}
                                style={styles.dropdownOptionBtn}
                              >
                                <Archive size={14} /> Archive Chat
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
                            <div style={styles.userEmail}>{statusType === 'online' ? '● Online' : formatLastSeen(userLastSeen[u.id])}</div>
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
                            <div style={styles.userEmail}>{statusType === 'online' ? '● Online' : formatLastSeen(userLastSeen[u.id])}</div>
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
                              : (otherStatusType === 'online' ? <span style={{ color: '#00a884', fontWeight: '700' }}>● online</span> : formatLastSeen(userLastSeen[otherUserId]))}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setShowMediaGalleryModal(true)}
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
                    onClick={handleDeleteChat}
                    style={styles.clearChatBtn}
                    title="Delete this chat from your list"
                  >
                    <Trash2 size={17} color="#ef4444" />
                    {!isMobile && <span>Delete Chat</span>}
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

                {messages.map((m, mIdx) => {
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
                  const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isImage = m.content?.startsWith('[IMAGE]:') || (m.content?.startsWith('https://') && !m.content?.startsWith('[AUDIO]:') && !m.content?.startsWith('[POLL]:'));
                  const isViewOnceImg = m.content?.startsWith('[VIEW-ONCE]:');
                  const isAudio = m.content?.startsWith('[AUDIO]:');
                  const isPoll = m.content?.startsWith('[POLL]:');
                  const youtubeId = !isImage && !isViewOnceImg && !isAudio && !isPoll ? extractYouTubeId(m.content) : null;

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
                  const prevMessage = mIdx > 0 ? messages[mIdx - 1] : null;
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
                          if (activeReactionPickerMsgId === m.id) {
                            setActiveReactionPickerMsgId(null);
                            setShowExtendedReactions(false);
                          }
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
                              {/* WhatsApp style hover chevron arrow positioned inside top-right */}
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
                                    {repliedMsg.content?.startsWith('https://') || repliedMsg.content?.startsWith('[IMAGE]:') || repliedMsg.content?.startsWith('[VIEW-ONCE]:') ? '📷 Photo' : repliedMsg.content?.startsWith('[AUDIO]:') ? '🎤 Voice note' : (repliedMsg.content || '')}
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
                                onClick={(e) => { e.stopPropagation(); setActiveReactionPickerMsgId(activeReactionPickerMsgId === m.id ? null : m.id); }} 
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
                })}

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
                      {replyingTo.content?.startsWith('https://') || replyingTo.content?.startsWith('[IMAGE]:') || replyingTo.content?.startsWith('[VIEW-ONCE]:') ? '📷 Photo' : replyingTo.content?.startsWith('[AUDIO]:') ? '🎤 Voice note' : (replyingTo.content || '')}
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
        <div style={styles.modalBackdrop} onClick={() => setShowMediaGalleryModal(false)}>
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
            <div style={{ ...styles.modalScrollList, maxHeight: '320px' }}>
              {messages.filter(m => m.content?.startsWith('[IMAGE]:') || m.content?.startsWith('https://') || m.content?.startsWith('[AUDIO]:')).length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
                  No media shared in this chat yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {messages.filter(m => m.content?.startsWith('[IMAGE]:') || m.content?.startsWith('https://')).map(m => {
                    const imgUrl = m.content.replace('[IMAGE]:', '');
                    return (
                      <img
                        key={m.id}
                        src={imgUrl}
                        alt="Shared media"
                        onClick={() => {
                          setPreviewImage({ src: imgUrl, title: 'Shared Photo' });
                          setShowMediaGalleryModal(false);
                        }}
                        style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }}
                      />
                    );
                  })}
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
        <div style={styles.modalBackdrop} onClick={() => setShowForwardModal(false)}>
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
        <div style={styles.modalBackdrop} onClick={() => setReactionDetailsTarget(null)}>
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
        <div style={styles.modalBackdrop} onClick={() => setShowPollModal(false)}>
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
        <div style={styles.modalBackdrop} onClick={() => setShowNicknameModal(false)}>
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
        <div style={styles.modalBackdrop} onClick={() => setShowArchiveModal(false)}>
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
        <div style={styles.lightboxBackdrop} onClick={() => setPendingImageUpload(null)}>
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
        <div style={styles.lightboxBackdrop} onClick={() => setViewOnceViewerData(null)}>
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
        <div style={styles.lightboxBackdrop} onClick={() => setProfilePreviewTarget(null)}>
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
        <div style={styles.lightboxBackdrop} onClick={() => setPreviewImage(null)}>
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
        <div style={styles.modalBackdrop}>
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isOwner && (
                          <div style={styles.groupOwnerBadge} title="Group Creator & Admin">
                            <Crown size={12} color="#b45309" />
                            <span>Owner</span>
                          </div>
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
        <div style={styles.modalBackdrop}>
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
                        <div style={{ fontSize: '12px', color: '#667781' }}>{getUserStatusType(f.id) === 'online' ? '● Online' : formatLastSeen(userLastSeen[f.id])}</div>
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
        <div style={styles.modalBackdrop}>
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
                        <div style={{ fontSize: '12px', color: '#667781' }}>{getUserStatusType(friend.id) === 'online' ? '● Online' : formatLastSeen(userLastSeen[friend.id])}</div>
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
        <div style={styles.modalBackdrop}>
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
        <div style={styles.modalBackdrop}>
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
                    <span style={{ fontWeight: '600', color: '#111b21', fontSize: '12.5px' }}>{session.user.email}</span>
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
                    Credentials updates are mailed directly to <b>{session.user.email}</b>.
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