import React from 'react';
import { id } from './id.js';
import PanelAIResults from './panels/PanelAIResults';

/**
 * AI Extension for OHIF Viewer
 *
 * Provides:
 * - Panel for displaying AI inference results with confidence scores
 * - Commands for triggering AI inference
 * - Integration points for external AI services (MONAI, ONNX, custom APIs)
 */
const aiExtension = {
  id,

  getPanelModule({ servicesManager, commandsManager, extensionManager }) {
    return [
      {
        name: 'aiResults',
        iconName: 'AIResults',
        iconLabel: 'AI',
        label: 'AI Analysis',
        component: props => (
          <PanelAIResults
            servicesManager={servicesManager}
            {...props}
          />
        ),
      },
    ];
  },

  getCommandsModule({ servicesManager, commandsManager }) {
    return {
      definitions: {
        runAIInference: {
          commandFn: async ({ endpoint, modelId, studyInstanceUID }) => {
            const { uiNotificationService } = servicesManager.services;

            try {
              uiNotificationService.show({
                title: 'AI Analysis',
                message: 'Starting AI inference...',
                type: 'info',
              });

              // Integration point: call external AI service
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, studyInstanceUID }),
              });

              if (!response.ok) {
                throw new Error(`AI service responded with ${response.status}`);
              }

              const results = await response.json();

              uiNotificationService.show({
                title: 'AI Analysis Complete',
                message: `Found ${results.findings?.length || 0} findings`,
                type: 'success',
              });

              return results;
            } catch (error) {
              uiNotificationService.show({
                title: 'AI Analysis Failed',
                message: error.message,
                type: 'error',
              });
              throw error;
            }
          },
        },
      },
    };
  },
};

export default aiExtension;
export { PanelAIResults };
