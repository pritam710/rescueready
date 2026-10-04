# RescueReady demo script (2–3 minutes)

## 0:00–0:20 — The problem

“Emergency advice is usually a long generic checklist. RescueReady turns
Alexa+ into a calm coach that adapts preparation to the household before a
crisis happens.”

Open the dashboard. Point out the fictional household and the visible local
activity panel, which traces REST and simulator actions.

## 0:20–0:55 — Make a plan

Ask: **“Help our household prepare for a 48-hour power outage.”**

Show the personalized result returned by the REST API or deterministic fallback.
Highlight that it accounts for a child, a dog, and limited mobility while
keeping instructions short enough for a voice experience. Demonstrate the
corresponding `get_household_profile` and `generate_preparedness_plan` tools
separately with an MCP client during the architecture segment.

## 0:55–1:25 — Find supply gaps

Open the readiness checklist or ask: **“What are we missing?”**

Show the readiness score and the top missing items. Explain that the prototype
uses deterministic rules so judges can reproduce the same result without cloud
credentials. The equivalent MCP tool is `check_supply_readiness`.

## 1:25–2:05 — Practice, do not panic

Start the power-outage drill. Complete two steps in the simulator and show the
progress indicator update. The equivalent MCP tools are `start_drill` and
`complete_drill_step`.

Mention the safety boundary: this is preparation and practice; live emergencies
should go to local emergency services.

## 2:05–2:35 — Architecture and AWS

Show the architecture diagram and `/mcp` endpoint. Demonstrate the MCP server
with MCP Inspector if time permits. If Bedrock has been configured and tested,
show the live adapter and its documented environment setting; otherwise call
it an optional adapter, not a completed cloud deployment.

## 2:35–2:50 — Close

“RescueReady makes preparedness personal, visible, and repeatable—so families
can practice on calm days and act with confidence when plans matter.”
