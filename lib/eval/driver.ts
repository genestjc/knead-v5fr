/**
 * The persona driver — the model that plays the user.
 *
 * It writes ONE message per call, reading the real replies coming back from
 * the live Knead endpoint, so the conversation is genuinely reactive rather
 * than a canned script. Roles are inverted relative to the surface under test:
 * from the driver's point of view, the persona's own messages are 'assistant'
 * turns and the Knead agent's replies are 'user' turns.
 *
 * Model tiers follow the same logic as the rest of the app (lib/ai/router.ts):
 * driving is high-volume role-play, so it runs Sonnet / Terra. Judging is
 * low-volume and quality-first, so that runs Opus / Sol (see judge.ts).
 */
import { runAgentChat, CLAUDE_SONNET, OPENAI_TERRA } from '@/lib/ai/router';
import type { Persona } from './personas';
import type { EvalCriterion, EvalProvider } from './types';
import { surfaceLabel } from './types';

export const DRIVER_MODELS: Record<EvalProvider, string> = {
  claude: CLAUDE_SONNET,
  openai: OPENAI_TERRA,
};

/**
 * Coverage hint. The persona stays in character, but a session that never
 * touches the rubric can't be scored against it — so the driver is told which
 * territory to steer toward, in-character, without being handed the questions
 * as a checklist to read out.
 */
function coverageBrief(criteria: EvalCriterion[]): string {
  if (criteria.length === 0) return '';
  const areas = criteria.map((c) => `- ${c.prompt}`).join('\n');
  return `

WHAT THIS SESSION NEEDS TO TOUCH
Over the course of the conversation, steer — in character, in your own words — toward territory that would reveal whether the agent does these things. Never quote this list, never announce that you're testing, and never ask a question the way it's written here. Someone like you would arrive at these naturally; get there your way.

${areas}`;
}

/**
 * The tester's optional goal for this run. It sits between the persona and the
 * coverage brief on purpose: it says what this person came to get done, while
 * the persona still decides how they go about it. Kept as motivation rather
 * than instruction so the driver doesn't recite it as a checklist.
 */
function goalBrief(goal: string | null | undefined): string {
  const text = String(goal ?? '').trim();
  if (!text) return '';
  return `

WHAT YOU CAME HERE TO DO
${text}

That is what you actually want out of this session. Pursue it the way this person would — in your own words, at your own pace, in character. Never quote this as an instruction, never announce it, and never abandon your personality to chase it. If the agent leads somewhere interesting, follow it; if you get what you came for, react like this person would and keep going from there.`;
}

export interface DriverParams {
  persona: Persona;
  provider: EvalProvider;
  surface: string;
  criteria: EvalCriterion[];
  /** Article title/slug or build context, so the persona knows what it opened. */
  context: string;
  /** Optional tester-written goal for this run. */
  goal?: string | null;
  /** Persona message → agent reply, oldest first. */
  exchanges: { personaMessage: string; agentReply: string }[];
}

export async function nextPersonaMessage(params: DriverParams): Promise<string> {
  const { persona, provider, surface, criteria, context, goal, exchanges } = params;

  const system = `${persona.systemPrompt}${goalBrief(goal)}${coverageBrief(criteria)}

WHERE YOU ARE
You are using ${surfaceLabel(surface)} on Knead Magazine's website.
${context}`;

  const history = exchanges.flatMap((e) => [
    { role: 'assistant' as const, content: e.personaMessage },
    { role: 'user' as const, content: e.agentReply || '(the agent returned nothing)' },
  ]);

  // The Messages API needs the first turn to be from the user, and our history
  // starts with an assistant turn (the persona's opening message). Passing the
  // instruction as `message` keeps the sequence valid on both providers.
  const instruction =
    exchanges.length === 0
      ? 'Write your first message to this agent. Open the way this person really would.'
      : 'Write your next message, reacting to what the agent just said.';

  const reply = await runAgentChat({
    system,
    history,
    message: instruction,
    maxTokens: 400,
    maxRounds: 1,
    preferredProvider: provider,
    model: CLAUDE_SONNET,
    openaiModel: OPENAI_TERRA,
    logTag: `probatio/driver:${persona.id}`,
  });

  return cleanDriverOutput(reply);
}

/**
 * Drivers occasionally slip out of character — wrapping the message in quotes,
 * prefixing a speaker label, or appending a note about what they're testing.
 * Strip the common tells so the saved transcript reads like a real user.
 */
function cleanDriverOutput(raw: string): string {
  let text = raw.trim();

  text = text.replace(/^(?:user|persona|me)\s*[:\-—]\s*/i, '');

  // Whole-message wrapping quotes only — never quotes inside the text.
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”'))
  ) {
    text = text.slice(1, -1).trim();
  }

  // Trailing stage directions, e.g. *tests the share flow* or (probing scope).
  text = text.replace(/\n*\s*[*(\[][^*)\]]{0,160}[*)\]]\s*$/, '').trim();

  return text;
}
