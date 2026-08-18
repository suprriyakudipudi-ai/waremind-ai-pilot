import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Profile = {
  name: string;
  role: string;
  email: string;
  phone: string;
  warehouse: string;
  shift: string;
  bio: string;
};

const DEFAULT_PROFILE: Profile = {
  name: "Suprriya K.",
  role: "Warehouse Manager",
  email: "suprriya.k@waremind.ai",
  phone: "+91 98765 43210",
  warehouse: "WH-South (Chennai)",
  shift: "Morning (6:00 – 14:00)",
  bio: "Runs daily fulfilment operations and owns SLA performance across the network.",
};

const STORAGE_KEY = "waremind-profile";

const ProfileContext = createContext<{
  profile: Profile;
  saveProfile: (next: Profile) => void;
  initials: string;
}>({ profile: DEFAULT_PROFILE, saveProfile: () => {}, initials: "SK" });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setProfile({ ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) });
      } catch {
        /* ignore malformed storage */
      }
    }
  }, []);

  const value = useMemo(
    () => ({
      profile,
      saveProfile: (next: Profile) => {
        setProfile(next);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      initials:
        profile.name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? "")
          .join("") || "WM",
    }),
    [profile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}

export { DEFAULT_PROFILE };
