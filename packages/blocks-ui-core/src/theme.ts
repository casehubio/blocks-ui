export interface BlocksTheme {
  readonly fontFamily: string;
  readonly fontSize: string;
  readonly colors: {
    readonly primary: string;
    readonly success: string;
    readonly warning: string;
    readonly error: string;
    readonly neutral: string;
  };
}

export const defaultTheme: BlocksTheme = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  colors: {
    primary: '#2563eb',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    neutral: '#6b7280',
  },
};
