import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-heading text-6xl font-bold text-[#5427C8]">404</p>
      <h1 className="mt-4 font-heading text-2xl font-bold text-[#23232D]">Page Not Found</h1>
      <p className="mt-2 max-w-md text-[#23232D]/60">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex rounded-full bg-[#5427C8] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4520A8]"
      >
        Back to Home
      </Link>
    </div>
  );
}
