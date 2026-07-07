/**
 * Notification event topics and helper for emitting CustomEvents.
 */

export const NotificationEventTopics = {
  SELECTED: 'notification.selected',
  DISMISSED: 'notification.dismissed',
  MUTED: 'notification.muted',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_DELETED: 'subscription.deleted',
} as const;

/**
 * Emit a pages-event CustomEvent with the given topic and payload.
 * Uses { bubbles: true, composed: true } to cross shadow DOM boundaries.
 *
 * @param target EventTarget to dispatch from
 * @param topic Event topic string
 * @param payload Event payload
 */
export function emitNotificationEvent<T>(
  target: EventTarget,
  topic: string,
  payload: T,
): void {
  target.dispatchEvent(
    new CustomEvent('pages-event', {
      bubbles: true,
      composed: true,
      detail: { topic, payload },
    }),
  );
}
