export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className="min-h-screen bg-midnight-950 flex items-center justify-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border-2 border-emerald-500/20" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin" />
        </div>
        <span className="text-white/40 text-xs font-data uppercase tracking-[0.25em]">
          Loading
        </span>
      </div>
    </div>
  );
}
