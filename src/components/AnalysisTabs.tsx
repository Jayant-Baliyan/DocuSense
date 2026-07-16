'use client';

import React from 'react';

type TabType = 'summary' | 'insights' | 'qa' | 'raw';

interface AnalysisTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasData: boolean;
}

export default function AnalysisTabs({ activeTab, onTabChange, hasData }: AnalysisTabsProps) {
  const tabs: Array<{ id: TabType; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'insights', label: 'Key Insights' },
    { id: 'qa', label: 'Q&A Chat' },
    { id: 'raw', label: 'Document Text' },
  ];

  return (
    <div className="tabs-container">
      {tabs.map((tab) => {
        const isQA = tab.id === 'qa';
        // Allow Q&A and Raw tab only if we have analyzed some data
        const isDisabled = !hasData && tab.id !== 'summary' && tab.id !== 'raw';

        return (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            style={{
              opacity: isDisabled ? 0.35 : 1,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
