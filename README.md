# Lichess MCP

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

## Configuration

The Lichess API token can be set in two ways:

1. Environment variables: Add it to your `.env` file in the project root or set it directly:

   ```bash
   LICHESS_TOKEN=your-lichess-api-token
   ```

2. Using the `set_token` tool during runtime:

   ```typescript
   set_token({
     token: "your-lichess-api-token"
   });
   ```

The token can be generated at https://lichess.org/account/oauth/token

## Available Tools

### 1. Account Management

```typescript
// Set your Lichess API token
set_token({
  token: "your-lichess-api-token"
});

// Get your Lichess profile
get_my_profile();

// Get another user's profile
get_user_profile({
  username: "player_name",
  trophies: true  // include trophies, optional
});
```

### 2. Game Play

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

1. Clone the repository:

   ```bash
   git clone https://github.com/karayaman/lichess-mcp.git
   cd lichess-mcp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:

   ```bash
   LICHESS_TOKEN=your-lichess-api-token
   ```

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
         "command": "lichess-mcp",
         "env": {
           "LICHESS_TOKEN": "your-lichess-api-token",
           "DEBUG": "*"
         }
       }
     }
   }
   ```

   Note: Replace `your-lichess-api-token` with your actual Lichess API token. The `DEBUG` environment variable is optional but helpful for troubleshooting.

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
         "command": "lichess-mcp",
         "env": {
           "LICHESS_TOKEN": "your-lichess-api-token"
         }
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