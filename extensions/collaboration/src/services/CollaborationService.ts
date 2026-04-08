import { PubSubService } from '@ohif/core';

export const EVENTS = {
  USER_JOINED: 'collaboration:userJoined',
  USER_LEFT: 'collaboration:userLeft',
  CURSOR_MOVED: 'collaboration:cursorMoved',
  ANNOTATION_ADDED: 'collaboration:annotationAdded',
  ANNOTATION_UPDATED: 'collaboration:annotationUpdated',
  ANNOTATION_REMOVED: 'collaboration:annotationRemoved',
  CHAT_MESSAGE: 'collaboration:chatMessage',
  CONNECTION_STATUS_CHANGED: 'collaboration:connectionStatusChanged',
};

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  cursorPosition?: { x: number; y: number; viewportId: string };
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  imageReference?: {
    studyInstanceUID: string;
    seriesInstanceUID: string;
    sopInstanceUID: string;
  };
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * CollaborationService manages real-time collaboration state.
 *
 * Provides WebSocket-based communication for:
 * - Shared cursor positions across viewports
 * - Collaborative annotations (measurements, markers)
 * - In-context chat with image references
 * - User presence tracking
 *
 * The service uses a pluggable transport layer - by default WebSocket,
 * but can be adapted for WebRTC or other protocols.
 */
class CollaborationService extends PubSubService {
  private _ws: WebSocket | null = null;
  private _users: Map<string, CollaborationUser> = new Map();
  private _messages: ChatMessage[] = [];
  private _sessionId: string | null = null;
  private _currentUser: CollaborationUser | null = null;
  private _connectionStatus: ConnectionStatus = 'disconnected';
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;

  public static REGISTRATION = {
    name: 'collaborationService',
    altName: 'CollaborationService',
    create: ({ configuration }): CollaborationService => {
      return new CollaborationService(configuration);
    },
  };

  constructor(configuration = {}) {
    super(EVENTS);
  }

  /**
   * Connect to a collaboration session.
   */
  public connect(serverUrl: string, sessionId: string, user: CollaborationUser): void {
    this._sessionId = sessionId;
    this._currentUser = user;
    this._setConnectionStatus('connecting');

    try {
      this._ws = new WebSocket(`${serverUrl}/session/${sessionId}`);

      this._ws.onopen = () => {
        this._reconnectAttempts = 0;
        this._setConnectionStatus('connected');

        // Announce presence
        this._send({
          type: 'join',
          payload: { user },
        });
      };

      this._ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          this._handleMessage(message);
        } catch (err) {
          console.warn('CollaborationService: Invalid message received', err);
        }
      };

      this._ws.onclose = () => {
        this._setConnectionStatus('disconnected');
        this._attemptReconnect(serverUrl, sessionId, user);
      };

      this._ws.onerror = () => {
        this._setConnectionStatus('error');
      };
    } catch (error) {
      console.error('CollaborationService: Connection failed', error);
      this._setConnectionStatus('error');
    }
  }

  /**
   * Disconnect from the current session.
   */
  public disconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this._ws) {
      this._send({ type: 'leave', payload: { userId: this._currentUser?.id } });
      this._ws.close();
      this._ws = null;
    }

    this._users.clear();
    this._messages = [];
    this._sessionId = null;
    this._setConnectionStatus('disconnected');
  }

  /**
   * Broadcast cursor position to other users.
   */
  public sendCursorPosition(x: number, y: number, viewportId: string): void {
    this._send({
      type: 'cursor',
      payload: { x, y, viewportId, userId: this._currentUser?.id },
    });
  }

  /**
   * Send a chat message, optionally referencing a specific image.
   */
  public sendChatMessage(text: string, imageReference?: ChatMessage['imageReference']): void {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: this._currentUser?.id || '',
      userName: this._currentUser?.name || 'Unknown',
      text,
      timestamp: Date.now(),
      imageReference,
    };

    this._messages.push(message);
    this._send({ type: 'chat', payload: message });
    this._broadcastEvent(EVENTS.CHAT_MESSAGE, message);
  }

  /**
   * Broadcast an annotation change to other users.
   */
  public sendAnnotationUpdate(
    action: 'add' | 'update' | 'remove',
    annotation: Record<string, unknown>
  ): void {
    this._send({
      type: `annotation_${action}`,
      payload: { annotation, userId: this._currentUser?.id },
    });
  }

  // Getters
  public get users(): CollaborationUser[] {
    return Array.from(this._users.values());
  }

  public get messages(): ChatMessage[] {
    return [...this._messages];
  }

  public get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  public get sessionId(): string | null {
    return this._sessionId;
  }

  // Private methods
  private _send(data: Record<string, unknown>): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  private _setConnectionStatus(status: ConnectionStatus): void {
    this._connectionStatus = status;
    this._broadcastEvent(EVENTS.CONNECTION_STATUS_CHANGED, { status });
  }

  private _handleMessage(message: { type: string; payload: any }): void {
    const { type, payload } = message;

    switch (type) {
      case 'join': {
        const user = payload.user as CollaborationUser;
        this._users.set(user.id, user);
        this._broadcastEvent(EVENTS.USER_JOINED, user);
        break;
      }
      case 'leave': {
        const userId = payload.userId;
        const user = this._users.get(userId);
        this._users.delete(userId);
        if (user) {
          this._broadcastEvent(EVENTS.USER_LEFT, user);
        }
        break;
      }
      case 'cursor': {
        const { userId, x, y, viewportId } = payload;
        const user = this._users.get(userId);
        if (user) {
          user.cursorPosition = { x, y, viewportId };
          this._broadcastEvent(EVENTS.CURSOR_MOVED, { user, x, y, viewportId });
        }
        break;
      }
      case 'chat': {
        this._messages.push(payload as ChatMessage);
        this._broadcastEvent(EVENTS.CHAT_MESSAGE, payload);
        break;
      }
      case 'annotation_add':
        this._broadcastEvent(EVENTS.ANNOTATION_ADDED, payload);
        break;
      case 'annotation_update':
        this._broadcastEvent(EVENTS.ANNOTATION_UPDATED, payload);
        break;
      case 'annotation_remove':
        this._broadcastEvent(EVENTS.ANNOTATION_REMOVED, payload);
        break;
    }
  }

  private _attemptReconnect(
    serverUrl: string,
    sessionId: string,
    user: CollaborationUser
  ): void {
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      this._setConnectionStatus('error');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
    this._reconnectAttempts++;

    this._reconnectTimer = setTimeout(() => {
      this.connect(serverUrl, sessionId, user);
    }, delay);
  }
}

export default CollaborationService;
