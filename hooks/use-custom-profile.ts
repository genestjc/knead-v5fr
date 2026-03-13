import { useEffect, useState } from 'react';

interface CustomProfile {
  alias: string | null;
  avatar: string | null;
}

const profileCache = new Map<string, CustomProfile>();
const pendingFetches = new Map<string, Promise<CustomProfile | null>>();

export function useCustomProfile(address: string | undefined): CustomProfile | null {
  const [profile, setProfile] = useState<CustomProfile | null>(() => {
    if (!address) return null;
    return profileCache.get(address.toLowerCase()) || null;
  });

  useEffect(() => {
    if (!address) return;

    // ✅ Normalize once for all operations
    const normalizedAddress = address.toLowerCase();

    // Check cache first
    if (profileCache.has(normalizedAddress)) {
      setProfile(profileCache.get(normalizedAddress)!);
      return;
    }

    // Check if already fetching
    if (pendingFetches.has(normalizedAddress)) {
      pendingFetches.get(normalizedAddress)!.then(setProfile);
      return;
    }

    // ✅ Fetch using normalized address for consistency
    const fetchPromise = fetch(`/api/chat/user?address=${normalizedAddress}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          const customProfile: CustomProfile = {
            alias: d.user.alias,
            avatar: d.user.avatar,
          };
          
          // ✅ Store under normalized address
          profileCache.set(normalizedAddress, customProfile);
          
          console.log('✅ Cached profile:', {
            address: normalizedAddress.slice(0, 10) + '...',
            alias: customProfile.alias,
          });
          
          return customProfile;
        }
        
        console.log('⚠️ No profile found for:', normalizedAddress.slice(0, 10) + '...');
        return null;
      })
      .catch((error) => {
        console.error('❌ Profile fetch failed:', normalizedAddress.slice(0, 10) + '...', error);
        return null;
      })
      .finally(() => {
        pendingFetches.delete(normalizedAddress);
      });

    pendingFetches.set(normalizedAddress, fetchPromise);
    fetchPromise.then(setProfile);
  }, [address]);

  return profile;
}
