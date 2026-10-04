import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDemoHousehold } from '../src/domain/demo-data.js';
import { DeterministicPlanGenerator } from '../src/services/plan-generator.js';
import { RescueReadyService } from '../src/services/rescue-ready-service.js';
import { InMemoryStore } from '../src/store/in-memory-store.js';

const fixedNow = new Date('2026-10-04T09:00:00.000Z');

describe('REST API', () => {
  const service = new RescueReadyService(
    new InMemoryStore([createDemoHousehold(fixedNow)]),
    new DeterministicPlanGenerator(),
    { clock: () => fixedNow, idFactory: () => 'api-test-id' },
  );
  const context = createApp(service, { allowedOrigins: ['http://localhost:5173'] });

  afterAll(async () => context.mcpHandler.close());

  it('reports health', async () => {
    const response = await request(context.app).get('/api/v1/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', mcpEndpoint: '/mcp' });
  });

  it('returns the fictional demo household', async () => {
    const response = await request(context.app).get('/api/v1/household').expect(200);
    expect(response.body.data).toMatchObject({ id: 'default-home', displayName: 'Harbor Household (Demo)' });
  });

  it('generates a plan and exposes it as the latest plan', async () => {
    const generated = await request(context.app)
      .post('/api/v1/plans/generate')
      .send({ scenario: 'power-outage' })
      .expect(201);
    expect(generated.body.data).toMatchObject({ scenario: 'power-outage', generationMode: 'mock' });

    const latest = await request(context.app).get('/api/v1/plans/latest').expect(200);
    expect(latest.body.data.id).toBe(generated.body.data.id);
  });

  it('starts a drill and completes its current step', async () => {
    const started = await request(context.app)
      .post('/api/v1/drills')
      .send({ scenario: 'fire' })
      .expect(201);
    const drill = started.body.data as { id: string; steps: Array<{ id: string }> };

    const advanced = await request(context.app)
      .post(`/api/v1/drills/${drill.id}/steps/${drill.steps[0]!.id}/complete`)
      .send({})
      .expect(200);
    expect(advanced.body.data.currentStepIndex).toBe(1);
  });

  it('supports the simulator evacuation drill request shape', async () => {
    const response = await request(context.app)
      .post('/api/v1/drills')
      .send({ householdId: 'default-home', type: 'evacuation', mode: 'guided' })
      .expect(201);
    expect(response.body.data).toMatchObject({ scenario: 'fire', status: 'active' });
  });

  it('answers simulator coach messages from local household state', async () => {
    const response = await request(context.app)
      .post('/api/v1/coach/chat')
      .send({ householdId: 'default-home', message: 'What supplies should I pack next?' })
      .expect(200);
    expect(response.body.data.answer).toContain('59%');
    expect(response.body.data).toMatchObject({ source: 'deterministic' });
    expect(response.body.data.actions.length).toBeGreaterThan(0);
  });

  it('returns useful validation errors', async () => {
    const response = await request(context.app)
      .post('/api/v1/drills')
      .send({ scenario: 'volcano' })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
