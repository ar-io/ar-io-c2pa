import { Hono } from 'hono';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiDocs = new Hono();

// Serve the OpenAPI spec as YAML
apiDocs.get('/openapi.yaml', (c) => {
  const specPath = resolve(process.cwd(), 'openapi/openapi.yaml');
  const spec = readFileSync(specPath, 'utf-8');
  return new Response(spec, {
    headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
  });
});

// Serve Swagger UI (loaded from CDN)
apiDocs.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AR.IO C2PA Sidecar — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: window.location.pathname.replace(/\\/$/, '') + '/openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`;
  return c.html(html);
});

export default apiDocs;
