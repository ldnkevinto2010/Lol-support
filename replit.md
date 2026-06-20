# CarryBot

A Discord bot with a ticket system, message-gating, and vouch/review system.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Discord bot (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `MONGODB_URI`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Bot: Discord.js v14
- DB: MongoDB + Mongoose
- API: Express 5
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/api-server/src/bot/` — all bot logic
  - `client.ts` — Discord client setup, event handlers, command router
  - `deploy-commands.ts` — registers slash commands globally via REST
  - `commands/setup.ts` — `/setup` admin config command
  - `commands/ticket.ts` — `/ticket open|close|claim|add`
  - `commands/vouch.ts` — `/vouch give|check|recent`
  - `interactions.ts` — button + modal submit handlers
  - `models/` — Mongoose schemas (GuildConfig, Ticket, Vouch, UserMessageCount)
  - `db.ts` — MongoDB connection

## Architecture decisions

- The bot runs inside the same Express process (api-server artifact) as a background async IIFE.
- Slash commands are deployed globally on every bot startup via Discord REST API.
- Message counts are tracked in MongoDB to enforce per-guild message requirements before ticket creation.
- Vouch prompts are shown in the ticket channel when it closes, but only if someone claimed the ticket.
- Ticket channels use per-channel permission overwrites to restrict visibility.

## Product

- `/setup` — Admins configure ticket category, log channel, vouch channel, support role, and minimum message count.
- `/ticket open [topic]` — Opens a private ticket channel. Gated by message requirement if configured.
- `/ticket close [reason]` — Closes the ticket, logs it, prompts for a vouch if the ticket was claimed.
- `/ticket claim` — Staff-only: claims a ticket (shows up in logs + vouch prompt).
- `/ticket add <user>` — Adds a user to the ticket channel.
- `/vouch give <user> <rating> [comment]` — Posts a star rating to the vouch channel.
- `/vouch check <user>` — Shows total vouches, average rating, and breakdown.
- `/vouch recent <user>` — Shows the 5 most recent vouches for a user.
- Ticket close/claim buttons — in-channel buttons for staff convenience.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Slash commands register globally (not per-guild) — changes take up to 1 hour to propagate on Discord's side. For instant testing, switch to guild-specific command registration in `deploy-commands.ts`.
- `bufferutil` and `utf-8-validate` are listed as external in esbuild — Discord.js uses them optionally for performance but works without them.
- The `MessageContent` intent requires enabling it in the Discord Developer Portal (Bot → Privileged Gateway Intents).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
