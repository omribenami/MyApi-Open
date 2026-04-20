import React from 'react';

function ApiDocs() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="flex flex-col sm:flex-row items-start gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">RESOURCES</div>
          <h1 className="font-serif text-[22px] sm:text-[34px] leading-[1.05] tracking-tight ink font-medium">API Docs</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Interactive reference for the MyApi REST API — explore endpoints, test requests, view schemas.</p>
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
