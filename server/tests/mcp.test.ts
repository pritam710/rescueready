import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDemoHousehold } from '../src/domain/demo-data.js';
import { createRescueReadyMcpHandler } from '../src/mcp.js';
import { DeterministicPlanGenerator } from '../src/services/plan-generator.js';
import { RescueReadyService } from '../src/services/rescue-ready-service.js';
import { InMemoryStore } from '../src/store/in-memory-store.js';

const fixedNow = new Date('2026-10-04T09:00:00.000Z');

describe('MCP Streamable HTTP endpoint', () => {
  const service = new RescueReadyService(
    new InMemoryStore([createDemoHousehold(fixedNow)]),
    new DeterministicPlanGenerator(),
    { clock: () => fixedNow, idFactory: () => 'mcp-test-id' },
  );
  const handler = createRescueReadyMcpHandler(service);
  const client = new Client(
    { name: 'rescueready-test-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );

  beforeAll(async () => {
    const transport = new StreamableHTTPClientTransport(new URL('http://test.local/mcp'), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
    await handler.close();
  });

  it('advertises the six RescueReady MCP tools', async () => {
    const result = await client.listTools();
    expect(result.tools.map((tool) => tool.name)).toEqual([
      'get_household_profile',
      'update_household_profile',
      'generate_preparedness_plan',
      'check_supply_readiness',
      'start_drill',
      'complete_drill_step',
    ]);
  });

  it('calls readiness over the real Streamable HTTP client transport', async () => {
    const result = await client.callTool({
      name: 'check_supply_readiness',
      arguments: { householdId: 'default-home' },
    });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      readiness: { householdId: 'default-home', score: 59 },
    });
  });
});
