'use client';

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';

interface FileDropzoneProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
}

export default function FileDropzone({ onFileSelect, selectedFile }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isValidFile(file)) {
        onFileSelect(file);
      } else {
        alert('Unsupported file type. Please upload a PDF or TXT file.');
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isValidFile(file)) {
        onFileSelect(file);
      } else {
        alert('Unsupported file type. Please upload a PDF or TXT file.');
      }
    }
  };

  const isValidFile = (file: File) => {
    return file.name.endsWith('.pdf') || file.name.endsWith('.txt') || file.type === 'application/pdf' || file.type === 'text/plain';
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".pdf,.txt"
        onChange={handleChange}
      />

      {!selectedFile ? (
        <div
          className={`drag-zone ${isDragActive ? 'active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <div className="upload-icon">✦</div>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>Drag & drop your file here</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            Supports PDF and TXT up to 10MB
          </p>
          <button
            type="button"
            style={{
              marginTop: '0.5rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-primary)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Browse Files
          </button>
        </div>
      ) : (
        <div className="file-info-container">
          <div className="file-details">
            <span className="file-name" title={selectedFile.name}>{selectedFile.name}</span>
            <span className="file-size">{formatFileSize(selectedFile.size)}</span>
          </div>
          <button
            type="button"
            className="remove-file-btn"
            onClick={handleRemoveFile}
            title="Remove file"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
