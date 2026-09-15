import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import { 
  MessageSquare, Users, UserPlus, Settings, LogOut, Send, 
  Check, Clock, Plus, KeyRound, Sparkles, X, ChevronLeft, 
  MailCheck, Trash2, AlertTriangle, Image as ImageIcon, 
  Mic, Square, Camera, Palette, RotateCcw, MoreVertical, 
  UserCheck, UserX, MessageCircle 
} from 'lucide-react';

// EmailJS Credentials
const EMAILJS_SERVICE_ID = 'service_l1fiok5';
const EMAILJS_TEMPLATE_ID = 'template_lbuqucn';
const EMAILJS_PUBLIC_KEY = '5nZrVHZgApUZf00Z4';

const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Responsive state
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Real-time Online Presence
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // Auth Inputs
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');

  // Tabs: 'chats' | 'friends' | 'users' | 'requests'
  const [activeTab, setActiveTab] = useState('chats');
  const [allUsers, setAllUsers] = useState([]);
  const [friendships, setFriendships] = useState([]); 
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [requests, setRequests] = useState([]);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Chat Wallpaper
  const [chatBg, setChatBg] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_wallpaper_config');
      return saved ? JSON.parse(saved) : { type: 'color', value: '#ffffff' };
    } catch {
      return { type: 'color', value: '#ffffff' };
    }
  });

  // Message Deletion Menu
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState(null);

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [changeOption, setChangeOption] = useState('both');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [settingsMsg, setSettingsMsg] = useState({ text: '', type: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Deletion Verification Flow
  const [deleteStep, setDeleteStep] = useState('idle');
  const [generatedDeleteOtp, setGeneratedDeleteOtp] = useState('');
  const [enteredDeleteOtp, setEnteredDeleteOtp] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const bgImageInputRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Session Lifecycle
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

  // 2. Real-time Presence
  useEffect(() => {
    if (!profile?.id) return;

    const presenceChannel = supabase.channel('global-presence', {
      config: { presence: { key: profile.id } }
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [profile?.id]);

  // 3. Real-time Listeners
  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel(`social-sync:${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => {
        syncSocialGraph(profile.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members' }, () => {
        fetchConversations(profile.id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations(profile.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  // 4. Email Dispatch Helper
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

  // 5. Data Fetchers
  const fetchUsers = async (myId) => {
    const { data } = await supabase.from('profiles').select('*').neq('id', myId);
    if (data) setAllUsers(data);
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
    const { data: memberRows, error } = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at')
      .eq('user_id', myId);

    if (error || !memberRows || memberRows.length === 0) {
      setConversations([]);
      return;
    }

    const convIds = memberRows.map((m) => m.conversation_id);
    const { data: convList } = await supabase
      .from('conversations')
      .select('*, conversation_members(*, profiles(*))')
      .in('id', convIds)
      .order('created_at', { ascending: false });

    if (convList) setConversations(convList);
  };

  // 6. Relationships & Friends
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
    const confirmRemove = window.confirm('Remove this friend? You will not be able to message each other until re-friended.');
    if (!confirmRemove) return;

    await supabase
      .from('friend_requests')
      .delete()
      .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${profile.id})`);

    await syncSocialGraph(profile.id);
  };

  // 7. Instant Chat Activation (Unhides if previously hidden)
  const handleStartDirectChat = async (friend, isInitialAccept = false) => {
    let existing = conversations.find(
      (c) => !c.is_group && c.conversation_members?.some((m) => m.user_id === friend.id)
    );

    if (existing) {
      // Unhide the conversation if it was deleted/hidden
      await supabase
        .from('conversation_members')
        .update({ hidden_at: null })
        .eq('conversation_id', existing.id)
        .eq('user_id', profile.id);

      // Update in local state
      const unhiddenConv = {
        ...existing,
        conversation_members: existing.conversation_members.map((m) =>
          m.user_id === profile.id ? { ...m, hidden_at: null } : m
        ),
      };

      setActiveConversation(unhiddenConv);
      setConversations((prev) => [unhiddenConv, ...prev.filter((c) => c.id !== unhiddenConv.id)]);
      setShowNewChatModal(false);
      setActiveTab('chats');
      return;
    }

    // Otherwise, create a new conversation
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({ is_group: false })
      .select()
      .single();

    if (convErr || !newConv) {
      alert('Could not start conversation: ' + (convErr?.message || 'Error'));
      return;
    }

    await supabase.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: profile.id, hidden_at: null },
      { conversation_id: newConv.id, user_id: friend.id, hidden_at: null }
    ]);

    await supabase.from('messages').insert({
      conversation_id: newConv.id,
      sender_id: isInitialAccept ? friend.id : profile.id,
      content: 'hi',
    });

    const builtConv = {
      ...newConv,
      conversation_members: [
        { conversation_id: newConv.id, user_id: profile.id, profiles: profile, hidden_at: null },
        { conversation_id: newConv.id, user_id: friend.id, profiles: friend, hidden_at: null }
      ]
    };

    setActiveConversation(builtConv);
    setConversations((prev) => [builtConv, ...prev.filter((c) => c.id !== builtConv.id)]);
    setShowNewChatModal(false);
    setActiveTab('chats');

    fetchConversations(profile.id);
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedGroupUsers.length === 0) return;
    const { data: conv } = await supabase
      .from('conversations')
      .insert({ is_group: true, name: groupName.trim() })
      .select()
      .single();

    if (conv) {
      const members = [profile.id, ...selectedGroupUsers].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        hidden_at: null,
      }));
      await supabase.from('conversation_members').insert(members);
      setShowGroupModal(false);
      setGroupName('');
      setSelectedGroupUsers([]);
      fetchConversations(profile.id);
    }
  };

  // 8. Real-time Messages
  useEffect(() => {
    if (!activeConversation) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(username, avatar_url)')
        .eq('conversation_id', activeConversation.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const visible = data.filter((m) => {
          if (m.is_deleted_for_everyone) return false;
          if (m.deleted_for && m.deleted_for.includes(profile.id)) return false;
          return true;
        });
        setMessages(visible);
      }
    };
    loadMessages();

    const channel = supabase
      .channel(`chat:${activeConversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConversation.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!payload.new.is_deleted_for_everyone && !payload.new.deleted_for?.includes(profile.id)) {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.new.sender_id)
                .single();

              setMessages((prev) => [...prev, { ...payload.new, profiles: senderProfile }]);
            }
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.is_deleted_for_everyone || payload.new.deleted_for?.includes(profile.id)) {
              setMessages((prev) => prev.filter((m) => m.id !== payload.new.id));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConversation, profile?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;
    const content = newMessage.trim();
    setNewMessage('');

    await supabase.from('messages').insert({
      conversation_id: activeConversation.id,
      sender_id: profile.id,
      content,
    });
  };

  const handleImageMessageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    try {
      const base64Image = await compressImage(file, 900, 900, 0.7);
      await supabase.from('messages').insert({
        conversation_id: activeConversation.id,
        sender_id: profile.id,
        content: `[IMAGE]:${base64Image}`,
      });
    } catch {
      alert('Failed to upload image.');
    }
    e.target.value = null;
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
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          await supabase.from('messages').insert({
            conversation_id: activeConversation.id,
            sender_id: profile.id,
            content: `[AUDIO]:${base64Audio}`,
          });
        };
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

  // 9. WhatsApp-Style "Delete Chat" (Hides the chat without deleting messages)
  const handleDeleteChat = async () => {
    if (!activeConversation) return;

    const confirmDelete = window.confirm(
      'Delete this chat? It will disappear from your chat list. If a new message is sent or received, it will reappear with all previous messages intact.'
    );
    if (!confirmDelete) return;

    const convId = activeConversation.id;
    setActiveConversation(null);

    // Optimistically hide the chat locally
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

    // Save hidden_at in Supabase
    await supabase
      .from('conversation_members')
      .update({ hidden_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', profile.id);

    fetchConversations(profile.id);
  };

  // 10. Message Deletions
  const handleDeleteForMe = async (msg) => {
    const updatedDeletedFor = [...(msg.deleted_for || []), profile.id];
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setSelectedMessageForDelete(null);

    await supabase
      .from('messages')
      .update({ deleted_for: updatedDeletedFor })
      .eq('id', msg.id);
  };

  const handleDeleteForEveryone = async (msg) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setSelectedMessageForDelete(null);

    await supabase
      .from('messages')
      .update({ is_deleted_for_everyone: true })
      .eq('id', msg.id);
  };

  // 11. Profile Photo & Wallpapers
  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSavingSettings(true);
      const compressedAvatar = await compressImage(file, 300, 300, 0.8);
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: compressedAvatar })
        .eq('id', profile.id);
      if (error) throw error;
      setProfile((prev) => ({ ...prev, avatar_url: compressedAvatar }));
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
      const compressedBg = await compressImage(file, 1400, 1400, 0.7);
      const newConfig = { type: 'image', value: compressedBg };
      setChatBg(newConfig);
      localStorage.setItem('chat_wallpaper_config', JSON.stringify(newConfig));
      setSettingsMsg({ text: 'Custom chat background applied!', type: 'success' });
    } catch {
      alert('Failed to apply wallpaper.');
    }
    e.target.value = null;
  };

  const handleResetWallpaper = () => {
    const defaultConfig = { type: 'color', value: '#ffffff' };
    setChatBg(defaultConfig);
    localStorage.setItem('chat_wallpaper_config', JSON.stringify(defaultConfig));
  };

  // 12. Credential Update
  const handleUpdateCredentials = async () => {
    setSettingsMsg({ text: '', type: '' });
    setSavingSettings(true);

    try {
      let updatedUsernameVal = profile?.username || '';
      let updatedPasswordVal = 'Unchanged';

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

  // 13. Account Deletion
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

      await supabase.auth.signOut();
      alert('Account deleted. This email can be re-registered anytime.');
      window.location.reload();
    } catch (err) {
      setSettingsMsg({ text: err.message, type: 'error' });
      setDeletingAccount(false);
    }
  };

  // 14. Auth Handlers
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

        await sendCredentialsToMail({
          targetEmail: email,
          uname: initialUname,
          pwd: password,
          actionType: 'Account Registration Details',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  // Avatar Component
  const renderAvatar = (avatarUrl, fallbackText, size = 44, isSquare = false, isUserOnline = false) => {
    return (
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        {avatarUrl ? (
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
              background: isSquare ? '#dbeafe' : 'linear-gradient(135deg, #2563eb, #60a5fa)',
              color: isSquare ? '#1d4ed8' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: `${Math.round(size * 0.4)}px`,
            }}
          >
            {fallbackText ? fallbackText[0].toUpperCase() : 'U'}
          </div>
        )}
        {isUserOnline && (
          <div
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: `${Math.max(10, Math.round(size * 0.26))}px`,
              height: `${Math.max(10, Math.round(size * 0.26))}px`,
              borderRadius: '50%',
              backgroundColor: '#16a34a',
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
        <Sparkles style={{ animation: 'spin 2s linear infinite', color: '#2563eb' }} size={38} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.authContainer}>
        <div style={styles.authCard}>
          <div style={styles.authHeader}>
            <div style={styles.logoBadge}>
              <Sparkles size={28} color="#ffffff" />
            </div>
            <h2 style={styles.authTitle}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
            <p style={styles.authSubtitle}>
              {authMode === 'login' ? 'Enter credentials or use Google' : 'Your login details will be mailed for recovery'}
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
            <input
              type="password"
              placeholder="Password"
              style={styles.modernInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" style={styles.primaryButton}>
              {authMode === 'login' ? 'Sign In' : 'Register & Email My Credentials'}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine}></span>
            <span style={styles.dividerText}>or</span>
            <span style={styles.dividerLine}></span>
          </div>

          <button onClick={handleGoogleLogin} style={styles.googleButton}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Continue with Google
          </button>

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

  // Dashboard Layout
  const showSidebar = !isMobile || !activeConversation;
  const showChatWindow = !isMobile || !!activeConversation;

  const otherDirectMember = activeConversation && !activeConversation.is_group
    ? activeConversation.conversation_members?.find((m) => m.user_id !== profile?.id)
    : null;

  const otherUserId = otherDirectMember?.user_id;
  const isDirectOtherOnline = otherUserId ? onlineUserIds.has(otherUserId) : false;

  const isDirectChatFriend = activeConversation?.is_group 
    ? true 
    : (otherUserId ? getRelationStatus(otherUserId) === 'accepted' : true);

  const groupOnlineCount = activeConversation?.is_group
    ? activeConversation.conversation_members?.filter((m) => m.user_id !== profile?.id && onlineUserIds.has(m.user_id)).length
    : 0;

  // Filter out conversations that this user has deleted/hidden
  const visibleConversations = conversations.filter((c) => {
    const myMem = c.conversation_members?.find((m) => m.user_id === profile?.id);
    return !myMem?.hidden_at;
  });

  return (
    <div style={styles.appContainer}>
      {showSidebar && (
        <aside style={{ ...styles.sidebar, width: isMobile ? '100vw' : '360px' }}>
          <div style={styles.profileSection}>
            {renderAvatar(profile?.avatar_url, profile?.username || session.user.email, 44, false, true)}
            <div style={styles.profileDetails}>
              <div style={styles.profileUsername}>{profile?.username || 'User'}</div>
              <div style={styles.profileEmail}>{session.user.email}</div>
            </div>
            <div style={styles.headerIcons}>
              <button onClick={() => setShowSettingsModal(true)} style={styles.iconButton} title="Settings & Customization">
                <Settings size={20} />
              </button>
              <button onClick={() => supabase.auth.signOut()} style={styles.iconButton} title="Logout">
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

                {visibleConversations.length === 0 ? (
                  <div style={styles.emptyListNotice}>No active chats. Start a new chat with a friend!</div>
                ) : (
                  visibleConversations.map((c) => {
                    const otherMember = c.conversation_members?.find((m) => m.user_id !== profile?.id)?.profiles;
                    const cUserId = c.conversation_members?.find((m) => m.user_id !== profile?.id)?.user_id;
                    const isOnline = cUserId ? onlineUserIds.has(cUserId) : false;
                    const title = c.is_group ? c.name : otherMember?.username || 'Direct Message';
                    const isSelected = activeConversation?.id === c.id;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setActiveConversation(c)}
                        style={{
                          ...styles.chatRow,
                          backgroundColor: isSelected ? '#f1f5f9' : '#ffffff',
                          borderColor: isSelected ? '#cbd5e1' : '#f1f5f9',
                        }}
                      >
                        {c.is_group ? (
                          <div style={styles.groupAvatar}>👥</div>
                        ) : (
                          renderAvatar(otherMember?.avatar_url, title, 40, false, isOnline)
                        )}
                        <div style={styles.chatRowMeta}>
                          <span style={styles.chatRowTitle}>{title}</span>
                          <span style={styles.chatRowSub}>
                            {c.is_group ? 'Group chat' : (isOnline ? '● Online' : '○ Not online')}
                          </span>
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
                    const isUserOnline = onlineUserIds.has(u.id);
                    return (
                      <div key={u.id} style={styles.userRow}>
                        <div style={styles.userRowLeft}>
                          {renderAvatar(u.avatar_url, u.username || u.email, 40, false, isUserOnline)}
                          <div>
                            <div style={styles.userName}>{u.username || 'User'}</div>
                            <div style={styles.userEmail}>{isUserOnline ? '● Online' : '○ Not online'}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
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
                            title="Remove friend"
                          >
                            <UserX size={14} />
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
                    const isUserOnline = onlineUserIds.has(u.id);

                    return (
                      <div key={u.id} style={styles.userRow}>
                        <div style={styles.userRowLeft}>
                          {renderAvatar(u.avatar_url, u.username || u.email, 40, false, isUserOnline)}
                          <div>
                            <div style={styles.userName}>{u.username || 'User'}</div>
                            <div style={styles.userEmail}>{isUserOnline ? '● Online' : '○ Not online'}</div>
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
                  requests.map((r) => (
                    <div key={r.id} style={styles.userRow}>
                      <div style={styles.userRowLeft}>
                        {renderAvatar(r.sender?.avatar_url, r.sender?.username || r.sender?.email, 40)}
                        <div>
                          <div style={styles.userName}>{r.sender?.username || 'User'}</div>
                          <div style={styles.userEmail}>{r.sender?.email}</div>
                        </div>
                      </div>
                      <button onClick={() => acceptRequest(r.id, r.sender_id)} style={styles.acceptBtn}>
                        Accept
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Main Chat Canvas */}
      {showChatWindow && (
        <main style={styles.chatWindow}>
          {activeConversation ? (
            <>
              <div style={styles.windowHeader}>
                <div style={styles.windowHeaderInfo}>
                  {isMobile && (
                    <button onClick={() => setActiveConversation(null)} style={styles.backBtn}>
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  {activeConversation.is_group ? (
                    <div style={styles.groupAvatar}>👥</div>
                  ) : (
                    renderAvatar(
                      otherDirectMember?.profiles?.avatar_url,
                      otherDirectMember?.profiles?.username || 'F',
                      40,
                      false,
                      isDirectOtherOnline
                    )
                  )}
                  <div>
                    <h3 style={styles.windowTitle}>
                      {activeConversation.is_group ? activeConversation.name : otherDirectMember?.profiles?.username || 'Direct Message'}
                    </h3>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: (activeConversation.is_group ? groupOnlineCount > 0 : isDirectOtherOnline) ? '#16a34a' : '#94a3b8',
                    }}>
                      {activeConversation.is_group
                        ? (groupOnlineCount > 0 ? `● ${groupOnlineCount} online` : '○ Not online')
                        : (isDirectOtherOnline ? '● Online' : '○ Not online')}
                    </span>
                  </div>
                </div>

                {/* WhatsApp-Style Delete Chat Button */}
                <button
                  onClick={handleDeleteChat}
                  style={styles.clearChatBtn}
                  title="Delete this chat from your list (messages are kept, reappears on new message)"
                >
                  <Trash2 size={18} color="#ef4444" />
                  {!isMobile && <span>Delete Chat</span>}
                </button>
              </div>

              <div
                style={{
                  ...styles.messagesContainer,
                  backgroundColor: chatBg.type === 'color' ? chatBg.value : 'transparent',
                  backgroundImage: chatBg.type === 'image' ? `url(${chatBg.value})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {messages.map((m) => {
                  const isMe = m.sender_id === profile?.id;
                  const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isImage = m.content?.startsWith('[IMAGE]:');
                  const isAudio = m.content?.startsWith('[AUDIO]:');

                  return (
                    <div
                      key={m.id}
                      style={{
                        ...styles.messageRow,
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {!isMe && renderAvatar(m.profiles?.avatar_url, m.profiles?.username, 32)}
                      
                      <div style={styles.messageBubbleWrapper}>
                        {!isMe && <div style={styles.bubbleSenderName}>{m.profiles?.username || 'User'}</div>}
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                          <div
                            style={{
                              ...styles.bubble,
                              ...(isMe ? styles.myBubble : styles.theirBubble),
                              padding: isImage ? '6px' : '11px 16px',
                            }}
                          >
                            {isImage ? (
                              <img
                                src={m.content.replace('[IMAGE]:', '')}
                                alt="Shared"
                                style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: '14px', display: 'block' }}
                              />
                            ) : isAudio ? (
                              <audio
                                controls
                                src={m.content.replace('[AUDIO]:', '')}
                                style={{ maxWidth: '240px', height: '38px', outline: 'none' }}
                              />
                            ) : (
                              m.content
                            )}
                          </div>

                          <button
                            onClick={() => setSelectedMessageForDelete(m)}
                            style={styles.msgOptionIconBtn}
                            title="Message options"
                          >
                            <MoreVertical size={14} color="#94a3b8" />
                          </button>
                        </div>

                        <span style={{ ...styles.messageTimestamp, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                          {time}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={styles.inputContainer}>
                {!isDirectChatFriend ? (
                  <div style={styles.notFriendsGateBanner}>
                    <AlertTriangle size={18} color="#b45309" />
                    <span>You are not friends yet. Send or wait for request acceptance to chat!</span>
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
                      onChange={handleImageMessageUpload}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={styles.composerIconBtn}
                      title="Send photo"
                    >
                      <ImageIcon size={20} color="#64748b" />
                    </button>

                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      style={styles.composerIconBtn}
                      title="Hold to record voice message"
                    >
                      <Mic size={20} color="#64748b" />
                    </button>

                    <input
                      type="text"
                      placeholder="Message..."
                      style={styles.composerInput}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                    />

                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      style={{
                        ...styles.sendBtn,
                        opacity: newMessage.trim() ? 1 : 0.35,
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
                <MessageSquare size={52} color="#94a3b8" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px' }}>Your Messages</h3>
              <p style={{ color: '#64748b', fontSize: '15px', maxWidth: '320px', textAlign: 'center', lineHeight: '1.5' }}>
                Select an existing chat, start a new chat with a friend, or explore new connections.
              </p>
            </div>
          )}
        </main>
      )}

      {/* Start New Chat Modal */}
      {showNewChatModal && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalBox}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={20} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '18px' }}>Start a New Chat</h4>
              </div>
              <button onClick={() => setShowNewChatModal(false)} style={styles.closeBtn}><X size={20} /></button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px' }}>
              Select an accepted friend to open a conversation:
            </p>

            <div style={styles.modalScrollList}>
              {confirmedFriends.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  No accepted friends yet. Head to Explore to add friends first!
                </div>
              ) : (
                confirmedFriends.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleStartDirectChat(f)}
                    style={styles.modalFriendRow}
                  >
                    {renderAvatar(f.avatar_url, f.username || f.email, 38, false, onlineUserIds.has(f.id))}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{f.username || 'User'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{onlineUserIds.has(f.id) ? '● Online' : '○ Not online'}</div>
                    </div>
                    <button style={styles.openChatBtn}>Chat</button>
                  </div>
                ))
              )}
            </div>

            <div style={styles.modalActions}>
              <button onClick={() => setShowNewChatModal(false)} style={styles.secondaryBtn}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Deletion Modal */}
      {selectedMessageForDelete && (
        <div style={styles.modalBackdrop}>
          <div style={{ ...styles.modalBox, maxWidth: '340px' }}>
            <div style={styles.modalHead}>
              <h4 style={{ margin: 0, fontSize: '16px' }}>Delete Message</h4>
              <button onClick={() => setSelectedMessageForDelete(null)} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px' }}>
              Choose how you want to delete this message:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => handleDeleteForMe(selectedMessageForDelete)}
                style={styles.deleteChoiceBtn}
              >
                Delete for Me
              </button>
              
              {selectedMessageForDelete.sender_id === profile.id && (
                <button
                  onClick={() => handleDeleteForEveryone(selectedMessageForDelete)}
                  style={{ ...styles.deleteChoiceBtn, color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
                >
                  Delete for Everyone
                </button>
              )}

              <button
                onClick={() => setSelectedMessageForDelete(null)}
                style={styles.secondaryBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Creation Modal */}
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
              {confirmedFriends.map((u) => (
                <label key={u.id} style={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={selectedGroupUsers.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedGroupUsers([...selectedGroupUsers, u.id]);
                      else setSelectedGroupUsers(selectedGroupUsers.filter((id) => id !== u.id));
                    }}
                  />
                  <span style={{ fontSize: '15px' }}>{u.username || u.email}</span>
                </label>
              ))}
            </div>
            <div style={styles.modalActions}>
              <button onClick={() => setShowGroupModal(false)} style={styles.secondaryBtn}>Cancel</button>
              <button onClick={createGroupChat} style={styles.primaryButton}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
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
                Profile Photo
              </button>
              <button
                onClick={() => setSettingsTab('wallpaper')}
                style={settingsTab === 'wallpaper' ? styles.settingsTabActive : styles.settingsTab}
              >
                Wallpaper
              </button>
              <button
                onClick={() => setSettingsTab('credentials')}
                style={settingsTab === 'credentials' ? styles.settingsTabActive : styles.settingsTab}
              >
                Credentials
              </button>
              <button
                onClick={() => setSettingsTab('danger')}
                style={settingsTab === 'danger' ? styles.settingsTabActive : styles.settingsTab}
              >
                Delete Account
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
                  {renderAvatar(profile?.avatar_url, profile?.username || session.user.email, 80)}
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    style={styles.avatarCameraBadge}
                    title="Change Profile Photo"
                  >
                    <Camera size={16} color="#ffffff" />
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', textAlign: 'center', margin: 0 }}>
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

            {settingsTab === 'wallpaper' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <span style={styles.fieldLabel}>Preset Colors:</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { name: 'Plain White', color: '#ffffff' },
                    { name: 'Soft Gray', color: '#f1f5f9' },
                    { name: 'Warm Cream', color: '#fef3c7' },
                    { name: 'Pale Rose', color: '#ffe4e6' },
                    { name: 'Lavender', color: '#ede9fe' },
                    { name: 'Midnight', color: '#0f172a' },
                  ].map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => handleSetBgColor(p.color)}
                      style={{
                        ...styles.colorPresetBtn,
                        backgroundColor: p.color,
                        outline: chatBg.type === 'color' && chatBg.value === p.color ? '2px solid #2563eb' : '1px solid #cbd5e1',
                      }}
                      title={p.name}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={styles.fieldLabel}>Custom Color:</span>
                  <input
                    type="color"
                    value={chatBg.type === 'color' ? chatBg.value : '#ffffff'}
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
                  Reset to Default Plain White
                </button>
              </div>
            )}

            {settingsTab === 'credentials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={styles.fieldLabel}>Select what to update:</span>
                <div style={styles.optionSelectorGroup}>
                  <button
                    type="button"
                    onClick={() => setChangeOption('username')}
                    style={changeOption === 'username' ? styles.optionSelectedBtn : styles.optionBtn}
                  >
                    Only Username
                  </button>
                  <button
                    type="button"
                    onClick={() => setChangeOption('password')}
                    style={changeOption === 'password' ? styles.optionSelectedBtn : styles.optionBtn}
                  >
                    Only Password
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

                <div style={styles.emailBackupNotice}>
                  <MailCheck size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    New details will be mailed directly to <b>{session.user.email}</b>.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleUpdateCredentials}
                  disabled={savingSettings}
                  style={styles.primaryButton}
                >
                  {savingSettings ? 'Updating...' : 'Save & Email New Credentials'}
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
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px', lineHeight: '1.4' }}>
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
  loadingContainer: { display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  appContainer: { display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#ffffff', color: '#0f172a', overflow: 'hidden' },

  authContainer: { display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: '16px' },
  authCard: { width: '100%', maxWidth: '420px', padding: '40px', borderRadius: '20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' },
  authHeader: { textAlign: 'center', marginBottom: '28px' },
  logoBadge: { width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 16px rgba(37,99,235,0.25)' },
  authTitle: { fontSize: '24px', fontWeight: '800', margin: '0 0 6px', color: '#0f172a' },
  authSubtitle: { fontSize: '14px', color: '#64748b', margin: 0, lineHeight: '1.4' },
  authForm: { display: 'flex', flexDirection: 'column', gap: '14px' },
  errorBanner: { padding: '12px 16px', borderRadius: '10px', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '14px', marginBottom: '14px', border: '1px solid #fee2e2' },
  modernInput: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '15px', outline: 'none' },
  primaryButton: { width: '100%', padding: '12px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  googleButton: { width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: '600', fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '6px' },
  divider: { display: 'flex', alignItems: 'center', margin: '18px 0' },
  dividerLine: { flex: 1, height: '1px', backgroundColor: '#e2e8f0' },
  dividerText: { margin: '0 12px', color: '#94a3b8', fontSize: '14px' },
  switchAuthText: { textAlign: 'center', fontSize: '14px', color: '#64748b', marginTop: '20px' },
  switchAuthLink: { color: '#2563eb', fontWeight: '700', cursor: 'pointer' },

  sidebar: { borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc' },
  profileSection: { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' },
  profileDetails: { flex: 1, overflow: 'hidden' },
  profileUsername: { fontWeight: '700', fontSize: '15px', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  profileEmail: { fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  headerIcons: { display: 'flex', gap: '4px' },
  iconButton: { padding: '8px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '8px' },

  tabNav: { display: 'flex', padding: '6px', margin: '10px 14px', backgroundColor: '#e2e8f0', borderRadius: '12px', gap: '2px' },
  tabBtn: { flex: 1, padding: '9px 4px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: '600' },
  activeTabBtn: { flex: 1, padding: '9px 4px', backgroundColor: '#ffffff', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: '12px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', fontWeight: '700', boxShadow: '0 2px 4px rgba(0,0,0,0.06)' },
  badge: { backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', borderRadius: '10px', padding: '1px 5px', fontWeight: 'bold' },

  listArea: { flex: 1, overflowY: 'auto', padding: '0 10px 14px' },
  newGroupBtn: { width: '100%', boxSizing: 'border-box', margin: '4px 0 6px', padding: '11px', borderRadius: '10px', backgroundColor: '#ffffff', border: '1px dashed #94a3b8', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '600' },
  startNewChatBtn: { width: '100%', boxSizing: 'border-box', margin: '0 0 10px', padding: '11px', borderRadius: '10px', backgroundColor: '#2563eb', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: '700', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' },
  sectionHeading: { padding: '10px 12px 6px', fontSize: '13px', fontWeight: '700', color: '#64748b' },
  emptyListNotice: { textAlign: 'center', padding: '36px 16px', color: '#94a3b8', fontSize: '14px' },

  chatRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', margin: '4px 0', border: '1px solid #f1f5f9' },
  groupAvatar: { width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 },
  chatRowMeta: { flex: 1, overflow: 'hidden' },
  chatRowTitle: { display: 'block', fontWeight: '700', fontSize: '14px', color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  chatRowSub: { display: 'block', fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: '2px' },

  userRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', borderRadius: '10px', margin: '4px 0' },
  userRowLeft: { display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' },
  userName: { fontWeight: '700', fontSize: '14px', color: '#0f172a' },
  userEmail: { fontSize: '12px', color: '#64748b' },
  addBtn: { padding: '7px 16px', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' },
  pendingBtn: { padding: '7px 12px', borderRadius: '8px', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' },
  respondBtn: { padding: '7px 14px', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  acceptBtn: { padding: '7px 16px', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700' },
  friendsTag: { fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: '700' },
  chatFriendBtn: { padding: '6px 12px', borderRadius: '6px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  removeFriendBtn: { padding: '6px 10px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' },
  windowHeader: { height: '64px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', zIndex: 10 },
  windowHeaderInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#0f172a', padding: '4px', marginRight: '4px' },
  windowTitle: { margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  clearChatBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },

  messagesContainer: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' },
  messageRow: { display: 'flex', gap: '8px', width: '100%' },
  messageBubbleWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '72%' },
  bubbleSenderName: { fontSize: '11px', color: '#64748b', marginBottom: '3px', marginLeft: '6px', fontWeight: '600' },
  bubble: { borderRadius: '20px', fontSize: '15px', lineHeight: '1.45', wordBreak: 'break-word' },
  myBubble: { background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', borderBottomRightRadius: '4px', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' },
  theirBubble: { backgroundColor: '#ffffff', color: '#0f172a', borderBottomLeftRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  messageTimestamp: { fontSize: '10px', color: '#94a3b8', marginTop: '3px', marginInline: '6px' },
  msgOptionIconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', opacity: 0.7 },

  inputContainer: { padding: '14px 20px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0' },
  composerForm: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '30px', padding: '4px 6px 4px 14px' },
  composerIconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' },
  composerInput: { flex: 1, backgroundColor: 'transparent', border: 'none', color: '#0f172a', fontSize: '15px', outline: 'none', padding: '8px 4px' },
  sendBtn: { width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  notFriendsGateBanner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '12px 16px', borderRadius: '12px', color: '#b45309', fontSize: '14px', fontWeight: '600' },

  recordingBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '30px', padding: '8px 16px' },
  recordingPulse: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#dc2626', animation: 'pulse 1.5s infinite' },
  stopRecordBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },

  emptyStateContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  emptyStateIcon: { width: '84px', height: '84px', borderRadius: '50%', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', border: '1px solid #e2e8f0' },

  modalBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalBox: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  modalHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  closeBtn: { background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' },

  settingsTabRow: { display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', marginBottom: '16px' },
  settingsTab: { flex: 1, padding: '8px 2px', fontSize: '12px', fontWeight: '600', color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '6px' },
  settingsTabActive: { flex: 1, padding: '8px 2px', fontSize: '12px', fontWeight: '700', color: '#0f172a', backgroundColor: '#ffffff', border: 'none', cursor: 'pointer', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },

  avatarCameraBadge: { position: 'absolute', bottom: '0', right: '0', backgroundColor: '#2563eb', border: '2px solid #ffffff', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  colorPresetBtn: { width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', border: 'none' },
  resetBtn: { width: '100%', padding: '10px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '6px' },

  modalListLabel: { fontSize: '13px', color: '#64748b', margin: '14px 0 6px', fontWeight: '600' },
  modalScrollList: { maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' },
  modalFriendRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'pointer' },
  openChatBtn: { padding: '6px 14px', borderRadius: '8px', background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  checkboxItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#0f172a', cursor: 'pointer' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' },
  secondaryBtn: { width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteChoiceBtn: { width: '100%', padding: '10px 16px', borderRadius: '10px', backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  fieldLabel: { fontSize: '13px', color: '#475569', fontWeight: '600', marginBottom: '4px', display: 'block' },
  statusMessage: { padding: '9px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '12px', fontWeight: '500' },

  optionSelectorGroup: { display: 'flex', gap: '6px', marginTop: '4px' },
  optionBtn: { flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' },
  optionSelectedBtn: { flex: 1, padding: '8px 4px', fontSize: '12px', fontWeight: '700', backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #2563eb', borderRadius: '8px', cursor: 'pointer' },
  emailBackupNotice: { display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' },

  dangerZone: { border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '12px', padding: '14px' },
  deleteInitBtn: { width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: '#ef4444', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  deleteConfirmBtn: { flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#b91c1c', color: '#ffffff', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
};