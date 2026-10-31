import { describe, expect, it } from 'vitest';
import { graphStyle } from '../../src/graph/styles';
import {
  contestedColor,
  contextColors,
  edgeColor,
  highlightColor,
  labelColor,
  neighborColor,
  neutralColor,
} from '../../src/graph/styles/palette';
import type { Css } from 'cytoscape';

function rule(selector: string): { style: Record<string, unknown> } {
  const found = graphStyle.find((r) => r.selector === selector);
  if (!found) throw new Error(`regra ${selector} não encontrada`);
  return found as unknown as { style: Record<string, unknown> };
}
function fakeElement(data: Record<string, unknown>) {
  return { data: (key: string) => data[key] };
}

describe('graphStyle', () => {
  it('resolve o formato do nó a partir dos dados do elemento', () => {
    const style = rule('node').style as unknown as {
      shape: (ele: unknown) => Css.NodeShape;
    };
    expect(style.shape(fakeElement({ shape: 'hexagon' }))).toBe('hexagon');
  });

  it('resolve estilo e seta da aresta a partir dos dados do elemento', () => {
    const style = rule('edge').style as unknown as {
      'line-style': (ele: unknown) => string;
      'target-arrow-shape': (ele: unknown) => string;
    };
    expect(style['line-style'](fakeElement({ line: 'dashed' }))).toBe('dashed');
    expect(
      style['target-arrow-shape'](fakeElement({ arrow: 'triangle' })),
    ).toBe('triangle');
  });

  it('define regras de seleção, vizinhança e contestação', () => {
    expect(rule(':selected').style).toEqual({
      'border-width': 3,
      'border-color': highlightColor,
      'line-color': highlightColor,
      'target-arrow-color': highlightColor,
      label: 'data(label)',
    });
    expect(rule('.neighbor').style).toEqual({
      'border-width': 1,
      'border-color': neighborColor,
    });
    expect(rule('edge[?contested]').style).toEqual({
      'line-color': contestedColor,
      'target-arrow-color': contestedColor,
    });
  });

  it('mantém regras, propriedades e paleta completas', () => {
    expect(graphStyle.map(({ selector }) => selector)).toEqual([
      'node',
      'edge',
      ':selected',
      '.neighbor',
      'edge[?contested]',
    ]);
    expect(rule('node').style).toMatchObject({
      label: 'data(label)',
      width: 'data(size)',
      height: 'data(size)',
      'background-color': 'data(color)',
      color: labelColor,
      'font-family': 'IBM Plex Mono',
      'font-size': 10,
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'text-wrap': 'ellipsis',
      'text-max-width': '130px',
      'min-zoomed-font-size': 9,
    });
    expect(rule('edge').style).toMatchObject({
      width: 'data(width)',
      'curve-style': 'bezier',
      'control-point-step-size': 50,
      'line-color': edgeColor,
      'target-arrow-color': edgeColor,
      'arrow-scale': 1,
    });
    expect(contextColors).toEqual(['#b9d99b', '#f0a074', '#8fb8e8', '#b8a4e0']);
    expect(neutralColor).toBe('#7b8772');
  });
});
