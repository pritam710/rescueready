import { z } from 'zod/v4';

export const DEFAULT_HOUSEHOLD_ID = 'default-home';

export const scenarioSchema = z.enum([
  'fire',
  'earthquake',
  'flood',
  'severe-weather',
  'power-outage',
]);

export const supplyCategorySchema = z.enum([
  'water',
  'food',
  'light',
  'medical',
  'communication',
  'documents',
  'pet-care',
]);

export const householdMemberSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(80),
  ageGroup: z.enum(['child', 'adult', 'older-adult']),
  accessNeeds: z.array(z.string().min(1).max(160)).max(10).default([]),
});

export const petSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(80),
  species: z.string().min(1).max(80),
});

export const supplyItemSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().min(1).max(100),
  category: supplyCategorySchema,
  quantity: z.number().nonnegative().finite(),
  targetQuantity: z.number().positive().finite(),
  unit: z.string().min(1).max(40),
  expiresOn: z.iso.date().optional(),
});

export const householdProfileSchema = z.object({
  id: z.string().min(1).max(60),
  displayName: z.string().min(1).max(100),
  location: z.object({
    city: z.string().min(1).max(100),
    region: z.string().min(1).max(100),
    countryCode: z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter uppercase country code.'),
  }),
  homeType: z.enum(['apartment', 'detached-home', 'townhouse', 'other']),
  preferredLanguage: z.string().min(2).max(40),
  members: z.array(householdMemberSchema).min(1).max(20),
  pets: z.array(petSchema).max(20),
  hazards: z.array(scenarioSchema).min(1).max(5),
  emergencyMeetingPoint: z.string().min(1).max(200),
  supplies: z.array(supplyItemSchema).max(100),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const householdUpdateSchema = householdProfileSchema
  .omit({ id: true, updatedAt: true })
  .partial()
  .refine((update) => Object.keys(update).length > 0, {
    message: 'Provide at least one household field to update.',
  });

export const readinessGapSchema = z.object({
  supplyId: z.string(),
  name: z.string(),
  category: supplyCategorySchema,
  have: z.number(),
  target: z.number(),
  unit: z.string(),
  shortage: z.number(),
  priority: z.enum(['high', 'medium', 'low']),
  reason: z.string(),
});

export const readinessReportSchema = z.object({
  householdId: z.string(),
  checkedAt: z.iso.datetime({ offset: true }),
  score: z.number().int().min(0).max(100),
  level: z.enum(['needs-attention', 'building', 'ready']),
  readyItems: z.number().int().nonnegative(),
  totalItems: z.number().int().nonnegative(),
  gaps: z.array(readinessGapSchema),
  nextBestActions: z.array(z.string()),
  disclaimer: z.string(),
});

export const planStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  owner: z.string().optional(),
  timing: z.string(),
});

export const preparednessPlanSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  scenario: scenarioSchema,
  title: z.string(),
  generatedAt: z.iso.datetime({ offset: true }),
  generationMode: z.enum(['mock', 'bedrock', 'mock-fallback']),
  summary: z.string(),
  priorities: z.array(z.string()).min(1).max(8),
  steps: z.array(planStepSchema).min(1).max(20),
  disclaimer: z.string(),
});

export const drillStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  instruction: z.string(),
  safetyNote: z.string().optional(),
  completedAt: z.iso.datetime({ offset: true }).optional(),
});

export const drillSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  scenario: scenarioSchema,
  status: z.enum(['active', 'completed']),
  startedAt: z.iso.datetime({ offset: true }),
  completedAt: z.iso.datetime({ offset: true }).optional(),
  currentStepIndex: z.number().int().nonnegative(),
  steps: z.array(drillStepSchema).min(1),
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type HouseholdProfile = z.infer<typeof householdProfileSchema>;
export type HouseholdUpdate = z.infer<typeof householdUpdateSchema>;
export type SupplyItem = z.infer<typeof supplyItemSchema>;
export type ReadinessReport = z.infer<typeof readinessReportSchema>;
export type PreparednessPlan = z.infer<typeof preparednessPlanSchema>;
export type Drill = z.infer<typeof drillSchema>;

export const PUBLIC_SAFETY_DISCLAIMER =
  'Preparedness guidance only. For an active emergency, follow local authorities and contact the appropriate emergency service. Never delay evacuation to use RescueReady.';
