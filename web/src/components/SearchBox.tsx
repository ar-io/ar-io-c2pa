import { useState, useCallback, type FormEvent } from 'react';
import { Search } from 'lucide-react';
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

export default function SearchBox({ onSearch, loading = false }: SearchBoxProps) {
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
  }, []);

  const handleImageSearch = useCallback(() => {
    if (!selectedFile || loading) return;
    onSearch({ type: 'content', file: selectedFile });
  }, [selectedFile, loading, onSearch]);

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
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 pr-24 text-foreground placeholder:text-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
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
        <span className="text-sm text-foreground/40">or</span>
        <div className="h-px flex-1 bg-foreground/10" />
      </div>

      <DropZone onFile={handleFileDrop} disabled={loading} />

      {selectedFile && (
        <button
          type="button"
          onClick={handleImageSearch}
          disabled={loading}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          <Search className="mr-2 inline h-4 w-4" />
          Search Image
        </button>
      )}
    </div>
  );
}
