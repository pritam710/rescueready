# About RescueReady

## Inspiration

Emergency-preparedness guidance is often technically correct but practically
overwhelming. A generic checklist rarely accounts for a child, a pet, mobility
needs, available supplies, or the fact that people learn better through small
rehearsed steps. We wanted to explore a calmer model: an Alexa+ coach that helps
a household prepare before an emergency, then turns the plan into short voice
drills people can actually practice.

## What it does

RescueReady creates a personalized preparedness plan from a fictional household
profile, checks supplies, identifies the most important gaps, and guides the
household through short practice drills. The web simulator shows a local
activity trace of REST and demo actions. The separate `/mcp` endpoint can be
demonstrated with an MCP client; no production Alexa+ integration is claimed.

The prototype deliberately separates preparation from emergency response. It
does not diagnose, dispatch, or replace local authorities. During an active
emergency, users are directed to official local guidance and emergency
services.

## How we built it

The project has two main pieces:

1. A responsive React and TypeScript simulator for the conversational flow,
   readiness dashboard, supply gaps, drills, and simulated activity trace.
2. A self-hosted TypeScript MCP service using Streamable HTTP. Its tools manage
   the demo household, generate plans, calculate readiness, and record drill
   progress.

The default path is deterministic and works without credentials, which makes
judging reproducible. The server also includes an optional Amazon Bedrock
integration path; the final submission will list only AWS services that have
actually been configured and demonstrated.

## Challenges we ran into

Voice experiences need to be brief without becoming vague. Preparedness advice
also has safety implications, so the project must avoid presenting itself as a
live-response authority. We addressed both issues with structured tool outputs,
short prioritized actions, a visible safety boundary, and a transparent
activity log that shows how each answer was produced.

## Accomplishments we are proud of

- A complete Alexa+-style flow that remains testable without gated hardware.
- A real MCP endpoint rather than a purely visual mockup.
- Reproducible readiness scoring and voice-friendly drills.
- Privacy-conscious fictional demo data and clear safety guardrails.
- A UI that makes each simulator/API action and answer source visible to
  judges.

## What we learned

Agent experiences are stronger when tools return small, explicit state changes
instead of large opaque answers. We also learned that a preparedness coach is
most useful when it converts information into practice: a checklist can be
forgotten, but a completed drill builds confidence.

## What is next

Next steps include verified Bedrock personalization, multilingual plan
adaptation, opt-in reminders, richer accessibility modes, and curated regional
templates reviewed against official sources. Any production version would add
authentication, encryption, consent-based retention, and expert review before
handling real household data.
