import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Profile {
  id: string;
  name: string;
  relation: string;
}

interface ProfileContextType {
  profiles: Profile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  selectedProfile: Profile | undefined;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileIdState] = useState<string>(
    () => localStorage.getItem('mv_selected_profile') || ''
  );

  useEffect(() => {
    fetch('http://localhost:8000/family')
      .then(res => res.json())
      .then((data: Profile[]) => {
        setProfiles(data);
        // Pick first profile if nothing is persisted yet
        if (!localStorage.getItem('mv_selected_profile') && data.length > 0) {
          setSelectedProfileIdState(data[0].id);
          localStorage.setItem('mv_selected_profile', data[0].id);
        }
      })
      .catch(err => console.error(err));
  }, []);

  const setSelectedProfileId = (id: string) => {
    setSelectedProfileIdState(id);
    localStorage.setItem('mv_selected_profile', id);
  };

  const selectedProfile = profiles.find(p => p.id === selectedProfileId);

  return (
    <ProfileContext.Provider value={{ profiles, selectedProfileId, setSelectedProfileId, selectedProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
