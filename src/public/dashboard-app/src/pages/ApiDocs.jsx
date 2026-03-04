import React from 'react';

function ApiDocs() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">API Docs</h1>
        <p className="text-slate-400">Interactive API options powered by MyApi OpenAPI schema</p>
      </div>

      <div className="flex-1 bg-white rounded-xl overflow-hidden border border-slate-700">
        <iframe
          src="/api-docs-ui"
          className="w-full h-full border-0"
          title="MyApi API Docs"
        />
      </div>
    </div>
  );
}

export default ApiDocs;
