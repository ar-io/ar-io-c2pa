import { useParams, Link } from 'react-router-dom';
import ManifestDetail from '@/components/ManifestDetail';

export default function ManifestPage() {
  const { id } = useParams<{ id: string }>();
  const decodedId = id ? decodeURIComponent(id) : '';

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-[#23232D]/60">
        <Link to="/" className="text-[#5427C8] hover:text-[#4520A8]">
          Home
        </Link>
        <span className="mx-2">&gt;</span>
        <Link to="/results" className="text-[#5427C8] hover:text-[#4520A8]">
          Search Results
        </Link>
        <span className="mx-2">&gt;</span>
        <span>Manifest Detail</span>
      </nav>

      {decodedId ? (
        <ManifestDetail manifestId={decodedId} />
      ) : (
        <div className="py-16 text-center">
          <p className="text-[#23232D]/60">No manifest ID provided.</p>
        </div>
      )}
    </div>
  );
}
