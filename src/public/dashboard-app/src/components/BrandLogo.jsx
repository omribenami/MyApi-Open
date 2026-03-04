function BrandLogo({ size = 'md', withWordmark = true, className = '' }) {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  const iconSizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <div className={`${sizeClasses[size] || sizeClasses.md} bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/10`}>
        <svg className={`${iconSizeClasses[size] || iconSizeClasses.md} text-white`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.2 2.6a.9.9 0 0 0-1.62-.3L4.54 13.1a.9.9 0 0 0 .76 1.4h5.07l-1.57 6.72a.9.9 0 0 0 1.62.73l9.03-11.97a.9.9 0 0 0-.72-1.44h-5.3l-.23-5.94z" />
        </svg>
      </div>
      {withWordmark && <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">MyApi</span>}
    </div>
  );
}

export default BrandLogo;
