/**
 * REST API client for notification system. Injectable fetch for testing and auth.
 */

import type {
  Notification,
  NotificationPage,
  Subscription,
  SubscriptionPage,
  SubscriptionInput,
  SubscriptionUpdate,
  MuteRule,
  MuteRuleInput,
  Snooze,
  NotificationPreferences,
  NotificationPreferenceUpdate,
  DeliveryChannelDescriptor,
  EventTypeDescriptor,
} from './types.js';

/**
 * API error with status code and message.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Typed REST API client for notification endpoints.
 *
 * Constructor accepts an injectable fetch function for testing and authentication.
 */
export class NotificationApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /**
   * List notifications with optional filters.
   */
  async listNotifications(params: {
    status?: string;
    category?: string;
    cursor?: string;
    limit?: number;
  }): Promise<NotificationPage> {
    const url = this.buildUrl('/notifications', params);
    return this.get<NotificationPage>(url, (data) => {
      if (!Array.isArray((data as Record<string, unknown>).notifications)) {
        throw new ApiError(200, 'Invalid response: notifications must be an array');
      }
      return true;
    });
  }

  /**
   * Get unread notification count.
   */
  async unreadCount(): Promise<number> {
    const url = this.buildUrl('/notifications/unread-count');
    const data = await this.get<{ count: number }>(url, (data) => {
      if (typeof (data as Record<string, unknown>).count !== 'number') {
        throw new ApiError(200, 'Invalid response: count must be a number');
      }
      return true;
    });
    return data.count;
  }

  /**
   * Mark a notification as read.
   */
  async markRead(id: string): Promise<Notification> {
    const url = this.buildUrl(`/notifications/${id}/read`);
    return this.patch<Notification>(url, undefined);
  }

  /**
   * Dismiss a notification.
   */
  async dismiss(id: string): Promise<Notification> {
    const url = this.buildUrl(`/notifications/${id}/dismiss`);
    return this.patch<Notification>(url, undefined);
  }

  /**
   * Mark all notifications as read.
   */
  async markAllRead(): Promise<number> {
    const url = this.buildUrl('/notifications/mark-all-read');
    const data = await this.post<{ count: number }>(url, undefined, (data) => {
      if (typeof (data as Record<string, unknown>).count !== 'number') {
        throw new ApiError(200, 'Invalid response: count must be a number');
      }
      return true;
    });
    return data.count;
  }

  /**
   * List subscriptions with optional filters.
   */
  async listSubscriptions(params?: {
    enabled?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<SubscriptionPage> {
    const url = this.buildUrl('/subscriptions', params || {});
    return this.get<SubscriptionPage>(url, (data) => {
      if (!Array.isArray((data as Record<string, unknown>).subscriptions)) {
        throw new ApiError(200, 'Invalid response: subscriptions must be an array');
      }
      return true;
    });
  }

  /**
   * Create a new subscription.
   */
  async createSubscription(input: SubscriptionInput): Promise<Subscription> {
    const url = this.buildUrl('/subscriptions');
    return this.post<Subscription>(url, input);
  }

  /**
   * Update an existing subscription.
   */
  async updateSubscription(id: string, update: SubscriptionUpdate): Promise<Subscription> {
    const url = this.buildUrl(`/subscriptions/${id}`);
    return this.patch<Subscription>(url, update);
  }

  /**
   * Delete a subscription.
   */
  async deleteSubscription(id: string): Promise<void> {
    const url = this.buildUrl(`/subscriptions/${id}`);
    await this.delete(url);
  }

  /**
   * Enable a subscription.
   */
  async enableSubscription(id: string): Promise<Subscription> {
    const url = this.buildUrl(`/subscriptions/${id}/enable`);
    return this.post<Subscription>(url, undefined);
  }

  /**
   * Disable a subscription.
   */
  async disableSubscription(id: string): Promise<Subscription> {
    const url = this.buildUrl(`/subscriptions/${id}/disable`);
    return this.post<Subscription>(url, undefined);
  }

  /**
   * Get user notification preferences. Returns null if none exist.
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    const url = this.buildUrl('/preferences');
    try {
      return await this.get<NotificationPreferences>(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Update user notification preferences.
   */
  async updatePreferences(update: NotificationPreferenceUpdate): Promise<NotificationPreferences> {
    const url = this.buildUrl('/preferences');
    return this.patch<NotificationPreferences>(url, update);
  }

  /**
   * Add a mute rule.
   */
  async addMuteRule(input: MuteRuleInput): Promise<MuteRule> {
    const url = this.buildUrl('/mutes');
    return this.post<MuteRule>(url, input);
  }

  /**
   * List all mute rules.
   */
  async listMuteRules(): Promise<readonly MuteRule[]> {
    const url = this.buildUrl('/mutes');
    return this.get<MuteRule[]>(url, (data) => {
      if (!Array.isArray(data)) {
        throw new ApiError(200, 'Invalid response: expected array of mute rules');
      }
      return true;
    });
  }

  /**
   * Remove a mute rule.
   */
  async removeMuteRule(id: string): Promise<void> {
    const url = this.buildUrl(`/mutes/${id}`);
    await this.delete(url);
  }

  /**
   * Activate snooze until a specific time.
   */
  async activateSnooze(until: string): Promise<Snooze> {
    const url = this.buildUrl('/snooze');
    return this.post<Snooze>(url, { until });
  }

  /**
   * Get current snooze state. Returns null if not snoozed.
   */
  async getSnooze(): Promise<Snooze | null> {
    const url = this.buildUrl('/snooze');
    try {
      return await this.get<Snooze>(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  /**
   * Cancel active snooze.
   */
  async cancelSnooze(): Promise<void> {
    const url = this.buildUrl('/snooze');
    await this.delete(url);
  }

  /**
   * Get available delivery channels.
   */
  async getChannels(): Promise<readonly DeliveryChannelDescriptor[]> {
    const url = this.buildUrl('/channels');
    return this.get<DeliveryChannelDescriptor[]>(url, (data) => {
      if (!Array.isArray(data)) {
        throw new ApiError(200, 'Invalid response: expected array of channels');
      }
      return true;
    });
  }

  async getEventTypes(): Promise<readonly EventTypeDescriptor[]> {
    const url = this.buildUrl('/subscriptions/event-types');
    return this.get<EventTypeDescriptor[]>(url, (data) => {
      if (!Array.isArray(data)) {
        throw new ApiError(200, 'Invalid response: expected array of event types');
      }
      return true;
    });
  }

  // Helper methods

  private buildUrl(path: string, params: Record<string, unknown> = {}): string {
    if (this.baseUrl == null) {
      throw new Error('baseUrl is required');
    }
    const base = this.baseUrl === '' ? window.location.origin : this.baseUrl;
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async get<T>(
    url: string,
    validate?: (data: unknown) => boolean,
  ): Promise<T> {
    const response = await this.fetchFn(url);
    return this.handleResponse<T>(response, validate);
  }

  private async post<T>(
    url: string,
    body: unknown,
    validate?: (data: unknown) => boolean,
  ): Promise<T> {
    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    return this.handleResponse<T>(response, validate);
  }

  private async patch<T>(
    url: string,
    body: unknown,
    validate?: (data: unknown) => boolean,
  ): Promise<T> {
    const response = await this.fetchFn(url, {
      method: 'PATCH',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : null,
    });
    return this.handleResponse<T>(response, validate);
  }

  private async delete(url: string): Promise<void> {
    const response = await this.fetchFn(url, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw await this.buildError(response);
    }
  }

  private async handleResponse<T>(
    response: Response,
    validate?: (data: unknown) => boolean,
  ): Promise<T> {
    if (!response.ok) {
      throw await this.buildError(response);
    }
    const data = await response.json();
    if (validate && !validate(data)) {
      throw new ApiError(response.status, 'Response validation failed');
    }
    return data as T;
  }

  private async buildError(response: Response): Promise<ApiError> {
    let message = response.statusText;
    try {
      const body = await response.json();
      if (body.message) {
        message = body.message;
      } else if (body.error) {
        message = body.error;
      }
    } catch {
      // Ignore JSON parse errors
    }
    return new ApiError(response.status, message);
  }
}
