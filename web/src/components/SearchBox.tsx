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

  const handleTextSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!textInput.trim() || loading) return;
      onSearch(classifyInput(textInput));
    },
    [textInput, loading, onSearch],
  );

  const handleFileDrop = useCallback(
    (file: File) => {
      if (loading) return;
      onSearch({ type: 'content', file });
    },
    [loading, onSearch],
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleTextSubmit} className="relative">
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Enter manifest ID (urn:uuid:...) or pHash..."
          disabled={loading}
          className="w-full rounded-2xl border border-[#23232D]/10 bg-[#F0F0F0] px-4 py-3 pr-24 text-[#23232D] placeholder:text-[#23232D]/40 focus:border-[#5427C8] focus:ring-1 focus:ring-[#5427C8] focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !textInput.trim()}
          className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-[#23232D] px-5 py-2 text-sm font-semibold text-[#F0F0F0] transition-colors hover:bg-[#23232D]/90 disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
        </button>
      </form>

      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-[#23232D]/10" />
        <span className="text-sm text-[#23232D]/40">or</span>
        <div className="h-px flex-1 bg-[#23232D]/10" />
      </div>

      <DropZone onFile={handleFileDrop} disabled={loading} />
    </div>
  );
}
