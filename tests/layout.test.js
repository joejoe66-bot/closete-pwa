import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const app = readFileSync('src/main.js', 'utf8');

describe('responsive box balance', () => {
  it('uses the same four-column track for stats and clothing cards', () => {
    expect(html).toMatch(/\.stats\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(html).toMatch(/\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(html).not.toMatch(/\.grid\s*\{[^}]*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    expect(html).toMatch(/\.nav\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('switches stats and cards together to two columns on a narrow tablet', () => {
    const narrow = html.slice(html.indexOf('@media (max-width: 900px)'));
    expect(narrow).toMatch(/\.stats,\s*\.grid\s*\{[^}]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  });

  it('gives Edit and Wore it equal columns and lines the gate buttons up', () => {
    expect(html).toMatch(/\.card-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(0,\s*1fr\)/);
    expect(html).toMatch(/\.actions\s*\{[^}]*align-items:\s*stretch/);
    expect(html).toMatch(/\.actions \.primary,\s*\.actions \.pill\s*\{[^}]*margin-top:\s*0/);
    expect(app).toContain('class="card-actions"');
  });

  it('keeps a centered content width and clears the mobile nav', () => {
    expect(html).toMatch(/\.main\s*\{[^}]*align-self:\s*start/);
    expect(html).toMatch(/\.main\s*\{[^}]*width:\s*min\(1120px,\s*100%\)/);
    expect(html).toMatch(/\.main\s*\{[^}]*justify-self:\s*center/);
    expect(html).toMatch(/scroll-padding-bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
    expect(html).toMatch(/padding-bottom:\s*calc\(96px \+ env\(safe-area-inset-bottom\)\)/);
  });
});
