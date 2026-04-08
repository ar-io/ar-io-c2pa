import { Github, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-[#23232D]/10 bg-[#DFD6F7]">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <span className="text-sm text-[#23232D]/70">&copy; 2026 AR.IO</span>
          <span className="text-xs text-[#23232D]/50">Powered by Arweave</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ar-io/ar-io-c2pa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#23232D]/60 transition-colors hover:text-[#23232D]"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="https://twitter.com/ar_io_network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#23232D]/60 transition-colors hover:text-[#23232D]"
            aria-label="Twitter"
          >
            <Twitter className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
