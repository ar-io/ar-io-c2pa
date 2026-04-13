import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { Upload, Image, X } from 'lucide-react';

interface DropZoneProps {
  onFile: (file: File | null) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFile, disabled = false }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onFile(file);

      // Generate thumbnail preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    },
    [onFile]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleFile(file);
    },
    [disabled, handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
      onFile(null);
    },
    [onFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload image file"
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none ${
        disabled
          ? 'cursor-not-allowed border-border bg-card/50 opacity-60'
          : isDragOver
            ? 'border-primary bg-primary/5'
            : 'border-border-strong hover:border-primary/50 hover:bg-primary/5'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        aria-label="Upload image file"
      />

      {selectedFile ? (
        <div className="flex items-center justify-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <Image className="h-10 w-10 shrink-0 text-foreground/40" />
          )}
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-medium text-foreground">{selectedFile.name}</p>
            <p className="text-xs text-foreground/60">{formatFileSize(selectedFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-foreground/30" />
          <p className="text-sm text-foreground/70">
            Drag & drop an image or{' '}
            <span className="font-semibold text-primary">click to browse</span>
          </p>
          <p className="text-xs text-foreground/40">Supports JPEG, PNG, WebP, GIF, TIFF, AVIF</p>
        </div>
      )}
    </div>
  );
}
