export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-2 p-6 text-krishi-700">
      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="4" />
        <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}
