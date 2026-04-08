import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Github, ExternalLink } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-lavender">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3 text-foreground hover:opacity-80">
            <img src={`${import.meta.env.BASE_URL}ario-logo.svg`} alt="ar.io" className="h-7" />
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              C2PA Verify
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors ${
                isHome ? 'text-primary' : 'text-foreground-muted hover:text-foreground'
              }`}
            >
              Verify
            </Link>
            <a
              href="https://ar.io/provenance/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              About
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://docs.ar.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm font-medium text-foreground-muted hover:text-foreground"
            >
              Docs
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://github.com/ar-io/ar-io-c2pa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground-muted hover:text-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t border-border bg-card/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
          <p className="text-sm text-foreground-muted">
            Powered by{' '}
            <a
              href="https://ar.io"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:text-primary-hover"
            >
              AR.IO
            </a>{' '}
            &mdash; Permanent data, verifiable provenance.
          </p>
          <p className="text-xs text-foreground-muted">
            Content credentials via{' '}
            <a
              href="https://c2pa.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              C2PA
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
