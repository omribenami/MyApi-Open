import React from 'react';

function ApiDocs() {
  return (
    <div className="space-y-6 flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-start gap-6 mb-2">
        <div className="flex-1 min-w-0">
          <div className="micro mb-2">RESOURCES</div>
          <h1 className="font-serif text-[34px] leading-[1.05] tracking-tight ink font-medium">API Docs</h1>
          <p className="mt-2 text-[15px] ink-2 max-w-[60ch]">Interactive reference for the MyApi REST API — explore endpoints, test requests, view schemas.</p>
        </div>
      </div>

      <div className="flex-1 card overflow-hidden" style={{ minHeight: '500px' }}>
        <iframe
          src="/api-docs-ui"
          className="w-full h-full border-0"
          style={{ minHeight: '500px' }}
          title="MyApi API Docs"
        />
      </div>
    </div>
  );
}

export default ApiDocs;
