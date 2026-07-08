import React, { useEffect } from 'react';

function applyPageMeta({ title, description, path }) {
  if (typeof document === 'undefined') return;
  document.title = title;

  const ensureMeta = (selector, attrs) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      document.head.appendChild(el);
    }
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  };

  ensureMeta('meta[name="description"]', { name: 'description', content: description });
  ensureMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  ensureMeta('meta[property="og:url"]', { property: 'og:url', content: `https://www.myapiai.com${path}` });
  ensureMeta('meta[name="robots"]', { name: 'robots', content: 'index,follow,max-image-preview:large' });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `https://www.myapiai.com${path}`);
}

function ApiDocs() {
  useEffect(() => {
    applyPageMeta({
      title: "MyApi docs — Official docs for the personal API gateway for AI agents",
      description: "Official MyApi documentation for the personal API gateway for AI agents: connected services, scoped access, personas, memory, approvals, and audit trails.",
      path: "/dashboard/api-docs",
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">RESOURCES</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">MyApi docs.</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Official documentation for MyApi, the personal API gateway for AI agents — connected services, scoped access, personas, memory, approvals, and audit trails.</p>
        </div>
      </div>

      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        <iframe
          src="/api-docs-ui"
          title="MyApi API Docs"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
      </div>
    </div>
  );
}

export default ApiDocs;
