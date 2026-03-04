function BrandLogo({ size = 'md', withWordmark = true, className = '' }) {
  const sizeClasses = {
    sm: 'w-9 h-9 rounded-xl',
    md: 'w-11 h-11 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <img
        src="/dashboard/myapi-logo.svg"
        alt="MyApi"
        className={`${sizeClasses[size] || sizeClasses.md} shadow-lg ring-1 ring-white/10`}
      />
      {withWordmark && <span className="text-2xl sm:text-3xl font-bold tracking-tight text-white">MyApi</span>}
    </div>
  );
}

export default BrandLogo;
