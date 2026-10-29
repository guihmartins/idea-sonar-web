import type { StylesheetJson, Css } from 'cytoscape';
import {
  contestedColor,
  edgeColor,
  highlightColor,
  neighborColor,
  labelColor,
} from './palette';
export const graphStyle: StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      shape: (node) => node.data('shape') as Css.NodeShape,
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
    },
  },
  {
    selector: 'edge',
    style: {
      width: 'data(width)',
      'line-style': (edge) => edge.data('line') as Css.LineStyle,
      'target-arrow-shape': (edge) => edge.data('arrow') as Css.ArrowShape,
      'curve-style': 'bezier',
      'control-point-step-size': 50,
      'line-color': edgeColor,
      'target-arrow-color': edgeColor,
      'arrow-scale': 1,
    },
  },
  {
    selector: ':selected',
    style: {
      'border-width': 3,
      'border-color': highlightColor,
      'line-color': highlightColor,
      'target-arrow-color': highlightColor,
      label: 'data(label)',
    },
  },
  {
    selector: '.neighbor',
    style: { 'border-width': 1, 'border-color': neighborColor },
  },
  {
    selector: 'edge[?contested]',
    style: {
      'line-color': contestedColor,
      'target-arrow-color': contestedColor,
    },
  },
];
