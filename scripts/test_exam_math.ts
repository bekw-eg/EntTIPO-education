import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { EXAM_EXERCISES } from "../lib/exam/bank";

// The project's existing math-service contains the pinned SymPy dependency.
// Run both script and bank entirely through stdin; no Docker copy or workspace mount.
const script = readFileSync("scripts/verify_exam_math.py", "utf8");
const run = spawnSync("docker", ["exec", "-i", "entTIPO_math", "python", "-c", script], {
  input: JSON.stringify(EXAM_EXERCISES), encoding: "utf8", timeout: 60000,
});
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
if (run.error) console.error(run.error);
process.exitCode = run.status === 0 ? 0 : 1;
