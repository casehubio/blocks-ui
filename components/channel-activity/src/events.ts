import type { QhorusMessage, MessageType, ArtefactRef } from './types.js';

export const ChannelEventTopics = {
  SEND_MESSAGE: 'channel:send-message',
  REACT: 'channel:react',
  UNREACT: 'channel:unreact',
  CREATE_CHANNEL: 'channel:create',
  DELETE_CHANNEL: 'channel:delete',
  SELECT_CHANNEL: 'channel:selected',
  MESSAGE_SELECTED: 'channel:message-selected',
  CURSOR_CATCHUP: 'channel:cursor-catchup',
  CURSOR_RELOAD: 'channel:cursor-reload',
} as const;

export interface SendMessagePayload {
  readonly channelId: string;
  readonly content: string;
  readonly topic?: string;
  readonly inReplyTo?: string;
  readonly speechAct?: MessageType;
  readonly artefactRefs?: readonly ArtefactRef[];
}

export interface ReactPayload {
  readonly messageId: string;
  readonly emoji: string;
}

export interface CreateChannelPayload {
  readonly name: string;
  readonly description?: string;
  readonly spaceId?: string;
  readonly semantic?: string;
}

export interface DeleteChannelPayload {
  readonly channelId: string;
}

export interface SelectChannelPayload {
  readonly channelId: string;
}

export interface MessageSelectedPayload {
  readonly message: QhorusMessage;
}

export interface CursorActionPayload {
  readonly channelId: string;
  readonly cursorId?: string;
}
