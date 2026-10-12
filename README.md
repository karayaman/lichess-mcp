# Lichess MCP

[![smithery badge](https://smithery.ai/badge/@karayaman/lichess-mcp)](https://smithery.ai/server/@karayaman/lichess-mcp)

Speak to Lichess in natural language to interact with the chess platform. Use it with Claude Desktop to play games, analyze positions, and manage your chess activities.

Built using the [Model Context Protocol](https://github.com/modelcontextprotocol).

<a href="https://glama.ai/mcp/servers/x7iuw37s1v">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/x7iuw37s1v/badge" alt="Lichess MCP server" />
</a>

The server enables:

- Managing your Lichess account
- Playing chess games and challenges
- Analyzing positions and games
- Joining tournaments and teams
- Interacting with other players

## Lichess Token

Create a token at https://lichess.org/account/oauth/token. Tick only the scopes you need. Some tools act on your account (sending messages, creating challenges, upgrading to a bot account), and the model reads text other Lichess users wrote. The token's scopes limit what a misled model can do.

Ways to give the server your token, most secure first:

1. **Recommended: keep it in your OS secret store and pass it in at launch.** The token never sits in a plaintext file or in the chat.

   macOS (Keychain). Store it once; the command prompts for the token:

   ```bash
   security add-generic-password -s lichess-mcp -a "$USER" -w
   ```

   Then have your MCP client start the server like this:

   ```json
   "lichess": {
     "command": "/bin/sh",
     "args": ["-c", "LICHESS_TOKEN=\"$(security find-generic-password -s lichess-mcp -w)\" exec lichess-mcp"]
   }
   ```

   Linux (libsecret): store it with `secret-tool store --label="Lichess MCP" service lichess-mcp` and read it with `$(secret-tool lookup service lichess-mcp)` in the same way. A password manager CLI works too, for example `$(op read "op://Private/Lichess/token")` with 1Password.

2. **The `env` block of your MCP client's config.** Simple, but the token sits in plaintext in that config file. Don't share or commit the file.

   ```json
   "lichess": {
     "command": "lichess-mcp",
     "env": { "LICHESS_TOKEN": "your-lichess-api-token" }
   }
   ```

3. **A `.env` file** containing `LICHESS_TOKEN=your-lichess-api-token`. Also plaintext. The server reads `.env` from the directory it starts in, and MCP clients often start it somewhere else, so this suits running from a clone with `npm start`. `.env` is in `.gitignore`; keep it private with `chmod 600 .env`.

4. **Not recommended: the `set_token` tool.** The token passes through the conversation, so it's stored in your chat history and sent to the model provider. If you use it for a quick test, use a short-lived token and revoke it afterwards at https://lichess.org/account/oauth/token.

## Available Tools

### 1. Account Management

```typescript
// Get your Lichess profile
get_my_profile();

// Get another user's profile
get_user_profile({
  username: "player_name",
  trophies: true  // include trophies, optional
});
```

### 2. Game Play

Needs the `challenges` and `board` toolsets (see [Toolsets](#toolsets)).

```typescript
// Create a challenge against another player
create_challenge({
  username: "opponent_username",
  timeControl: "10+0",  // 10 minutes, no increment
  color: "random"       // or "white", "black"
});

// Make a move in a game
make_move({
  gameId: "abcd1234",
  move: "e2e4",
  offeringDraw: false
});

// Get your ongoing games
get_ongoing_games({
  nb: 10  // number of games to fetch
});
```

### 3. Game Analysis

```typescript
// Export a game in PGN format
export_game({
  gameId: "abcd1234",
  clocks: true,
  evals: true
});

// Get cloud evaluation for a position
get_cloud_eval({
  fen: "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
});
```

### 4. Tournaments

Needs the `arena` toolset (see [Toolsets](#toolsets)).

```typescript
// List current tournaments
get_arena_tournaments();

// Join a tournament
join_arena({
  tournamentId: "abc123"
});

// Create a new tournament
create_arena({
  name: "My Tournament",
  clockTime: 3,
  clockIncrement: 2,
  minutes: 45
});
```

### 5. Interactive UIs (Claude Desktop)

These tools open a real chess board inside the chat — drag pieces, navigate
moves, and click through opening trees — using the [MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)
extension. In clients without UI support, each tool falls back to a
text response containing FEN/PGN/Lichess links.

```typescript
// Open today's daily puzzle (or a specific id) as an interactive solver.
play_puzzle({ puzzleId: "Bmfot" });

// Step through a Lichess game or raw PGN with prev/next/play controls.
view_pgn({ gameId: "abcd1234" });
view_pgn({ pgn: "1. e4 e5 2. Nf3 ..." });

// Walk the opening tree: click moves to drill down; toggle masters/lichess.
explore_openings({ source: "masters" });
```

## Toolsets

The server has about 190 tools. Every enabled tool's description is sent to the model at the start of each session, so by default only the core toolsets are on: about 70 tools, a third of the full list's size.

Choose toolsets with `LICHESS_TOOLSETS`, a comma-separated list:

| Value | Enables |
| --- | --- |
| *(unset)* or `core` | `account`, `users`, `relations`, `messaging`, `games`, `opening-explorer`, `tablebase`, `puzzles`, `tv`, `analysis`, `apps` |
| `core,challenges,board` | core, plus challenging players and playing games |
| `all` | every toolset |

The other toolsets are `board`, `bot`, `bulk-pairings`, `engine`, `challenges`, `arena`, `swiss`, `simuls`, `teams`, `studies` and `broadcasts`. A name not on this list stops the server at startup with the valid names.

Set it alongside the token, for example `"env": { "LICHESS_TOOLSETS": "core,arena,swiss" }` in your MCP client's config.

The model can also turn toolsets on mid-session with the `enable_toolset` tool, whose description lists the toolsets that are off, one line each. This needs a client that refreshes its tool list when the server says it changed; otherwise set `LICHESS_TOOLSETS` and restart. Because the model can turn any toolset on, `LICHESS_TOOLSETS` saves context but doesn't restrict what the model can do. Your token's scopes do that (see [Lichess Token](#lichess-token)).

## Chess Notation

### Move Formats

The Lichess API accepts moves in these formats:

- **UCI**: Universal Chess Interface format (e.g., `e2e4`, `g8f6`)
- **SAN**: Standard Algebraic Notation (e.g., `e4`, `Nf6`) - only for some endpoints

### FEN Format

The Forsyth-Edwards Notation (FEN) is used to represent chess positions:

```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
```

This represents:
- Piece positions (from 8th rank to 1st rank)
- Active color (w/b)
- Castling availability (KQkq)
- En passant target square
- Halfmove clock
- Fullmove number

## Error Handling

The server provides detailed error messages for:

- Invalid moves or positions
- Authentication issues
- Rate limits
- Resource not found cases

## Setup Instructions

### Installing via Smithery

To install Lichess Integration for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@karayaman/lichess-mcp):

```bash
npx -y @smithery/cli install @karayaman/lichess-mcp --client claude
```

### Manual Installation
1. Clone the repository:

   ```bash
   git clone https://github.com/karayaman/lichess-mcp.git
   cd lichess-mcp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your token: see [Lichess Token](#lichess-token).

4. Build the project:

   ```bash
   npm run build
   ```

5. Install the package globally (recommended for Claude Desktop integration):
   ```bash
   npm install -g
   ```

6. Start the server (for standalone usage):
   ```bash
   npm start
   ```

## Configuring Claude Desktop

To use this MCP server with Claude Desktop:

1. Locate your Claude Desktop configuration file:

   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add the Lichess MCP server to your configuration:

   ```json
   {
     "mcpServers": {
       "lichess": {
         "command": "/bin/sh",
         "args": ["-c", "LICHESS_TOKEN=\"$(security find-generic-password -s lichess-mcp -w)\" exec lichess-mcp"]
       }
     }
   }
   ```

   This reads the token from the macOS Keychain (see [Lichess Token](#lichess-token) for storing it, and for the other options). To troubleshoot, add `"env": { "DEBUG": "*" }`.

3. (Optional) You can add other MCP servers as well:

   ```json
   {
     "mcpServers": {
       "filesystem": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/server-filesystem",
           "/Users/username/Desktop",
           "/Users/username/Downloads"
         ]
       },
       "lichess": {
         "command": "/bin/sh",
         "args": ["-c", "LICHESS_TOKEN=\"$(security find-generic-password -s lichess-mcp -w)\" exec lichess-mcp"]
       }
     }
   }
   ```

4. Restart Claude Desktop to apply the changes.

   - Make sure to completely close Claude Desktop (including from the system tray/menu bar)
   - Launch Claude Desktop again
   - Look for a hammer icon in the interface, which indicates that MCP servers are connected

5. Test the integration by asking Claude about your Lichess account:
   - "Show me my Lichess profile"
   - "Start a new chess game with 10 minutes time control"

## Troubleshooting

If you encounter issues with the MCP server connection:

1. Ensure you've installed the package globally with `npm install -g`
2. Verify that the `lichess-mcp` command is available in your PATH (`which lichess-mcp`)
3. Check that your configuration file has the correct format (the newer `mcpServers` format instead of `mcp_servers`)
4. Restart Claude Desktop completely
5. Try enabling Developer Mode in Claude Desktop (if available) for additional logging
6. Verify your Lichess API token is valid

## References

- [Model Context Protocol](https://github.com/modelcontextprotocol)
- [Lichess API Documentation](https://lichess.org/api)
