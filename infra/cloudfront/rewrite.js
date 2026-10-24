// CloudFront Function (viewer-request). Associar ao comportamento padrão, não à API externa.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (/^\/(map|login|callback|access-denied|nodes|relations|sources|contexts|views|imports|pending|export)\/?$/.test(uri) ||
      /^\/(imports\/[A-Za-z0-9_-]+|edit\/(nodes|relations|sources|contexts)(\/[A-Za-z0-9_-]+)?|history\/(nodes|relations)\/[A-Za-z0-9_-]+)\/?$/.test(uri) || uri === '/') {
    request.uri = '/index.html';
  }
  return request;
}
