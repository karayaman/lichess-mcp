Prototype: Lichess → Claude game analysis

What this does
- Connects to Lichess account event stream using a personal/bot OAuth token
- When a `gameFull` event arrives, it extracts the moves and sends them to Claude for a concise analysis
- Saves each analysis to tools/lichess-claude/analyses/<gameId>.txt

Setup
1. Node 18+ installed
2. Create a Lichess OAuth token: https://lichess.org/account/oauth/token (scopes: board:read or all)
3. Get an Anthropic/Claude API key
4. Copy .env.example to .env and fill values

Run
cd tools/lichess-claude
npm start

Notes & safety
- This prototype is for analysis/commentary only. Do NOT use it to automate playing in prize games or to cheat. Respect Lichess terms of service.
- The Claude API URL and request body may need adjustment depending on your Anthropic API contract/version.
