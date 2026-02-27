import { useState, useEffect } from 'react';
import { get } from '../api';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  useEffect(() => { get('/api/v1/audit').then(setLogs); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">📋 Audit Log</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-gray-400">
            <th className="text-left p-2">Time</th><th className="text-left p-2">Action</th><th className="text-left p-2">Resource</th><th className="text-left p-2">IP</th>
          </tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="p-2 text-gray-400">{l.created_at}</td>
                <td className="p-2">{l.action}</td>
                <td className="p-2 text-gray-300 font-mono text-xs">{l.resource}</td>
                <td className="p-2 text-gray-500">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="text-gray-500 mt-4">No audit entries yet.</p>}
      </div>
    </div>
  );
}
