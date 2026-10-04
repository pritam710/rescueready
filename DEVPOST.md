# Devpost entry — working copy

## Project name

RescueReady

## Elevator pitch

RescueReady prototypes a calm Alexa+ household preparedness coach that builds
personalized emergency plans, tracks supplies, runs voice drills, and guides
families step by step.

## Primary track

Alexa+

## Mini challenge

AWS Builder — select **Yes only after the Bedrock integration has been run,
documented, and shown in the demo**.

## Submitter type

Individual

## Submitter country of residence

India

## Built with

TypeScript, React, Vite, Node.js, Model Context Protocol, Streamable HTTP,
Express, Zod, Vitest, Amazon Bedrock (optional adapter), Amazon Nova (optional)

## About the project

Use the polished story in [`docs/devpost-story.md`](docs/devpost-story.md) after
final technical verification.

## Links still required

- GitHub repository: https://github.com/pritam710/rescueready
- Live demo or testing link: **[ADD URL IF DEPLOYED]**
- Public YouTube/Vimeo demo: **[ADD VIDEO URL]**

## Additional information still requiring the entrant

- Country of residence: `India`
- Canadian province: `N/A` unless applicable
- Organization: `N/A` unless applicable
- New or existing project: confirm based on actual project history
- Eligibility attestations: user must review personally
- Developer-tool feedback and friction log: answer from actual build experience

## AWS Builder integration draft

RescueReady includes an optional server-side Amazon Bedrock Converse adapter for
plan personalization with Amazon Nova. The application keeps a deterministic
local generator as a reproducible fallback and never exposes AWS credentials to
the browser. **Before submitting this paragraph, configure Bedrock, verify a
real call, record the service/model/region used, and show the result in the
demo.**
