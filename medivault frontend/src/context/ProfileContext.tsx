import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { API_URL } from "../config";

export interface Profile {
  id: string;
  name: string;
  relation: string;
  age?: number;
  gender?: string;
}

interface ProfileContextType {
  profiles: Profile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  selectedProfile: Profile | undefined;
  refreshProfiles: () => void;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string>(
    () => localStorage.getItem('mv_selected_profile') || ''
  );

  const refreshProfiles = useCallback(() => {
    const storedUser = sessionStorage.getItem('medivault_user');
    const email = storedUser ? encodeURIComponent(JSON.parse(storedUser).email || '') : '';
    fetch(`${API_URL}/family?user=${email}`)
      .then(res => res.json())
      .then((data: Profile[]) => {
        setProfiles(data);
        const persisted = localStorage.getItem('mv_selected_profile');
        // If the currently selected profile was deleted, fall back to first
        if (persisted && !data.find(p => p.id === persisted) && data.length > 0) {
          setSelectedProfileIdState(data[0].id);
          localStorage.setItem('mv_selected_profile', data[0].id);
        } else if (!persisted && data.length > 0) {
          setSelectedProfileIdState(data[0].id);
          localStorage.setItem('mv_selected_profile', data[0].id);
        }
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    refreshProfiles();
  }, [refreshProfiles]);

  const setSelectedProfileId = (id: string) => {
    setSelectedProfileIdState(id);
    localStorage.setItem('mv_selected_profile', id);
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <ProfileContext.Provider value={{ profiles, selectedProfileId, setSelectedProfileId, selectedProfile, refreshProfiles }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
