import React, { useState, useCallback } from 'react';

/**
 * Confidence level color mapping for AI findings.
 */
const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#ef4444'; // High - red
  if (confidence >= 0.5) return '#f59e0b'; // Medium - amber
  return '#22c55e'; // Low - green
};

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
};

export interface AIFinding {
  id: string;
  label: string;
  confidence: number;
  description?: string;
  location?: string;
  sopInstanceUID?: string;
  frameNumber?: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface AIModelInfo {
  name: string;
  version: string;
  vendor?: string;
  modality?: string;
}

interface PanelAIResultsProps {
  findings?: AIFinding[];
  modelInfo?: AIModelInfo;
  isLoading?: boolean;
  onFindingClick?: (finding: AIFinding) => void;
  onRunInference?: () => void;
  servicesManager?: AppTypes.ServicesManager;
}

/**
 * Panel for displaying AI inference results.
 *
 * Shows:
 * - Model information (name, version, vendor)
 * - List of AI findings with confidence scores
 * - Color-coded confidence indicators
 * - Click-to-navigate to finding location
 */
function PanelAIResults({
  findings = [],
  modelInfo,
  isLoading = false,
  onFindingClick,
  onRunInference,
}: PanelAIResultsProps) {
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'confidence' | 'label'>('confidence');

  const sortedFindings = [...findings].sort((a, b) => {
    if (sortBy === 'confidence') {
      return b.confidence - a.confidence;
    }
    return a.label.localeCompare(b.label);
  });

  const handleFindingClick = useCallback(
    (finding: AIFinding) => {
      setSelectedFindingId(finding.id);
      onFindingClick?.(finding);
    },
    [onFindingClick]
  );

  return (
    <div
      className="flex h-full flex-col bg-black text-white"
      role="region"
      aria-label="AI Analysis Results"
    >
      {/* Header */}
      <div className="border-b border-gray-800 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">AI Analysis</h3>
          {onRunInference && (
            <button
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              onClick={onRunInference}
              disabled={isLoading}
              aria-label="Run AI inference"
            >
              {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          )}
        </div>

        {/* Model info */}
        {modelInfo && (
          <div className="mt-2 text-xs text-gray-400">
            <span>{modelInfo.name}</span>
            <span className="mx-1">v{modelInfo.version}</span>
            {modelInfo.vendor && <span className="text-gray-500">by {modelInfo.vendor}</span>}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
          <span className="text-sm text-gray-400">Running AI analysis...</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && findings.length === 0 && (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-2 text-2xl">🔬</div>
          <div className="text-sm text-gray-400">No AI findings available</div>
          <div className="mt-1 text-xs text-gray-500">
            Run an analysis or load a study with AI results
          </div>
        </div>
      )}

      {/* Sort controls */}
      {findings.length > 0 && (
        <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
          <span className="text-xs text-gray-500">Sort:</span>
          <button
            className={`text-xs ${sortBy === 'confidence' ? 'text-blue-400' : 'text-gray-400'}`}
            onClick={() => setSortBy('confidence')}
          >
            Confidence
          </button>
          <button
            className={`text-xs ${sortBy === 'label' ? 'text-blue-400' : 'text-gray-400'}`}
            onClick={() => setSortBy('label')}
          >
            Name
          </button>
          <span className="ml-auto text-xs text-gray-500">{findings.length} findings</span>
        </div>
      )}

      {/* Findings list */}
      <div
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label="AI findings"
      >
        {sortedFindings.map(finding => {
          const isSelected = finding.id === selectedFindingId;
          const confidencePercent = Math.round(finding.confidence * 100);
          const confidenceColor = getConfidenceColor(finding.confidence);

          return (
            <div
              key={finding.id}
              className={`cursor-pointer border-b border-gray-800/50 p-3 transition-colors hover:bg-gray-900 ${
                isSelected ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''
              }`}
              onClick={() => handleFindingClick(finding)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleFindingClick(finding);
                }
              }}
              role="listitem"
              tabIndex={0}
              aria-selected={isSelected}
              aria-label={`${finding.label}: ${confidencePercent}% confidence`}
            >
              {/* Finding header */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{finding.label}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: confidenceColor }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-xs font-mono"
                    style={{ color: confidenceColor }}
                  >
                    {confidencePercent}%
                  </span>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="mt-1.5 h-1 w-full rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${confidencePercent}%`,
                    backgroundColor: confidenceColor,
                  }}
                />
              </div>

              {/* Details */}
              {finding.description && (
                <p className="mt-1.5 text-xs text-gray-400">{finding.description}</p>
              )}
              {finding.location && (
                <p className="mt-1 text-xs text-gray-500">
                  Location: {finding.location}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer disclaimer */}
      <div className="border-t border-gray-800 px-3 py-2">
        <p className="text-center text-[10px] text-gray-600">
          AI results are for research purposes only. Not for clinical diagnosis.
        </p>
      </div>
    </div>
  );
}

export default PanelAIResults;
