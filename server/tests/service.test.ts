import { describe, expect, it } from 'vitest';

import { createDemoHousehold } from '../src/domain/demo-data.js';
import { DeterministicPlanGenerator } from '../src/services/plan-generator.js';
import { RescueReadyService } from '../src/services/rescue-ready-service.js';
import { InMemoryStore } from '../src/store/in-memory-store.js';

const fixedNow = new Date('2026-10-04T09:00:00.000Z');

function createService() {
  return new RescueReadyService(
    new InMemoryStore([createDemoHousehold(fixedNow)]),
    new DeterministicPlanGenerator(),
    { clock: () => fixedNow, idFactory: () => 'test-id' },
  );
}

describe('RescueReadyService', () => {
  it('calculates deterministic readiness and prioritizes missing supplies', () => {
    const readiness = createService().checkSupplyReadiness('default-home');

    expect(readiness.score).toBe(59);
    expect(readiness.level).toBe('needs-attention');
    expect(readiness.readyItems).toBe(3);
    expect(readiness.gaps[0]).toMatchObject({ supplyId: 'radio', priority: 'high', shortage: 1 });
    expect(readiness.gaps[1]).toMatchObject({ supplyId: 'pet-kit', priority: 'high', shortage: 1 });
  });

  it('updates only requested household fields', () => {
    const service = createService();
    const original = service.getHousehold('default-home');
    const updated = service.updateHousehold('default-home', { preferredLanguage: 'Hindi' });

    expect(updated.preferredLanguage).toBe('Hindi');
    expect(updated.members).toEqual(original.members);
    expect(service.getHousehold('default-home').preferredLanguage).toBe('Hindi');
  });

  it('generates a safe local plan without external credentials', async () => {
    const plan = await createService().generatePreparednessPlan('default-home', 'fire');

    expect(plan.generationMode).toBe('mock');
    expect(plan.scenario).toBe('fire');
    expect(plan.steps).toHaveLength(4);
    expect(plan.disclaimer).toContain('active emergency');
  });

  it('advances drill steps in order and rejects skipping', () => {
    const service = createService();
    const drill = service.startDrill('default-home', 'severe-weather');

    expect(() => service.completeDrillStep(drill.id, drill.steps[1]!.id)).toThrow(/Complete step 1/);
    const advanced = service.completeDrillStep(drill.id, drill.steps[0]!.id);
    expect(advanced.currentStepIndex).toBe(1);
    expect(advanced.steps[0]?.completedAt).toBe(fixedNow.toISOString());
  });

  it('escalates active-emergency language instead of continuing the demo', () => {
    const reply = createService().answerCoach('default-home', 'There is smoke right now, help');
    expect(reply.answer).toContain('immediate danger');
    expect(reply.answer).toContain('emergency service');
  });
});
