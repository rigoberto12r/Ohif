import React from 'react';
import getSopClassHandlerModule from './getSopClassHandlerModule';
import { id } from './id.js';

const Component = React.lazy(() => {
  return import(/* webpackPrefetch: true */ './viewports/ECGViewport');
});

const OHIFECGViewport = props => {
  return (
    <React.Suspense fallback={<div>Loading ECG Viewer...</div>}>
      <Component {...props} />
    </React.Suspense>
  );
};

/**
 * DICOM ECG/Waveform Extension
 *
 * Provides support for viewing DICOM waveform data including:
 * - 12-Lead ECG
 * - General ECG
 * - Ambulatory ECG
 * - Hemodynamic Waveforms
 * - Cardiac Electrophysiology Waveforms
 * - Audio Waveforms (Basic Voice, General)
 * - Arterial Pulse Waveforms
 * - Respiratory Waveforms
 */
const dicomECGExtension = {
  id,

  getViewportModule({ servicesManager, extensionManager }) {
    const ExtendedECGViewport = props => {
      return (
        <OHIFECGViewport
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          {...props}
        />
      );
    };

    return [{ name: 'dicom-ecg', component: ExtendedECGViewport }];
  },

  getSopClassHandlerModule,
};

export default dicomECGExtension;
