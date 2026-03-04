import React from 'react';

function ApiDocs() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">API Docs</h1>
        <p className="text-slate-400">Interactive API options powered by MyApi OpenAPI schema</p>
      </div>

      <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-inner">
        <div className="h-full p-1 bg-slate-950/70">
          <iframe
            src="/api-docs-ui"
            className="w-full h-full border-0 rounded-lg bg-white"
            title="MyApi API Docs"
          />
        </div>
      </div>
    </div>
  );
}

export default ApiDocs;
