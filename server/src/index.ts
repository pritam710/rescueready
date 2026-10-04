import 'dotenv/config';

import { createDemoHousehold } from './domain/demo-data.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { BedrockPlanGenerator, DeterministicPlanGenerator } from './services/plan-generator.js';
import { RescueReadyService } from './services/rescue-ready-service.js';
import { InMemoryStore } from './store/in-memory-store.js';

const config = loadConfig();
const fallbackGenerator = new DeterministicPlanGenerator();
const planGenerator = config.aiProvider === 'bedrock'
  ? new BedrockPlanGenerator({
      region: config.awsRegion,
      modelId: config.bedrockModelId,
      strict: config.bedrockStrict,
      fallback: fallbackGenerator,
      onFallback: (error) => console.warn(
        '[rescueready] Bedrock unavailable; used deterministic plan generator.',
        error instanceof Error ? error.message : error,
      ),
    })
  : fallbackGenerator;

const store = new InMemoryStore([createDemoHousehold()]);
const service = new RescueReadyService(store, planGenerator);
const { app, mcpHandler } = createApp(service, config);

const httpServer = app.listen(config.port, config.host, () => {
  console.log(`RescueReady listening at http://${config.host}:${config.port}`);
  console.log(`REST health: http://${config.host}:${config.port}/api/v1/health`);
  console.log(`MCP endpoint: http://${config.host}:${config.port}/mcp`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[rescueready] ${signal} received; shutting down.`);
  await mcpHandler.close();
  httpServer.close((error) => {
    if (error) {
      console.error('[rescueready] Shutdown failed.', error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
