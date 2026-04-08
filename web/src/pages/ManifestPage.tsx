import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import ManifestDetail from '@/components/ManifestDetail';
import EmptyState from '@/components/EmptyState';

export default function ManifestPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const decodedId = id ? decodeURIComponent(id) : '';
  const distanceParam = searchParams.get('distance');
  const searchDistance = distanceParam !== null ? parseInt(distanceParam, 10) : undefined;

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
        <ManifestDetail manifestId={decodedId} searchDistance={searchDistance} />
      ) : (
        <EmptyState
          title="No Manifest ID"
          description="No manifest ID was provided. Please search for a manifest first."
          action={{ label: 'Go to Search', onClick: () => navigate('/') }}
        />
      )}
    </div>
  );
}
