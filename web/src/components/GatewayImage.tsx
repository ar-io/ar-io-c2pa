import { useState } from 'react';
import { ImageOff } from 'lucide-react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || window.location.origin;

interface GatewayImageProps {
  txId: string;
  contentType?: string;
  alt?: string;
  className?: string;
}

/**
 * Displays an image fetched from the ar.io gateway by transaction ID.
 * Shows a loading shimmer while loading, and a fallback icon on error.
 * Only renders for image/* content types.
 */
export default function GatewayImage({
  txId,
  contentType,
  alt = 'Content preview',
  className = '',
}: GatewayImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  const isImage = !contentType || contentType.startsWith('image/');
  if (!isImage) {
    return (
      <div
        className={`flex items-center justify-center bg-foreground/5 text-foreground/20 ${className}`}
      >
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-foreground/5 ${className}`}>
      {status === 'loading' && <div className="absolute inset-0 animate-pulse bg-foreground/10" />}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground/20">
          <ImageOff className="h-8 w-8" />
          <span className="text-xs">Image unavailable</span>
        </div>
      )}
      <img
        src={`${GATEWAY_URL}/${txId}`}
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-300 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}
