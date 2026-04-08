import { useParams, Link, useNavigate } from 'react-router-dom';
import ManifestDetail from '@/components/ManifestDetail';

export default function ManifestPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const decodedId = id ? decodeURIComponent(id) : '';

  return (
    <div className="mx-auto max-w-4xl">
      {/* Breadcrumb */}
      <nav className="mb-8 text-sm text-foreground/60">
        <Link to="/" className="text-primary hover:text-primary-hover">
          Home
        </Link>
        <span className="mx-2">&gt;</span>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-primary hover:text-primary-hover"
        >
          Search Results
        </button>
        <span className="mx-2">&gt;</span>
        <span>Manifest Detail</span>
      </nav>

      {decodedId ? (
        <ManifestDetail manifestId={decodedId} />
      ) : (
        <div className="py-16 text-center">
          <p className="text-foreground/60">No manifest ID provided.</p>
        </div>
      )}
    </div>
  );
}
