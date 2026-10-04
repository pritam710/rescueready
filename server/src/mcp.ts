import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod/v4';

import {
  DEFAULT_HOUSEHOLD_ID,
  drillSchema,
  householdProfileSchema,
  householdUpdateSchema,
  preparednessPlanSchema,
  readinessReportSchema,
  scenarioSchema,
} from './domain/models.js';
import type { RescueReadyService } from './services/rescue-ready-service.js';

export function createRescueReadyMcpHandler(service: RescueReadyService) {
  return createMcpHandler(() => createRescueReadyMcpServer(service));
}

export function createRescueReadyMcpServer(service: RescueReadyService): McpServer {
  const server = new McpServer({ name: 'rescueready', version: '1.0.0' });

  server.registerTool(
    'get_household_profile',
    {
      title: 'Get household profile',
      description: 'Read the household preparedness profile used to tailor RescueReady guidance. The demo starts with fictional data.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({ householdId: z.string().default(DEFAULT_HOUSEHOLD_ID) }),
      outputSchema: z.object({ profile: householdProfileSchema }),
    },
    async ({ householdId }) => toolResult(
      `Here is the current household profile for ${householdId}.`,
      { profile: service.getHousehold(householdId) },
    ),
  );

  server.registerTool(
    'update_household_profile',
    {
      title: 'Update household profile',
      description: 'Update one or more preparedness profile fields after confirming the requested changes with the household.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({
        householdId: z.string().default(DEFAULT_HOUSEHOLD_ID),
        updates: householdUpdateSchema,
      }),
      outputSchema: z.object({ profile: householdProfileSchema }),
    },
    async ({ householdId, updates }) => toolResult(
      'The household preparedness profile has been updated.',
      { profile: service.updateHousehold(householdId, updates) },
    ),
  );

  server.registerTool(
    'generate_preparedness_plan',
    {
      title: 'Generate preparedness plan',
      description: 'Create a calm, practical household preparedness plan for a selected scenario. This is planning guidance, not live emergency response.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: z.object({
        householdId: z.string().default(DEFAULT_HOUSEHOLD_ID),
        scenario: scenarioSchema.optional(),
      }),
      outputSchema: z.object({ plan: preparednessPlanSchema }),
    },
    async ({ householdId, scenario }) => {
      const plan = await service.generatePreparednessPlan(householdId, scenario);
      return toolResult(`${plan.title} is ready. It has ${plan.steps.length} practical steps.`, { plan });
    },
  );

  server.registerTool(
    'check_supply_readiness',
    {
      title: 'Check supply readiness',
      description: 'Compare recorded household supplies with demo target quantities and suggest the highest-value gaps to close.',
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({ householdId: z.string().default(DEFAULT_HOUSEHOLD_ID) }),
      outputSchema: z.object({ readiness: readinessReportSchema }),
    },
    async ({ householdId }) => {
      const readiness = service.checkSupplyReadiness(householdId);
      return toolResult(
        `Supply readiness is ${readiness.score} percent. ${readiness.nextBestActions[0] ?? 'No urgent supply gap is recorded.'}`,
        { readiness },
      );
    },
  );

  server.registerTool(
    'start_drill',
    {
      title: 'Start a guided household drill',
      description: 'Start a safe spoken simulation for a selected scenario. It never asks the household to create real danger.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      inputSchema: z.object({
        householdId: z.string().default(DEFAULT_HOUSEHOLD_ID),
        scenario: scenarioSchema,
      }),
      outputSchema: z.object({ drill: drillSchema }),
    },
    async ({ householdId, scenario }) => {
      const drill = service.startDrill(householdId, scenario);
      const first = drill.steps[0];
      return toolResult(
        `The ${scenario.replaceAll('-', ' ')} drill has started. First: ${first?.title}. ${first?.instruction}`,
        { drill },
      );
    },
  );

  server.registerTool(
    'complete_drill_step',
    {
      title: 'Complete drill step',
      description: 'Mark the current guided drill step complete and return the next step. Steps must be completed in order.',
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: z.object({ drillId: z.string().min(1), stepId: z.string().min(1) }),
      outputSchema: z.object({ drill: drillSchema }),
    },
    async ({ drillId, stepId }) => {
      const drill = service.completeDrillStep(drillId, stepId);
      const next = drill.steps[drill.currentStepIndex];
      const message = drill.status === 'completed'
        ? 'The drill is complete. Nice work—choose one small improvement before the next practice.'
        : `Step complete. Next: ${next?.title}. ${next?.instruction}`;
      return toolResult(message, { drill });
    },
  );

  return server;
}

function toolResult<T extends Record<string, unknown>>(message: string, structuredContent: T) {
  return {
    content: [{ type: 'text' as const, text: `${message}\n\n${JSON.stringify(structuredContent)}` }],
    structuredContent,
  };
}
