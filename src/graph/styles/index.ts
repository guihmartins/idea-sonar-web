import type { StylesheetJson, Css } from 'cytoscape';
export const graphStyle: StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      shape: (node) => node.data('shape') as Css.NodeShape,
      width: 'data(size)',
      height: 'data(size)',
      'background-color': 'data(color)',
      color: '#203840',
      'font-size': 11,
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
      'line-color': '#728c91',
      'target-arrow-color': '#728c91',
      'arrow-scale': 1,
    },
  },
  {
    selector: ':selected',
    style: {
      'border-width': 3,
      'border-color': '#b06d13',
      'line-color': '#b06d13',
      'target-arrow-color': '#b06d13',
      label: 'data(label)',
    },
  },
  {
    selector: '.neighbor',
    style: { 'border-width': 2, 'border-color': '#b06d13' },
  },
  {
    selector: 'edge[?contested]',
    style: { 'line-color': '#9a525d', 'target-arrow-color': '#9a525d' },
  },
];
