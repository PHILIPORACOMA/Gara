export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="rounded-card border border-danger/30 bg-danger/5 p-5 text-center" role="alert">
      <p className="text-sm font-medium text-danger">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-control border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10"
        >
          Try again
        </button>
      )}
    </div>
  );
}
