import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ensureMusicRuntime,
  GENERATED_CONFIG_MARKER,
  normalizeMusicAutoSetupConfig,
  resolveJava17Command
} from '../src/systems/music-setup.js';

test('음악 자동 설정 기본값은 npm start에서 로컬 런타임과 yt-dlp 자동 다운로드를 켠다', () => {
  const config = normalizeMusicAutoSetupConfig({});
  assert.equal(config.autoSetup, true);
  assert.equal(config.runtimeDir, 'data/music-runtime');
  assert.equal(config.lavalink.autoStart, true);
  assert.equal(config.lavalink.bufferDurationMs, 1000);
  assert.equal(config.lavalink.frameBufferDurationMs, 10000);
  assert.equal(config.lavalink.opusEncodingQuality, 10);
  assert.equal(config.lavalink.resamplingQuality, 'MEDIUM');
  assert.equal(config.lavalink.nonAllocatingFrameBuffer, true);
  assert.equal(config.lavalink.useSeekGhosting, true);
  assert.equal(config.ytdlp.enabled, true);
  assert.equal(config.ytdlp.autoDownload, true);
});

test('로컬 Lavalink 자동 설정은 jar, application.yml을 준비하고 준비될 때까지 기다린다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-music-setup-'));
  const fetchCalls = [];
  const spawned = [];
  let healthChecks = 0;

  try {
    const result = await ensureMusicRuntime({
      runtimeDir: directory,
      lavalink: {
        port: 2444,
        password: 'secret',
        jarUrl: 'https://example.test/Lavalink.jar'
      },
      ytdlp: { enabled: false }
    }, {
      async fetchFn(url, options = {}) {
        const href = String(url);
        fetchCalls.push(href);
        if (href.includes('youtube-source')) {
          return new Response(JSON.stringify({ tag_name: 'v9.9.9' }), { status: 200 });
        }
        if (href.includes('Lavalink.jar')) {
          return new Response('fake jar', { status: 200 });
        }
        if (href.endsWith('/version')) {
          assert.equal(options.headers.Authorization, 'secret');
          healthChecks += 1;
          return new Response('4.0.0', { status: healthChecks >= 2 ? 200 : 503 });
        }
        throw new Error(`unexpected fetch ${href}`);
      },
      spawnSyncFn(command, args) {
        assert.equal(command, 'java');
        assert.deepEqual(args, ['-version']);
        return { status: 0, stderr: 'openjdk version "17.0.10"' };
      },
      spawnFn(command, args, options) {
        spawned.push({ command, args, cwd: options.cwd });
        return new FakeChildProcess();
      },
      logger: quietLogger
    });

    assert.equal(result.musicConfig.lavalink.host, '127.0.0.1');
    assert.equal(result.musicConfig.lavalink.port, 2444);
    assert.equal(result.musicConfig.lavalink.password, 'secret');
    assert.ok(existsSync(join(directory, 'Lavalink.jar')));
    const applicationYaml = await readFile(join(directory, 'application.yml'), 'utf8');
    assert.ok(applicationYaml.includes(GENERATED_CONFIG_MARKER));
    assert.ok(applicationYaml.includes('youtube-plugin:9.9.9'));
    assert.ok(applicationYaml.includes('password: "secret"'));
    assert.ok(applicationYaml.includes('nonAllocatingFrameBuffer: true'));
    assert.ok(applicationYaml.includes('bufferDurationMs: 1000'));
    assert.ok(applicationYaml.includes('frameBufferDurationMs: 10000'));
    assert.ok(applicationYaml.includes('opusEncodingQuality: 10'));
    assert.ok(applicationYaml.includes('resamplingQuality: MEDIUM'));
    assert.ok(applicationYaml.includes('trackStuckThresholdMs: 10000'));
    assert.ok(applicationYaml.includes('useSeekGhosting: true'));
    assert.ok(applicationYaml.includes('volume: false'));
    assert.deepEqual(spawned.map(({ command }) => command), ['java']);
    assert.equal(spawned[0].cwd, directory);

    result.cleanup();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Windows에서 PATH java가 없어도 Temurin 설치 경로를 자동 탐색한다', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'heeheebot-java-'));
  const javaPath = join(directory, 'Eclipse Adoptium', 'jdk-17.0.19.10-hotspot', 'bin', 'java.exe');

  try {
    await mkdir(join(directory, 'Eclipse Adoptium', 'jdk-17.0.19.10-hotspot', 'bin'), { recursive: true });
    const resolved = resolveJava17Command({
      platform: 'win32',
      env: { ProgramFiles: directory },
      spawnSyncFn(command) {
        if (command === 'java') return { status: 1, error: new Error('not found') };
        assert.equal(command, javaPath);
        return { status: 0, stderr: 'openjdk version "17.0.19"' };
      },
      logger: quietLogger
    });

    assert.equal(resolved, javaPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

class FakeChildProcess extends EventEmitter {
  constructor() {
    super();
    this.killed = false;
  }

  kill(signal) {
    this.killed = true;
    this.signal = signal;
    this.emit('exit', null, signal);
  }
}

const quietLogger = {
  log() {},
  warn() {},
  error() {}
};
