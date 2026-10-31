import { describe, expect, it } from 'vitest';

describe('valores estáticos do estilo do grafo', () => {
  it('preserva regras visuais do Atlas ao carregar os módulos', async () => {
    const [{ graphStyle }, palette] = await Promise.all([
      import('../../src/graph/styles'),
      import('../../src/graph/styles/palette'),
    ]);
    const style = (selector: string) =>
      (
        graphStyle.find((rule) => rule.selector === selector) as
          { style: Record<string, unknown> } | undefined
      )?.style;
    expect(graphStyle.map((rule) => rule.selector)).toEqual([
      'node',
      'edge',
      '.neighbor',
      '.faded',
      'node:selected',
      'edge.selected-edge',
    ]);
    expect(style('node')).toMatchObject({
      label: expect.any(Function),
      shape: 'rectangle',
      width: 'label',
      height: 'label',
      'background-color': '#efebdf',
      color: '#172034',
      'font-family': 'DM Sans Variable, DM Sans, system-ui, sans-serif',
      'text-wrap': 'ellipsis',
      'text-max-width': '180px',
    });
    expect(style('edge')).toMatchObject({
      'curve-style': 'unbundled-bezier',
      'line-color': '#8b8f7f',
      'target-arrow-color': '#8b8f7f',
      'arrow-scale': 0.7,
    });
    expect(style('node:selected')).toMatchObject({
      'border-color': '#2145d8',
      'background-color': '#2145d8',
      color: '#f5f2e9',
    });
    expect(style('.neighbor')).toEqual({ 'border-width': 1.5 });
    expect(style('.faded')).toEqual({ opacity: 0.58 });
    expect(style('edge.selected-edge')).toMatchObject({
      'line-color': '#2145d8',
      'target-arrow-color': '#2145d8',
    });
    expect(palette.highlightColor).toBe('#2145d8');
    expect(palette.labelColor).toBe('#172034');
    expect(palette.nodeFillColor).toBe('#efebdf');
    expect(palette.surfaceColor).toBe('#f5f2e9');
  });
});
