/**
 * Export a study report as a PDF document.
 *
 * Generates a PDF containing:
 * - Patient demographics and study information
 * - Viewport screenshots with annotations
 * - Measurement table with values
 * - Timestamp and institution details
 *
 * Uses the browser's built-in print functionality to create a PDF
 * without external library dependencies.
 */
interface ExportReportPDFOptions {
  servicesManager: AppTypes.ServicesManager;
  commandsManager: any;
  title?: string;
  includeAnnotations?: boolean;
  includeMeasurements?: boolean;
  includePatientInfo?: boolean;
  institutionName?: string;
}

interface MeasurementData {
  label: string;
  type: string;
  value: string;
  unit: string;
  location?: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDICOMDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) {
    return dateStr || 'N/A';
  }
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Captures the current viewport as a base64 image.
 */
function captureViewport(viewportElement: HTMLElement): Promise<string | null> {
  return new Promise(resolve => {
    try {
      const canvas = viewportElement.querySelector('canvas');
      if (canvas) {
        resolve(canvas.toDataURL('image/png'));
        return;
      }

      // Fallback: try html2canvas-style capture via offscreen canvas
      resolve(null);
    } catch (err) {
      console.warn('Failed to capture viewport:', err);
      resolve(null);
    }
  });
}

/**
 * Collects measurement data from the MeasurementService.
 */
function getMeasurements(servicesManager: AppTypes.ServicesManager): MeasurementData[] {
  const { measurementService } = servicesManager.services;
  const measurements = measurementService.getMeasurements();

  return measurements.map(m => ({
    label: m.label || m.type || 'Unnamed',
    type: m.type || 'Unknown',
    value: m.displayText?.join(', ') || 'N/A',
    unit: m.unit || '',
    location: m.location || '',
  }));
}

/**
 * Generates and triggers download of a PDF report.
 */
async function exportReportPDF({
  servicesManager,
  title = 'Radiology Report',
  includeAnnotations = true,
  includeMeasurements = true,
  includePatientInfo = true,
  institutionName = '',
}: ExportReportPDFOptions): Promise<void> {
  const { uiNotificationService, viewportGridService, displaySetService } =
    servicesManager.services;

  try {
    uiNotificationService.show({
      title: 'Export Report',
      message: 'Generating PDF report...',
      type: 'info',
    });

    // Collect study info
    const activeDisplaySets = displaySetService.getActiveDisplaySets();
    const firstDisplaySet = activeDisplaySets[0];
    const studyInfo = firstDisplaySet
      ? {
          patientName: firstDisplaySet.PatientName || 'N/A',
          patientId: firstDisplaySet.PatientID || 'N/A',
          studyDate: formatDICOMDate(firstDisplaySet.StudyDate),
          studyDescription: firstDisplaySet.StudyDescription || 'N/A',
          modality: firstDisplaySet.Modality || 'N/A',
          accessionNumber: firstDisplaySet.AccessionNumber || 'N/A',
        }
      : null;

    // Capture viewport screenshots
    const viewportImages: string[] = [];
    if (includeAnnotations) {
      const viewportGridState = viewportGridService.getState();
      const viewportElements = document.querySelectorAll('[data-viewport-id]');

      for (const el of Array.from(viewportElements)) {
        const img = await captureViewport(el as HTMLElement);
        if (img) {
          viewportImages.push(img);
        }
      }
    }

    // Collect measurements
    const measurements = includeMeasurements ? getMeasurements(servicesManager) : [];

    // Generate HTML for PDF
    const html = generateReportHTML({
      title,
      studyInfo,
      viewportImages,
      measurements,
      includePatientInfo,
      institutionName,
      generatedAt: formatDate(new Date()),
    });

    // Open print dialog to save as PDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Could not open print window. Check popup blocker settings.');
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };

    uiNotificationService.show({
      title: 'Export Report',
      message: 'PDF report generated. Use the print dialog to save.',
      type: 'success',
    });
  } catch (error) {
    uiNotificationService.show({
      title: 'Export Report',
      message: `Failed to generate PDF: ${error.message}`,
      type: 'error',
    });
  }
}

function generateReportHTML({
  title,
  studyInfo,
  viewportImages,
  measurements,
  includePatientInfo,
  institutionName,
  generatedAt,
}: {
  title: string;
  studyInfo: any;
  viewportImages: string[];
  measurements: MeasurementData[];
  includePatientInfo: boolean;
  institutionName: string;
  generatedAt: string;
}): string {
  const measurementRows = measurements
    .map(
      m => `
    <tr>
      <td>${m.label}</td>
      <td>${m.type}</td>
      <td>${m.value} ${m.unit}</td>
      <td>${m.location}</td>
    </tr>`
    )
    .join('');

  const imageElements = viewportImages
    .map(
      (img, i) => `
    <div class="viewport-image">
      <img src="${img}" alt="Viewport ${i + 1}" />
      <p class="caption">Viewport ${i + 1}</p>
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; padding: 20mm; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 22px; color: #1e40af; }
    .header .institution { font-size: 14px; color: #6b7280; }
    .header .date { font-size: 12px; color: #9ca3af; float: right; }
    .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px;
                    background: #f8fafc; padding: 12px; border-radius: 6px; }
    .patient-info .field { font-size: 13px; }
    .patient-info .label { font-weight: 600; color: #374151; }
    .patient-info .value { color: #6b7280; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 16px; color: #1e40af; border-bottom: 1px solid #e5e7eb;
                   padding-bottom: 6px; margin-bottom: 12px; }
    .viewport-image { display: inline-block; margin: 8px; text-align: center; }
    .viewport-image img { max-width: 100%; max-height: 300px; border: 1px solid #e5e7eb; border-radius: 4px; }
    .caption { font-size: 11px; color: #9ca3af; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1e40af; color: white; padding: 8px 12px; text-align: left; }
    td { padding: 6px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px;
              font-size: 11px; color: #9ca3af; text-align: center; }
    .disclaimer { font-size: 10px; color: #ef4444; text-align: center; margin-top: 8px; }
    @media print { body { padding: 10mm; } }
  </style>
</head>
<body>
  <div class="header">
    <span class="date">${generatedAt}</span>
    <h1>${title}</h1>
    ${institutionName ? `<div class="institution">${institutionName}</div>` : ''}
  </div>

  ${
    includePatientInfo && studyInfo
      ? `
  <div class="patient-info">
    <div class="field"><span class="label">Patient: </span><span class="value">${studyInfo.patientName}</span></div>
    <div class="field"><span class="label">Patient ID: </span><span class="value">${studyInfo.patientId}</span></div>
    <div class="field"><span class="label">Study Date: </span><span class="value">${studyInfo.studyDate}</span></div>
    <div class="field"><span class="label">Modality: </span><span class="value">${studyInfo.modality}</span></div>
    <div class="field"><span class="label">Description: </span><span class="value">${studyInfo.studyDescription}</span></div>
    <div class="field"><span class="label">Accession: </span><span class="value">${studyInfo.accessionNumber}</span></div>
  </div>`
      : ''
  }

  ${
    viewportImages.length > 0
      ? `
  <div class="section">
    <h2>Images</h2>
    ${imageElements}
  </div>`
      : ''
  }

  ${
    measurements.length > 0
      ? `
  <div class="section">
    <h2>Measurements (${measurements.length})</h2>
    <table>
      <thead>
        <tr><th>Label</th><th>Type</th><th>Value</th><th>Location</th></tr>
      </thead>
      <tbody>${measurementRows}</tbody>
    </table>
  </div>`
      : ''
  }

  <div class="footer">
    <p>Generated by OHIF Viewer on ${generatedAt}</p>
    <p class="disclaimer">For research and educational purposes only. Not for clinical diagnosis.</p>
  </div>
</body>
</html>`;
}

export default exportReportPDF;
export { getMeasurements, captureViewport, generateReportHTML };
