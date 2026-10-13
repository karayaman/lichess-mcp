import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const LICHESS_TOKEN = process.env.LICHESS_TOKEN;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_API_URL = process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/complete';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-2.1';

if (!LICHESS_TOKEN) {
  console.error('Missing LICHESS_TOKEN in environment. Create a bot/token at https://lichess.org/account/oauth/token');
  process.exit(1);
}
if (!CLAUDE_API_KEY) {
  console.error('Missing CLAUDE_API_KEY in environment. Set your Anthropic API key.');
  process.exit(1);
}

const analysesDir = path.resolve('./tools/lichess-claude/analyses');
if (!fs.existsSync(analysesDir)) fs.mkdirSync(analysesDir, { recursive: true });

async function fetchClaude(prompt) {
  try {
    const res = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        prompt,
        max_tokens: 1000
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Claude API error ${res.status}: ${txt}`);
    }
    const data = await res.json();
    // Anthropic responses vary by API; look for common fields
    return data.completion || data.output || data.result || JSON.stringify(data);
  } catch (err) {
    console.error('Error calling Claude:', err.message);
    return null;
  }
}

async function analyzeGame(gameId, moves, white, black) {
  const prompt = `You are an expert chess coach. Analyze this finished game and provide:\n1) Short summary (1-2 sentences)\n2) Key mistakes/blunders with move numbers and brief explanation\n3) Three practical improvement tips for the losing side.\n\nGame ID: ${gameId}\nPlayers: ${white} vs ${black}\nMoves (space-separated SAN/UCI):\n${moves}\n\nKeep the answer concise and numbered.`;

  const analysis = await fetchClaude(prompt);
  if (!analysis) return;
  const outPath = path.join(analysesDir, `${gameId}.txt`);
  const content = `Game: ${gameId}\nPlayers: ${white} vs ${black}\nMoves:\n${moves}\n\n=== Claude analysis ===\n${analysis}\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Saved analysis to ${outPath}`);
}

async function streamEvents() {
  console.log('Connecting to Lichess event stream...');
  const res = await fetch('https://lichess.org/api/stream/event', {
    headers: { Authorization: `Bearer ${LICHESS_TOKEN}` }
  });
  if (!res.ok) {
    console.error('Failed to connect to Lichess event stream:', res.status, await res.text());
    process.exit(1);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch (err) {
        console.warn('Skipping non-JSON line:', line.slice(0, 200));
        continue;
      }
      handleEvent(event).catch(e => console.error('handleEvent error', e));
    }
  }
}

async function getPlayerName(player) {
  if (!player) return 'Unknown';
  if (player.user && player.user.name) return player.user.name;
  if (player.name) return player.name;
  return 'Unknown';
}

async function handleEvent(event) {
  // Interested in `gameFull` events (contains state.moves) and `gameFinish`/`gameFinished` variations
  if (event.type === 'gameFull') {
    const gameId = event.id || (event.game && event.game.id) || 'unknown';
    const moves = event.state && event.state.moves ? event.state.moves : '';
    const white = await getPlayerName(event.white || (event.players && event.players.white));
    const black = await getPlayerName(event.black || (event.players && event.players.black));
    console.log(`Received gameFull: ${gameId} — moves length ${moves.split(' ').length}`);
    // Only analyze finished games; try to detect by state or status
    const isFinished = event.state && event.state.status === 'mate' || event.state && event.state.moves && event.state.moves.length > 0 && (event.initialFen === undefined && event.variant === undefined ? false : false);
    // For prototype, analyze whenever we get gameFull and there are moves
    if (moves) {
      await analyzeGame(gameId, moves, white, black);
    }
  } else if (event.type === 'gameFinish' || event.type === 'gameFinished') {
    const gameId = event.id || event.gameId || 'unknown';
    console.log('gameFinish event', gameId);
    // optionally fetch full game state here
  } else if (event.type) {
    // other event types: challenge, challengeCanceled, etc.
    // console.log('Event:', event.type);
  }
}

streamEvents().catch(err => {
  console.error('Stream error:', err);
  process.exit(1);
});
