import { useState, useEffect } from 'react';
import { connectionLogger, ConnectionLog } from '../ConnectionLogger';
import { clientErrorReporter, type ClientErrorRecord } from '../services/ClientErrorReporter';

interface LogPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const LogPanel = ({ isOpen, onClose }: LogPanelProps) => {
    const [logs, setLogs] = useState<ConnectionLog[]>([]);
    const [runtimeErrors, setRuntimeErrors] = useState<ClientErrorRecord[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [confirmClear, setConfirmClear] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const refreshLogs = () => {
        setLogs([...connectionLogger.getLogs()].reverse());
        setRuntimeErrors(clientErrorReporter.getErrors());
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
        connectionLogger.clearLogs();
        clientErrorReporter.clear();
        refreshLogs();
        setConfirmClear(false);
        setStatusMessage('Connection logs and runtime errors cleared.');
    };

    const handleCopyJson = async () => {
        try {
            const dump = JSON.stringify({
                connectionLogs: connectionLogger.getLogs(),
                runtimeErrors: clientErrorReporter.getErrors(),
            }, null, 2);
            await navigator.clipboard.writeText(dump);
            setStatusMessage('Session diagnostics copied to the clipboard.');
        } catch {
            setStatusMessage('Clipboard copy failed. Try exporting the CSV instead.');
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:block">
            <button
                type="button"
                onClick={onClose}
                aria-label="Close diagnostics"
                className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] sm:hidden"
            />

            <div className="relative z-10 mx-3 mb-3 w-[calc(100vw-1.5rem)] rounded-[1.75rem] border border-gray-700 bg-gray-900/95 shadow-[0_-20px_70px_rgba(2,6,23,0.72)] backdrop-blur-md sm:fixed sm:bottom-24 sm:right-6 sm:mx-0 sm:mb-0 sm:w-96 sm:rounded-lg sm:shadow-2xl max-h-[78vh] sm:max-h-[520px] flex flex-col overflow-hidden">
                <div className="flex justify-center py-2 sm:hidden">
                    <div className="h-1.5 w-12 rounded-full bg-gray-500/50" />
                </div>

                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-700 bg-gray-800/90">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/80">
                            Session Diagnostics
                        </div>
                        <h3 className="mt-1 font-bold text-gray-200">
                            {logs.length} links · {runtimeErrors.length} errors
                        </h3>
                    </div>
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

                <div className="border-b border-gray-700 bg-gray-800/50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center text-xs text-gray-400 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={e => setAutoRefresh(e.target.checked)}
                                className="mr-2"
                            />
                            Auto-refresh
                        </label>
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                            <button
                                onClick={() => setConfirmClear(true)}
                                className="text-xs px-2 py-2 bg-red-900/50 text-red-400 hover:bg-red-900 rounded-xl border border-red-800"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleExport}
                                className="text-xs px-2 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl"
                            >
                                Export CSV
                            </button>
                            <button
                                onClick={() => void handleCopyJson()}
                                className="text-xs px-2 py-2 bg-gray-600 text-white hover:bg-gray-700 rounded-xl"
                                title="Copy session diagnostics to clipboard for analysis"
                            >
                                Copy JSON
                            </button>
                        </div>
                    </div>
                </div>

                {(confirmClear || statusMessage) && (
                    <div className="border-b border-gray-700 bg-gray-900/80 px-3 py-2 text-xs">
                        {confirmClear ? (
                            <div className="flex flex-col gap-3 text-gray-200 sm:flex-row sm:items-center sm:justify-between">
                                <span>Clear all connection logs and runtime errors for this browser session?</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setConfirmClear(false)}
                                        className="rounded-xl border border-gray-700 px-2 py-1 text-gray-300 hover:bg-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        className="rounded-xl border border-red-700 bg-red-900/40 px-2 py-1 text-red-200 hover:bg-red-900/60"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-gray-300">{statusMessage}</span>
                                <button
                                    onClick={() => setStatusMessage(null)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-auto p-0 font-mono text-xs">
                    <div className="border-b border-gray-800">
                        <div className="sticky top-0 bg-gray-800 px-3 py-2 text-[11px] uppercase tracking-widest text-gray-400">
                            Connection Logs
                        </div>
                        <div className="sm:hidden divide-y divide-gray-800">
                            {logs.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    No connection logs yet. Explore the graph to generate them.
                                </div>
                            ) : (
                                logs.map(log => (
                                    <div key={log.id} className="px-3 py-3 text-gray-300">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-[11px] text-gray-500">
                                                {new Date(log.timestamp).toLocaleTimeString()}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${log.type === 'manual' ? 'bg-blue-900 text-blue-300' :
                                                log.type === 'path' ? 'bg-purple-900 text-purple-300' :
                                                log.type.includes('backlink') ? 'bg-orange-900 text-orange-300' :
                                                    'bg-gray-700 text-gray-300'
                                                }`}>
                                                {log.type}
                                            </span>
                                        </div>
                                        <div className="mt-2 leading-relaxed">
                                            <span className="text-blue-400">{log.source}</span>
                                            <span className="text-gray-600 mx-1">→</span>
                                            <span className="text-green-400">{log.target}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <table className="hidden sm:table w-full text-left border-collapse">
                            <thead className="bg-gray-800/70 sticky top-[32px]">
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
                                            No connection logs yet. Explore the graph to generate them.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div>
                        <div className="sticky top-[61px] bg-gray-800 px-3 py-2 text-[11px] uppercase tracking-widest text-gray-400">
                            Runtime Errors
                        </div>
                        {runtimeErrors.length === 0 ? (
                            <div className="p-4 text-gray-500">No runtime errors captured in this session.</div>
                        ) : (
                            <div className="divide-y divide-gray-800">
                                {runtimeErrors.map(error => (
                                    <div key={error.id} className="px-3 py-3 text-gray-300">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-semibold text-red-300">{error.message}</div>
                                            <div className="shrink-0 text-[11px] text-gray-500">
                                                {new Date(error.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="mt-1 text-[11px] text-gray-500">
                                            {error.source}
                                            {error.url ? ` · ${error.url}` : ''}
                                            {typeof error.line === 'number' ? `:${error.line}` : ''}
                                            {typeof error.column === 'number' ? `:${error.column}` : ''}
                                        </div>
                                        {error.detail && (
                                            <div className="mt-2 text-[11px] text-orange-200">{error.detail}</div>
                                        )}
                                        {error.stack && (
                                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-[10px] text-gray-400">
                                                {error.stack}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LogPanel;
