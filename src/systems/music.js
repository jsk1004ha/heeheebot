import { spawn } from 'node:child_process';
import WebSocket from 'ws';

export const MUSIC_FEATURE_KEY = 'music';
export const DEFAULT_SEARCH_PREFIX = 'ytsearch';
export const DEFAULT_LAVALINK_PORT = 2333;
export const DEFAULT_LAVALINK_PASSWORD = 'youshallnotpass';
export const DEFAULT_YTDLP_TIMEOUT_MS = 12_000;
export const MAX_PLAYLIST_TRACKS = 200;
export const MAX_SEARCH_RESULTS = 5;
export const DEFAULT_PANEL_REFRESH_INTERVAL_MS = 15_000;

export const MUSIC_FILTER_PRESETS = Object.freeze({
  none: Object.freeze({
    label: '필터 없음',
    description: '원본 음질 그대로 재생합니다.',
    filters: Object.freeze({})
  }),
  bassboost: Object.freeze({
    label: '베이스 부스트',
    description: '저음을 살짝 강화합니다.',
    filters: Object.freeze({
      equalizer: Object.freeze([
        Object.freeze({ band: 0, gain: 0.20 }),
        Object.freeze({ band: 1, gain: 0.18 }),
        Object.freeze({ band: 2, gain: 0.12 }),
        Object.freeze({ band: 3, gain: 0.05 })
      ])
    })
  }),
  nightcore: Object.freeze({
    label: '나이트코어',
    description: '속도와 피치를 살짝 올립니다.',
    filters: Object.freeze({
      timescale: Object.freeze({ speed: 1.12, pitch: 1.10, rate: 1.0 })
    })
  }),
  vaporwave: Object.freeze({
    label: '베이퍼웨이브',
    description: '느리고 낮은 피치로 분위기를 바꿉니다.',
    filters: Object.freeze({
      timescale: Object.freeze({ speed: 0.86, pitch: 0.82, rate: 1.0 })
    })
  }),
  karaoke: Object.freeze({
    label: '노래방',
    description: '중앙 보컬 대역을 줄입니다.',
    filters: Object.freeze({
      karaoke: Object.freeze({ level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 })
    })
  })
});

const URL_PATTERN = /^https?:\/\//i;
const TRACK_END_REASONS_THAT_ADVANCE = new Set(['finished', 'loadFailed', 'stopped']);

export class LavalinkNodeClient {
  constructor(config = {}, {
    fetchFn = globalThis.fetch,
    WebSocketImpl = WebSocket,
    logger = console
  } = {}) {
    this.config = normalizeLavalinkConfig(config);
    this.fetchFn = fetchFn;
    this.WebSocketImpl = WebSocketImpl;
    this.logger = logger;
    this.sessionId = this.config.sessionId ?? null;
    this.socket = null;
    this.callbacks = {};
    this.connectedUserId = null;
  }

  get configured() {
    return Boolean(this.config.host && this.config.password);
  }

  get restBaseUrl() {
    const protocol = this.config.secure ? 'https' : 'http';
    return `${protocol}://${this.config.host}:${this.config.port}`;
  }

  get websocketUrl() {
    const protocol = this.config.secure ? 'wss' : 'ws';
    return `${protocol}://${this.config.host}:${this.config.port}/v4/websocket`;
  }

  async connect({ userId, onMessage, onReady, onClose, onError } = {}) {
    this.ensureConfigured();
    if (!userId) throw new Error('Lavalink WebSocket 연결에는 봇 User ID가 필요합니다.');
    if (this.socket && this.socket.readyState === this.WebSocketImpl.OPEN) return this.socket;

    this.callbacks = { onMessage, onReady, onClose, onError };
    this.connectedUserId = userId;

    const headers = {
      Authorization: this.config.password,
      'User-Id': userId,
      'Client-Name': this.config.clientName
    };
    if (this.sessionId) headers['Session-Id'] = this.sessionId;

    const socket = new this.WebSocketImpl(this.websocketUrl, { headers });
    this.socket = socket;

    socket.on('message', (payload) => {
      const message = parseWebSocketJson(payload, this.logger);
      if (!message) return;

      if (message.op === 'ready') {
        this.sessionId = message.sessionId;
        onReady?.(message);
      }

      onMessage?.(message);
    });

    socket.on('close', (code, reason) => {
      if (this.socket === socket) this.socket = null;
      onClose?.({ code, reason: reason?.toString?.() ?? '' });
    });

    socket.on('error', (error) => {
      this.logger.warn?.('Lavalink WebSocket error:', error);
      onError?.(error);
    });

    return socket;
  }

  async loadTracks(identifier) {
    this.ensureConfigured();
    const url = new URL('/v4/loadtracks', this.restBaseUrl);
    url.searchParams.set('identifier', identifier);
    return this.requestJson(url, { method: 'GET' });
  }

  async getStats() {
    this.ensureConfigured();
    return this.requestJson(new URL('/v4/stats', this.restBaseUrl), { method: 'GET' });
  }

  async updatePlayer(guildId, payload, { noReplace = false } = {}) {
    this.ensureSessionReady();
    const url = new URL(`/v4/sessions/${this.sessionId}/players/${guildId}`, this.restBaseUrl);
    url.searchParams.set('noReplace', String(Boolean(noReplace)));
    return this.requestJson(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async destroyPlayer(guildId) {
    if (!this.sessionId) return null;
    const url = new URL(`/v4/sessions/${this.sessionId}/players/${guildId}`, this.restBaseUrl);
    return this.requestJson(url, { method: 'DELETE', expectJson: false });
  }

  async requestJson(url, { expectJson = true, headers = {}, ...options } = {}) {
    const response = await this.fetchFn(url, {
      ...options,
      headers: {
        Authorization: this.config.password,
        ...headers
      }
    });

    if (!response.ok) {
      let detail = '';
      try {
        const errorPayload = await response.json();
        detail = errorPayload?.message ? `: ${errorPayload.message}` : '';
      } catch {
        try {
          const text = await response.text();
          detail = text ? `: ${text.slice(0, 200)}` : '';
        } catch {
          detail = '';
        }
      }
      throw new Error(`Lavalink 요청 실패 (${response.status})${detail}`);
    }

    if (!expectJson || response.status === 204) return null;
    return response.json();
  }

  ensureConfigured() {
    if (!this.configured) {
      throw new Error('Lavalink 설정이 필요합니다. LAVALINK_HOST와 LAVALINK_PASSWORD를 설정해주세요.');
    }
  }

  ensureSessionReady() {
    this.ensureConfigured();
    if (!this.sessionId) {
      throw new Error('Lavalink 세션이 아직 준비되지 않았습니다. 봇이 Ready 상태가 된 뒤 다시 시도해주세요.');
    }
  }

  close() {
    if (!this.socket) return;
    this.socket.close();
    this.socket = null;
  }
}

export class YtDlpMetadataResolver {
  constructor(config = {}, { spawnFn = spawn, logger = console } = {}) {
    this.config = normalizeYtDlpConfig(config);
    this.spawnFn = spawnFn;
    this.logger = logger;
  }

  get enabled() {
    return Boolean(this.config.enabled);
  }

  async search(query, { limit = MAX_SEARCH_RESULTS } = {}) {
    if (!this.enabled) return [];
    const identifier = isUrl(query) ? query : `ytsearch${limit}:${query}`;
    const payload = await this.runJson([
      '--ignore-config',
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--skip-download',
      identifier
    ]);

    const entries = Array.isArray(payload?.entries) ? payload.entries : [payload].filter(Boolean);
    return entries
      .slice(0, limit)
      .map(normalizeYtDlpEntry)
      .filter((track) => track.title && track.uri);
  }

  runJson(args) {
    return new Promise((resolve, reject) => {
      const child = this.spawnFn(this.config.path, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let stdout = '';
      let stderr = '';
      let settled = false;

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        reject(new Error(`yt-dlp 실행 시간이 ${this.config.timeoutMs}ms를 초과했습니다.`));
      }, this.config.timeoutMs);
      timeout.unref?.();

      child.stdout?.on('data', (chunk) => {
        stdout += chunk.toString('utf8');
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk.toString('utf8');
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`yt-dlp 실행 실패: ${error.message}`));
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`yt-dlp 종료 코드 ${code}: ${stderr.trim() || '오류 내용 없음'}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout));
        } catch (error) {
          reject(new Error(`yt-dlp JSON 파싱 실패: ${error.message}`));
        }
      });
    });
  }
}

export class MusicService {
  constructor({
    store = null,
    lavalink = null,
    ytdlp = null,
    config = {},
    logger = console,
    now = () => Date.now(),
    random = Math.random
  } = {}) {
    this.store = store;
    this.config = normalizeMusicConfig(config);
    this.logger = logger;
    this.now = now;
    this.random = random;
    this.lavalink = lavalink ?? new LavalinkNodeClient(this.config.lavalink, { logger });
    this.ytdlp = ytdlp ?? new YtDlpMetadataResolver(this.config.ytdlp, { logger });
    this.players = new Map();
    this.searchSessions = new Map();
    this.latestNodeStats = null;
    this.panelRenderer = null;
  }

  setPanelRenderer(renderer) {
    this.panelRenderer = typeof renderer === 'function' ? renderer : null;
  }

  async connectNode(userId) {
    if (!this.lavalink?.configured) return false;
    await this.lavalink.connect({
      userId,
      onMessage: (message) => this.handleLavalinkMessage(message),
      onReady: (message) => this.logger.log?.(`Lavalink connected. Session ${message.sessionId}`),
      onClose: ({ code, reason }) => this.logger.warn?.(`Lavalink disconnected (${code}) ${reason}`.trim()),
      onError: (error) => this.logger.warn?.('Lavalink connection error:', error)
    });
    return true;
  }

  async search(query, { limit = MAX_SEARCH_RESULTS } = {}) {
    const safeLimit = clampInteger(limit, 1, MAX_SEARCH_RESULTS);
    let tracks = [];
    try {
      const loadResult = await this.lavalink.loadTracks(toLavalinkIdentifier(query, this.config.defaultSearchPrefix));
      tracks = normalizeLavalinkLoadResult(loadResult).slice(0, safeLimit);
    } catch (error) {
      this.logger.warn?.('Lavalink search failed; trying yt-dlp fallback if enabled:', error);
    }

    if (tracks.length > 0) return tracks;

    try {
      return (await this.ytdlp.search(query, { limit: safeLimit })).slice(0, safeLimit);
    } catch (error) {
      this.logger.warn?.('yt-dlp search fallback failed:', error);
      return [];
    }
  }

  createSearchSession({ guildId, userId, query, tracks, ttlMs = 120_000 }) {
    const id = createShortId(this.now, this.random);
    this.searchSessions.set(id, {
      id,
      guildId,
      userId,
      query,
      tracks: tracks.map(cloneTrackCandidate),
      expiresAt: this.now() + ttlMs
    });
    this.pruneExpiredSearchSessions();
    return this.searchSessions.get(id);
  }

  getSearchSelection({ sessionId, index, guildId, userId }) {
    this.pruneExpiredSearchSessions();
    const session = this.searchSessions.get(sessionId);
    if (!session) throw new Error('검색 선택 시간이 만료되었습니다. `/검색`을 다시 실행해주세요.');
    if (session.guildId !== guildId) throw new Error('다른 서버의 검색 결과입니다.');
    if (session.userId !== userId) throw new Error('검색을 실행한 유저만 이 결과를 선택할 수 있습니다.');
    const selection = session.tracks[index];
    if (!selection) throw new Error('선택한 검색 결과를 찾을 수 없습니다.');
    this.searchSessions.delete(sessionId);
    return selection;
  }

  async playQuery({ guild, textChannel, voiceChannel, requester, query }) {
    const tracks = await this.resolvePlayableTracks(query, requester);
    if (tracks.length === 0) throw new Error('검색 결과가 없습니다. 다른 검색어나 URL을 시도해주세요.');
    return this.enqueueTracks({ guild, textChannel, voiceChannel, requester, tracks });
  }

  async playSelectedTrack({ guild, textChannel, voiceChannel, requester, track }) {
    const playable = track.encoded ? normalizeRuntimeTrack(track, requester) : (await this.resolvePlayableTracks(track.uri ?? track.title, requester))[0];
    if (!playable) throw new Error('선택한 곡을 Lavalink에서 재생 가능한 트랙으로 변환하지 못했습니다.');
    return this.enqueueTracks({ guild, textChannel, voiceChannel, requester, tracks: [playable] });
  }

  async playPlaylist({ guild, textChannel, voiceChannel, requester, name }) {
    assertStoreConfigured(this.store, '플레이리스트 재생');
    const playlist = await this.getPlaylist({ guildId: guild.id, userId: requester.id, name });
    if (!playlist) throw new Error(`플레이리스트 **${name}**을 찾을 수 없습니다.`);
    if (playlist.tracks.length === 0) throw new Error(`플레이리스트 **${playlist.name}**에 곡이 없습니다.`);

    const tracks = [];
    for (const storedTrack of playlist.tracks) {
      try {
        const resolved = await this.resolvePlayableTracks(storedTrack.uri ?? `${storedTrack.title} ${storedTrack.author}`, requester, { limit: 1 });
        if (resolved[0]) tracks.push(resolved[0]);
      } catch (error) {
        this.logger.warn?.(`Failed to resolve playlist track ${storedTrack.title}:`, error);
      }
    }

    if (tracks.length === 0) throw new Error('플레이리스트 곡을 재생 가능한 트랙으로 불러오지 못했습니다.');
    const result = await this.enqueueTracks({ guild, textChannel, voiceChannel, requester, tracks });
    return { ...result, playlist };
  }

  async enqueueTracks({ guild, textChannel, voiceChannel, requester, tracks }) {
    this.ensurePlaybackConfigured();
    if (!guild?.id) throw new Error('서버 정보를 찾을 수 없습니다.');
    if (!voiceChannel?.id) throw new Error('먼저 음성 채널에 들어가주세요.');

    const state = this.getOrCreatePlayerState(guild.id);
    state.guild = guild;
    state.textChannel = textChannel ?? state.textChannel;
    state.voiceChannelId = voiceChannel.id;
    state.textChannelId = textChannel?.id ?? state.textChannelId;

    await this.joinVoiceChannel(guild, voiceChannel.id);

    const normalizedTracks = tracks.map((track) => normalizeRuntimeTrack(track, requester));
    state.queue.push(...normalizedTracks);

    const startedNow = !state.current;
    if (startedNow) {
      await this.startNext(guild.id, { ignoreRepeat: true });
    } else {
      await this.refreshPanel(guild.id);
    }

    return {
      queued: normalizedTracks,
      startedNow,
      current: state.current,
      queueSize: state.queue.length
    };
  }

  async joinVoiceChannel(guild, channelId) {
    const state = this.getOrCreatePlayerState(guild.id);
    state.guild = guild;
    state.voiceChannelId = channelId;
    await sendGuildVoiceStateUpdate(guild, channelId);
    await this.maybeSendVoiceUpdate(guild.id);
  }

  async leaveVoiceChannel(guildId) {
    const state = this.players.get(guildId);
    if (!state?.guild) return;
    const previousVoiceChannelId = state.voiceChannelId;
    const previousLavalinkVoiceChannelId = state.voice.channelId;
    state.voiceChannelId = null;
    state.voice.channelId = null;
    try {
      await sendGuildVoiceStateUpdate(state.guild, null);
    } catch (error) {
      state.voiceChannelId = previousVoiceChannelId;
      state.voice.channelId = previousLavalinkVoiceChannelId;
      throw error;
    }
  }

  async pause(guildId) {
    const state = this.requirePlayerState(guildId);
    if (!state.current) throw new Error('현재 재생 중인 곡이 없습니다.');
    if (state.paused) return state;
    state.position = this.getCurrentPosition(guildId);
    state.lastPositionUpdateAt = this.now();
    state.paused = true;
    await this.lavalink.updatePlayer(guildId, { paused: true });
    await this.refreshPanel(guildId);
    return state;
  }

  async resume(guildId) {
    const state = this.requirePlayerState(guildId);
    if (!state.current) throw new Error('현재 재생 중인 곡이 없습니다.');
    if (!state.paused) return state;
    state.lastPositionUpdateAt = this.now();
    state.paused = false;
    await this.lavalink.updatePlayer(guildId, { paused: false });
    await this.refreshPanel(guildId);
    return state;
  }

  async skip(guildId) {
    const state = this.requirePlayerState(guildId);
    if (!state.current) throw new Error('현재 재생 중인 곡이 없습니다.');
    await this.startNext(guildId, { ignoreRepeat: true, skipped: true });
    return this.getPlayerState(guildId);
  }

  async stop(guildId) {
    const state = this.requirePlayerState(guildId);
    state.queue = [];
    state.history = state.current ? [state.current, ...state.history].slice(0, 20) : state.history;
    state.current = null;
    state.paused = false;
    state.position = 0;
    state.lastPositionUpdateAt = this.now();
    await this.lavalink.updatePlayer(guildId, { track: { encoded: null } }).catch((error) => {
      this.logger.warn?.('Failed to stop Lavalink track:', error);
    });
    await this.lavalink.destroyPlayer(guildId).catch((error) => {
      this.logger.warn?.('Failed to destroy Lavalink player:', error);
    });
    await this.leaveVoiceChannel(guildId);
    await this.refreshPanel(guildId);
    return state;
  }

  async toggleRepeat(guildId) {
    const state = this.requirePlayerState(guildId);
    state.repeat = !state.repeat;
    await this.refreshPanel(guildId);
    return state.repeat;
  }

  async shuffleQueue(guildId) {
    const state = this.requirePlayerState(guildId);
    shuffleInPlace(state.queue, this.random);
    state.shuffle = !state.shuffle;
    await this.refreshPanel(guildId);
    return state;
  }

  async setFilter(guildId, filterName) {
    const state = this.requirePlayerState(guildId);
    const preset = MUSIC_FILTER_PRESETS[filterName];
    if (!preset) throw new Error('알 수 없는 음악 필터입니다.');
    state.filter = filterName;
    await this.lavalink.updatePlayer(guildId, { filters: preset.filters });
    await this.refreshPanel(guildId);
    return preset;
  }

  async startNext(guildId, { ignoreRepeat = false, skipped = false } = {}) {
    const state = this.requirePlayerState(guildId);
    let nextTrack = null;

    if (!ignoreRepeat && state.repeat && state.current) {
      nextTrack = state.current;
    } else {
      if (state.current) state.history = [state.current, ...state.history].slice(0, 20);
      nextTrack = state.queue.shift() ?? null;
    }

    if (!nextTrack) {
      state.current = null;
      state.paused = false;
      state.position = 0;
      state.lastPositionUpdateAt = this.now();
      if (skipped) {
        await this.lavalink.updatePlayer(guildId, { track: { encoded: null } }).catch((error) => {
          this.logger.warn?.('Failed to stop Lavalink track after queue drained:', error);
        });
      }
      await this.lavalink.destroyPlayer(guildId).catch((error) => {
        this.logger.warn?.('Failed to destroy drained Lavalink player:', error);
      });
      await this.leaveVoiceChannel(guildId).catch((error) => {
        this.logger.warn?.('Failed to leave Discord voice channel after queue drained:', error);
      });
      await this.refreshPanel(guildId);
      return null;
    }

    state.current = nextTrack;
    state.paused = false;
    state.position = 0;
    state.lastPositionUpdateAt = this.now();
    await this.lavalink.updatePlayer(guildId, {
      track: {
        encoded: nextTrack.encoded,
        userData: {
          requesterId: nextTrack.requesterId,
          requesterName: nextTrack.requesterName
        }
      },
      paused: false,
      filters: MUSIC_FILTER_PRESETS[state.filter]?.filters ?? {}
    });
    await this.recordTrackStarted(guildId, nextTrack);
    await this.refreshPanel(guildId);
    return nextTrack;
  }

  async handleLavalinkMessage(message) {
    if (message.op === 'stats') {
      this.latestNodeStats = {
        receivedAt: this.now(),
        stats: normalizeLavalinkStats(message)
      };
      return;
    }

    if (message.op === 'playerUpdate') {
      const state = this.players.get(message.guildId);
      if (state) {
        state.position = Math.max(0, Number(message.state?.position) || 0);
        state.lastPositionUpdateAt = this.now();
        if (this.shouldRefreshProgressPanel(state)) {
          await this.refreshPanel(message.guildId).catch((error) => {
            this.logger.warn?.('Failed to auto-refresh music progress panel:', error);
          });
        }
      }
      return;
    }

    if (message.op !== 'event') return;
    const guildId = message.guildId;
    if (!guildId || !this.players.has(guildId)) return;

    if (message.type === 'TrackEndEvent') {
      const reason = String(message.reason ?? '').toLowerCase();
      if (TRACK_END_REASONS_THAT_ADVANCE.has(reason)) {
        await this.startNext(guildId).catch((error) => this.logger.error?.('Failed to advance queue:', error));
      }
      return;
    }

    if (message.type === 'TrackExceptionEvent' || message.type === 'TrackStuckEvent') {
      this.logger.warn?.(`Lavalink ${message.type}; advancing queue.`, message);
      await this.startNext(guildId, { ignoreRepeat: true }).catch((error) => this.logger.error?.('Failed to recover queue:', error));
    }
  }

  async handleRawDiscordPacket(packet, botUserId) {
    if (!packet?.t || !packet?.d || !botUserId) return false;

    if (packet.t === 'VOICE_STATE_UPDATE') {
      const payload = packet.d;
      if (payload.user_id !== botUserId || !payload.guild_id) return false;
      const state = this.getOrCreatePlayerState(payload.guild_id);
      state.voice.sessionId = payload.session_id ?? null;
      state.voice.channelId = Object.hasOwn(payload, 'channel_id') ? payload.channel_id : state.voiceChannelId ?? null;
      state.voiceChannelId = state.voice.channelId;
      await this.maybeSendVoiceUpdate(payload.guild_id);
      return true;
    }

    if (packet.t === 'VOICE_SERVER_UPDATE') {
      const payload = packet.d;
      if (!payload.guild_id) return false;
      const state = this.getOrCreatePlayerState(payload.guild_id);
      state.voice.token = payload.token ?? null;
      state.voice.endpoint = payload.endpoint ?? null;
      await this.maybeSendVoiceUpdate(payload.guild_id);
      return true;
    }

    return false;
  }

  async maybeSendVoiceUpdate(guildId) {
    const state = this.players.get(guildId);
    if (!state || !state.voice.token || !state.voice.endpoint || !state.voice.sessionId) return false;
    if (!this.lavalink?.sessionId) return false;

    await this.lavalink.updatePlayer(guildId, {
      voice: {
        token: state.voice.token,
        endpoint: state.voice.endpoint,
        sessionId: state.voice.sessionId,
        channelId: state.voice.channelId ?? state.voiceChannelId ?? null
      }
    });
    return true;
  }

  async resolvePlayableTracks(query, requester, { limit = 100 } = {}) {
    this.ensurePlaybackConfigured();
    const loadResult = await this.lavalink.loadTracks(toLavalinkIdentifier(query, this.config.defaultSearchPrefix));
    return normalizeLavalinkLoadResult(loadResult)
      .slice(0, limit)
      .map((track) => normalizeRuntimeTrack(track, requester));
  }

  async createPlaylist({ guildId, userId, username, name }) {
    assertStoreConfigured(this.store, '플레이리스트 생성');
    return this.store.update((data) => {
      const playlists = getOrCreateUserPlaylists(data, guildId, userId);
      const key = normalizePlaylistKey(name);
      if (playlists[key]) throw new Error(`이미 **${name}** 플레이리스트가 있습니다.`);
      const now = this.now();
      playlists[key] = {
        name: normalizePlaylistName(name),
        ownerId: userId,
        ownerName: username,
        public: false,
        tracks: [],
        createdAt: now,
        updatedAt: now
      };
      return clonePlaylist(playlists[key]);
    });
  }

  async addCurrentTrackToPlaylist({ guildId, userId, username, name }) {
    const state = this.players.get(guildId);
    if (!state?.current) throw new Error('현재 재생 중인 곡이 없습니다.');
    return this.addTrackToPlaylist({ guildId, userId, username, name, track: state.current });
  }

  async addTrackToPlaylist({ guildId, userId, username, name, track }) {
    assertStoreConfigured(this.store, '플레이리스트 곡 추가');
    return this.store.update((data) => {
      const playlists = getOrCreateUserPlaylists(data, guildId, userId);
      const key = normalizePlaylistKey(name);
      const playlist = playlists[key];
      if (!playlist) throw new Error(`플레이리스트 **${name}**을 먼저 생성해주세요.`);
      if (playlist.tracks.length >= MAX_PLAYLIST_TRACKS) {
        throw new Error(`플레이리스트는 최대 ${MAX_PLAYLIST_TRACKS}곡까지 저장할 수 있습니다.`);
      }
      const storedTrack = toStoredTrack(track);
      playlist.ownerName = username ?? playlist.ownerName;
      playlist.tracks.push(storedTrack);
      playlist.updatedAt = this.now();
      return { playlist: clonePlaylist(playlist), track: structuredClone(storedTrack) };
    });
  }

  async setPlaylistPublic({ guildId, userId, name, isPublic = true }) {
    assertStoreConfigured(this.store, '플레이리스트 공개 설정');
    return this.store.update((data) => {
      const playlist = getPlaylistFromData(data, guildId, userId, name);
      if (!playlist) throw new Error(`플레이리스트 **${name}**을 찾을 수 없습니다.`);
      playlist.public = Boolean(isPublic);
      playlist.updatedAt = this.now();
      return clonePlaylist(playlist);
    });
  }

  async importPublicPlaylist({ guildId, ownerId, importerId, importerName, name }) {
    assertStoreConfigured(this.store, '공개 플레이리스트 가져오기');
    return this.store.update((data) => {
      const source = getPlaylistFromData(data, guildId, ownerId, name);
      if (!source) throw new Error('가져올 플레이리스트를 찾을 수 없습니다.');
      if (!source.public) throw new Error('공개된 플레이리스트만 가져올 수 있습니다.');
      const targetPlaylists = getOrCreateUserPlaylists(data, guildId, importerId);
      const key = normalizePlaylistKey(source.name);
      if (targetPlaylists[key]) throw new Error(`내 플레이리스트에 **${source.name}** 이름이 이미 있습니다.`);
      const now = this.now();
      targetPlaylists[key] = {
        ...clonePlaylist(source),
        ownerId: importerId,
        ownerName: importerName,
        public: false,
        createdAt: now,
        updatedAt: now,
        importedFrom: {
          ownerId: source.ownerId,
          ownerName: source.ownerName,
          name: source.name,
          importedAt: now
        }
      };
      return clonePlaylist(targetPlaylists[key]);
    });
  }

  async getPlaylist({ guildId, userId, name }) {
    assertStoreConfigured(this.store, '플레이리스트 조회');
    return this.store.view((data) => {
      const playlist = getPlaylistFromData(data, guildId, userId, name);
      return playlist ? clonePlaylist(playlist) : null;
    });
  }

  async getTopTracks({ guildId, limit = 10 } = {}) {
    assertStoreConfigured(this.store, '인기곡 랭킹');
    const safeLimit = clampInteger(limit, 1, 20);
    return this.store.view((data) => {
      const music = getGuildMusic(data, guildId);
      return Object.values(music?.playCounts ?? {})
        .sort((left, right) => (right.count - left.count) || (right.lastPlayedAt - left.lastPlayedAt))
        .slice(0, safeLimit)
        .map((entry) => ({
          track: structuredClone(entry.track),
          count: entry.count,
          lastPlayedAt: entry.lastPlayedAt
        }));
    });
  }

  async getUserStats({ guildId, userId }) {
    assertStoreConfigured(this.store, '내 음악 통계');
    return this.store.view((data) => {
      const stats = getGuildMusic(data, guildId)?.users?.[userId];
      return stats ? cloneUserMusicStats(stats) : createEmptyUserMusicStats(userId);
    });
  }

  async getNodeStatus() {
    this.ensurePlaybackConfigured();
    const restStats = typeof this.lavalink.getStats === 'function'
      ? normalizeLavalinkStats(await this.lavalink.getStats())
      : null;
    const websocketStats = this.latestNodeStats?.stats ?? null;
    const stats = mergeLavalinkStats(restStats, websocketStats);
    if (!stats) throw new Error('Lavalink 노드 통계를 가져오지 못했습니다.');

    return {
      ...stats,
      fetchedAt: this.now(),
      websocketStatsReceivedAt: this.latestNodeStats?.receivedAt ?? null,
      frameStatsSource: stats.frameStats
        ? (restStats?.frameStats ? 'rest' : 'websocket')
        : null
    };
  }

  async recordTrackStarted(guildId, track) {
    if (!this.store) return null;
    const storedTrack = toStoredTrack(track);
    const trackKey = getTrackKey(storedTrack);
    const artistKey = normalizeStatKey(storedTrack.author || '알 수 없음');
    const genre = storedTrack.genre || '미분류';
    const genreKey = normalizeStatKey(genre);
    const now = this.now();

    return this.store.update((data) => {
      const music = getOrCreateGuildMusic(data, guildId);
      const playEntry = music.playCounts[trackKey] ?? { track: storedTrack, count: 0, lastPlayedAt: 0 };
      playEntry.track = storedTrack;
      playEntry.count += 1;
      playEntry.lastPlayedAt = now;
      music.playCounts[trackKey] = playEntry;

      const userStats = getOrCreateUserMusicStats(music, track.requesterId, track.requesterName);
      userStats.username = track.requesterName ?? userStats.username;
      userStats.totalRequests += 1;
      userStats.lastRequestedAt = now;
      incrementStatBucket(userStats.tracks, trackKey, storedTrack.title, now, { track: storedTrack });
      incrementStatBucket(userStats.artists, artistKey, storedTrack.author || '알 수 없음', now);
      incrementStatBucket(userStats.genres, genreKey, genre, now);

      return {
        track: storedTrack,
        totalRequests: userStats.totalRequests
      };
    });
  }

  getPlayerState(guildId) {
    const state = this.players.get(guildId);
    if (!state) return null;
    return {
      ...state,
      queue: [...state.queue],
      history: [...state.history],
      voice: { ...state.voice },
      position: this.getCurrentPosition(guildId)
    };
  }

  getCurrentPosition(guildId) {
    const state = this.players.get(guildId);
    if (!state?.current) return 0;
    const length = Number(state.current.length) || Number.POSITIVE_INFINITY;
    if (state.paused) return Math.min(state.position, length);
    const elapsed = Math.max(0, this.now() - state.lastPositionUpdateAt);
    return Math.min(state.position + elapsed, length);
  }

  async refreshPanel(guildId) {
    const state = this.players.get(guildId);
    if (!state?.textChannel || !this.panelRenderer) return null;
    state.lastPanelRefreshAt = this.now();
    const payload = this.panelRenderer(this.getPlayerState(guildId));
    if (!payload) return null;

    try {
      if (state.panelMessageId && typeof state.textChannel.messages?.fetch === 'function') {
        const existing = await state.textChannel.messages.fetch(state.panelMessageId).catch(() => null);
        if (existing && typeof existing.edit === 'function') {
          const edited = await existing.edit(payload);
          state.panelMessage = edited;
          return edited;
        }
      }

      if (typeof state.textChannel.send !== 'function') return null;
      const message = await state.textChannel.send(payload);
      state.panelMessageId = message.id ?? null;
      state.panelChannelId = message.channelId ?? state.textChannel.id ?? null;
      state.panelMessage = message;
      if (this.config.pinPanel && typeof message.pin === 'function') {
        await message.pin('희희봇 음악 패널 고정').catch((error) => {
          this.logger.debug?.('Failed to pin music panel:', error);
        });
      }
      return message;
    } catch (error) {
      this.logger.warn?.('Failed to refresh music panel:', error);
      return null;
    }
  }

  shouldRefreshProgressPanel(state) {
    const intervalMs = this.config.panelRefreshIntervalMs;
    if (!state?.current || state.paused || !state.textChannel || !this.panelRenderer) return false;
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
    return this.now() - (state.lastPanelRefreshAt ?? 0) >= intervalMs;
  }

  getOrCreatePlayerState(guildId) {
    if (!this.players.has(guildId)) this.players.set(guildId, createPlayerState(guildId, this.now()));
    return this.players.get(guildId);
  }

  requirePlayerState(guildId) {
    const state = this.players.get(guildId);
    if (!state) throw new Error('이 서버에는 활성 음악 플레이어가 없습니다.');
    return state;
  }

  ensurePlaybackConfigured() {
    if (!this.lavalink?.configured) {
      throw new Error('음악 재생을 위해 Lavalink 설정이 필요합니다. LAVALINK_HOST와 LAVALINK_PASSWORD를 확인해주세요.');
    }
  }

  pruneExpiredSearchSessions() {
    const now = this.now();
    for (const [id, session] of this.searchSessions) {
      if (session.expiresAt <= now) this.searchSessions.delete(id);
    }
  }

  close() {
    this.lavalink?.close?.();
  }
}

export function normalizeMusicConfig(config = {}) {
  return {
    lavalink: normalizeLavalinkConfig(config.lavalink ?? config),
    ytdlp: normalizeYtDlpConfig(config.ytdlp ?? {}),
    defaultSearchPrefix: normalizeSearchPrefix(config.defaultSearchPrefix ?? DEFAULT_SEARCH_PREFIX),
    pinPanel: Boolean(config.pinPanel),
    panelRefreshIntervalMs: clampInteger(
      config.panelRefreshIntervalMs ?? DEFAULT_PANEL_REFRESH_INTERVAL_MS,
      5_000,
      60_000
    )
  };
}

export function normalizeLavalinkConfig(config = {}) {
  return {
    host: normalizeOptionalString(config.host),
    port: normalizePort(config.port ?? DEFAULT_LAVALINK_PORT),
    password: normalizeOptionalString(config.password ?? DEFAULT_LAVALINK_PASSWORD),
    secure: Boolean(config.secure),
    sessionId: normalizeOptionalString(config.sessionId),
    clientName: normalizeOptionalString(config.clientName) ?? 'heeheebot/0.x'
  };
}

export function normalizeYtDlpConfig(config = {}) {
  return {
    enabled: Boolean(config.enabled),
    path: normalizeOptionalString(config.path) ?? 'yt-dlp',
    timeoutMs: clampInteger(config.timeoutMs ?? DEFAULT_YTDLP_TIMEOUT_MS, 1_000, 60_000)
  };
}

export function normalizeLavalinkStats(stats) {
  if (!stats) return null;
  return {
    players: normalizeNonNegativeNumber(stats.players),
    playingPlayers: normalizeNonNegativeNumber(stats.playingPlayers),
    uptime: normalizeNonNegativeNumber(stats.uptime),
    memory: normalizeMemoryStats(stats.memory),
    cpu: normalizeCpuStats(stats.cpu),
    frameStats: normalizeFrameStats(stats.frameStats)
  };
}

function mergeLavalinkStats(restStats, websocketStats) {
  if (!restStats && !websocketStats) return null;
  return {
    ...(websocketStats ?? {}),
    ...(restStats ?? {}),
    frameStats: restStats?.frameStats ?? websocketStats?.frameStats ?? null
  };
}

function normalizeMemoryStats(memory = {}) {
  return {
    free: normalizeNonNegativeNumber(memory.free),
    used: normalizeNonNegativeNumber(memory.used),
    allocated: normalizeNonNegativeNumber(memory.allocated),
    reservable: normalizeNonNegativeNumber(memory.reservable)
  };
}

function normalizeCpuStats(cpu = {}) {
  return {
    cores: normalizeNonNegativeNumber(cpu.cores),
    systemLoad: normalizeNonNegativeNumber(cpu.systemLoad),
    lavalinkLoad: normalizeNonNegativeNumber(cpu.lavalinkLoad)
  };
}

function normalizeFrameStats(frameStats) {
  if (!frameStats) return null;
  return {
    sent: normalizeNonNegativeNumber(frameStats.sent),
    nulled: normalizeNonNegativeNumber(frameStats.nulled),
    deficit: Number(frameStats.deficit) || 0
  };
}

export function normalizeLavalinkLoadResult(loadResult) {
  const loadType = String(loadResult?.loadType ?? '').toLowerCase();
  const data = loadResult?.data;

  if (['track', 'track_loaded'].includes(loadType)) {
    return data ? [normalizeLavalinkTrack(data)] : [];
  }

  if (['playlist', 'playlist_loaded'].includes(loadType)) {
    const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
    return tracks.map(normalizeLavalinkTrack).filter(Boolean);
  }

  if (['search', 'search_result'].includes(loadType)) {
    const tracks = Array.isArray(data) ? data : [];
    return tracks.map(normalizeLavalinkTrack).filter(Boolean);
  }

  if (['empty', 'no_matches'].includes(loadType)) return [];

  if (['error', 'load_failed'].includes(loadType)) {
    const message = data?.message ?? data?.exception?.message ?? '알 수 없는 Lavalink 로드 오류';
    throw new Error(message);
  }

  return [];
}

export function normalizeLavalinkTrack(track) {
  if (!track) return null;
  const info = track.info ?? {};
  return {
    encoded: track.encoded ?? track.track ?? null,
    title: cleanTrackText(info.title) || '제목 없음',
    author: cleanTrackText(info.author) || '알 수 없음',
    uri: info.uri ?? null,
    length: normalizeDurationMs(info.length),
    isStream: Boolean(info.isStream),
    sourceName: info.sourceName ?? null,
    identifier: info.identifier ?? null,
    artworkUrl: info.artworkUrl ?? null,
    genre: track.pluginInfo?.genre ?? track.userData?.genre ?? null,
    pluginInfo: track.pluginInfo ?? {},
    userData: track.userData ?? {}
  };
}

export function toLavalinkIdentifier(query, defaultSearchPrefix = DEFAULT_SEARCH_PREFIX) {
  const normalized = String(query ?? '').trim();
  if (!normalized) throw new Error('검색어 또는 URL을 입력해주세요.');
  if (isUrl(normalized)) return normalized;
  if (/^[a-z][a-z0-9+.-]*search:/i.test(normalized)) return normalized;
  return `${normalizeSearchPrefix(defaultSearchPrefix)}:${normalized}`;
}

export function toStoredTrack(track) {
  return {
    title: cleanTrackText(track?.title) || '제목 없음',
    author: cleanTrackText(track?.author) || '알 수 없음',
    uri: track?.uri ?? null,
    length: normalizeDurationMs(track?.length),
    isStream: Boolean(track?.isStream),
    sourceName: track?.sourceName ?? null,
    identifier: track?.identifier ?? null,
    artworkUrl: track?.artworkUrl ?? null,
    genre: cleanTrackText(track?.genre) || null,
    addedAt: Number(track?.addedAt) || Date.now()
  };
}

export function getTrackKey(track) {
  const uri = normalizeOptionalString(track?.uri)?.toLowerCase();
  if (uri) return `uri:${uri}`;
  const sourceIdentifier = [track?.sourceName, track?.identifier].filter(Boolean).join(':').toLowerCase();
  if (sourceIdentifier) return `id:${sourceIdentifier}`;
  return `text:${normalizeStatKey(`${track?.title ?? ''}:${track?.author ?? ''}`)}`;
}

function createPlayerState(guildId, now) {
  return {
    guildId,
    guild: null,
    textChannel: null,
    textChannelId: null,
    voiceChannelId: null,
    current: null,
    queue: [],
    history: [],
    paused: false,
    repeat: false,
    shuffle: false,
    filter: 'none',
    position: 0,
    lastPositionUpdateAt: now,
    lastPanelRefreshAt: 0,
    panelMessageId: null,
    panelChannelId: null,
    panelMessage: null,
    voice: {
      token: null,
      endpoint: null,
      sessionId: null,
      channelId: null
    }
  };
}

function normalizeRuntimeTrack(track, requester) {
  const normalized = track?.encoded || track?.title ? track : normalizeLavalinkTrack(track);
  if (!normalized?.encoded) throw new Error(`트랙 **${normalized?.title ?? '알 수 없음'}**의 Lavalink encoded 데이터가 없습니다.`);
  return {
    ...normalized,
    requesterId: requester?.id ?? normalized.requesterId ?? null,
    requesterName: requester?.username ?? requester?.displayName ?? normalized.requesterName ?? '알 수 없음',
    addedAt: Date.now()
  };
}

function normalizeYtDlpEntry(entry) {
  const duration = Number(entry.duration) || 0;
  const webpageUrl = entry.webpage_url || entry.original_url || (entry.url && isUrl(entry.url) ? entry.url : null);
  return {
    encoded: null,
    title: cleanTrackText(entry.title) || '제목 없음',
    author: cleanTrackText(entry.uploader || entry.channel || entry.creator) || '알 수 없음',
    uri: webpageUrl,
    length: duration > 0 ? Math.round(duration * 1000) : 0,
    isStream: Boolean(entry.is_live || entry.live_status === 'is_live'),
    sourceName: 'yt-dlp',
    identifier: entry.id ?? null,
    artworkUrl: entry.thumbnail ?? null,
    genre: Array.isArray(entry.categories) ? entry.categories[0] ?? null : entry.genre ?? null,
    pluginInfo: {},
    userData: {}
  };
}

async function sendGuildVoiceStateUpdate(guild, channelId) {
  const payload = {
    op: 4,
    d: {
      guild_id: guild.id,
      channel_id: channelId,
      self_mute: false,
      self_deaf: true
    }
  };

  if (typeof guild.shard?.send === 'function') {
    await guild.shard.send(payload);
    return;
  }

  const shard = guild.client?.ws?.shards?.get?.(guild.shardId ?? 0);
  if (typeof shard?.send === 'function') {
    await shard.send(payload);
    return;
  }

  throw new Error('Discord 음성 채널에 연결할 Gateway shard를 찾을 수 없습니다.');
}

function getGuildMusic(data, guildId) {
  return data.guilds?.[guildId]?.[MUSIC_FEATURE_KEY] ?? null;
}

function getOrCreateGuildMusic(data, guildId) {
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  data.guilds[guildId][MUSIC_FEATURE_KEY] ??= {};
  const music = data.guilds[guildId][MUSIC_FEATURE_KEY];
  music.playlists ??= {};
  music.playCounts ??= {};
  music.users ??= {};
  return music;
}

function getOrCreateUserPlaylists(data, guildId, userId) {
  const music = getOrCreateGuildMusic(data, guildId);
  music.playlists[userId] ??= {};
  return music.playlists[userId];
}

function getPlaylistFromData(data, guildId, userId, name) {
  const key = normalizePlaylistKey(name);
  return getGuildMusic(data, guildId)?.playlists?.[userId]?.[key] ?? null;
}

function getOrCreateUserMusicStats(music, userId, username) {
  const safeUserId = userId ?? 'unknown';
  music.users[safeUserId] ??= createEmptyUserMusicStats(safeUserId, username);
  const stats = music.users[safeUserId];
  stats.username = username ?? stats.username ?? '알 수 없음';
  stats.totalRequests ??= 0;
  stats.tracks ??= {};
  stats.artists ??= {};
  stats.genres ??= {};
  return stats;
}

function createEmptyUserMusicStats(userId, username = null) {
  return {
    userId,
    username: username ?? '알 수 없음',
    totalRequests: 0,
    lastRequestedAt: null,
    tracks: {},
    artists: {},
    genres: {}
  };
}

function incrementStatBucket(bucket, key, label, now, extra = {}) {
  bucket[key] ??= { key, label, count: 0, lastRequestedAt: 0, ...extra };
  bucket[key].label = label;
  bucket[key].count += 1;
  bucket[key].lastRequestedAt = now;
  if (extra.track) bucket[key].track = extra.track;
}

function clonePlaylist(playlist) {
  return {
    ...playlist,
    tracks: playlist.tracks.map((track) => structuredClone(track)),
    importedFrom: playlist.importedFrom ? { ...playlist.importedFrom } : undefined
  };
}

function cloneUserMusicStats(stats) {
  return structuredClone({
    userId: stats.userId,
    username: stats.username,
    totalRequests: stats.totalRequests ?? 0,
    lastRequestedAt: stats.lastRequestedAt ?? null,
    tracks: stats.tracks ?? {},
    artists: stats.artists ?? {},
    genres: stats.genres ?? {}
  });
}

function cloneTrackCandidate(track) {
  return structuredClone(track);
}

function normalizePlaylistName(name) {
  const normalized = String(name ?? '').normalize('NFKC').trim();
  if (normalized.length < 1 || normalized.length > 40) {
    throw new Error('플레이리스트 이름은 1~40자여야 합니다.');
  }
  return normalized;
}

function normalizePlaylistKey(name) {
  return normalizePlaylistName(name).toLocaleLowerCase('ko-KR');
}

function normalizeStatKey(value) {
  return String(value ?? 'unknown')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/\s+/g, ' ')
    || 'unknown';
}

function normalizeSearchPrefix(prefix) {
  const normalized = String(prefix ?? DEFAULT_SEARCH_PREFIX).trim().replace(/:$/, '');
  return normalized || DEFAULT_SEARCH_PREFIX;
}

function cleanTrackText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeDurationMs(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function normalizePort(value) {
  return clampInteger(value, 1, 65_535);
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function clampInteger(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.trunc(number)));
}

function normalizeNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isUrl(value) {
  return URL_PATTERN.test(String(value ?? '').trim());
}

function createShortId(now, random) {
  const timestamp = Math.max(0, Number(now()) || Date.now()).toString(36);
  const nonce = Math.floor(Math.max(0, Math.min(0.999999, random())) * 36 ** 4).toString(36).padStart(4, '0');
  return `${timestamp}${nonce}`;
}

function shuffleInPlace(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}

function parseWebSocketJson(payload, logger) {
  try {
    return JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));
  } catch (error) {
    logger.warn?.('Invalid Lavalink WebSocket payload:', error);
    return null;
  }
}

function assertStoreConfigured(store, feature) {
  if (!store) throw new Error(`${feature} 저장소가 준비되지 않았습니다.`);
}
