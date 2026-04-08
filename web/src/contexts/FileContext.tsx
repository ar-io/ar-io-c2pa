import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react';

interface FileContextValue {
  getFile: () => File | null;
  setFile: (file: File | null) => void;
}

const FileContext = createContext<FileContextValue | null>(null);

export function FileProvider({ children }: { children: ReactNode }) {
  const fileRef = useRef<File | null>(null);

  const getFile = useCallback(() => fileRef.current, []);
  const setFile = useCallback((file: File | null) => {
    fileRef.current = file;
  }, []);

  return <FileContext.Provider value={{ getFile, setFile }}>{children}</FileContext.Provider>;
}

export function useFileContext() {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error('useFileContext must be used within FileProvider');
  return ctx;
}
