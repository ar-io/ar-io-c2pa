import { useState, useCallback, type FormEvent } from 'react';
import { Search, X, Image } from 'lucide-react';
import DropZone from './DropZone';

export type SearchParams =
  | { type: 'content'; file: File }
  | { type: 'phash'; phash: string }
  | { type: 'manifest'; manifestId: string };

interface SearchBoxProps {
  onSearch: (params: SearchParams) => void;
  loading?: boolean;
}

function classifyInput(input: string): SearchParams {
  const trimmed = input.trim();
  if (trimmed.startsWith('urn:')) {
    return { type: 'manifest', manifestId: trimmed };
  }
  return { type: 'phash', phash: trimmed };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SearchBox({ onSearch, loading = false }: SearchBoxProps) {
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleTextSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!textInput.trim() || loading) return;
      onSearch(classifyInput(textInput));
    },
    [textInput, loading, onSearch]
  );

  const handleFileDrop = useCallback((file: File | null) => {
    setSelectedFile(file);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const handleImageSearch = useCallback(() => {
    if (!selectedFile || loading) return;
    onSearch({ type: 'content', file: selectedFile });
  }, [selectedFile, loading, onSearch]);

  const handleClearFile = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
  }, []);

  return (
    <div className="space-y-6">
      <form onSubmit={handleTextSubmit} className="relative">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Enter manifest ID (urn:uuid:...) or pHash..."
          disabled={loading}
          aria-label="Search query"
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 pr-24 text-foreground placeholder:text-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !textInput.trim()}
          className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-foreground/10" />
        <span className="text-sm text-foreground/40">or upload an image</span>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      {selectedFile ? (
        <div className="overflow-hidden rounded-2xl border-2 border-primary/30 bg-card">
          {/* File preview + info */}
          <div className="flex items-center gap-4 p-4">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
                <Image className="h-8 w-8 text-foreground/30" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-foreground/50">{formatFileSize(selectedFile.size)}</p>
            </div>
            <button
              type="button"
              onClick={handleClearFile}
              className="shrink-0 rounded-full p-2 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Prominent search button */}
          <button
            type="button"
            onClick={handleImageSearch}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 border-t border-primary/20 bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Search for Similar Images
          </button>
        </div>
      ) : (
        <DropZone onFile={handleFileDrop} disabled={loading} />
      )}
    </div>
  );
}
