import type { Drill, HouseholdProfile, HouseholdUpdate, PreparednessPlan } from '../domain/models.js';
import { AppError } from '../errors.js';

export class InMemoryStore {
  readonly #households = new Map<string, HouseholdProfile>();
  readonly #plans = new Map<string, PreparednessPlan>();
  readonly #drills = new Map<string, Drill>();

  public constructor(seed: HouseholdProfile[]) {
    for (const profile of seed) this.#households.set(profile.id, structuredClone(profile));
  }

  public getHousehold(id: string): HouseholdProfile {
    const profile = this.#households.get(id);
    if (!profile) throw new AppError(404, 'HOUSEHOLD_NOT_FOUND', `Household "${id}" was not found.`);
    return structuredClone(profile);
  }

  public updateHousehold(id: string, update: HouseholdUpdate, updatedAt: string): HouseholdProfile {
    const current = this.getHousehold(id);
    const definedUpdate = Object.fromEntries(
      Object.entries(update).filter((entry) => entry[1] !== undefined),
    ) as Partial<Omit<HouseholdProfile, 'id' | 'updatedAt'>>;
    const next: HouseholdProfile = {
      ...current,
      ...structuredClone(definedUpdate),
      id: current.id,
      updatedAt,
    };
    this.#households.set(id, structuredClone(next));
    return structuredClone(next);
  }

  public savePlan(plan: PreparednessPlan): PreparednessPlan {
    this.#plans.set(plan.id, structuredClone(plan));
    return structuredClone(plan);
  }

  public getLatestPlan(householdId: string): PreparednessPlan | undefined {
    const plans = [...this.#plans.values()]
      .filter((plan) => plan.householdId === householdId)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
    return plans[0] ? structuredClone(plans[0]) : undefined;
  }

  public saveDrill(drill: Drill): Drill {
    this.#drills.set(drill.id, structuredClone(drill));
    return structuredClone(drill);
  }

  public getDrill(id: string): Drill {
    const drill = this.#drills.get(id);
    if (!drill) throw new AppError(404, 'DRILL_NOT_FOUND', `Drill "${id}" was not found.`);
    return structuredClone(drill);
  }
}
