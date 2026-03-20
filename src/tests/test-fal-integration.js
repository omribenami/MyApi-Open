#!/usr/bin/env node

const { buildServiceDefinition, executeServiceMethod } = require('../services/integration-layer');

async function run() {
  const service = {
    id: 999,
    name: 'fal',
    label: 'fal',
    auth_type: 'api_key',
    api_endpoint: 'https://fal.run',
    documentation_url: 'https://fal.ai/models',
  };

  const methods = [
    {
      method_name: 'generate_video',
      http_method: 'POST',
      endpoint: 'unsupported://generate_video',
      parameters: JSON.stringify([{ name: 'prompt', required: true }]),
    },
  ];

  const def = buildServiceDefinition(service, methods);
  const method = def.methods.find((m) => m.methodName === 'generate_video');
  const result = await executeServiceMethod({ serviceDef: def, method, params: { prompt: 'test' } });

  if (result.ok !== false) throw new Error('expected unsupported method to fail');
  if (result.statusCode !== 501) throw new Error(`expected 501, got ${result.statusCode}`);
  if (result.error?.code !== 'METHOD_UNSUPPORTED') throw new Error('unexpected error code');

  console.log('✓ fal unsupported generate_video returns standardized 501');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
