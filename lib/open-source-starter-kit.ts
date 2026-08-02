/**
 * README generation for the downloadable starter kit produced by
 * /api/open-source/zip.
 *
 * The assistant supplies its own getting-started guide via
 * propose_zip_contents, but that guide is the least reliable part of the
 * bundle: it's the tail end of a token-capped tool call, so it arrives thin,
 * truncated, or not at all. The deployment framework — unzip, push to GitHub,
 * import to Vercel, set env vars, deploy — is identical for every kit, so it's
 * generated here from the actual contents of the bundle and the assistant's
 * guide is folded in as the project-specific part. That way a builder always
 * ends up with a README that can get them to a live site, even when the
 * conversation ran out of room before the walkthrough happened.
 */

export interface StarterKitFile {
  path: string;
  source: 'repo' | 'generated';
  content?: string;
}

// ---------- what may leave the repo ----------

// Shared by the ZIP builder and by the assistant's proposal check, so the
// file count the assistant announces is the file count that gets packaged.
// They disagreed before: the assistant would promise files the ZIP route then
// dropped without a word.
const EXPORT_BLOCKED_PREFIXES = ['app/admin/', 'app/api/admin/', 'app/api/agent/', 'lib/admin/'];

const EXPORT_BLOCKED_FILES = new Set([
  'lib/agent.ts',
  'lib/agentcard.ts',
  'lib/thirdweb-server-wallet.ts',
  'vercel.json',
]);

/** Real .env files carry live secrets; the committed template does not. */
export function isSecretEnvFile(path: string): boolean {
  const basename = path.split('/').pop() ?? '';
  return basename.startsWith('.env') && basename !== '.env.example';
}

export function isExportBlockedPath(path: string): boolean {
  return (
    isSecretEnvFile(path) ||
    EXPORT_BLOCKED_FILES.has(path) ||
    EXPORT_BLOCKED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

const ENV_VAR_PATTERN = /process\.env\.([A-Z0-9_]+)/g;

/**
 * Env vars that exist only inside Knead's own deployment. Builders set their
 * own equivalents, so surfacing these names in an exported kit would just be
 * confusing (and the assistant is told never to expose them).
 */
function isInternalEnvVar(name: string): boolean {
  return name.startsWith('KNEAD_');
}

/** Env var names actually referenced by the code going into the bundle. */
export function collectEnvVars(files: { content: string }[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const match of file.content.matchAll(ENV_VAR_PATTERN)) {
      const name = match[1];
      if (!isInternalEnvVar(name)) found.add(name);
    }
  }
  return [...found].sort();
}

function section(title: string, body: string[]): string {
  return body.length > 0 ? `## ${title}\n\n${body.join('\n')}\n` : '';
}

export function buildStarterReadme(opts: {
  /** Files that made it into the ZIP, with their final contents. */
  included: { path: string; source: 'repo' | 'generated'; content: string }[];
  /** Repo files that could not be pulled, so the README can be honest. */
  missing?: string[];
  /** The assistant's own project-specific guide, if it wrote one. */
  setupInstructions?: string;
  repo: string;
  branch: string;
}): string {
  const { included, missing = [], setupInstructions = '', repo, branch } = opts;

  const envVars = collectEnvVars(included);
  const guide = setupInstructions.trim();

  const fileList = included.map((f) => {
    const origin =
      f.source === 'repo'
        ? `pulled from [${repo}](https://github.com/${repo}/blob/${branch}/${f.path})`
        : 'written for your project';
    return `- \`${f.path}\` — ${origin}`;
  });

  const envList =
    envVars.length > 0
      ? envVars.map((name) => `- \`${name}\``)
      : ['- See `.env.example` — it lists every key Knead\'s stack can use.'];

  const parts = [
    '# Your Knead Starter Kit\n',
    "This bundle is real code from Knead's open-source repository, plus anything written for your project. Nothing here is a placeholder — the repo files are the same ones running in production.\n",

    section("What's inside", fileList),

    missing.length > 0
      ? section(
          "What we couldn't include",
          [
            'These files were requested but could not be pulled from the repository, so they are not in this bundle:\n',
            ...missing.map((p) => `- \`${p}\``),
            `\nYou can look for them directly at https://github.com/${repo}.`,
          ],
        )
      : '',

    guide ? `## Getting started with this project\n\n${guide}\n` : '',

    `## Putting it online

These steps take you from this ZIP to a live website. They're written for someone who has never deployed anything — no step assumes the one before it was obvious.

**1. Unzip it.** Double-click the file. You'll get a folder of code you can open in any editor — [VS Code](https://code.visualstudio.com) and [Cursor](https://cursor.com) are both free.

**2. Put it on GitHub.** Make a free account at [github.com](https://github.com), click **New repository**, give it a name, and create it. On the next screen use **uploading an existing file** and drag your unzipped folder in. GitHub is where your code lives and remembers every change you make to it.

**3. Connect it to Vercel.** Make a free account at [vercel.com](https://vercel.com) and **sign in with GitHub** — that way it can see the repository you just made. Click **Add New → Project**, find your repository, and click **Import**.

**4. Add your keys before you deploy.** On the import screen, open **Environment Variables**. ${
      envVars.length > 0
        ? 'Add each of these, pasting in the value from that service\'s dashboard:'
        : 'Add the keys listed in `.env.example` for whichever services your project uses:'
    }

${envList.join('\n')}

   Every one of these comes from a dashboard you sign up for — \`.env.example\` has a link next to each. These are passwords: they belong in Vercel's settings, never in your code.

**5. Deploy.** Click **Deploy** and wait about a minute. Vercel gives you a real URL. It's live — you can send it to someone.

**6. Change something.** Edit a file on GitHub, commit it, and watch Vercel rebuild your site automatically. That loop — edit, push, see it live — is the whole job from here on.

### If the build fails

A failed first deploy is normal and it's not a sign you did anything wrong. Open the **Deployments** tab in Vercel and read the red text in the log — it almost always names the exact file or the missing environment variable. Fix that one thing and push again.
`,

    `## Running it on your own machine (optional)

You can skip this and let Vercel do all the building. When you want a private draft that updates as you type:

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open http://localhost:3000. That address is only visible to you — your Vercel URL is the published version everyone else sees. Copy \`.env.example\` to \`.env.local\` and fill in the same keys you put in Vercel.
`,

    `---

The full source is at [${repo}](https://github.com/${repo}). Bring questions back to Demeter on Knead's open-source page — she can pull any other file in the repo and walk you through it.
`,
  ];

  return parts.filter(Boolean).join('\n');
}
