import { existsSync } from 'node:fs';
import { SlashCommandBuilder } from 'discord.js';
import {
  formatFishingAssetLine,
  getFishingAssetBatch,
  getFishingAssetCount,
  getFishingAssetRarityCounts
} from '../systems/fishing-assets.js';
import {
  getBattleDifficultyOptions,
  getFishConfig,
  getRarityLabel
} from '../systems/fishing.js';

export const fishingCommands = [
  new SlashCommandBuilder()
    .setName('낚시')
    .setDescription('낚싯대로 물고기를 잡고 낚시 포인트를 얻습니다.'),
  new SlashCommandBuilder()
    .setName('낚시강화')
    .setDescription('낚시 포인트를 사용해 낚싯대를 1~20강까지 강화합니다.'),
  new SlashCommandBuilder()
    .setName('잠수')
    .setDescription('잠수를 시작하거나 종료해서 방치 보상을 받습니다.'),
  new SlashCommandBuilder()
    .setName('물고기팀설정')
    .setDescription('물고기배틀에 사용할 팀 슬롯을 설정합니다.')
    .addIntegerOption((option) =>
      option
        .setName('슬롯')
        .setDescription('팀 슬롯 번호')
        .setMinValue(1)
        .setMaxValue(3)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('물고기')
        .setDescription('팀에 넣을 보유 물고기 이름 또는 id')
        .setMaxLength(50)
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('물고기배틀')
    .setDescription('설정한 물고기 팀으로 야생 팀 또는 다른 유저와 배틀합니다.')
    .addStringOption((option) =>
      option
        .setName('난이도')
        .setDescription('야생 팀 배틀 난이도')
        .addChoices(...getBattleDifficultyOptions())
    )
    .addUserOption((option) =>
      option
        .setName('상대')
        .setDescription('비우면 야생 물고기 팀과 배틀합니다.')
    ),
  new SlashCommandBuilder()
    .setName('낚시에셋')
    .setDescription('agent-sprite-forge로 생성할 물고기 이미지 에셋 배치를 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('등급')
        .setDescription('확인할 물고기 등급')
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '일반', value: 'common' },
          { name: '고급', value: 'uncommon' },
          { name: '희귀', value: 'rare' },
          { name: '영웅', value: 'epic' },
          { name: '전설', value: 'legendary' },
          { name: '히든', value: 'hidden' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('표시할 에셋 개수')
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addIntegerOption((option) =>
      option
        .setName('시작')
        .setDescription('건너뛸 에셋 수')
        .setMinValue(0)
    )
];

export function getFishingCommandPayloads() {
  return fishingCommands.map((command) => command.toJSON());
}

export async function handleFishingCommand(interaction, fishing) {
  if (!interaction.isChatInputCommand() || !isFishingCommand(interaction.commandName)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      ephemeral: true
    });
    return true;
  }

  try {
    await routeFishingCommand(interaction, fishing);
  } catch (error) {
    await interaction.reply({
      content: `낚시 처리 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function routeFishingCommand(interaction, fishing) {
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (interaction.commandName === '낚시') {
    const result = await fishing.catchFish({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithFishImage(interaction, formatCatchResult(user, result), result.fish);
    return;
  }

  if (interaction.commandName === '낚시강화') {
    const result = await fishing.enhanceRod({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatEnhancementResult(user, result));
    return;
  }

  if (interaction.commandName === '잠수') {
    const result = await fishing.toggleIdle({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatIdleResult(user, result));
    return;
  }

  if (interaction.commandName === '물고기팀설정') {
    const result = await fishing.setTeamSlot({
      guildId,
      userId: user.id,
      username: user.username,
      slot: interaction.options.getInteger('슬롯', true),
      fishId: interaction.options.getString('물고기', true)
    });
    await replyWithFishImage(interaction, formatTeamResult(user, result), result.fish);
    return;
  }

  if (interaction.commandName === '물고기배틀') {
    const opponent = interaction.options.getUser('상대');
    if (opponent?.bot) {
      throw new Error('봇 유저와는 물고기배틀을 할 수 없습니다.');
    }

    const result = await fishing.battleFishTeam({
      guildId,
      userId: user.id,
      username: user.username,
      opponentUserId: opponent?.id ?? null,
      opponentUsername: opponent?.username ?? '상대',
      difficulty: interaction.options.getString('난이도') ?? 'normal'
    });
    await interaction.reply(formatBattleResult(user, opponent, result));
    return;
  }

  if (interaction.commandName === '낚시에셋') {
    const rarity = interaction.options.getString('등급') ?? 'all';
    const limit = interaction.options.getInteger('개수') ?? 8;
    const offset = interaction.options.getInteger('시작') ?? 0;
    await interaction.reply(formatAssetBatch(rarity, limit, offset));
  }
}

function formatCatchResult(user, result) {
  const count = result.profile.inventory[result.fishId] ?? 0;

  return [
    `🎣 **낚시 성공** — ${user}`,
    `획득: **${result.fish.label}** (${getRarityLabel(result.rarity)} / ${result.fish.type})`,
    `크기: **${result.size.toLocaleString()}cm** / 낚시 포인트: **+${result.pointsGained.toLocaleString()}점**`,
    `보유 ${result.fish.label}: **${count.toLocaleString()}마리**`,
    `낚싯대: **+${result.profile.rod.level}강** / 총 포인트: **${result.profile.stats.fishingPoints.toLocaleString()}점**`,
    `이미지 에셋: \`${result.fish.assetId}\``
  ].join('\n');
}

function formatEnhancementResult(user, result) {
  if (result.capped) {
    return `🎣 **낚싯대 강화** — ${user}\n이미 최고 강화 단계입니다. 현재 낚싯대: **+${result.afterLevel}강**`;
  }

  const outcomeText = {
    success: '✅ 성공',
    maintain: '➖ 유지',
    destroy: '💥 파괴'
  }[result.outcome];
  const levelText = result.outcome === 'destroy'
    ? `+${result.beforeLevel}강 → +${result.afterLevel}강으로 리셋`
    : `+${result.beforeLevel}강 → +${result.afterLevel}강`;

  return [
    `🎣 **낚싯대 강화** — ${user}`,
    `결과: **${outcomeText}** (${levelText})`,
    `사용 포인트: **${result.cost.toLocaleString()}점** / 남은 포인트: **${result.profile.stats.fishingPoints.toLocaleString()}점**`,
    `누적 시도: **${result.profile.rod.totalEnhancementAttempts.toLocaleString()}회** / 파괴: **${result.profile.rod.destroyedCount.toLocaleString()}회**`
  ].join('\n');
}

function formatIdleResult(user, result) {
  if (result.action === 'started') {
    return [
      `🌊 **잠수 시작** — ${user}`,
      '다시 `/잠수`를 입력하면 방치 보상을 정산합니다.',
      '보상은 최대 12시간까지만 누적됩니다.'
    ].join('\n');
  }

  const catchSummary = summarizeCatches(result.catches);

  return [
    `🌊 **잠수 보상 정산** — ${user}`,
    `잠수 시간: **${formatMinutes(result.minutes)}** / 획득 물고기: **${result.fishCount.toLocaleString()}마리**`,
    `추가 포인트: **+${result.pointsGained.toLocaleString()}점** / 총 포인트: **${result.profile.stats.fishingPoints.toLocaleString()}점**`,
    `획득 목록: ${catchSummary}`
  ].join('\n');
}

function formatTeamResult(user, result) {
  const rows = result.team.map((entry) =>
    `${entry.slot}. **${entry.fish.label}** (${getRarityLabel(entry.fish.rarity)}${entry.bestSize ? ` / 최고 ${entry.bestSize}cm` : ''})`
  );

  return [
    `🐟 **물고기 팀 설정** — ${user}`,
    `${result.slot}번 슬롯에 **${result.fish.label}**을(를) 배치했습니다.`,
    `현재 팀:\n${rows.join('\n')}`
  ].join('\n');
}

function formatBattleResult(user, opponent, result) {
  const winnerText = result.winner === 'player'
    ? `${user.username} 승리`
    : result.winner === 'opponent'
      ? `${opponent?.username ?? result.opponentLabel} 승리`
      : '무승부';
  const playerRows = summarizeBattleTeam(result.playerTeam);
  const opponentRows = summarizeBattleTeam(result.opponentTeam);

  return [
    `⚔️ **물고기배틀** — ${user}`,
    `상대: **${opponent ? opponent.username : result.opponentLabel}**`,
    `결과: **${winnerText}**`,
    `내 팀: ${playerRows}`,
    `상대 팀: ${opponentRows}`,
    `전투 로그:\n${result.log.join('\n') || '- 기록 없음'}`,
    `전적: **${result.profile.battle.wins}승 ${result.profile.battle.losses}패 ${result.profile.battle.draws}무** / 포인트: **${result.profile.stats.fishingPoints.toLocaleString()}점**`
  ].join('\n');
}

function formatAssetBatch(rarity, limit, offset) {
  const assets = getFishingAssetBatch({ rarity, limit, offset });
  const counts = getFishingAssetRarityCounts();
  const countText = Object.entries(counts)
    .map(([key, count]) => `${getRarityLabel(key)} ${count}`)
    .join(' / ');
  const body = assets.map(formatFishingAssetLine).join('\n');
  const firstPrompt = assets[0]
    ? `\n\n첫 번째 생성 프롬프트:\n\`\`\`\n${assets[0].prompt}\n\`\`\``
    : '';

  return [
    `🎨 **낚시 물고기 이미지 에셋 배치** (${assets.length}/${getFishingAssetCount()}개 표시, 시작 ${offset})`,
    `등급별 수: ${countText}`,
    'agent-sprite-forge 기준으로 각 항목의 `$generate2dsprite` 프롬프트를 실행하면 됩니다.',
    body || '표시할 에셋이 없습니다.',
    firstPrompt
  ].join('\n');
}

function summarizeCatches(catches) {
  const counts = new Map();
  for (const catchResult of catches) {
    counts.set(catchResult.fishId, (counts.get(catchResult.fishId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([fishId, count]) => `${getFishConfig(fishId).label} × ${count}`)
    .join(', ');
}

function summarizeBattleTeam(team) {
  return team
    .map((fish) => `${fish.name} ${Math.max(0, fish.hp)}/${fish.maxHp}HP`)
    .join(', ');
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours > 0) return `${hours}시간 ${rest}분`;
  return `${rest}분`;
}

function isFishingCommand(commandName) {
  return fishingCommands.some((command) => command.name === commandName);
}

async function replyWithFishImage(interaction, content, fish) {
  const imagePath = fish?.imagePath;
  if (imagePath && existsSync(imagePath)) {
    await interaction.reply({
      content,
      files: [imagePath]
    });
    return;
  }

  await interaction.reply(content);
}
