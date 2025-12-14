'use client';

import { useCallback, useState } from 'react';
import { bulkUploadResumes, type BulkUploadResult } from '../lib/api';

type Props = {
    onComplete?: (result: BulkUploadResult) => void;
};

export function BulkResumeUpload({ onComplete }: Props) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<BulkUploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            (file) => file.name.endsWith('.pdf') || file.name.endsWith('.txt')
        );

        if (droppedFiles.length > 0) {
            setFiles((prev) => [...prev, ...droppedFiles]);
            setResult(null);
            setError(null);
        }
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        if (selectedFiles.length > 0) {
            setFiles((prev) => [...prev, ...selectedFiles]);
            setResult(null);
            setError(null);
        }
    }, []);

    const removeFile = useCallback((index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const handleUpload = useCallback(async () => {
        if (files.length === 0) return;

        setIsUploading(true);
        setError(null);

        try {
            const uploadResult = await bulkUploadResumes(files);
            setResult(uploadResult);
            setFiles([]);
            onComplete?.(uploadResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [files, onComplete]);

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                </div>
                <div>
                    <h2 className="font-semibold text-slate-900">Bulk Resume Upload</h2>
                    <p className="text-sm text-slate-500">Drop multiple resumes to auto-import candidates</p>
                </div>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${isDragging
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                    }`}
            >
                <input
                    type="file"
                    multiple
                    accept=".pdf,.txt"
                    onChange={handleFileSelect}
                    className="absolute inset-0 cursor-pointer opacity-0"
                />
                <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2 text-sm font-medium text-slate-700">
                    {isDragging ? 'Drop resumes here' : 'Drag & drop resumes here'}
                </p>
                <p className="mt-1 text-xs text-slate-500">PDF or TXT files • Names & emails auto-extracted</p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-slate-700">{files.length} file(s) selected</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {files.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <svg className="h-4 w-4 flex-shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="truncate text-sm text-slate-700">{file.name}</span>
                                    <span className="text-xs text-slate-400">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={isUploading}
                        className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
                    >
                        {isUploading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Processing {files.length} resume(s)...
                            </span>
                        ) : (
                            `Upload ${files.length} Resume${files.length > 1 ? 's' : ''}`
                        )}
                    </button>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            {/* Results */}
            {result && (
                <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-4">
                        <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-slate-900">{result.total}</p>
                            <p className="text-xs text-slate-500">Total</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{result.successful}</p>
                            <p className="text-xs text-slate-500">Imported</p>
                        </div>
                        {result.failed > 0 && (
                            <div className="flex-1 text-center">
                                <p className="text-2xl font-bold text-rose-600">{result.failed}</p>
                                <p className="text-xs text-slate-500">Failed</p>
                            </div>
                        )}
                    </div>

                    {/* Individual Results */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                        {result.results.map((r, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${r.status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                                    }`}
                            >
                                {r.status === 'success' ? (
                                    <>
                                        <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="font-medium">{r.candidate?.name}</span>
                                        <span className="text-emerald-600">({r.candidate?.email})</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-4 w-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <span>{r.filename}: {r.error}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}
