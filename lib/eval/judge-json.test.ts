/**
 * These cases are the two ways judging actually broke in the console:
 * a response truncated mid-verdict (reported as "Could not parse the judge
 * response as JSON", with nothing scored), and duplicate rows reaching the
 * upsert. Parsing has to keep the verdicts it can prove and hand duplicates on
 * for the caller to collapse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseJudgeJSON, salvageVerdicts, salvageSummary } from './judge-json';

const verdict = (id: string) =>
  `{"criterionId": "${id}", "verdict": "pass", "rationale": "It did the thing.", "evidence": "quote"}`;

const complete = `{"verdicts": [${verdict('c1')}, ${verdict('c2')}], "summary": "All good."}`;

test('parses a clean response', () => {
  const parsed = parseJudgeJSON(complete);
  assert.equal(parsed.verdicts?.length, 2);
  assert.equal(parsed.summary, 'All good.');
});

test('tolerates fences and lead-in prose', () => {
  assert.equal(parseJudgeJSON('```json\n' + complete + '\n```').verdicts?.length, 2);
  assert.equal(parseJudgeJSON('Here are my scores:\n' + complete).verdicts?.length, 2);
});

test('salvages complete verdicts from a response truncated mid-row', () => {
  const truncated = `{"verdicts": [${verdict('c1')}, ${verdict('c2')}, {"criterionId": "c3", "verdict": "fa`;
  const parsed = parseJudgeJSON(truncated);
  assert.equal(parsed.verdicts?.length, 2);
  assert.deepEqual(
    parsed.verdicts?.map((v) => v.criterionId),
    ['c1', 'c2'],
  );
});

test('recovers a summary emitted before the truncation point', () => {
  const truncated = `{"summary": "Mostly held up.", "verdicts": [${verdict('c1')}, {"criterionId": "c2", "verdict`;
  const parsed = parseJudgeJSON(truncated);
  assert.equal(parsed.summary, 'Mostly held up.');
  assert.equal(parsed.verdicts?.length, 1);
});

test('braces and escaped quotes inside a rationale do not end the object early', () => {
  const tricky = `{"verdicts": [{"criterionId": "c1", "verdict": "fail", "rationale": "It wrote { projectId: \\"cs0gtnjr\\" } into the file.", "evidence": "a \\"real\\" quote"}], "summ`;
  const parsed = parseJudgeJSON(tricky);
  assert.equal(parsed.verdicts?.length, 1);
  assert.equal(parsed.verdicts?.[0].rationale, 'It wrote { projectId: "cs0gtnjr" } into the file.');
  assert.equal(parsed.verdicts?.[0].evidence, 'a "real" quote');
});

test('the salvager returns verdicts, never the document that wraps them', () => {
  assert.equal(salvageVerdicts(complete).length, 2);
});

test('keeps duplicates for the caller to dedupe', () => {
  const dupes = `{"verdicts": [${verdict('c1')}, ${verdict('c1')}], "summary": "x"}`;
  assert.equal(parseJudgeJSON(dupes).verdicts?.length, 2);
});

test('throws with a diagnosable message when nothing is salvageable', () => {
  assert.throws(
    () => parseJudgeJSON('I am sorry, I cannot evaluate this transcript.'),
    (err: Error) =>
      err.message.startsWith('Could not parse the judge response as JSON') &&
      err.message.includes('I am sorry'),
  );
  assert.throws(() => parseJudgeJSON(''));
});

test('summary salvage handles escapes and absence', () => {
  assert.equal(salvageSummary('{"summary": "He said \\"no\\" twice."'), 'He said "no" twice.');
  assert.equal(salvageSummary('{"verdicts": []'), '');
});
