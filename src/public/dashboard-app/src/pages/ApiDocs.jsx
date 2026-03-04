import React, { useEffect, useState } from 'react';

function ApiDocs() {
  const [docsUrl, setDocsUrl] = useState('');

  useEffect(() => {
    // Reconstruct the URL using the current hostname but pointing to port 8000/docs
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Assuming the API docs are served on port 8000
    setDocsUrl(`${protocol}//${hostname}:8000/docs`);
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">API Reference</h1>
        <p className="text-slate-400">Interactive API documentation (Swagger UI)</p>
      </div>
      
      <div className="flex-1 bg-white rounded-xl overflow-hidden border border-slate-700">
        {docsUrl ? (
          <iframe 
            src={docsUrl} 
            className="w-full h-full border-0"
            title="API Documentation"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-500">
            Loading documentation...
          </div>
        )}
      </div>
    </div>
  );
}

export default ApiDocs;
