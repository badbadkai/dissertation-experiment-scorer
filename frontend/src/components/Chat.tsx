'use client';

import { useState, useRef } from 'react';
import { Upload, HelpCircle, LogOut, Download, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

interface ChatProps {
  token: string;
  userName: string;
  onLogout: () => void;
}

type ViewState = 'home' | 'help' | 'uploading' | 'success' | 'error';

interface ProcessingStats {
  total_responses: number;
  complete: number;
  incomplete: number;
  completion_rate: number;
  conditions: Record<string, number>;
  mean_recall_score: number;
  recall_score_range: { min: number; max: number };
  gender_breakdown: Record<string, number>;
  age_range: { min: number; max: number };
}

export default function Chat({ token, userName, onLogout }: ChatProps) {
  const [viewState, setViewState] = useState<ViewState>('home');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a CSV file.');
      setViewState('error');
      return;
    }

    setViewState('uploading');
    setIsProcessing(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('output_format', 'xlsx');

    try {
      const res = await fetch(`${API_URL}/process/csv`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        // Auto-logout on token expiry
        if (res.status === 401 || data.detail === 'Invalid token') {
          onLogout();
          return;
        }
        throw new Error(data.detail || 'Processing failed');
      }

      // Extract stats from response header
      const statsHeader = res.headers.get('X-Processing-Stats');
      if (statsHeader) {
        try {
          const parsedStats = JSON.parse(statsHeader);
          setStats(parsedStats);
        } catch {
          console.error('Failed to parse stats header');
        }
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setViewState('success');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred');
      setViewState('error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `cleaned_results_${timestamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const resetToHome = () => {
    setViewState('home');
    setErrorMessage('');
    setDownloadUrl(null);
    setStats(null);
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Minimal Header */}
      <header className="absolute top-0 right-0 p-6">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-[var(--muted)] hover:text-white transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full text-center animate-fade-in">
          
          {/* Home State */}
          {viewState === 'home' && (
            <>
              <h1 className="text-4xl font-light text-white mb-4">
                Hello {userName}.
              </h1>
              <p className="text-xl text-[var(--muted)] mb-12">
                What can I help you with today?
              </p>

              <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button
                  onClick={() => setViewState('help')}
                  className="flex items-center justify-center gap-3 bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] rounded-xl p-5 text-left transition-all hover:scale-[1.02] group"
                >
                  <HelpCircle className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                  <span className="text-white">How do I export from Qualtrics?</span>
                </button>

                <button
                  onClick={handleUploadClick}
                  className="flex items-center justify-center gap-3 bg-[var(--card)] hover:bg-[var(--card-hover)] border border-[var(--border)] rounded-xl p-5 text-left transition-all hover:scale-[1.02] group"
                >
                  <Upload className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-white">Upload CSV for scoring</span>
                </button>
              </div>
            </>
          )}

          {/* Help State */}
          {viewState === 'help' && (
            <>
              <h2 className="text-2xl font-light text-white mb-8">How to Export from Qualtrics</h2>
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 text-left mb-8">
                <ol className="space-y-3 text-[var(--muted)]">
                  <li className="flex gap-3">
                    <span className="text-white font-medium">1.</span>
                    Log in to your Qualtrics account
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">2.</span>
                    Open your survey project
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">3.</span>
                    Click "Data & Analysis" in the top navigation
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">4.</span>
                    Click "Export & Import" → "Export Data"
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">5.</span>
                    Select "CSV" as the format
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">6.</span>
                    Choose "Download all fields" and select "Use numeric values" (not labels)
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">7.</span>
                    Click "Download" and save the file
                  </li>
                  <li className="flex gap-3">
                    <span className="text-white font-medium">8.</span>
                    Upload the CSV file here for processing
                  </li>
                </ol>
              </div>
              <button
                onClick={resetToHome}
                className="text-[var(--muted)] hover:text-white transition-colors"
              >
                ← Back
              </button>
            </>
          )}

          {/* Uploading State */}
          {viewState === 'uploading' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-light text-white mb-2">Processing your file...</h2>
              <p className="text-[var(--muted)]">Scoring recall responses and generating results</p>
            </>
          )}

          {/* Success State */}
          {viewState === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-[var(--success)] mx-auto mb-6" />
              <h2 className="text-2xl font-light text-white mb-2">Processing complete!</h2>
              <p className="text-[var(--muted)] mb-6">
                Your file has been cleaned and scored.
              </p>
              
              {/* Stats Summary */}
              {stats && (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 mb-8 text-left">
                  <h3 className="text-lg font-medium text-white mb-4">Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[var(--muted)]">Complete</p>
                      <p className="text-green-400 text-xl font-medium">{stats.complete}</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Incomplete</p>
                      <p className="text-yellow-400 text-xl font-medium">{stats.incomplete}</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Mean Recall</p>
                      <p className="text-white text-xl font-medium">{stats.mean_recall_score}</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted)]">Age Range</p>
                      <p className="text-white text-xl font-medium">{stats.age_range?.min ?? '–'} - {stats.age_range?.max ?? '–'}</p>
                    </div>
                  </div>
                  
                  {/* Condition Distribution */}
                  {Object.keys(stats.conditions).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <p className="text-[var(--muted)] mb-2">Conditions</p>
                      <div className="flex gap-4">
                        {Object.entries(stats.conditions).map(([condition, count]) => (
                          <div key={condition} className="flex items-center gap-2">
                            <span className="text-white capitalize">{condition}:</span>
                            <span className="text-blue-400 font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Gender Split */}
                  {Object.keys(stats.gender_breakdown).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <p className="text-[var(--muted)] mb-2">Gender</p>
                      <div className="flex gap-4 flex-wrap">
                        {Object.entries(stats.gender_breakdown).map(([gender, count]) => (
                          <div key={gender} className="flex items-center gap-2">
                            <span className="text-white">{gender}:</span>
                            <span className="text-purple-400 font-medium">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-3 bg-[var(--success)] hover:bg-green-600 text-white font-medium px-6 py-3 rounded-xl transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download Results (.xlsx)
                </button>
                <button
                  onClick={resetToHome}
                  className="text-[var(--muted)] hover:text-white transition-colors px-6 py-3"
                >
                  Process another file
                </button>
              </div>
            </>
          )}

          {/* Error State */}
          {viewState === 'error' && (
            <>
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                <X className="w-6 h-6 text-[var(--error)]" />
              </div>
              <h2 className="text-2xl font-light text-white mb-2">Processing failed</h2>
              <p className="text-[var(--muted)] mb-8">{errorMessage}</p>
              <button
                onClick={resetToHome}
                className="text-[var(--muted)] hover:text-white transition-colors"
              >
                ← Try again
              </button>
            </>
          )}

        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </main>
  );
}
