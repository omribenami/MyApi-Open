function BrandLogo({ size = 'md', withWordmark = true, className = '' }) {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  const iconSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <div className={`${iconSize} bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/35 ring-1 ring-white/10`}>
        <svg className="w-1/2 h-1/2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      {withWordmark && <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">MyApi</span>}
    </div>
  );
}

export default BrandLogo;
