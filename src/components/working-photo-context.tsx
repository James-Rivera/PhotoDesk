"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface WorkingPhoto {
  id: string;
  file: File;
}

interface WorkingPhotoContextValue {
  photo: WorkingPhoto | null;
  sendToTemplate: (file: File) => void;
  clear: () => void;
}

const WorkingPhotoContext = createContext<WorkingPhotoContextValue | null>(null);

export function WorkingPhotoProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<WorkingPhoto | null>(null);
  const value = useMemo(() => ({
    photo,
    sendToTemplate: (file: File) => setPhoto({ id: crypto.randomUUID(), file }),
    clear: () => setPhoto(null),
  }), [photo]);
  return <WorkingPhotoContext.Provider value={value}>{children}</WorkingPhotoContext.Provider>;
}

export function useWorkingPhoto() {
  const value = useContext(WorkingPhotoContext);
  if (!value) throw new Error("useWorkingPhoto must be used inside WorkingPhotoProvider.");
  return value;
}
