import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, '..', 'layers', 'free-port', 'files', 'scripts', 'free-port.cjs');

// The layer file carries a {{APP_PORT}} token, so load a rendered copy.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skeletor-free-port-'));
const rendered = path.join(tmpDir, 'free-port.cjs');
fs.writeFileSync(rendered, fs.readFileSync(SCRIPT, 'utf8').replaceAll('{{APP_PORT}}', '3000'));
const { freePort, findPidsOnPort, killPid } = createRequire(import.meta.url)(rendered);

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

function execError(status, message = 'Command failed') {
  return Object.assign(new Error(message), { status });
}

/** A fake system whose lookups answer from `listening`, a mutable list of PIDs. */
function fakeSystem({ platform = 'linux', listening, kill = () => {}, lsofError } = {}) {
  const calls = { exec: [], kill: [] };
  return {
    calls,
    platform,
    exec(command) {
      calls.exec.push(command);
      if (command.startsWith('lsof')) {
        if (lsofError) throw lsofError;
        if (listening.length === 0) throw execError(1);
        return listening.join('\n') + '\n';
      }
      if (command.startsWith('netstat')) {
        return listening.map((pid) => `  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    ${pid}`).join('\r\n');
      }
      return '';
    },
    kill(pid, signal) {
      calls.kill.push([pid, signal]);
      kill(pid, signal);
    },
    sleep() {},
  };
}

describe('free-port: findPidsOnPort', () => {
  test('parses lsof output into unique PIDs', () => {
    const sys = fakeSystem({ listening: [101, 202, 101] });
    expect(findPidsOnPort(3000, sys)).toEqual([101, 202]);
  });

  test('lsof exit 1 (no matches) means the port is free', () => {
    const sys = fakeSystem({ listening: [], lsofError: execError(1) });
    expect(findPidsOnPort(3000, sys)).toEqual([]);
  });

  test.each([
    ['lsof missing', 127],
    ['permission or other failure', 2],
  ])('rethrows other lsof failures (%s)', (_label, status) => {
    const sys = fakeSystem({ listening: [], lsofError: execError(status, 'lsof failed') });
    expect(() => findPidsOnPort(3000, sys)).toThrow('lsof failed');
  });

  test('parses netstat LISTENING rows for the port on Windows', () => {
    const sys = fakeSystem({ platform: 'win32', listening: [4321] });
    expect(findPidsOnPort(3000, sys)).toEqual([4321]);
    expect(findPidsOnPort(30000, sys)).toEqual([]);
  });

  test('netstat failures propagate on Windows', () => {
    const sys = {
      platform: 'win32',
      exec: () => {
        throw execError(1, 'netstat failed');
      },
    };
    expect(() => findPidsOnPort(3000, sys)).toThrow('netstat failed');
  });

  test('freePort propagates lookup failures instead of reporting a free port', () => {
    const sys = fakeSystem({ listening: [], lsofError: execError(127, 'lsof: not found') });
    expect(() => freePort(3000, sys)).toThrow('lsof: not found');
  });
});

describe('free-port: killPid', () => {
  test('never signals its own process', () => {
    const sys = fakeSystem({ listening: [] });
    expect(killPid(process.pid, true, sys)).toBe(false);
    expect(sys.calls.kill).toEqual([]);
  });

  test('uses taskkill without /F unless forced on Windows', () => {
    const sys = fakeSystem({ platform: 'win32', listening: [] });
    killPid(42, false, sys);
    killPid(42, true, sys);
    expect(sys.calls.exec).toEqual(['taskkill /PID 42 /T', 'taskkill /PID 42 /T /F']);
  });

  test('reports a failed signal as false', () => {
    const sys = fakeSystem({
      listening: [],
      kill: () => {
        throw new Error('EPERM');
      },
    });
    expect(killPid(42, false, sys)).toBe(false);
  });
});

describe('free-port: freePort', () => {
  test('a free port is reported as already free without signalling anything', () => {
    const sys = fakeSystem({ listening: [] });
    expect(freePort(3000, sys)).toEqual({ port: 3000, freed: [], alreadyFree: true, free: true });
    expect(sys.calls.kill).toEqual([]);
  });

  test('a graceful stop that releases the port does not escalate', () => {
    const listening = [101];
    const sys = fakeSystem({ listening, kill: () => listening.splice(0) });
    expect(freePort(3000, { ...sys, waitMs: 50 })).toEqual({ port: 3000, freed: [101], alreadyFree: false, free: true });
    expect(sys.calls.kill).toEqual([[101, 'SIGTERM']]);
  });

  test('escalates to SIGKILL when the graceful stop times out', () => {
    const listening = [101];
    const sys = fakeSystem({ listening, kill: (_pid, signal) => signal === 'SIGKILL' && listening.splice(0) });
    expect(freePort(3000, { ...sys, waitMs: 0 })).toEqual({ port: 3000, freed: [101], alreadyFree: false, free: true });
    expect(sys.calls.kill).toEqual([
      [101, 'SIGTERM'],
      [101, 'SIGKILL'],
    ]);
  });

  test('on timeout, a port that is still bound is reported as in use even though signals were delivered', () => {
    const sys = fakeSystem({ listening: [101] });
    const result = freePort(3000, { ...sys, waitMs: 0 });
    expect(result).toEqual({ port: 3000, freed: [101], alreadyFree: false, free: false });
  });

  test('on timeout, the result comes from a fresh lookup even when every signal failed', () => {
    const listening = [101];
    const sys = fakeSystem({
      listening,
      kill: () => {
        // The listener exits on its own; the signal itself fails.
        listening.splice(0);
        throw new Error('ESRCH');
      },
    });
    expect(freePort(3000, { ...sys, waitMs: 0 })).toEqual({ port: 3000, freed: [], alreadyFree: false, free: true });
  });

  test('a refused graceful stop escalates immediately on Windows', () => {
    const listening = [77];
    const sys = fakeSystem({ platform: 'win32', listening });
    const exec = sys.exec;
    sys.exec = (command) => {
      if (command === 'taskkill /PID 77 /T') throw execError(128, 'can only be terminated forcefully');
      if (command === 'taskkill /PID 77 /T /F') listening.splice(0);
      return exec(command);
    };
    expect(freePort(3000, { ...sys, waitMs: 60_000 })).toEqual({ port: 3000, freed: [77], alreadyFree: false, free: true });
  });
});

test('free-port: the npm script passes no port, so $PORT is honoured', () => {
  const patch = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'layers', 'free-port', 'patch', 'package.json.json'), 'utf8'));
  expect(patch.scripts['free-port']).toBe('node scripts/free-port.cjs');
});
