export function PremiumBadge() {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-slate-200 via-gray-300 to-slate-200 text-slate-700 border border-slate-300 shadow-sm font-adonis">
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
      Members-Only
    </span>
  )
}
