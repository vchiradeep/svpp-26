import { supabase } from '../supabaseClient';

// Fetch user's conversations with optimized, lightweight column selections
export const fetchUserConversations = async (myId) => {
  const { data: memberRows, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, hidden_at, last_read_at')
    .eq('user_id', myId);

  if (error || !memberRows || memberRows.length === 0) return [];

  const convIds = memberRows.map((m) => m.conversation_id);
  const { data: convList } = await supabase
    .from('conversations')
    .select(`
      id, is_group, name, avatar_url, created_by, created_at,
      conversation_members(conversation_id, user_id, hidden_at, last_read_at, profiles(id, username, avatar_url)),
      messages(id, conversation_id, sender_id, content, created_at)
    `)
    .in('id', convIds);

  return convList || [];
};