import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { z } from 'zod/v4';

import {
  PUBLIC_SAFETY_DISCLAIMER,
  type HouseholdProfile,
  type PreparednessPlan,
  type ReadinessReport,
  type Scenario,
} from '../domain/models.js';
import { AppError } from '../errors.js';

export interface GeneratePlanInput {
  profile: HouseholdProfile;
  readiness: ReadinessReport;
  scenario: Scenario;
  generatedAt: string;
  planId: string;
}

export interface PlanGenerator {
  generate(input: GeneratePlanInput): Promise<PreparednessPlan>;
}

const scenarioCopy: Record<Scenario, { title: string; summary: string; steps: Array<[string, string, string]> }> = {
  fire: {
    title: 'Home fire readiness plan',
    summary: 'Practice getting everyone outside quickly, meeting at one known point, and calling emergency services from safety.',
    steps: [
      ['Map two exits', 'Identify two usable exits from each sleeping area without blocking hallways.', 'Today'],
      ['Assign support', 'Agree who assists anyone who needs step-by-step guidance and who carries the pet carrier.', 'Today'],
      ['Test alarms', 'Use the alarm test button and replace batteries or the unit if it does not sound.', 'This week'],
      ['Run an exit drill', 'Practice leaving without collecting belongings, then meet at the agreed outdoor point.', 'This week'],
    ],
  },
  earthquake: {
    title: 'Earthquake readiness plan',
    summary: 'Reduce falling hazards, practice Drop, Cover, and Hold On, and prepare to check injuries and utilities after shaking stops.',
    steps: [
      ['Choose safe spots', 'Identify a sturdy table or an interior position away from windows in each regularly used room.', 'Today'],
      ['Secure hazards', 'Move heavy objects lower and anchor unstable furniture using suitable hardware.', 'This week'],
      ['Practice protection', 'Practice Drop, Cover, and Hold On without running outside during shaking.', 'This week'],
      ['Plan after-shock actions', 'Agree how to check injuries, avoid damaged areas, and follow local alerts.', 'This week'],
    ],
  },
  flood: {
    title: 'Flood readiness plan',
    summary: 'Know higher ground, protect essentials, and leave early when local authorities advise evacuation.',
    steps: [
      ['Find higher ground', 'Record a primary and backup route to a safer elevated location.', 'Today'],
      ['Protect essentials', 'Place medicines, documents, and charging equipment in a portable water-resistant container.', 'This week'],
      ['Enable alerts', 'Turn on official local weather and emergency notifications.', 'Today'],
      ['Practice leaving', 'Walk through loading people, the pet, and the go-kit without entering moving water.', 'This week'],
    ],
  },
  'severe-weather': {
    title: 'Severe weather readiness plan',
    summary: 'Pick the safest indoor area, enable official alerts, and keep lighting and communication supplies ready.',
    steps: [
      ['Choose shelter space', 'Select an interior room away from windows and keep its route clear.', 'Today'],
      ['Enable alerts', 'Turn on official local weather notifications on at least two devices.', 'Today'],
      ['Stage supplies', 'Place shoes, flashlights, water, and the radio near the shelter space.', 'This week'],
      ['Practice moving in', 'Time a calm household move to the shelter space with the pet.', 'This week'],
    ],
  },
  'power-outage': {
    title: 'Power outage readiness plan',
    summary: 'Prepare safe lighting, backup communication, and a plan for food, medicines, and temperature needs.',
    steps: [
      ['Stage safe lights', 'Place working flashlights where each member can reach them; avoid candles.', 'Today'],
      ['Prepare communications', 'Charge power banks and write down official outage-reporting information.', 'Today'],
      ['Plan essential needs', 'Review medicine storage and temperature needs with the relevant professional before an outage.', 'This week'],
      ['Protect food', 'Keep refrigerator and freezer doors closed during an outage and follow official food-safety guidance.', 'When needed'],
    ],
  },
};

export class DeterministicPlanGenerator implements PlanGenerator {
  public async generate(input: GeneratePlanInput): Promise<PreparednessPlan> {
    const copy = scenarioCopy[input.scenario];
    const supplyPriorities = input.readiness.gaps.slice(0, 3).map(
      (gap) => `Add ${formatAmount(gap.shortage)} ${gap.unit} of ${gap.name.toLowerCase()}.`,
    );
    const priorities = [
      `Review the ${input.scenario.replaceAll('-', ' ')} plan with every household member.`,
      ...supplyPriorities,
    ].slice(0, 5);

    return {
      id: input.planId,
      householdId: input.profile.id,
      scenario: input.scenario,
      title: copy.title,
      generatedAt: input.generatedAt,
      generationMode: 'mock',
      summary: copy.summary,
      priorities,
      steps: copy.steps.map(([title, detail, timing], index) => ({
        id: `plan-step-${index + 1}`,
        title,
        detail,
        owner: input.profile.members[index % input.profile.members.length]?.name,
        timing,
      })),
      disclaimer: PUBLIC_SAFETY_DISCLAIMER,
    };
  }
}

const bedrockEnhancementSchema = z.object({
  summary: z.string().min(20).max(500),
  priorities: z.array(z.string().min(5).max(180)).min(1).max(5),
});

export interface BedrockGeneratorOptions {
  region: string;
  modelId: string;
  strict: boolean;
  fallback?: PlanGenerator;
  client?: Pick<BedrockRuntimeClient, 'send'>;
  onFallback?: (error: unknown) => void;
}

/**
 * Bedrock only personalizes narrative fields. Safety-critical drill and plan steps
 * stay deterministic and reviewable.
 */
export class BedrockPlanGenerator implements PlanGenerator {
  readonly #client: Pick<BedrockRuntimeClient, 'send'>;
  readonly #modelId: string;
  readonly #strict: boolean;
  readonly #fallback: PlanGenerator;
  readonly #onFallback: ((error: unknown) => void) | undefined;

  public constructor(options: BedrockGeneratorOptions) {
    this.#client = options.client ?? new BedrockRuntimeClient({ region: options.region });
    this.#modelId = options.modelId;
    this.#strict = options.strict;
    this.#fallback = options.fallback ?? new DeterministicPlanGenerator();
    this.#onFallback = options.onFallback;
  }

  public async generate(input: GeneratePlanInput): Promise<PreparednessPlan> {
    const base = await this.#fallback.generate(input);
    try {
      const response = await this.#client.send(
        new ConverseCommand({
          modelId: this.#modelId,
          system: [
            {
              text: 'You write calm, concise household preparedness coaching. Never claim to replace emergency services, never diagnose, and never advise delaying evacuation. Return only valid JSON.',
            },
          ],
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: JSON.stringify({
                    task: 'Personalize the summary and at most five priorities. Keep every item practical and under 180 characters.',
                    output: { summary: 'string', priorities: ['string'] },
                    household: {
                      homeType: input.profile.homeType,
                      region: input.profile.location.region,
                      countryCode: input.profile.location.countryCode,
                      memberCount: input.profile.members.length,
                      petCount: input.profile.pets.length,
                      accessNeeds: input.profile.members.flatMap((member) => member.accessNeeds),
                      hazards: input.profile.hazards,
                    },
                    scenario: input.scenario,
                    readinessScore: input.readiness.score,
                    supplyGaps: input.readiness.gaps.map((gap) => ({
                      name: gap.name,
                      shortage: gap.shortage,
                      unit: gap.unit,
                    })),
                    deterministicDraft: {
                      summary: base.summary,
                      priorities: base.priorities,
                    },
                  }),
                },
              ],
            },
          ],
          inferenceConfig: { maxTokens: 500, temperature: 0.2, topP: 0.9 },
        }),
      );
      const enhanced = parseBedrockEnhancement(response);
      return { ...base, ...enhanced, generationMode: 'bedrock' };
    } catch (error) {
      if (this.#strict) {
        throw new AppError(503, 'BEDROCK_UNAVAILABLE', 'Amazon Bedrock could not generate the plan.', {
          cause: error instanceof Error ? error.message : 'Unknown Bedrock error',
        });
      }
      this.#onFallback?.(error);
      return { ...base, generationMode: 'mock-fallback' };
    }
  }
}

function parseBedrockEnhancement(response: ConverseCommandOutput): z.infer<typeof bedrockEnhancementSchema> {
  const text = response.output?.message?.content?.find((block) => 'text' in block)?.text;
  if (!text) throw new Error('Bedrock returned no text content.');
  const normalized = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  return bedrockEnhancementSchema.parse(JSON.parse(normalized));
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
