'use strict';

const { execSync } = require('child_process');

/**
 * The process and OS calls free-port makes. Each function takes an optional partial override,
 * so the lookup and kill logic can be exercised without real processes or ports.
 */
const defaultSystem = {
  platform: process.platform,
  /** @param {string} command */
  exec: (command) => execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  /** @param {number} pid @param {NodeJS.Signals} signal */
  kill: (pid, signal) => process.kill(pid, signal),
  /** Blocks without spinning a CPU core, so free-port stays synchronous for `prestart`. */
  sleep: (/** @type {number} */ ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms),
};

/**
 * @typedef {typeof defaultSystem} System
 * @param {Partial<System>} [system]
 * @returns {System}
 */
function withDefaults(system) {
  return { ...defaultSystem, ...system };
}

/** No port-lookup command is installed. The CLI skips instead of failing `npm start`. */
class LookupToolMissing extends Error {
  /** @param {string[]} tools */
  constructor(tools) {
    super(`${tools.join(' and ')} not found`);
    this.name = 'LookupToolMissing';
  }
}

/** @param {unknown} error */
function isCommandMissing(error) {
  const { status, code } = /** @type {{ status?: number, code?: string }} */ (error);
  return status === 127 || code === 'ENOENT';
}

/**
 * @param {System} sys
 * @param {string} command
 * @param {string[]} tools named in the error when the command is missing
 */
function run(sys, command, tools) {
  try {
    return sys.exec(command);
  } catch (error) {
    if (isCommandMissing(error)) throw new LookupToolMissing(tools);
    throw error;
  }
}

/**
 * PIDs listening on `port` in `ss -ltnp` output. Throws when a listener's PID is hidden
 * (another user's process), since the port is then known to be busy but can't be freed.
 * @param {string} output
 * @param {number} port
 * @returns {number[]}
 */
function parseSsOutput(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols[0] !== 'LISTEN' || !cols[3]?.endsWith(`:${port}`)) continue;
    const found = [...line.matchAll(/pid=(\d+)/g)].map((m) => Number(m[1]));
    if (found.length === 0) throw new Error(`port ${port} is in use by a process ss can't identify`);
    for (const pid of found) pids.add(pid);
  }
  return [...pids];
}

/**
 * PIDs listening on a TCP port: `netstat` on Windows, `lsof` elsewhere, falling back to `ss` on
 * Linux. Throws `LookupToolMissing` when no tool is installed and rethrows any other failure, so
 * a failed check is never mistaken for a free port.
 * @param {number} port
 * @param {Partial<System>} [system]
 * @returns {number[]}
 */
function findPidsOnPort(port, system) {
  const sys = withDefaults(system);
  const pids = new Set();

  if (sys.platform === 'win32') {
    const portPattern = new RegExp(`:${port}\\s`);
    for (const line of run(sys, 'netstat -ano -p tcp', ['netstat']).split(/\r?\n/)) {
      if (!line.includes('LISTENING') || !portPattern.test(line)) continue;
      const pid = Number(line.trim().split(/\s+/).pop());
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  }

  let output;
  try {
    output = sys.exec(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`);
  } catch (error) {
    // lsof exits 1 when nothing matches; any other failure is a real error.
    if (/** @type {{ status?: number }} */ (error).status === 1) return [];
    if (!isCommandMissing(error)) throw error;
    if (sys.platform !== 'linux') throw new LookupToolMissing(['lsof']);
    return parseSsOutput(run(sys, 'ss -ltnp', ['lsof', 'ss']), port);
  }
  for (const line of output.split(/\r?\n/)) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

/**
 * Asks a process to stop (SIGTERM, or `taskkill` without `/F`), or kills it when `force` is set.
 * @param {number} pid
 * @param {boolean} [force]
 * @param {Partial<System>} [system]
 * @returns {boolean} whether the signal was delivered
 */
function killPid(pid, force = false, system) {
  if (pid === process.pid) return false;
  const sys = withDefaults(system);

  try {
    if (sys.platform === 'win32') {
      sys.exec(`taskkill /PID ${pid} /T${force ? ' /F' : ''}`);
    } else {
      sys.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Polls until nothing listens on the port or `waitMs` passes, then answers from a fresh lookup.
 * @param {number} port
 * @param {number} waitMs
 * @param {number} pollIntervalMs
 * @param {System} sys
 * @returns {boolean}
 */
function waitUntilFree(port, waitMs, pollIntervalMs, sys) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (findPidsOnPort(port, sys).length === 0) return true;
    sys.sleep(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 0)));
  }
  return findPidsOnPort(port, sys).length === 0;
}

/**
 * Stops whatever listens on `port`: a graceful stop first, then a forced kill of anything still
 * listening once `waitMs` has passed. `free` reports the port as last observed.
 * @param {number} port
 * @param {{ waitMs?: number, pollIntervalMs?: number } & Partial<System>} [options]
 * @returns {{ port: number, freed: number[], alreadyFree: boolean, free: boolean }}
 */
function freePort(port, options = {}) {
  const { waitMs = 2000, pollIntervalMs = 100, ...system } = options;
  const sys = withDefaults(system);

  const pids = findPidsOnPort(port, sys);
  if (pids.length === 0) {
    return { port, freed: [], alreadyFree: true, free: true };
  }

  const freed = new Set(pids.filter((pid) => killPid(pid, false, sys)));
  // Skip the wait when no graceful stop was accepted (e.g. a console app refusing taskkill).
  let free = freed.size > 0 && waitUntilFree(port, waitMs, pollIntervalMs, sys);

  if (!free) {
    for (const pid of findPidsOnPort(port, sys)) {
      if (killPid(pid, true, sys)) freed.add(pid);
    }
    free = waitUntilFree(port, waitMs, pollIntervalMs, sys);
  }

  return { port, freed: [...freed], alreadyFree: false, free };
}

if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || {{APP_PORT}});
  if (!Number.isInteger(port) || port <= 0) {
    console.error('Usage: node scripts/free-port.cjs [port] (defaults to $PORT, then {{APP_PORT}})');
    process.exit(1);
  }

  let result;
  try {
    result = freePort(port);
  } catch (error) {
    if (error instanceof LookupToolMissing) {
      // Port-freeing is a convenience: don't block `npm start` on machines without the tools.
      console.warn(`free-port: can't check port ${port} (${error.message}); skipping`);
      process.exit(0);
    }
    const message = error instanceof Error ? error.message.trim() : String(error);
    console.error(`Could not check port ${port}: ${message}`);
    process.exit(1);
  }

  if (!result.free) {
    console.error(`Port ${port} is still in use; could not free it automatically`);
    process.exit(1);
  } else if (result.alreadyFree) {
    console.log(`Port ${port} is already free`);
  } else if (result.freed.length > 0) {
    console.log(`Freed port ${port} (stopped PID ${result.freed.join(', ')})`);
  } else {
    console.log(`Port ${port} is free`);
  }
}

module.exports = { freePort, findPidsOnPort, killPid, parseSsOutput, LookupToolMissing };
