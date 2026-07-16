'use client';

import React, { useState } from 'react';
import FileDropzone from '@/components/FileDropzone';
import AnalysisTabs from '@/components/AnalysisTabs';
import QAInterface from '@/components/QAInterface';

type TabType = 'summary' | 'insights' | 'qa' | 'raw';

interface InsightItem {
  tag: string;
  title: string;
  desc: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [documentText, setDocumentText] = useState('');
  const [isMock, setIsMock] = useState(true);
  const [provider, setProvider] = useState<'gemini' | 'grok' | 'mock'>('mock');
  const [error, setError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number; type: string } | null>(null);

  const handleAnalyze = async () => {
    if (inputMode === 'file' && !selectedFile) return;
    if (inputMode === 'text' && !rawText.trim()) return;

    setLoading(true);
    setError(null);
    setSummary('');
    setInsights([]);
    setDocumentText('');

    try {
      const formData = new FormData();
      formData.append('action', 'analyze');

      if (inputMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
        setFileDetails({
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.name.endsWith('.pdf') ? 'PDF Document' : 'Text File'
        });
      } else {
        formData.append('text', rawText);
        setFileDetails({
          name: 'Pasted Raw Text',
          size: new Blob([rawText]).size,
          type: 'Manual Input'
        });
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to analyze the document.');
      }

      const data = await res.json();
      setSummary(data.summary || '');
      setInsights(data.insights || []);
      setDocumentText(data.text || '');
      setIsMock(data.isMock !== false);
      setProvider(data.provider || (data.isMock !== false ? 'mock' : 'gemini'));
      setActiveTab('summary');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while processing the document.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setRawText('');
    setSummary('');
    setInsights([]);
    setDocumentText('');
    setFileDetails(null);
    setError(null);
    setActiveTab('summary');
    setProvider('mock');
  };

  // Safe markdown highlighting parser
  const renderSummaryMarkdown = (markdownText: string) => {
    if (!markdownText) return null;
    
    const lines = markdownText.split('\n');
    return (
      <div className="summary-article">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          
          if (trimmed.startsWith('### ')) {
            return <h3 key={idx}>{trimmed.substring(4)}</h3>;
          }
          if (trimmed.startsWith('## ')) {
            return <h2 key={idx} style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', marginTop: '1.25rem', marginBottom: '0.5rem', fontWeight: 600 }}>{trimmed.substring(3)}</h2>;
          }
          if (trimmed.startsWith('# ')) {
            return <h1 key={idx} style={{ fontSize: '1.5rem', color: 'var(--accent-cyan)', marginTop: '1.5rem', marginBottom: '0.75rem', fontWeight: 700 }}>{trimmed.substring(2)}</h1>;
          }
          if (trimmed.startsWith('> ')) {
            return <blockquote key={idx}>{trimmed.substring(2)}</blockquote>;
          }
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const content = trimmed.substring(2);
            return (
              <li key={idx} style={{ marginLeft: '1.25rem', listStyleType: 'square', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                <span dangerouslySetInnerHTML={{ __html: replaceBoldTokens(content) }} />
              </li>
            );
          }
          if (trimmed === '') {
            return <div key={idx} style={{ height: '0.75rem' }} />;
          }

          return (
            <p key={idx} style={{ marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ 
              __html: replaceBoldTokens(trimmed) 
            }} />
          );
        })}
      </div>
    );
  };

  const replaceBoldTokens = (text: string) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasAnalyzedData = !!summary;

  return (
    <div>
      {/* App Header */}
      <header className="app-header glass-panel">
        <div className="logo-section">
          <h1><span>✦</span> DocuSense</h1>
          <p>AI Document Analyzer & Insights Assistant</p>
        </div>
        <div className={`badge ${provider === 'mock' ? 'badge-mock' : provider === 'grok' ? 'badge-grok' : 'badge-real'}`}>
          <span className="badge-dot" />
          {provider === 'mock' ? 'Demo Mode (Mock AI)' : provider === 'grok' ? 'Production (Grok AI)' : 'Production (Gemini AI)'}
        </div>
      </header>

      {/* Main Container */}
      <main className="dashboard-container">
        {/* Left Column - Control Panel */}
        <section className="left-column">
          <div className="glass-panel upload-card">
            <h2 className="card-title">Select Document Source</h2>
            
            {/* Input Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: 'var(--border-radius-sm)', marginBottom: '0.5rem' }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: inputMode === 'file' ? 'var(--accent-gradient)' : 'none',
                  color: inputMode === 'file' ? '#080c14' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'var(--transition-smooth)'
                }}
                onClick={() => setInputMode('file')}
              >
                Upload File
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  background: inputMode === 'text' ? 'var(--accent-gradient)' : 'none',
                  color: inputMode === 'text' ? '#080c14' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'var(--transition-smooth)'
                }}
                onClick={() => setInputMode('text')}
              >
                Paste Text
              </button>
            </div>

            {inputMode === 'file' ? (
              <FileDropzone onFileSelect={setSelectedFile} selectedFile={selectedFile} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span className="text-area-label">Input plain text below</span>
                <textarea
                  className="text-input-field"
                  placeholder="Paste text contents here (at least 20 words)..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '0.75rem',
                borderRadius: 'var(--border-radius-sm)',
                fontSize: '0.85rem'
              }}>
                {error}
              </div>
            )}

            {/* Control Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="action-btn"
                disabled={loading || (inputMode === 'file' && !selectedFile) || (inputMode === 'text' && !rawText.trim())}
                onClick={handleAnalyze}
              >
                {loading ? 'Analyzing...' : 'Analyze Document'}
              </button>
              
              {(selectedFile || rawText.trim() || hasAnalyzedData) && (
                <button
                  type="button"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'var(--text-primary)',
                    padding: '0.75rem 1.25rem',
                    borderRadius: 'var(--border-radius-md)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  onClick={handleClear}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Metadata Card */}
          {hasAnalyzedData && fileDetails && (
            <div className="glass-panel metadata-panel" style={{ animation: 'fade-in 0.3s ease' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.5rem' }}>Document Profile</h3>
              <div className="metadata-grid">
                <span className="metadata-label">Source:</span>
                <span className="metadata-val">{fileDetails.name}</span>
                <span className="metadata-label">File Size:</span>
                <span className="metadata-val">{formatBytes(fileDetails.size)}</span>
                <span className="metadata-label">Format:</span>
                <span className="metadata-val">{fileDetails.type}</span>
              </div>
            </div>
          )}
        </section>

        {/* Right Column - Results Dashboard */}
        <section className="right-column">
          <div className="glass-panel insights-card">
            {/* Tabs */}
            <AnalysisTabs activeTab={activeTab} onTabChange={setActiveTab} hasData={hasAnalyzedData} />

            {/* Content Container */}
            <div className="insights-content">
              {loading ? (
                <div className="loader-container">
                  <div className="spinner" />
                  <p>Processing document and generating insights...</p>
                </div>
              ) : !hasAnalyzedData ? (
                <div className="placeholder-view">
                  <div className="placeholder-icon">✦</div>
                  <h3>No Document Analyzed</h3>
                  <p style={{ maxWidth: '400px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Upload a PDF or paste text on the left, then click <strong>Analyze Document</strong> to generate summaries, extract insights, and ask questions.
                  </p>
                </div>
              ) : (
                <>
                  {activeTab === 'summary' && renderSummaryMarkdown(summary)}

                  {activeTab === 'insights' && (
                    <div className="insights-grid">
                      {insights.map((insight, index) => (
                        <div key={index} className="insight-card">
                          <span className="insight-tag">{insight.tag}</span>
                          <h4 className="insight-title">{insight.title}</h4>
                          <p className="insight-desc">{insight.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'qa' && (
                    <QAInterface documentText={documentText} />
                  )}

                  {activeTab === 'raw' && (
                    <div style={{ animation: 'fade-in 0.4s ease', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Raw Extracted Characters: {documentText.length}</span>
                        <button
                          type="button"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'var(--text-secondary)',
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'var(--transition-smooth)'
                          }}
                          onClick={() => {
                            navigator.clipboard.writeText(documentText);
                            alert('Copied raw document text to clipboard!');
                          }}
                        >
                          Copy Text
                        </button>
                      </div>
                      <pre style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '1rem',
                        borderRadius: 'var(--border-radius-md)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        {documentText}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
