import { Link } from 'react-router-dom';
import { Search, Github } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#23232D]/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-heading text-xl font-bold text-[#23232D]">
            ar.io
          </Link>
          <span className="rounded-full bg-primary/10 px-3 py-0.5 text-sm text-primary">
            C2PA Verify
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-[#23232D]/70 transition-colors hover:text-[#23232D]"
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Link>
          <a
            href="https://github.com/ar-io/ar-io-c2pa"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#23232D]/70 transition-colors hover:text-[#23232D]"
          >
            <Github className="h-4 w-4" />
            <span>GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
