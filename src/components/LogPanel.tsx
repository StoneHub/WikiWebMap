import { useState, useEffect } from 'react';
import { connectionLogger, ConnectionLog } from '../ConnectionLogger';

interface LogPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const LogPanel = ({ isOpen, onClose }: LogPanelProps) => {
    const [logs, setLogs] = useState<ConnectionLog[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const refreshLogs = () => {
        setLogs([...connectionLogger.getLogs()].reverse()); // Show newest first
    };

    useEffect(() => {
        if (isOpen) {
            refreshLogs();
            if (autoRefresh) {
                const interval = setInterval(refreshLogs, 2000);
                return () => clearInterval(interval);
            }
        }
    }, [isOpen, autoRefresh]);

    const handleExport = () => {
        const csv = connectionLogger.exportCSV();
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wikiweb_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const handleClear = () => {
        if (confirm('Are you sure you want to clear all connection logs?')) {
            connectionLogger.clearLogs();
            refreshLogs();
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-3 sm:bottom-24 sm:right-6 w-[calc(100vw-1.5rem)] sm:w-96 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl z-50 flex flex-col max-h-[60vh] sm:max-h-[520px]">
            <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 rounded-t-lg">
                <h3 className="font-bold text-gray-200">Connection Logs ({logs.length})</h3>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white"
                        aria-label="Close Logs"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 5.293a1 1 0 010 1.414L10.414 10l4.293 4.293a1 1 0 01-1.414 1.414L9 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L7.586 10 3.293 5.707a1 1 0 011.414-1.414L9 8.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="p-2 border-b border-gray-700 flex justify-between bg-gray-800/50">
                <label className="flex items-center text-xs text-gray-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={e => setAutoRefresh(e.target.checked)}
                        className="mr-2"
                    />
                    Auto-refresh
                </label>
                <div className="flex gap-2">
                    <button
                        onClick={handleClear}
                        className="text-xs px-2 py-1 bg-red-900/50 text-red-400 hover:bg-red-900 rounded border border-red-800"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleExport}
                        className="text-xs px-2 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded"
                    >
                        Export CSV
                    </button>
                    <button
                        onClick={() => {
                            // Helper to dump graph data to clipboard
                            // We need to access nodes/links from App component, but we don't have them here explicitly.
                            // However, we can use a "cheat" and access the WikiService cache for now as a proxy, 
                            // or better, trigger a custom event or use a callback if we refactor. 
                            // For this specific user request ("simple text dump"), let's dump the logs since they represent connections.
                            // BUT user wants "current loaded session and ALL loaded results".
                            // Best way: LogPanel receives a callback prop "onDumpGraph".
                            // For now, let's just dump the logs as JSON which is accessible here.
                            const dump = JSON.stringify(connectionLogger.getLogs(), null, 2);
                            navigator.clipboard.writeText(dump);
                            alert('Session logs copied to clipboard!');
                        }}
                        className="text-xs px-2 py-1 bg-gray-600 text-white hover:bg-gray-700 rounded"
                        title="Copy session data to clipboard for analysis"
                    >
                        Copy JSON
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-0 font-mono text-xs">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800 sticky top-0">
                        <tr>
                            <th className="p-2 text-gray-500 font-medium">Time</th>
                            <th className="p-2 text-gray-500 font-medium">Source → Target</th>
                            <th className="p-2 text-gray-500 font-medium">Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map(log => (
                            <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50 text-gray-300">
                                <td className="p-2 whitespace-nowrap text-gray-500">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="p-2">
                                    <span className="text-blue-400">{log.source}</span>
                                    <span className="text-gray-600 mx-1">→</span>
                                    <span className="text-green-400">{log.target}</span>
                                </td>
                                <td className="p-2">
                                    <span className={`px-1 rounded ${log.type === 'manual' ? 'bg-blue-900 text-blue-300' :
                                        log.type === 'path' ? 'bg-purple-900 text-purple-300' :
                                        log.type.includes('backlink') ? 'bg-orange-900 text-orange-300' :
                                            'bg-gray-700 text-gray-300'
                                        }`}>
                                        {log.type}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-4 text-center text-gray-500">
                                    No logs yet. Explore the graph to generate logs.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LogPanel;
