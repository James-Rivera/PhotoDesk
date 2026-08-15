"use client";

import { createContext, useContext, useMemo, useState } from "react";

interface WorkingPhoto {
  id: string;
  file: File;
  backgroundColor?: string | null;
  source?: "library" | "photo-preparation";
}

interface WorkingPhotoContextValue {
  photo: WorkingPhoto | null;
  sendToTemplate: (file: File, options?: Pick<WorkingPhoto, "backgroundColor" | "source">) => void;
  clear: () => void;
}

const WorkingPhotoContext = createContext<WorkingPhotoContextValue | null>(null);

export function WorkingPhotoProvider({ children }: { children: React.ReactNode }) {
  const [photo, setPhoto] = useState<WorkingPhoto | null>(null);
  const value = useMemo(() => ({
    photo,
    sendToTemplate: (file: File, options?: Pick<WorkingPhoto, "backgroundColor" | "source">) => setPhoto({ id: crypto.randomUUID(), file, ...options }),
    clear: () => setPhoto(null),
  }), [photo]);
  return <WorkingPhotoContext.Provider value={value}>{children}</WorkingPhotoContext.Provider>;
}

export function useWorkingPhoto() {
  const value = useContext(WorkingPhotoContext);
  if (!value) throw new Error("useWorkingPhoto must be used inside WorkingPhotoProvider.");
  return value;
}
