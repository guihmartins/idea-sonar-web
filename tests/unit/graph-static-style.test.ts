import { describe, expect, it } from 'vitest';

describe('valores estáticos do estilo do grafo', () => {
  it('preserva regras visuais e cores ao carregar os módulos', async () => {
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
      ':selected',
      '.neighbor',
      'edge[?contested]',
    ]);
    expect(style('node')).toMatchObject({
      label: 'data(label)',
      width: 'data(size)',
      height: 'data(size)',
      'background-color': 'data(color)',
      color: '#dfe5d8',
      'font-family': 'IBM Plex Mono',
      'text-wrap': 'ellipsis',
      'text-max-width': '130px',
    });
    expect(style('edge')).toMatchObject({
      width: 'data(width)',
      'curve-style': 'bezier',
      'line-color': '#6d7a64',
      'target-arrow-color': '#6d7a64',
    });
    expect(style(':selected')).toEqual({
      'border-width': 3,
      'border-color': '#e76732',
      'line-color': '#e76732',
      'target-arrow-color': '#e76732',
      label: 'data(label)',
    });
    expect(style('.neighbor')).toEqual({
      'border-width': 1,
      'border-color': '#c3cabc',
    });
    expect(style('edge[?contested]')).toEqual({
      'line-color': '#f08a9b',
      'target-arrow-color': '#f08a9b',
    });
    expect(palette.contextColors).toEqual([
      '#b9d99b',
      '#f0a074',
      '#8fb8e8',
      '#b8a4e0',
    ]);
    expect(palette.neutralColor).toBe('#7b8772');
    expect(palette.highlightColor).toBe('#e76732');
    expect(palette.neighborColor).toBe('#c3cabc');
    expect(palette.contestedColor).toBe('#f08a9b');
  });
});
