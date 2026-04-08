import { id } from './id.js';
import CollaborationService from './services/CollaborationService';

/**
 * Collaboration Extension for OHIF Viewer
 *
 * Provides real-time collaboration features:
 * - Shared cursor positions across viewports
 * - Collaborative annotations (measurements, markers)
 * - In-context chat with image references
 * - User presence tracking
 * - WebSocket-based communication with auto-reconnect
 */
const collaborationExtension = {
  id,

  preRegistration({ servicesManager }) {
    servicesManager.registerService(CollaborationService.REGISTRATION);
  },

  onModeExit({ servicesManager }) {
    const { collaborationService } = servicesManager.services;
    if (collaborationService) {
      collaborationService.disconnect();
    }
  },

  getCommandsModule({ servicesManager }) {
    return {
      definitions: {
        startCollaboration: {
          commandFn: ({ serverUrl, sessionId, userName }) => {
            const { collaborationService } = servicesManager.services;
            const userId = `user-${Date.now()}`;
            const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];
            const color = colors[Math.floor(Math.random() * colors.length)];

            collaborationService.connect(serverUrl, sessionId, {
              id: userId,
              name: userName || 'Anonymous',
              color,
            });
          },
        },
        stopCollaboration: {
          commandFn: () => {
            const { collaborationService } = servicesManager.services;
            collaborationService.disconnect();
          },
        },
        sendCollaborationMessage: {
          commandFn: ({ text, imageReference }) => {
            const { collaborationService } = servicesManager.services;
            collaborationService.sendChatMessage(text, imageReference);
          },
        },
      },
    };
  },
};

export default collaborationExtension;
export { CollaborationService };
