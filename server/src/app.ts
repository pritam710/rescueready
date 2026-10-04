import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod/v4';

import type { AppConfig } from './config.js';
import { DEFAULT_HOUSEHOLD_ID, householdUpdateSchema, scenarioSchema } from './domain/models.js';
import { AppError, isAppError } from './errors.js';
import { createRescueReadyMcpHandler } from './mcp.js';
import type { RescueReadyService } from './services/rescue-ready-service.js';

const householdIdSchema = z.string().min(1).max(60);

export function createApp(service: RescueReadyService, config: Pick<AppConfig, 'allowedOrigins'>) {
  const app = createMcpExpressApp();
  const mcpHandler = createRescueReadyMcpHandler(service);
  const mcpNodeHandler = toNodeHandler(mcpHandler);

  app.use(cors(config.allowedOrigins));

  app.get(['/api/health', '/api/v1/health'], (_request, response) => {
    response.json({
      status: 'ok',
      service: 'rescueready',
      version: '1.0.0',
      mcpEndpoint: '/mcp',
    });
  });

  app.get('/api/v1/household', (request, response) => {
    const householdId = readHouseholdId(request.query.householdId);
    response.json({ data: service.getHousehold(householdId) });
  });

  app.patch('/api/v1/household', (request, response) => {
    const payload = z.object({
      householdId: householdIdSchema.optional(),
      updates: householdUpdateSchema.optional(),
    }).passthrough().parse(request.body);
    const householdId = payload.householdId ?? DEFAULT_HOUSEHOLD_ID;
    const updateCandidate = payload.updates ?? stripHouseholdId(payload);
    const updates = householdUpdateSchema.parse(updateCandidate);
    response.json({ data: service.updateHousehold(householdId, updates) });
  });

  app.get('/api/v1/readiness', (request, response) => {
    const householdId = readHouseholdId(request.query.householdId);
    response.json({ data: service.checkSupplyReadiness(householdId) });
  });

  app.post('/api/v1/plans/generate', async (request, response) => {
    const payload = z.object({
      householdId: householdIdSchema.default(DEFAULT_HOUSEHOLD_ID),
      scenario: scenarioSchema.optional(),
    }).parse(request.body ?? {});
    const plan = await service.generatePreparednessPlan(payload.householdId, payload.scenario);
    response.status(201).json({ data: plan });
  });

  app.get('/api/v1/plans/latest', (request, response) => {
    const householdId = readHouseholdId(request.query.householdId);
    const plan = service.getLatestPlan(householdId);
    if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'No plan has been generated for this household yet.');
    response.json({ data: plan });
  });

  app.post('/api/v1/coach/chat', (request, response) => {
    const payload = z.object({
      householdId: householdIdSchema.default(DEFAULT_HOUSEHOLD_ID),
      message: z.string().trim().min(1).max(1_000),
    }).parse(request.body);
    response.json({ data: service.answerCoach(payload.householdId, payload.message) });
  });

  app.post('/api/v1/drills', (request, response) => {
    const payload = z.object({
      householdId: householdIdSchema.default(DEFAULT_HOUSEHOLD_ID),
      scenario: scenarioSchema.optional(),
      type: z.enum(['evacuation', ...scenarioSchema.options]).optional(),
      mode: z.literal('guided').optional(),
    }).refine((value) => value.scenario !== undefined || value.type !== undefined, {
      message: 'Provide scenario, or use type "evacuation" for the simulator.',
    }).parse(request.body);
    const scenario = payload.scenario ?? (payload.type === 'evacuation' ? 'fire' : payload.type);
    if (!scenario) throw new AppError(400, 'SCENARIO_REQUIRED', 'Choose a drill scenario.');
    response.status(201).json({ data: service.startDrill(payload.householdId, scenario) });
  });

  app.get('/api/v1/drills/:drillId', (request, response) => {
    const { drillId } = z.object({ drillId: z.string().min(1) }).parse(request.params);
    response.json({ data: service.getDrill(drillId) });
  });

  app.post('/api/v1/drills/:drillId/steps/:stepId/complete', (request, response) => {
    const { drillId, stepId } = z.object({
      drillId: z.string().min(1),
      stepId: z.string().min(1),
    }).parse(request.params);
    response.json({ data: service.completeDrillStep(drillId, stepId) });
  });

  app.all('/mcp', (request, response) => void mcpNodeHandler(request, response, request.body));

  app.use((_request, _response, next) => {
    next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found.'));
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request was not valid.',
          details: error.issues,
        },
      });
      return;
    }
    if (isAppError(error)) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
      return;
    }
    console.error('[rescueready] Unhandled request error', error);
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  return { app, mcpHandler };
}

function readHouseholdId(value: unknown): string {
  return value === undefined ? DEFAULT_HOUSEHOLD_ID : householdIdSchema.parse(value);
}

function stripHouseholdId(payload: Record<string, unknown>): Record<string, unknown> {
  const { householdId: _householdId, updates: _updates, ...rest } = payload;
  return rest;
}

function cors(allowedOrigins: string[]) {
  const configured = new Set(allowedOrigins);
  return (request: Request, response: Response, next: NextFunction): void => {
    const origin = request.header('Origin');
    if (origin && isAllowedOrigin(origin, configured)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
      );
      response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    }
    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin, configured)) {
        response.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed.' } });
      } else {
        response.sendStatus(204);
      }
      return;
    }
    next();
  };
}

function isAllowedOrigin(origin: string, configured: Set<string>): boolean {
  if (configured.has(origin)) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  } catch {
    return false;
  }
}
