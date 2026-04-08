import { SearchX } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <SearchX className="mb-4 h-16 w-16 text-foreground/20" />
      <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-foreground/60">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
