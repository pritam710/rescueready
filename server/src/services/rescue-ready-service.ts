import { randomUUID } from 'node:crypto';

import {
  PUBLIC_SAFETY_DISCLAIMER,
  type Drill,
  type HouseholdProfile,
  type HouseholdUpdate,
  type PreparednessPlan,
  type ReadinessReport,
  type Scenario,
  type SupplyItem,
} from '../domain/models.js';
import { AppError } from '../errors.js';
import type { InMemoryStore } from '../store/in-memory-store.js';
import type { PlanGenerator } from './plan-generator.js';

type Clock = () => Date;
type IdFactory = () => string;

export class RescueReadyService {
  readonly #store: InMemoryStore;
  readonly #planGenerator: PlanGenerator;
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;

  public constructor(
    store: InMemoryStore,
    planGenerator: PlanGenerator,
    options: { clock?: Clock; idFactory?: IdFactory } = {},
  ) {
    this.#store = store;
    this.#planGenerator = planGenerator;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  public getHousehold(householdId: string): HouseholdProfile {
    return this.#store.getHousehold(householdId);
  }

  public updateHousehold(householdId: string, update: HouseholdUpdate): HouseholdProfile {
    return this.#store.updateHousehold(householdId, update, this.#clock().toISOString());
  }

  public checkSupplyReadiness(householdId: string): ReadinessReport {
    const profile = this.#store.getHousehold(householdId);
    const now = this.#clock();
    const assessed = profile.supplies.map((supply) => assessSupply(supply, now));
    const gaps = assessed
      .filter((item) => item.ratio < 1)
      .map(({ supply, effectiveQuantity, ratio }) => ({
        supplyId: supply.id,
        name: supply.name,
        category: supply.category,
        have: effectiveQuantity,
        target: supply.targetQuantity,
        unit: supply.unit,
        shortage: round(Math.max(0, supply.targetQuantity - effectiveQuantity)),
        priority: ratio <= 0.25 ? ('high' as const) : ratio < 0.75 ? ('medium' as const) : ('low' as const),
        reason: effectiveQuantity === 0 && supply.quantity > 0
          ? 'The stored item is expired or expires today.'
          : `${Math.round(ratio * 100)}% of the target amount is available.`,
      }))
      .sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || right.shortage - left.shortage);

    const score = assessed.length === 0
      ? 0
      : Math.round((assessed.reduce((sum, item) => sum + item.ratio, 0) / assessed.length) * 100);

    return {
      householdId,
      checkedAt: now.toISOString(),
      score,
      level: score >= 85 ? 'ready' : score >= 60 ? 'building' : 'needs-attention',
      readyItems: assessed.filter((item) => item.ratio >= 1).length,
      totalItems: assessed.length,
      gaps,
      nextBestActions: gaps.length > 0
        ? gaps.slice(0, 3).map((gap) => `Add ${formatAmount(gap.shortage)} ${gap.unit} of ${gap.name.toLowerCase()}.`)
        : ['Review expiry dates monthly and run a short household drill.'],
      disclaimer: PUBLIC_SAFETY_DISCLAIMER,
    };
  }

  public async generatePreparednessPlan(householdId: string, scenario?: Scenario): Promise<PreparednessPlan> {
    const profile = this.#store.getHousehold(householdId);
    const selectedScenario = scenario ?? profile.hazards[0];
    if (!selectedScenario) {
      throw new AppError(422, 'SCENARIO_REQUIRED', 'Choose a preparedness scenario.');
    }
    const generatedAt = this.#clock().toISOString();
    const plan = await this.#planGenerator.generate({
      profile,
      readiness: this.checkSupplyReadiness(householdId),
      scenario: selectedScenario,
      generatedAt,
      planId: `plan-${this.#idFactory()}`,
    });
    return this.#store.savePlan(plan);
  }

  public getLatestPlan(householdId: string): PreparednessPlan | undefined {
    this.#store.getHousehold(householdId);
    return this.#store.getLatestPlan(householdId);
  }

  public answerCoach(householdId: string, message: string): {
    answer: string;
    source: 'deterministic';
    actions: string[];
    disclaimer: string;
  } {
    const profile = this.#store.getHousehold(householdId);
    const readiness = this.checkSupplyReadiness(householdId);
    const normalized = message.toLowerCase();

    let answer: string;
    let actions: string[];
    if (/\b(fire|smoke|gas leak|intruder|medical emergency)\b.*\b(now|currently|right now|help)\b|\b(active emergency|immediate danger)\b/.test(normalized)) {
      answer = 'If anyone may be in immediate danger, leave for a safe place if you can, contact the appropriate local emergency service, and follow official instructions. Do not wait for RescueReady.';
      actions = ['I am safe—show my plan', 'Review our meeting point'];
    } else if (/\b(suppl|water|food|pack|kit|ready|readiness)\b/.test(normalized)) {
      const actionText = readiness.nextBestActions.slice(0, 2).join(' ');
      answer = `Your recorded supply readiness is ${readiness.score}%. ${actionText}`;
      actions = ['Make a shopping list', 'What can I do in five minutes?'];
    } else if (/\b(drill|practice|evacuat|exit)\b/.test(normalized)) {
      answer = `Start with a calm spoken fire drill: pause and listen, name the safest exit, account for everyone and the pet, then repeat your meeting point—${profile.emergencyMeetingPoint}. Do not create smoke, flame, or alarm anyone unexpectedly.`;
      actions = ['Start the guided drill', 'How do I include my pet?'];
    } else if (/\b(storm|weather|tornado|hurricane|wind)\b/.test(normalized)) {
      answer = 'For severe weather, choose an interior area away from windows, enable official alerts on two devices, and stage shoes, flashlights, water, and a radio nearby.';
      actions = ['Check my supplies', 'Create a severe weather plan'];
    } else if (/\b(pet|cat|dog|animal)\b/.test(normalized)) {
      const petNames = profile.pets.map((pet) => pet.name).join(' and ') || 'your pets';
      answer = `Include ${petNames} in every drill. Keep a carrier or leash easy to reach and add food, water, identification, and any needed medicine to the pet go-kit.`;
      actions = ['Check the pet go-kit', 'Run a family drill'];
    } else {
      answer = `A useful next step is to close the highest-priority supply gap, then practice one short ${profile.hazards[0]?.replaceAll('-', ' ') ?? 'household'} drill. I can check supplies, explain a scenario, or guide a drill.`;
      actions = ['Check my supplies', 'Run a family drill', 'Build my plan'];
    }

    return { answer, source: 'deterministic', actions, disclaimer: PUBLIC_SAFETY_DISCLAIMER };
  }

  public startDrill(householdId: string, scenario: Scenario): Drill {
    const profile = this.#store.getHousehold(householdId);
    const startedAt = this.#clock().toISOString();
    const drill: Drill = {
      id: `drill-${this.#idFactory()}`,
      householdId,
      scenario,
      status: 'active',
      startedAt,
      currentStepIndex: 0,
      steps: drillSteps(scenario, profile.emergencyMeetingPoint),
    };
    return this.#store.saveDrill(drill);
  }

  public getDrill(drillId: string): Drill {
    return this.#store.getDrill(drillId);
  }

  public completeDrillStep(drillId: string, stepId: string): Drill {
    const drill = this.#store.getDrill(drillId);
    const index = drill.steps.findIndex((step) => step.id === stepId);
    if (index < 0) throw new AppError(404, 'DRILL_STEP_NOT_FOUND', `Step "${stepId}" was not found.`);
    if (drill.steps[index]?.completedAt) return drill;
    if (drill.status === 'completed') return drill;
    if (index !== drill.currentStepIndex) {
      throw new AppError(409, 'DRILL_STEP_OUT_OF_ORDER', `Complete step ${drill.currentStepIndex + 1} before this step.`);
    }

    const completedAt = this.#clock().toISOString();
    const steps = drill.steps.map((step, stepIndex) => stepIndex === index ? { ...step, completedAt } : step);
    const done = steps.every((step) => step.completedAt !== undefined);
    const updated: Drill = {
      ...drill,
      steps,
      status: done ? 'completed' : 'active',
      currentStepIndex: done ? steps.length : index + 1,
      ...(done ? { completedAt } : {}),
    };
    return this.#store.saveDrill(updated);
  }
}

function assessSupply(supply: SupplyItem, now: Date): { supply: SupplyItem; effectiveQuantity: number; ratio: number } {
  const expiresAt = supply.expiresOn ? new Date(`${supply.expiresOn}T23:59:59.999Z`) : undefined;
  const effectiveQuantity = expiresAt && expiresAt <= now ? 0 : supply.quantity;
  return {
    supply,
    effectiveQuantity,
    ratio: Math.min(1, effectiveQuantity / supply.targetQuantity),
  };
}

function priorityRank(priority: 'high' | 'medium' | 'low'): number {
  return priority === 'high' ? 0 : priority === 'medium' ? 1 : 2;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function drillSteps(scenario: Scenario, meetingPoint: string): Drill['steps'] {
  const scenarioStep: Record<Scenario, Drill['steps'][number]> = {
    fire: {
      id: 'scenario-action',
      title: 'Move toward the nearest safe exit',
      instruction: 'Say which exit you would use. In a real fire, leave immediately, stay out, and call emergency services from safety.',
      safetyNote: 'This is a spoken simulation. Do not disable alarms or create smoke or flame.',
    },
    earthquake: {
      id: 'scenario-action',
      title: 'Drop, Cover, and Hold On',
      instruction: 'Name the safe cover position you would use and protect your head and neck.',
      safetyNote: 'Do not run outside during shaking.',
    },
    flood: {
      id: 'scenario-action',
      title: 'Choose the higher-ground route',
      instruction: 'Name your safe route and one backup without entering moving or unknown-depth water.',
      safetyNote: 'Never walk, swim, or drive through floodwater.',
    },
    'severe-weather': {
      id: 'scenario-action',
      title: 'Move to the shelter area',
      instruction: 'Name the interior shelter area and the quickest clear route to it.',
      safetyNote: 'Stay away from windows and follow official alerts.',
    },
    'power-outage': {
      id: 'scenario-action',
      title: 'Switch to safe lighting',
      instruction: 'Locate the nearest flashlight and name how you would check the official outage status.',
      safetyNote: 'Avoid candles and never run a generator indoors or near openings.',
    },
  };

  return [
    {
      id: 'pause-and-listen',
      title: 'Pause and listen',
      instruction: 'Everyone says “ready” and listens for the scenario prompt.',
    },
    scenarioStep[scenario],
    {
      id: 'account-for-household',
      title: 'Account for everyone',
      instruction: 'Confirm each person and pet has an assigned helper or check-in.',
    },
    {
      id: 'confirm-meeting-point',
      title: 'Confirm the meeting point',
      instruction: `Repeat the meeting point: ${meetingPoint}.`,
      safetyNote: 'Only travel there in a real event when the route and location are safe.',
    },
    {
      id: 'finish-and-improve',
      title: 'Name one improvement',
      instruction: 'Choose one small change to make before the next drill.',
    },
  ];
}
