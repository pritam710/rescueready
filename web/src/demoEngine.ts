export type DemoReply = {
  answer: string
  actions?: string[]
  source: string
}

const normalize = (message: string) => message.trim().toLowerCase()

export function getDemoReply(message: string): DemoReply {
  const text = normalize(message)

  if (/storm|weather|rain|flood|warning/.test(text)) {
    return {
      answer:
        "No urgent alerts are active near home right now. For heavy rain, move documents and electronics above floor level, charge both phones, and keep the family meeting point in everyone’s mind. I can turn that into a 10-minute checklist.",
      actions: ['Build a storm checklist', 'Review family meeting point'],
      source: 'Weather + household plan',
    }
  }

  if (/suppl|kit|missing|need|checklist/.test(text)) {
    return {
      answer:
        "Your go-kit is 7 of 10 essentials complete. The highest-impact gaps are a battery radio, two more days of water, and copies of prescriptions. I’d start with water—it raises your 72-hour coverage the most.",
      actions: ['Open supply checklist', 'Make a shopping list'],
      source: 'Household inventory',
    }
  }

  if (/drill|practice|fire|evac/.test(text)) {
    return {
      answer:
        "Let’s keep it calm and simple. I’ll run a three-minute evacuation drill: identify two exits, meet by the mailbox, and check that everyone—including Pepper—is accounted for. No alarms, no surprises.",
      actions: ['Start the guided drill', 'Preview the 3 steps'],
      source: 'Family safety plan',
    }
  }

  if (/child|kid|school|parent|family/.test(text)) {
    return {
      answer:
        "Use one short phrase everyone can remember: ‘Out, meet, text.’ Leave by the safest exit, meet at the mailbox, then text your out-of-area contact. I can make an age-friendly practice card for your family.",
      actions: ['Create a family practice card', 'Review contacts'],
      source: 'Household profile',
    }
  }

  if (/pet|dog|cat|pepper/.test(text)) {
    return {
      answer:
        "Pepper is included in your plan. Keep the carrier by the hall closet, add three days of food and a spare leash to the kit, and place a pet alert sticker near the main entrance.",
      actions: ['Add pet supplies', 'Update pet plan'],
      source: 'Pet readiness guide',
    }
  }

  return {
    answer:
      "You’re in a good place to make one small improvement today. Your household is 68% ready, and finishing the water supply would have the biggest impact. Want the two-minute version or a full plan?",
    actions: ['Give me the 2-minute version', 'Show my readiness plan'],
    source: 'Readiness coach',
  }
}

export function scoreForChecked(checked: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round(32 + (checked / total) * 53)))
}
