import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  MAX_SEARCH_RESULTS,
  MUSIC_FILTER_PRESETS
} from '../systems/music.js';
import { safeReplyToInteraction } from './interactions.js';

const MUSIC_COMMAND_NAMES = new Set(['재생', '검색', '일시정지', '다시재생', '스킵', '정지', '큐', '플리', '내음악통계']);
const MUSIC_CUSTOM_ID_PREFIX = 'music:';
const PLAYLIST_TARGET_CURRENT = '현재곡';
const MUSIC_COLOR = 0x8b5cf6;
const QUEUE_COLOR = 0x38bdf8;
const STATS_COLOR = 0xfacc15;
const PROGRESS_BAR_LENGTH = 14;

export const musicCommands = [
  new SlashCommandBuilder()
    .setName('재생')
    .setDescription('검색어 또는 URL로 노래를 찾아 바로 재생합니다.')
    .addStringOption((option) =>
      option
        .setName('검색어')
        .setDescription('노래 제목, 키워드, YouTube/SoundCloud URL')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('검색')
    .setDescription('상위 5개 음악 검색 결과를 버튼으로 선택합니다.')
    .addStringOption((option) =>
      option
        .setName('검색어')
        .setDescription('검색할 노래 제목 또는 키워드')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('일시정지')
    .setDescription('현재 곡을 일시정지합니다.'),
  new SlashCommandBuilder()
    .setName('다시재생')
    .setDescription('일시정지한 곡을 다시 재생합니다.'),
  new SlashCommandBuilder()
    .setName('스킵')
    .setDescription('현재 곡을 넘깁니다.'),
  new SlashCommandBuilder()
    .setName('정지')
    .setDescription('재생을 멈추고 큐를 비운 뒤 음성 채널에서 나갑니다.'),
  new SlashCommandBuilder()
    .setName('큐')
    .setDescription('현재 음악 대기열을 임베드로 보여줍니다.'),
  new SlashCommandBuilder()
    .setName('플리')
    .setDescription('개인 음악 플레이리스트를 만들고 재생합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('생성')
        .setDescription('새 플레이리스트를 생성합니다.')
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('플레이리스트 이름')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추가')
        .setDescription('현재 재생 중인 곡을 플레이리스트에 추가합니다.')
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('플레이리스트 이름')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('대상')
            .setDescription('추가할 곡')
            .addChoices({ name: '현재곡', value: PLAYLIST_TARGET_CURRENT })
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('재생')
        .setDescription('저장된 플레이리스트를 재생합니다.')
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('플레이리스트 이름')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('공개')
        .setDescription('내 플레이리스트를 다른 유저가 가져갈 수 있게 공개합니다.')
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('플레이리스트 이름')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('가져오기')
        .setDescription('다른 유저의 공개 플레이리스트를 내 목록으로 가져옵니다.')
        .addUserOption((option) =>
          option
            .setName('유저')
            .setDescription('공개 플레이리스트 소유자')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('이름')
            .setDescription('가져올 플레이리스트 이름')
            .setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName('내음악통계')
    .setDescription('내가 가장 많이 신청한 장르, 아티스트, 곡 수를 보여줍니다.')
];

export function getMusicCommandPayloads() {
  return musicCommands.map((command) => command.toJSON());
}

export async function handleMusicCommand(interaction, music, logger = console) {
  if (interaction.isButton?.() && interaction.customId?.startsWith(MUSIC_CUSTOM_ID_PREFIX)) {
    await handleMusicButton(interaction, music, logger);
    return true;
  }

  if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('music:filter_select')) {
    await handleMusicFilterSelect(interaction, music);
    return true;
  }

  if (!interaction.isChatInputCommand?.()) return false;

  if (interaction.commandName === '랭킹') {
    if (getOptionString(interaction, '종류') !== '인기곡') return false;
    await handlePopularRankingCommand(interaction, music);
    return true;
  }

  if (!MUSIC_COMMAND_NAMES.has(interaction.commandName)) return false;

  if (!interaction.inGuild?.()) {
    await safeReplyToInteraction(interaction, '서버에서만 사용할 수 있는 음악 명령어입니다.', {
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    switch (interaction.commandName) {
      case '재생':
        await handlePlayCommand(interaction, music);
        return true;
      case '검색':
        await handleSearchCommand(interaction, music);
        return true;
      case '일시정지':
        await music.pause(interaction.guildId);
        await safeReplyToInteraction(interaction, '⏸ 일시정지했습니다.');
        return true;
      case '다시재생':
        await music.resume(interaction.guildId);
        await safeReplyToInteraction(interaction, '▶️ 다시 재생합니다.');
        return true;
      case '스킵': {
        const state = await music.skip(interaction.guildId);
        await safeReplyToInteraction(interaction, state?.current ? `⏭ 다음 곡: **${state.current.title}**` : '⏭ 큐가 비어 재생을 멈췄습니다.');
        return true;
      }
      case '정지':
        await music.stop(interaction.guildId);
        await safeReplyToInteraction(interaction, '⏹ 재생을 멈추고 큐를 비웠습니다.');
        return true;
      case '큐':
        await safeReplyToInteraction(interaction, createQueuePayload(music.getPlayerState(interaction.guildId)));
        return true;
      case '플리':
        await handlePlaylistCommand(interaction, music);
        return true;
      case '내음악통계':
        await handleMyMusicStatsCommand(interaction, music);
        return true;
      default:
        return false;
    }
  } catch (error) {
    logger.warn?.('Music command failed:', error);
    await safeReplyToInteraction(interaction, `음악 명령 실패: ${error.message}`, {
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
}

export function createMusicPanelPayload(state) {
  const embed = new EmbedBuilder().setColor(MUSIC_COLOR);

  if (!state?.current) {
    embed
      .setTitle('⏹ 음악 재생이 멈췄습니다')
      .setDescription('`/재생 검색어`로 다시 노래를 틀어보세요.')
      .setFooter({ text: `대기열 ${state?.queue?.length ?? 0}곡` });
    return {
      embeds: [embed],
      components: [createDisabledPanelRow(), createDisabledFilterRow()]
    };
  }

  const current = state.current;
  const progress = createProgressLine(state.position, current.length, current.isStream);
  const filterLabel = MUSIC_FILTER_PRESETS[state.filter]?.label ?? '필터 없음';
  embed
    .setTitle('🎵 현재 재생 중')
    .setDescription([
      `제목: **${escapeMarkdown(current.title)}**`,
      `요청자: **${escapeMarkdown(current.requesterName ?? '알 수 없음')}**`,
      `진행: ${progress}`,
      `상태: ${state.paused ? '⏸ 일시정지' : '▶️ 재생 중'} · 반복 ${state.repeat ? 'ON' : 'OFF'} · 필터 ${filterLabel}`
    ].join('\n'))
    .setFooter({ text: `대기열 ${state.queue.length.toLocaleString()}곡 · 셔플 ${state.shuffle ? 'ON' : 'OFF'}` });

  if (current.artworkUrl) embed.setThumbnail(current.artworkUrl);

  return {
    embeds: [embed],
    components: [createPanelButtonRow(state), createPanelFilterRow()]
  };
}

export function createQueuePayload(state) {
  const embed = new EmbedBuilder()
    .setColor(QUEUE_COLOR)
    .setTitle('📜 음악 큐');

  if (!state?.current) {
    embed.setDescription('현재 재생 중인 곡이 없습니다.');
    return { embeds: [embed], flags: MessageFlags.Ephemeral };
  }

  const queueLines = state.queue.slice(0, 10).map((track, index) =>
    `${index + 1}. **${escapeMarkdown(track.title)}** — ${escapeMarkdown(track.author)} (${formatDuration(track.length, track.isStream)})`
  );
  const hiddenCount = Math.max(0, state.queue.length - queueLines.length);
  embed.setDescription([
    `지금: **${escapeMarkdown(state.current.title)}** — ${escapeMarkdown(state.current.author)}`,
    '',
    queueLines.length > 0 ? queueLines.join('\n') : '대기 중인 곡이 없습니다.',
    hiddenCount > 0 ? `…외 ${hiddenCount.toLocaleString()}곡` : null
  ].filter(Boolean).join('\n'));

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

export function createPopularTracksPayload(rows) {
  const embed = new EmbedBuilder()
    .setColor(STATS_COLOR)
    .setTitle('🏆 서버 인기곡 TOP 10');

  if (rows.length === 0) {
    embed.setDescription('아직 재생 기록이 없습니다. `/재생`으로 첫 곡을 틀어보세요.');
    return { embeds: [embed] };
  }

  embed.setDescription(rows.map((entry, index) => [
    `**${index + 1}. ${escapeMarkdown(entry.track.title)}**`,
    `${escapeMarkdown(entry.track.author)} · ${entry.count.toLocaleString()}회 재생`
  ].join(' — ')).join('\n'));
  return { embeds: [embed] };
}

export function createUserMusicStatsPayload(stats, user = null) {
  const embed = new EmbedBuilder()
    .setColor(STATS_COLOR)
    .setTitle('🎧 내 음악 통계')
    .setDescription(`총 신청 곡 수: **${(stats.totalRequests ?? 0).toLocaleString()}곡**`);

  if (user?.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL());

  embed.addFields(
    { name: '최다 신청 장르', value: formatTopStats(stats.genres, '미분류'), inline: true },
    { name: '최다 신청 아티스트', value: formatTopStats(stats.artists, '기록 없음'), inline: true },
    { name: '최다 신청 곡', value: formatTopStats(stats.tracks, '기록 없음'), inline: false }
  );

  return { embeds: [embed], flags: MessageFlags.Ephemeral };
}

async function handlePlayCommand(interaction, music) {
  const voiceChannel = getRequesterVoiceChannel(interaction);
  const query = interaction.options.getString('검색어', true);
  const result = await music.playQuery({
    guild: interaction.guild,
    textChannel: interaction.channel,
    voiceChannel,
    requester: interaction.user,
    query
  });
  await safeReplyToInteraction(interaction, formatEnqueueResult(result));
}

async function handleSearchCommand(interaction, music) {
  const query = interaction.options.getString('검색어', true);
  const tracks = await music.search(query, { limit: MAX_SEARCH_RESULTS });

  if (tracks.length === 0) {
    await safeReplyToInteraction(interaction, '검색 결과가 없습니다.', { flags: MessageFlags.Ephemeral });
    return;
  }

  const session = music.createSearchSession({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    query,
    tracks
  });

  await safeReplyToInteraction(interaction, createSearchResultsPayload(session));
}

async function handlePlaylistCommand(interaction, music) {
  const subcommand = interaction.options.getSubcommand();
  const name = interaction.options.getString('이름', true);

  if (subcommand === '생성') {
    const playlist = await music.createPlaylist({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      name
    });
    await safeReplyToInteraction(interaction, `✅ 플레이리스트 **${playlist.name}**을 만들었습니다.`, { flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === '추가') {
    const target = interaction.options.getString('대상') ?? PLAYLIST_TARGET_CURRENT;
    if (target !== PLAYLIST_TARGET_CURRENT) throw new Error('지금은 현재곡만 추가할 수 있습니다.');
    const result = await music.addCurrentTrackToPlaylist({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      name
    });
    await safeReplyToInteraction(interaction, `➕ **${result.track.title}**을(를) **${result.playlist.name}**에 추가했습니다.`, { flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === '재생') {
    const voiceChannel = getRequesterVoiceChannel(interaction);
    const result = await music.playPlaylist({
      guild: interaction.guild,
      textChannel: interaction.channel,
      voiceChannel,
      requester: interaction.user,
      name
    });
    await safeReplyToInteraction(interaction, `▶️ 플레이리스트 **${result.playlist.name}**에서 ${result.queued.length.toLocaleString()}곡을 큐에 넣었습니다.`);
    return;
  }

  if (subcommand === '공개') {
    const playlist = await music.setPlaylistPublic({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      name,
      isPublic: true
    });
    await safeReplyToInteraction(interaction, `🌐 **${playlist.name}** 플레이리스트를 공개했습니다.`, { flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === '가져오기') {
    const owner = interaction.options.getUser('유저', true);
    const playlist = await music.importPublicPlaylist({
      guildId: interaction.guildId,
      ownerId: owner.id,
      importerId: interaction.user.id,
      importerName: interaction.user.username,
      name
    });
    await safeReplyToInteraction(interaction, `📥 ${owner.username}님의 공개 플레이리스트 **${playlist.name}**을 가져왔습니다.`, { flags: MessageFlags.Ephemeral });
  }
}

async function handlePopularRankingCommand(interaction, music) {
  if (!interaction.inGuild?.()) {
    await safeReplyToInteraction(interaction, '서버에서만 사용할 수 있습니다.', { flags: MessageFlags.Ephemeral });
    return;
  }
  const rows = await music.getTopTracks({ guildId: interaction.guildId, limit: 10 });
  await safeReplyToInteraction(interaction, createPopularTracksPayload(rows));
}

async function handleMyMusicStatsCommand(interaction, music) {
  const stats = await music.getUserStats({ guildId: interaction.guildId, userId: interaction.user.id });
  await safeReplyToInteraction(interaction, createUserMusicStatsPayload(stats, interaction.user));
}

async function handleMusicButton(interaction, music, logger) {
  if (!interaction.inGuild?.()) {
    await replyEphemeral(interaction, '서버에서만 사용할 수 있는 음악 버튼입니다.');
    return;
  }

  const parts = interaction.customId.split(':');
  const action = parts[1];

  try {
    if (action === 'search') {
      await handleSearchSelectionButton(interaction, music, parts);
      return;
    }

    if (action === 'pause') {
      const state = music.getPlayerState(interaction.guildId);
      if (state?.paused) {
        await music.resume(interaction.guildId);
        await replyEphemeral(interaction, '▶️ 다시 재생합니다.');
      } else {
        await music.pause(interaction.guildId);
        await replyEphemeral(interaction, '⏸ 일시정지했습니다.');
      }
      return;
    }

    if (action === 'skip') {
      const state = await music.skip(interaction.guildId);
      await replyEphemeral(interaction, state?.current ? `⏭ 다음 곡: ${state.current.title}` : '⏭ 큐가 비었습니다.');
      return;
    }

    if (action === 'repeat') {
      const enabled = await music.toggleRepeat(interaction.guildId);
      await replyEphemeral(interaction, `🔁 반복 ${enabled ? 'ON' : 'OFF'}`);
      return;
    }

    if (action === 'shuffle') {
      await music.shuffleQueue(interaction.guildId);
      await replyEphemeral(interaction, '🔀 대기열을 섞었습니다.');
      return;
    }

    if (action === 'queue') {
      await replyEphemeral(interaction, createQueuePayload(music.getPlayerState(interaction.guildId)));
      return;
    }

    if (action === 'filter') {
      await replyEphemeral(interaction, createFilterSelectPayload());
      return;
    }
  } catch (error) {
    logger.warn?.('Music button failed:', error);
    await replyEphemeral(interaction, `음악 버튼 실패: ${error.message}`);
  }
}

async function handleSearchSelectionButton(interaction, music, parts) {
  const sessionId = parts[2];
  const index = Number(parts[3]);
  const selection = music.getSearchSelection({
    sessionId,
    index,
    guildId: interaction.guildId,
    userId: interaction.user.id
  });
  const voiceChannel = getRequesterVoiceChannel(interaction);
  const result = await music.playSelectedTrack({
    guild: interaction.guild,
    textChannel: interaction.channel,
    voiceChannel,
    requester: interaction.user,
    track: selection
  });

  const payload = {
    content: formatEnqueueResult(result),
    embeds: [],
    components: []
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload);
  } else {
    await interaction.update(payload);
  }
}

async function handleMusicFilterSelect(interaction, music) {
  try {
    const filter = interaction.values?.[0] ?? 'none';
    const preset = await music.setFilter(interaction.guildId, filter);
    await replyEphemeral(interaction, `🎚 필터를 **${preset.label}**로 변경했습니다.`);
  } catch (error) {
    await replyEphemeral(interaction, `필터 변경 실패: ${error.message}`);
  }
}

function createSearchResultsPayload(session) {
  const embed = new EmbedBuilder()
    .setColor(QUEUE_COLOR)
    .setTitle('🔎 음악 검색 결과')
    .setDescription(session.tracks.map((track, index) => [
      `**${index + 1}. ${escapeMarkdown(track.title)}**`,
      `${escapeMarkdown(track.author)} · ${formatDuration(track.length, track.isStream)}`
    ].join(' — ')).join('\n'))
    .setFooter({ text: '2분 안에 버튼을 눌러 선택하세요.' });

  const row = new ActionRowBuilder().addComponents(
    ...session.tracks.slice(0, MAX_SEARCH_RESULTS).map((track, index) =>
      new ButtonBuilder()
        .setCustomId(`music:search:${session.id}:${index}`)
        .setLabel(`${index + 1}`)
        .setStyle(index === 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('🎵')
    )
  );

  return { embeds: [embed], components: [row] };
}

function createPanelButtonRow(state) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:pause')
      .setLabel(state.paused ? '다시재생' : '일시정지')
      .setEmoji(state.paused ? '▶️' : '⏸')
      .setStyle(state.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:skip')
      .setLabel('스킵')
      .setEmoji('⏭')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:repeat')
      .setLabel('반복')
      .setEmoji('🔁')
      .setStyle(state.repeat ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:shuffle')
      .setLabel('셔플')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music:queue')
      .setLabel('큐')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createDisabledPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music:pause').setLabel('일시정지').setEmoji('⏸').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('music:skip').setLabel('스킵').setEmoji('⏭').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('music:repeat').setLabel('반복').setEmoji('🔁').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('music:shuffle').setLabel('셔플').setEmoji('🔀').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('music:queue').setLabel('큐').setEmoji('📜').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );
}

function createPanelFilterRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:filter')
      .setLabel('필터')
      .setEmoji('🎚')
      .setStyle(ButtonStyle.Primary)
  );
}

function createDisabledFilterRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music:filter')
      .setLabel('필터')
      .setEmoji('🎚')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
}

function createFilterSelectPayload() {
  const options = Object.entries(MUSIC_FILTER_PRESETS).map(([value, preset]) => ({
    label: preset.label,
    description: preset.description,
    value
  }));
  return {
    content: '🎚 적용할 음악 필터를 고르세요.',
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('music:filter_select')
          .setPlaceholder('필터 선택')
          .addOptions(...options)
      )
    ],
    flags: MessageFlags.Ephemeral
  };
}

function getRequesterVoiceChannel(interaction) {
  const channel = interaction.member?.voice?.channel
    ?? interaction.guild?.members?.cache?.get?.(interaction.user.id)?.voice?.channel
    ?? null;

  if (!channel) throw new Error('먼저 음성 채널에 들어가주세요.');

  if (![ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(channel.type)) {
    throw new Error('음성 채널 또는 스테이지 채널에서만 재생할 수 있습니다.');
  }

  return channel;
}

function formatEnqueueResult(result) {
  const first = result.queued[0];
  const countText = result.queued.length > 1 ? ` 외 ${result.queued.length - 1}곡` : '';
  return result.startedNow
    ? `▶️ **${first.title}**${countText} 재생을 시작합니다.`
    : `➕ **${first.title}**${countText} 큐에 추가했습니다. 현재 대기열 ${result.queueSize.toLocaleString()}곡.`;
}

function createProgressLine(position, length, isStream) {
  if (isStream || !length) return `${formatDuration(position)} ━━━━━━━● LIVE`;
  const ratio = Math.max(0, Math.min(1, position / length));
  const filled = Math.round(ratio * PROGRESS_BAR_LENGTH);
  const left = '━'.repeat(Math.max(0, filled));
  const right = '─'.repeat(Math.max(0, PROGRESS_BAR_LENGTH - filled));
  return `${formatDuration(position)} ${left}●${right} ${formatDuration(length)}`;
}

function formatDuration(ms, isStream = false) {
  if (isStream) return 'LIVE';
  const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatTopStats(bucket, emptyText) {
  const entries = Object.values(bucket ?? {})
    .sort((left, right) => (right.count - left.count) || (right.lastRequestedAt - left.lastRequestedAt))
    .slice(0, 3);
  if (entries.length === 0) return emptyText;
  return entries.map((entry, index) => `${index + 1}. ${escapeMarkdown(entry.label)} (${entry.count.toLocaleString()}회)`).join('\n');
}

async function replyEphemeral(interaction, payload) {
  const normalized = typeof payload === 'string'
    ? { content: payload, flags: MessageFlags.Ephemeral }
    : { ...payload, flags: payload.flags ?? MessageFlags.Ephemeral };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(normalized);
  } else {
    await interaction.reply(normalized);
  }
}

function getOptionString(interaction, name) {
  try {
    return interaction.options.getString(name);
  } catch {
    return null;
  }
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/([*_`~|])/g, '\\$1');
}
