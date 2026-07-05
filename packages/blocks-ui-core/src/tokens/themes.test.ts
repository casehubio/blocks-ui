import { describe, it, expect } from 'vitest';
import { generateThemeCSS, type ThemeConfig } from './themes.js';

const config: ThemeConfig = {
  baseHue: 220,
  accentHue: 250,
  chroma: 0.12,
  contrast: 0.5,
};

describe('generateThemeCSS', () => {
  it('generates light and dark theme classes', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('.blocks-theme-light');
    expect(css).toContain('.blocks-theme-dark');
  });

  it('includes all semantic hue scales', () => {
    const css = generateThemeCSS(config);
    for (const hue of ['accent', 'neutral', 'success', 'warning', 'danger', 'info']) {
      for (let step = 1; step <= 12; step++) {
        expect(css).toContain(`--blocks-${hue}-${step}`);
      }
    }
  });

  it('includes spacing tokens', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('--blocks-space-1');
    expect(css).toContain('--blocks-space-16');
  });

  it('includes typography tokens', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('--blocks-font-family');
    expect(css).toContain('--blocks-font-size-base');
  });

  it('includes elevation tokens', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('--blocks-shadow-1');
    expect(css).toContain('--blocks-surface-1');
  });

  it('includes motion tokens', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('--blocks-duration-fast');
    expect(css).toContain('--blocks-ease-out');
  });

  it('includes density compact variant', () => {
    const css = generateThemeCSS(config);
    expect(css).toContain('.blocks-density-compact');
  });
});
