# RescueReady server

RescueReady is a local-first household preparedness coach built for an Alexa+ simulated experience. This service exposes the same domain actions through:

- an official Model Context Protocol (MCP) **Streamable HTTP** endpoint at `http://127.0.0.1:8787/mcp`; and
- a versioned REST API under `http://127.0.0.1:8787/api/v1` for the included browser simulator.

The default mode is deterministic, works offline after dependencies are installed, and requires no cloud account. Every seeded name and location is fictional demo data.

> RescueReady provides preparedness guidance only. For an active emergency, follow local authorities and contact the appropriate emergency service. Never delay evacuation to use this demo.

## Requirements

- Node.js 20.19 or newer
- npm 10 or newer

## Run locally

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

On macOS or Linux, replace `copy` with `cp`. The service starts on `127.0.0.1:8787`, matching the simulator's development proxy.

Production-style build:

```bash
npm run build
npm start
```

Verification:

```bash
npm run typecheck
npm test
```

## REST API

All domain responses use `{ "data": ... }`. Errors use `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Health and endpoint discovery |
| GET | `/api/v1/household` | Read the demo household; optional `?householdId=` |
| PATCH | `/api/v1/household` | Update profile fields |
| GET | `/api/v1/readiness` | Calculate supply readiness |
| POST | `/api/v1/plans/generate` | Generate a scenario plan |
| GET | `/api/v1/plans/latest` | Read the latest generated plan |
| POST | `/api/v1/coach/chat` | Return a safe deterministic coaching reply |
| POST | `/api/v1/drills` | Start a spoken drill |
| GET | `/api/v1/drills/:drillId` | Read drill state |
| POST | `/api/v1/drills/:drillId/steps/:stepId/complete` | Complete the current drill step |

Examples:

```bash
curl http://127.0.0.1:8787/api/v1/readiness

curl -X POST http://127.0.0.1:8787/api/v1/plans/generate \
  -H "Content-Type: application/json" \
  -d '{"scenario":"fire"}'

curl -X POST http://127.0.0.1:8787/api/v1/drills \
  -H "Content-Type: application/json" \
  -d '{"scenario":"severe-weather"}'
```

Supported scenarios are `fire`, `earthquake`, `flood`, `severe-weather`, and `power-outage`. `householdId` defaults to `default-home`.

The browser simulator may also start its home-evacuation experience with `{"type":"evacuation","mode":"guided"}`; the API maps that compatibility shape to the safe spoken `fire` drill. The chat endpoint is local and deterministic in default mode, and returns `{ "data": { "answer", "actions", "source", "disclaimer" } }`.

## MCP endpoint

The `/mcp` route is built with the current official TypeScript SDK v2 `createMcpHandler` factory and mounted through its Node/Express adapter. It is stateless and creates a fresh `McpServer` for every request, as required by the current Streamable HTTP server guidance.

It exposes six tools:

1. `get_household_profile`
2. `update_household_profile`
3. `generate_preparedness_plan`
4. `check_supply_readiness`
5. `start_drill`
6. `complete_drill_step`

List tools with a raw MCP request:

```bash
curl -s -X POST http://127.0.0.1:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

The MCP integration test uses the official `Client` and `StreamableHTTPClientTransport`, not a mocked protocol layer.

## Optional Amazon Bedrock mode

The local generator is the default:

```dotenv
AI_PROVIDER=mock
```

To demonstrate AWS integration, configure normal AWS SDK credentials in your environment and set:

```dotenv
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_STRICT=false
```

The service uses the Bedrock Runtime `Converse` API. It sends only coarse preparedness context—not member names or the meeting-point text—and Bedrock may personalize only the plan summary and priorities. Safety-critical plan steps and all drill steps stay deterministic. With `BEDROCK_STRICT=false`, missing credentials, model access, or a transient Bedrock failure safely falls back to local generation and marks the result `mock-fallback`.

No AWS credentials belong in `.env` or source control. Use an AWS profile, role, workload identity, or the standard AWS SDK credential chain.

## Design and safety notes

- State is intentionally in memory for a judge-friendly demo and resets when the process restarts.
- Supply targets are illustrative demo values, not location-specific official recommendations.
- Drill steps are sequential and idempotent; the simulator cannot silently skip a step.
- CORS permits configured origins plus loopback development origins.
- The MCP Express app includes the official localhost Host/Origin checks to reduce DNS-rebinding risk.
- The API never seeds real names, addresses, phone numbers, or other personal records.

For production, replace `InMemoryStore` with durable per-user storage, add authenticated household ownership, configure explicit public hosts/origins, and complete a local emergency-management review.

## References

- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Official Streamable HTTP server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
- [Official Express integration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/express.md)
- [Official server testing guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/testing.md)
