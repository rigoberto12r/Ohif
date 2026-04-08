import { SOPClassHandlerId } from './id';
import { utils } from '@ohif/core';

/**
 * DICOM Waveform SOP Class UIDs
 * Covers ECG (12-Lead, General, Ambulatory), Hemodynamic, Cardiac Electrophysiology,
 * Audio (Basic Voice, General), Arterial Pulse, and Respiratory waveforms.
 */
const SOP_CLASS_UIDS = {
  TWELVE_LEAD_ECG: '1.2.840.10008.5.1.4.1.1.9.1.1',
  GENERAL_ECG: '1.2.840.10008.5.1.4.1.1.9.1.2',
  AMBULATORY_ECG: '1.2.840.10008.5.1.4.1.1.9.1.3',
  HEMODYNAMIC_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.2.1',
  CARDIAC_ELECTROPHYSIOLOGY_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.3.1',
  BASIC_VOICE_AUDIO_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.4.1',
  GENERAL_AUDIO_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.4.2',
  ARTERIAL_PULSE_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.5.1',
  RESPIRATORY_WAVEFORM: '1.2.840.10008.5.1.4.1.1.9.6.1',
};

const sopClassUids = Object.values(SOP_CLASS_UIDS);

/**
 * Maps SOP Class UIDs to human-readable waveform type names.
 */
const WAVEFORM_TYPE_NAMES = {
  [SOP_CLASS_UIDS.TWELVE_LEAD_ECG]: '12-Lead ECG',
  [SOP_CLASS_UIDS.GENERAL_ECG]: 'General ECG',
  [SOP_CLASS_UIDS.AMBULATORY_ECG]: 'Ambulatory ECG',
  [SOP_CLASS_UIDS.HEMODYNAMIC_WAVEFORM]: 'Hemodynamic',
  [SOP_CLASS_UIDS.CARDIAC_ELECTROPHYSIOLOGY_WAVEFORM]: 'Cardiac Electrophysiology',
  [SOP_CLASS_UIDS.BASIC_VOICE_AUDIO_WAVEFORM]: 'Voice Audio',
  [SOP_CLASS_UIDS.GENERAL_AUDIO_WAVEFORM]: 'General Audio',
  [SOP_CLASS_UIDS.ARTERIAL_PULSE_WAVEFORM]: 'Arterial Pulse',
  [SOP_CLASS_UIDS.RESPIRATORY_WAVEFORM]: 'Respiratory',
};

const _getDisplaySetsFromSeries = (instances, servicesManager, extensionManager) => {
  return instances.map(instance => {
    const { Modality, SOPInstanceUID, SOPClassUID } = instance;
    const { SeriesDescription, SeriesNumber, SeriesDate, SeriesInstanceUID, StudyInstanceUID } =
      instance;

    const waveformType = WAVEFORM_TYPE_NAMES[SOPClassUID] || 'Waveform';
    const label = SeriesDescription || `${waveformType} - Series ${SeriesNumber}`;

    return {
      Modality,
      displaySetInstanceUID: utils.guid(),
      SeriesDescription: label,
      SeriesNumber,
      SeriesDate,
      SOPInstanceUID,
      SeriesInstanceUID,
      StudyInstanceUID,
      SOPClassHandlerId,
      SOPClassUID,
      referencedImages: null,
      measurements: null,
      instances: [instance],
      thumbnailSrc: null,
      isDerivedDisplaySet: true,
      isLoaded: false,
      sopClassUids,
      numImageFrames: 0,
      numInstances: 1,
      instance,
      waveformType,
      label,
    };
  });
};

export default function getSopClassHandlerModule(params) {
  const { servicesManager, extensionManager } = params;

  const getDisplaySetsFromSeries = instances => {
    return _getDisplaySetsFromSeries(instances, servicesManager, extensionManager);
  };

  return [
    {
      name: 'dicom-ecg',
      sopClassUids,
      getDisplaySetsFromSeries,
    },
  ];
}

export { SOP_CLASS_UIDS, WAVEFORM_TYPE_NAMES };
