import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ChatUser } from '@/types/chat'; // Ensure this type path is correct

export function useRealtimeProfile(userId: string | null) {
  const supabase = createClientComponentClient();
  const [profile, setProfile] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // 1. Fetch initial profile data
    const fetchProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching initial profile:', error);
      } else {
        setProfile(data as ChatUser);
      }
      setLoading(false);
    };

    fetchProfile();

    // 2. Subscribe to future changes
    const channel = supabase
      .channel(`realtime-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          console.log('Profile update received!', payload.new);
          // When an update comes in, merge it with the existing profile state
          setProfile(prevProfile => ({ ...prevProfile, ...payload.new } as ChatUser));
        }
      )
      .subscribe();

    // 3. Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };

  }, [userId, supabase]);

  return { profile, loading };
}
