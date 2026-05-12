import assert from 'node:assert/strict';
import test from 'node:test';
import { ChannelType } from 'discord.js';
import { getApplicationCommandPayloads } from '../src/command-registration.js';
import {
  createMusicPanelPayload,
  createNodeStatusPayload,
  createPopularTracksPayload,
  createUserMusicStatsPayload,
  getMusicCommandPayloads,
  handleMusicCommand
} from '../src/commands/music.js';
import { createSqliteStore } from '../src/storage/sqlite-store.js';
import {
  MusicService,
  normalizeMusicConfig,
  normalizeLavalinkLoadResult,
  toLavalinkIdentifier
} from '../src/systems/music.js';

const SAMPLE_TRACK = Object.freeze({
  encoded: 'encoded-ditto',
  info: {
    title: 'Ditto - NewJeans',
    author: 'NewJeans',
    length: 185000,
    isStream: false,
    uri: 'https://example.test/ditto',
    sourceName: 'youtube',
    identifier: 'ditto-id',
    artworkUrl: 'https://example.test/ditto.jpg'
  },
  pluginInfo: { genre: 'K-Pop' }
});

test('음악 명령 payload가 기본 재생/검색/플리/통계 명령을 등록한다', () => {
  const payloads = getMusicCommandPayloads();
  const names = payloads.map((payload) => payload.name);

  for (const name of ['재생', '검색', '일시정지', '다시재생', '스킵', '정지', '큐', '플리', '내음악통계', '노드상태']) {
    assert.ok(names.includes(name), `${name} 음악 명령이 있어야 합니다.`);
  }

  const registeredNames = getApplicationCommandPayloads().map((payload) => payload.name);
  assert.equal(new Set(registeredNames).size, registeredNames.length, '음악 추가 후에도 slash command 이름 중복이 없어야 합니다.');
  assert.ok(registeredNames.includes('재생'));
  assert.ok(registeredNames.includes('내음악통계'));
});

test('기존 /랭킹 명령은 인기곡 선택지를 포함해 음악 랭킹으로 라우팅될 수 있다', () => {
  const ranking = getApplicationCommandPayloads().find((payload) => payload.name === '랭킹');
  assert.ok(ranking);
  const rankingType = ranking.options.find((option) => option.name === '종류');
  assert.ok(rankingType);
  assert.ok(rankingType.choices.some((choice) => choice.value === '인기곡'));
});

test('Lavalink loadtracks 결과와 검색 prefix를 표준화한다', () => {
  assert.equal(toLavalinkIdentifier('ditto', 'ytsearch'), 'ytsearch:ditto');
  assert.equal(toLavalinkIdentifier('https://youtu.be/example', 'ytsearch'), 'https://youtu.be/example');
  const config = normalizeMusicConfig({});
  assert.equal(config.panelRefreshIntervalMs, 5000);
  assert.equal(config.lavalink.resumeTimeoutSeconds, 120);
  assert.equal(config.lavalink.reconnectEnabled, true);

  const tracks = normalizeLavalinkLoadResult({ loadType: 'search', data: [SAMPLE_TRACK] });
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Ditto - NewJeans');
  assert.equal(tracks[0].author, 'NewJeans');
  assert.equal(tracks[0].genre, 'K-Pop');
});

test('Lavalink stopped 이벤트는 큐를 임의로 다음 곡으로 넘기지 않는다', async () => {
  const lavalink = new MockLavalink();
  const music = new MusicService({
    lavalink,
    config: { lavalink: { host: 'localhost', password: 'pw' } },
    now: createClock(1500)
  });

  await music.playQuery({
    guild: createGuild([]),
    textChannel: createTextChannel(),
    voiceChannel: createVoiceChannel(),
    requester: { id: 'user-1', username: 'Junseo' },
    query: 'ditto'
  });
  await music.playQuery({
    guild: createGuild([]),
    textChannel: createTextChannel(),
    voiceChannel: createVoiceChannel(),
    requester: { id: 'user-1', username: 'Junseo' },
    query: 'hype boy'
  });

  const before = music.getPlayerState('guild-1');
  await music.handleLavalinkMessage({
    op: 'event',
    type: 'TrackEndEvent',
    guildId: 'guild-1',
    reason: 'stopped'
  });

  const afterStopped = music.getPlayerState('guild-1');
  assert.equal(afterStopped.current.title, before.current.title);
  assert.equal(afterStopped.queue.length, 1);

  await music.handleLavalinkMessage({
    op: 'event',
    type: 'TrackEndEvent',
    guildId: 'guild-1',
    reason: 'finished'
  });
  assert.equal(music.getPlayerState('guild-1').queue.length, 0);
});

test('음악 서비스는 현재곡을 플레이리스트에 저장하고 공개 가져오기와 통계를 유지한다', async () => {
  const store = createSqliteStore(':memory:');
  const lavalink = new MockLavalink();
  const voicePackets = [];
  const music = new MusicService({
    store,
    lavalink,
    config: { lavalink: { host: 'localhost', password: 'pw' } },
    now: createClock(1000)
  });

  try {
    const result = await music.playQuery({
      guild: createGuild(voicePackets),
      textChannel: createTextChannel(),
      voiceChannel: createVoiceChannel(),
      requester: { id: 'user-1', username: 'Junseo' },
      query: 'ditto'
    });

    assert.equal(result.startedNow, true);
    assert.equal(result.current.title, 'Ditto - NewJeans');
    assert.equal(voicePackets[0].op, 4);
    assert.equal(voicePackets[0].d.channel_id, 'voice-1');
    assert.equal(lavalink.updates.at(-1).payload.track.encoded, 'encoded-ditto');

    const playlist = await music.createPlaylist({ guildId: 'guild-1', userId: 'user-1', username: 'Junseo', name: 'Kpop' });
    assert.equal(playlist.name, 'Kpop');

    const added = await music.addCurrentTrackToPlaylist({ guildId: 'guild-1', userId: 'user-1', username: 'Junseo', name: 'Kpop' });
    assert.equal(added.playlist.tracks.length, 1);
    assert.equal(added.track.title, 'Ditto - NewJeans');

    await music.setPlaylistPublic({ guildId: 'guild-1', userId: 'user-1', name: 'Kpop' });
    const imported = await music.importPublicPlaylist({
      guildId: 'guild-1',
      ownerId: 'user-1',
      importerId: 'user-2',
      importerName: 'Rabbit',
      name: 'Kpop'
    });
    assert.equal(imported.ownerId, 'user-2');
    assert.equal(imported.public, false);
    assert.equal(imported.tracks.length, 1);

    const topTracks = await music.getTopTracks({ guildId: 'guild-1', limit: 10 });
    assert.equal(topTracks[0].track.title, 'Ditto - NewJeans');
    assert.equal(topTracks[0].count, 1);

    const stats = await music.getUserStats({ guildId: 'guild-1', userId: 'user-1' });
    assert.equal(stats.totalRequests, 1);
    assert.equal(Object.values(stats.artists)[0].label, 'NewJeans');
    assert.equal(Object.values(stats.genres)[0].label, 'K-Pop');

    await music.stop('guild-1');
    assert.equal(lavalink.destroyed, 'guild-1');
    assert.equal(voicePackets.at(-1).d.channel_id, null);
    assert.equal(music.getPlayerState('guild-1').current, null);
    assert.equal(music.getPlayerState('guild-1').voiceChannelId, null);
  } finally {
    store.close();
  }
});

test('마지막 곡을 스킵해 큐가 비면 Lavalink 플레이어를 정리하고 음성 채널에서 나간다', async () => {
  const lavalink = new MockLavalink();
  const voicePackets = [];
  const music = new MusicService({
    lavalink,
    config: { lavalink: { host: 'localhost', password: 'pw' } },
    now: createClock(2000)
  });

  await music.playQuery({
    guild: createGuild(voicePackets),
    textChannel: createTextChannel(),
    voiceChannel: createVoiceChannel(),
    requester: { id: 'user-1', username: 'Junseo' },
    query: 'ditto'
  });

  const state = await music.skip('guild-1');

  assert.equal(state.current, null);
  assert.equal(lavalink.destroyed, 'guild-1');
  assert.equal(voicePackets.at(-1).op, 4);
  assert.equal(voicePackets.at(-1).d.channel_id, null);
  assert.equal(music.getPlayerState('guild-1').voiceChannelId, null);
});

test('음악 패널 종료 버튼은 정지 핸들러를 호출하고 음성 채널 퇴장을 안내한다', async () => {
  let stoppedGuildId = null;
  const replies = [];
  const interaction = {
    customId: 'music:stop',
    guildId: 'guild-1',
    deferred: false,
    replied: false,
    inGuild: () => true,
    isButton: () => true,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => false,
    async reply(payload) {
      replies.push(payload);
      this.replied = true;
    }
  };
  const music = {
    async stop(guildId) {
      stoppedGuildId = guildId;
    }
  };

  const handled = await handleMusicCommand(interaction, music, { warn() {} });

  assert.equal(handled, true);
  assert.equal(stoppedGuildId, 'guild-1');
  assert.match(replies[0].content, /음성 채널에서 나갔습니다/);
});

test('노드상태 명령은 Lavalink stats와 최근 frameStats를 진단한다', async () => {
  const lavalink = new MockLavalink();
  lavalink.stats = {
    players: 1,
    playingPlayers: 1,
    uptime: 3_600_000,
    memory: {
      free: 128 * 1024 * 1024,
      used: 900 * 1024 * 1024,
      allocated: 1024 * 1024 * 1024,
      reservable: 2048 * 1024 * 1024
    },
    cpu: {
      cores: 4,
      systemLoad: 0.72,
      lavalinkLoad: 0.31
    }
  };
  const music = new MusicService({
    lavalink,
    config: { lavalink: { host: 'localhost', password: 'pw' } },
    now: createClock(3000)
  });
  await music.handleLavalinkMessage({
    op: 'stats',
    players: 1,
    playingPlayers: 1,
    uptime: 3_500_000,
    memory: lavalink.stats.memory,
    cpu: lavalink.stats.cpu,
    frameStats: { sent: 6000, nulled: 2, deficit: 5 }
  });

  const replies = [];
  const interaction = {
    commandName: '노드상태',
    guildId: 'guild-1',
    deferred: false,
    replied: false,
    inGuild: () => true,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isChatInputCommand: () => true,
    async reply(payload) {
      replies.push(payload);
      this.replied = true;
    }
  };

  const handled = await handleMusicCommand(interaction, music, { warn() {} });

  assert.equal(handled, true);
  assert.match(replies[0].embeds[0].data.description, /systemLoad/);
  assert.match(replies[0].embeds[0].data.description, /deficit \*\*\+5\*\*/);
  assert.match(replies[0].embeds[0].data.description, /nulled \*\*2\*\*/);
  assert.match(replies[0].embeds[0].data.description, /CPU 병목/);

  const payload = createNodeStatusPayload(await music.getNodeStatus());
  assert.equal(payload.flags, 64);
});

test('Lavalink 진행도 업데이트는 현재 재생 패널 메시지를 자동 갱신한다', async () => {
  const store = createSqliteStore(':memory:');
  const textChannel = createEditableTextChannel();
  const music = new MusicService({
    store,
    lavalink: new MockLavalink(),
    config: {
      lavalink: { host: 'localhost', password: 'pw' },
      panelRefreshIntervalMs: 5000
    },
    now: createClock(1000, 6000)
  });
  music.setPanelRenderer((state) => ({
    content: `position:${Math.floor(state.position)}`
  }));

  try {
    await music.playQuery({
      guild: createGuild([]),
      textChannel,
      voiceChannel: createVoiceChannel(),
      requester: { id: 'user-1', username: 'Junseo' },
      query: 'ditto'
    });

    assert.equal(textChannel.sent.length, 1);
    assert.match(textChannel.sent[0].content, /position:/);

    await music.handleLavalinkMessage({
      op: 'playerUpdate',
      guildId: 'guild-1',
      state: { position: 42000 }
    });

    assert.equal(textChannel.edits.length, 1);
    const editedPosition = Number(textChannel.edits[0].content.match(/position:(\d+)/)?.[1] ?? 0);
    assert.ok(editedPosition >= 42000, '진행도 패널은 Lavalink position 이상으로 갱신되어야 합니다.');
  } finally {
    store.close();
  }
});

test('음악 패널과 랭킹/통계 payload는 핵심 정보를 임베드와 컨트롤로 표현한다', () => {
  const panel = createMusicPanelPayload({
    current: {
      title: 'Ditto - NewJeans',
      author: 'NewJeans',
      requesterName: 'Junseo',
      length: 185000,
      isStream: false,
      artworkUrl: null
    },
    queue: [],
    paused: false,
    repeat: false,
    shuffle: false,
    filter: 'none',
    position: 72000
  });

  assert.match(panel.embeds[0].data.description, /Ditto - NewJeans/);
  assert.equal(panel.components.length, 2);
  const panelCustomIds = panel.components.flatMap((row) => row.components.map((component) => component.data.custom_id));
  assert.ok(panelCustomIds.includes('music:stop'));
  assert.deepEqual(panel.components[1].components.map((component) => component.data.custom_id), ['music:queue', 'music:filter']);

  const ranking = createPopularTracksPayload([{ track: { title: 'Ditto', author: 'NewJeans' }, count: 3 }]);
  assert.match(ranking.embeds[0].data.description, /3회 재생/);

  const stats = createUserMusicStatsPayload({
    totalRequests: 4,
    genres: { kpop: { label: 'K-Pop', count: 4, lastRequestedAt: 1 } },
    artists: { nj: { label: 'NewJeans', count: 4, lastRequestedAt: 1 } },
    tracks: { ditto: { label: 'Ditto', count: 4, lastRequestedAt: 1 } }
  });
  assert.match(stats.embeds[0].data.description, /4곡/);
});

class MockLavalink {
  constructor() {
    this.configured = true;
    this.sessionId = 'session-1';
    this.updates = [];
  }

  async loadTracks(identifier) {
    return {
      loadType: identifier.startsWith('ytsearch:') ? 'search' : 'track',
      data: identifier.startsWith('ytsearch:') ? [SAMPLE_TRACK] : SAMPLE_TRACK
    };
  }

  async updatePlayer(guildId, payload) {
    this.updates.push({ guildId, payload });
    return { guildId, ...payload };
  }

  async getStats() {
    return this.stats ?? {
      players: 0,
      playingPlayers: 0,
      uptime: 0,
      memory: { free: 0, used: 0, allocated: 0, reservable: 0 },
      cpu: { cores: 0, systemLoad: 0, lavalinkLoad: 0 }
    };
  }

  async destroyPlayer(guildId) {
    this.destroyed = guildId;
  }

  close() {}
}

function createGuild(packets) {
  return {
    id: 'guild-1',
    shard: {
      async send(packet) {
        packets.push(packet);
      }
    }
  };
}

function createVoiceChannel() {
  return {
    id: 'voice-1',
    type: ChannelType.GuildVoice
  };
}

function createTextChannel() {
  return {
    id: 'text-1',
    async send() {
      return { id: 'panel-1', channelId: 'text-1', async edit(payload) { return payload; } };
    },
    messages: {
      async fetch() {
        return null;
      }
    }
  };
}

function createEditableTextChannel() {
  const channel = {
    id: 'text-1',
    sent: [],
    edits: [],
    message: null,
    async send(payload) {
      this.sent.push(payload);
      this.message = {
        id: 'panel-1',
        channelId: 'text-1',
        async edit(nextPayload) {
          channel.edits.push(nextPayload);
          return this;
        }
      };
      return this.message;
    },
    messages: {
      async fetch() {
        return channel.message;
      }
    }
  };
  return channel;
}

function createClock(start, step = 1000) {
  let value = start;
  return () => {
    value += step;
    return value;
  };
}
