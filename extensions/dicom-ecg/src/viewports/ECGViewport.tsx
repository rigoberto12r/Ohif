import React, { useEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useViewportRef } from '@ohif/core';

/**
 * Default ECG lead configuration for 12-Lead display.
 * Standard clinical layout: 4 columns x 3 rows + rhythm strip.
 */
const TWELVE_LEAD_LAYOUT = [
  ['I', 'aVR', 'V1', 'V4'],
  ['II', 'aVL', 'V2', 'V5'],
  ['III', 'aVF', 'V3', 'V6'],
];

const LEAD_COLORS = {
  I: '#00ff00',
  II: '#00ff00',
  III: '#00ff00',
  aVR: '#ffff00',
  aVL: '#ffff00',
  aVF: '#ffff00',
  V1: '#00bfff',
  V2: '#00bfff',
  V3: '#00bfff',
  V4: '#ff6347',
  V5: '#ff6347',
  V6: '#ff6347',
};

const GRID_COLOR = 'rgba(255, 50, 50, 0.15)';
const GRID_COLOR_MAJOR = 'rgba(255, 50, 50, 0.3)';
const DEFAULT_SPEED = 25; // mm/s
const DEFAULT_AMPLITUDE = 10; // mm/mV

/**
 * Draws ECG-style grid background on a canvas.
 */
function drawGrid(ctx, width, height) {
  const smallGridSize = 4; // 1mm at standard scale
  const largeGridSize = smallGridSize * 5; // 5mm

  // Small grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 0; x <= width; x += smallGridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += smallGridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Large grid
  ctx.strokeStyle = GRID_COLOR_MAJOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += largeGridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += largeGridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}

/**
 * Draws a single waveform channel on a canvas context.
 */
function drawWaveform(ctx, samples, startX, startY, width, height, color, samplingFrequency) {
  if (!samples || samples.length === 0) {
    return;
  }

  const pixelsPerSample = width / samples.length;
  const amplitudeScale = height / 4; // Scale to fit within the row height

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  for (let i = 0; i < samples.length; i++) {
    const x = startX + i * pixelsPerSample;
    const y = startY + height / 2 - samples[i] * amplitudeScale;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

/**
 * Parses waveform data from DICOM instance metadata.
 * Extracts channel data, sampling frequency, and lead names.
 */
function parseWaveformData(instance) {
  const waveformSequence = instance.WaveformSequence || instance['54000100'];

  if (!waveformSequence || !waveformSequence.length) {
    return null;
  }

  const channels = [];

  for (const waveformGroup of waveformSequence) {
    const numberOfChannels = waveformGroup.NumberOfWaveformChannels || waveformGroup['003A0005'];
    const numberOfSamples = waveformGroup.NumberOfWaveformSamples || waveformGroup['003A0010'];
    const samplingFrequency = waveformGroup.SamplingFrequency || waveformGroup['003A001A'];
    const channelDefinitions =
      waveformGroup.ChannelDefinitionSequence || waveformGroup['003A0200'] || [];
    const waveformData = waveformGroup.WaveformData || waveformGroup['54001010'];

    for (let ch = 0; ch < (numberOfChannels || channelDefinitions.length); ch++) {
      const channelDef = channelDefinitions[ch] || {};
      const channelSource = channelDef.ChannelSourceSequence || channelDef['003A0208'] || [];
      const leadName =
        channelSource[0]?.CodeMeaning || channelSource[0]?.['00080104'] || `Channel ${ch + 1}`;
      const sensitivity = channelDef.ChannelSensitivity || channelDef['003A0210'] || 1;
      const baseline = channelDef.ChannelBaseline || channelDef['003A0213'] || 0;

      // Extract samples for this channel (interleaved data)
      const samples = [];
      if (waveformData) {
        const dataView =
          waveformData instanceof ArrayBuffer ? new DataView(waveformData) : null;

        for (let s = 0; s < numberOfSamples; s++) {
          const offset = (s * numberOfChannels + ch) * 2;
          if (dataView && offset + 2 <= dataView.byteLength) {
            const rawValue = dataView.getInt16(offset, true);
            samples.push((rawValue - baseline) * sensitivity);
          }
        }
      }

      channels.push({
        leadName,
        samples,
        samplingFrequency: parseFloat(samplingFrequency) || 500,
        numberOfSamples: parseInt(numberOfSamples) || samples.length,
        sensitivity: parseFloat(sensitivity),
      });
    }
  }

  return channels;
}

/**
 * ECG/Waveform Viewport Component
 *
 * Renders DICOM waveform data (ECG, hemodynamic, respiratory, etc.)
 * on an HTML5 canvas with standard ECG grid background.
 */
function ECGViewport({ displaySets, viewportId = 'ecg-viewport' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const viewportRef = useViewportRef(viewportId);
  const [waveformData, setWaveformData] = useState(null);
  const [error, setError] = useState(null);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [amplitude, setAmplitude] = useState(DEFAULT_AMPLITUDE);

  // Parse waveform data from display set
  useEffect(() => {
    if (!displaySets || displaySets.length === 0) {
      return;
    }

    try {
      const displaySet = displaySets[0];
      const { instance } = displaySet;

      if (!instance) {
        setError('No instance data available');
        return;
      }

      const channels = parseWaveformData(instance);

      if (!channels || channels.length === 0) {
        setError('No waveform data found in DICOM instance');
        return;
      }

      setWaveformData(channels);
      setError(null);
    } catch (err) {
      console.error('Error parsing waveform data:', err);
      setError(`Error parsing waveform: ${err.message}`);
    }
  }, [displaySets]);

  // Render waveforms on canvas
  const renderWaveforms = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container || !waveformData) {
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear and draw background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // Draw ECG grid
    drawGrid(ctx, width, height);

    // Calculate layout
    const numChannels = waveformData.length;
    const rowHeight = height / Math.min(numChannels, 12);
    const padding = 5;

    // Draw each channel
    waveformData.forEach((channel, index) => {
      if (index >= 12) {
        return; // Max 12 channels displayed
      }

      const startY = index * rowHeight;
      const color = LEAD_COLORS[channel.leadName] || '#00ff00';

      // Draw lead label
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(channel.leadName, padding, startY + 15);

      // Draw waveform
      drawWaveform(
        ctx,
        channel.samples,
        40, // Offset for label
        startY,
        width - 50,
        rowHeight,
        color,
        channel.samplingFrequency
      );

      // Draw separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, startY + rowHeight);
      ctx.lineTo(width, startY + rowHeight);
      ctx.stroke();
    });

    // Draw info bar
    const infoY = height - 25;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, infoY, width, 25);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';

    const displaySet = displaySets[0];
    const waveformType = displaySet.waveformType || 'Waveform';
    const freq = waveformData[0]?.samplingFrequency || 'N/A';
    ctx.fillText(
      `${waveformType} | ${numChannels} channels | ${freq} Hz | ${speed} mm/s | ${amplitude} mm/mV`,
      padding,
      infoY + 16
    );
  }, [waveformData, speed, amplitude, displaySets]);

  useEffect(() => {
    renderWaveforms();
  }, [renderWaveforms]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => renderWaveforms();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderWaveforms]);

  // Cleanup
  useEffect(() => {
    return () => {
      viewportRef.unregister();
    };
  }, []);

  if (error) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-black text-white"
        ref={el => {
          if (el) viewportRef.register(el);
        }}
        data-viewport-id={viewportId}
      >
        <div className="text-center">
          <div className="mb-2 text-lg">ECG Waveform Viewer</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full bg-black"
      ref={el => {
        containerRef.current = el;
        if (el) viewportRef.register(el);
      }}
      data-viewport-id={viewportId}
      role="img"
      aria-label={`ECG waveform display with ${waveformData?.length || 0} channels`}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
      />
      {/* Speed/Amplitude controls */}
      <div className="absolute right-2 top-2 flex gap-2">
        <button
          className="rounded bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
          onClick={() => setSpeed(s => (s === 25 ? 50 : 25))}
          aria-label={`Paper speed: ${speed} mm/s. Click to toggle.`}
        >
          {speed} mm/s
        </button>
        <button
          className="rounded bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
          onClick={() => setAmplitude(a => (a === 10 ? 20 : 10))}
          aria-label={`Amplitude: ${amplitude} mm/mV. Click to toggle.`}
        >
          {amplitude} mm/mV
        </button>
      </div>
    </div>
  );
}

ECGViewport.propTypes = {
  displaySets: PropTypes.arrayOf(PropTypes.object).isRequired,
  viewportId: PropTypes.string,
};

export default ECGViewport;
