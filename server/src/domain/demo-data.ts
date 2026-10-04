import {
  DEFAULT_HOUSEHOLD_ID,
  householdProfileSchema,
  type HouseholdProfile,
} from './models.js';

/**
 * All names and places in this seed are fictional and exist only for the demo.
 */
export function createDemoHousehold(now = new Date()): HouseholdProfile {
  return householdProfileSchema.parse({
    id: DEFAULT_HOUSEHOLD_ID,
    displayName: 'Harbor Household (Demo)',
    location: {
      city: 'Demo City',
      region: 'Coastal State',
      countryCode: 'US',
    },
    homeType: 'apartment',
    preferredLanguage: 'English',
    members: [
      {
        id: 'member-nova',
        name: 'Nova',
        role: 'Household coordinator',
        ageGroup: 'adult',
        accessNeeds: [],
      },
      {
        id: 'member-sam',
        name: 'Sam',
        role: 'Household member',
        ageGroup: 'older-adult',
        accessNeeds: ['Benefits from large-text, one-step-at-a-time instructions'],
      },
    ],
    pets: [{ id: 'pet-pixel', name: 'Pixel', species: 'cat' }],
    hazards: ['fire', 'severe-weather', 'power-outage'],
    emergencyMeetingPoint: 'Community library entrance (fictional demo location)',
    supplies: [
      {
        id: 'water',
        name: 'Drinking water',
        category: 'water',
        quantity: 9,
        targetQuantity: 12,
        unit: 'litres',
      },
      {
        id: 'food',
        name: 'Shelf-stable meals',
        category: 'food',
        quantity: 8,
        targetQuantity: 12,
        unit: 'meals',
      },
      {
        id: 'flashlight',
        name: 'Flashlights',
        category: 'light',
        quantity: 2,
        targetQuantity: 2,
        unit: 'lights',
      },
      {
        id: 'batteries',
        name: 'Spare battery sets',
        category: 'light',
        quantity: 1,
        targetQuantity: 3,
        unit: 'sets',
      },
      {
        id: 'first-aid',
        name: 'First-aid kit',
        category: 'medical',
        quantity: 1,
        targetQuantity: 1,
        unit: 'kit',
      },
      {
        id: 'radio',
        name: 'Battery radio',
        category: 'communication',
        quantity: 0,
        targetQuantity: 1,
        unit: 'radio',
      },
      {
        id: 'documents',
        name: 'Protected document copies',
        category: 'documents',
        quantity: 1,
        targetQuantity: 1,
        unit: 'set',
      },
      {
        id: 'pet-kit',
        name: 'Pet go-kit',
        category: 'pet-care',
        quantity: 0,
        targetQuantity: 1,
        unit: 'kit',
      },
    ],
    updatedAt: now.toISOString(),
  });
}
