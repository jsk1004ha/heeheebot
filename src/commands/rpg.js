import {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  getRpgAdvancedClassConfig,
  getRpgAdventureGuide,
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgBossPattern,
  getRpgClassConfig,
  getRpgClassOptions,
  getRpgDifficultyOptions,
  getRpgDungeonConfig,
  getRpgDerivedStats,
  getRpgGenderConfig,
  getRpgGenderOptions,
  getRpgFirstJobOptions,
  getRpgStartClassOptions,
  getRpgItemConfig,
  getRpgRaidConfig,
  getRpgShopItemOptions,
  getRpgSkillConfig,
  getRpgFirstJobClassIds,
  normalizeNullableRpgCraftingCategory,
  normalizeRpgClass,
  normalizeRpgSkillId
} from '../systems/rpg.js';
import { SEASON_POINT_SOURCES } from '../systems/seasons.js';
import { formatDuration } from './economy.js';
import {
  safeDeferUpdate,
  safeReplyToInteraction,
  sendInteractionUpdate
} from './interactions.js';
import { formatSeasonAwardLine } from './seasons.js';
import {
  createButtonRows as createDiscordButtonRows,
  shortenComponentText
} from './ui.js';
import {
  formatDailyMissionSummary,
  formatGachaRarity,
  formatRewardItems,
  formatRpgDailyGoldLimit,
  formatRpgGoldReward,
  getRpgGold,
  formatRpgProgress,
  formatRpgRewardSummary
} from './rpg/formatters.js';
import { createRpgVisualPayload } from './rpg/visual.js';

const RPG_BOSS_SESSION_TTL_MS = 10 * 60_000;
const RPG_RAID_LOBBY_TTL_MS = 10 * 60_000;
const RPG_RAID_LOBBY_MAX_MEMBERS = 4;
const RPG_SELECT_OPTION_LIMIT = 25;
const activeRpgBossSessions = new Map();
// Discord button sessions are intentionally ephemeral; a bot restart invalidates
// in-flight boss and raid buttons.
const activeRpgRaidLobbies = new Map();

export const rpgCommands = [
  new SlashCommandBuilder()
    .setName('rpg')
    .setDescription('몬스터와 전투하고 RPG 진행도를 확인합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('시작')
        .setDescription('RPG 직업을 선택합니다.')
        .addStringOption((option) =>
          option
            .setName('직업')
            .setDescription('시작 직업. 비우면 직업/성별 선택 메뉴를 봅니다.')
        )
        .addStringOption((option) =>
          option
            .setName('성별')
            .setDescription('캐릭터 외형')
            .addChoices(...getRpgGenderOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('메뉴')
        .setDescription('RPG 메인 허브에서 다음 목표와 추천 행동을 봅니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('튜토리얼')
        .setDescription('초보자 여정과 받을 수 있는 튜토리얼 보상을 확인합니다.')
        .addStringOption((option) =>
          option
            .setName('보상')
            .setDescription('수령할 튜토리얼 단계. 비우면 초보자 여정을 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('사냥')
        .setDescription('몬스터를 사냥합니다.')
        .addStringOption((option) =>
          option
            .setName('난이도')
            .setDescription('전투 난이도')
            .addChoices(...getRpgDifficultyOptions())
        )
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('전투 지역')
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('직업변경')
        .setDescription('전투 전 주/보조 직업을 전환합니다.')
        .addStringOption((option) =>
          option
            .setName('직업')
            .setDescription('변경할 보유 직업')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('탐사')
        .setDescription('지역을 탐사해서 이벤트, 보물, 함정을 만납니다.')
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('탐험 지역')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('던전')
        .setDescription('여러 층을 연속 탐험하고 인벤토리 장비를 노립니다.')
        .addStringOption((option) =>
          option
            .setName('던전')
            .setDescription('입장할 던전')
        )
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('던전 지역')
        )
        .addIntegerOption((option) =>
          option
            .setName('깊이')
            .setDescription('진행할 층 수')
            .setMinValue(1)
            .setMaxValue(5)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('보스')
        .setDescription('강력한 보스에게 수동 턴제 전투로 도전합니다.')
        .addStringOption((option) =>
          option
            .setName('보스')
            .setDescription('도전할 보스')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('프로필')
        .setDescription('내 희희봇 RPG 프로필과 전투 기록을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상점')
        .setDescription('RPG 아이템을 확인하거나 구매합니다.')
        .addStringOption((option) =>
          option
            .setName('아이템')
            .setDescription('구매할 아이템')
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('구매 수량')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('인벤토리')
        .setDescription('RPG 인벤토리와 장비를 확인합니다.')
        .addStringOption((option) =>
          option
            .setName('보기')
            .setDescription('확인할 인벤토리 화면')
            .addChoices(
              { name: '전체', value: 'all' },
              { name: '장비', value: 'gear' },
              { name: '강화', value: 'enhance' },
              { name: '분해', value: 'disassemble' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('장비')
            .setDescription('장착/강화/분해할 인벤토리 장비 번호 또는 이름')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('장비')
        .setDescription('장비 아이템을 장착합니다.')
        .addStringOption((option) =>
          option
            .setName('아이템')
            .setDescription('장착할 아이템. 비우면 보유 장비 선택 메뉴를 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('강화')
        .setDescription('인벤토리 장비를 골드로 강화합니다.')
        .addStringOption((option) =>
          option
            .setName('장비')
            .setDescription('강화할 장비 번호/이름. 비우면 강화 선택 메뉴를 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('일일')
        .setDescription('오늘의 RPG 의뢰를 확인하거나 보상을 받습니다.')
        .addStringOption((option) =>
          option
            .setName('임무')
            .setDescription('보상을 받을 일일 의뢰. 비우면 의뢰판을 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('휴식')
        .setDescription('HP와 MP를 모두 회복합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('듀얼직업')
        .setDescription('Lv.15부터 두 번째 1차 직업을 선택합니다.')
        .addStringOption((option) =>
          option
            .setName('직업')
            .setDescription('선택할 보조 직업')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전직')
        .setDescription('현재 직업의 상위 직업으로 전직합니다.')
        .addStringOption((option) =>
          option
            .setName('전직')
            .setDescription('1차/상위 직업 이름. 비우면 전직 트리를 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('스토리')
        .setDescription('메인 퀘스트 진행도와 보상을 확인합니다.')
        .addStringOption((option) =>
          option
            .setName('챕터')
            .setDescription('진행할 챕터. 비우면 스토리 목록을 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도감')
        .setDescription('몬스터 도감과 수집 보상을 확인합니다.')
        .addStringOption((option) =>
          option
            .setName('몬스터')
            .setDescription('보상 받을 몬스터. 비우면 도감 목록을 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('제작')
        .setDescription('재료로 장비/소모품/룬을 제작합니다.')
        .addStringOption((option) =>
          option
            .setName('종류')
            .setDescription('제작 카테고리. 비우면 전체 제작 메뉴를 봅니다.')
        )
        .addStringOption((option) =>
          option
            .setName('레시피')
            .setDescription('제작할 레시피. 비우면 제작 가능한 목록을 봅니다.')
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('소모품/재료 가공 수량')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('거래소')
        .setDescription('RPG 재료와 제작품을 판매/구매합니다.')
        .addStringOption((option) =>
          option
            .setName('작업')
            .setDescription('비우면 거래소 목록을 봅니다.')
            .addChoices(
              { name: '보기', value: 'view' },
              { name: '검색', value: 'search' },
              { name: '판매', value: 'sell' },
              { name: '구매', value: 'buy' },
              { name: '취소', value: 'cancel' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('품목')
            .setDescription('판매 품목 또는 구매·취소할 목록 순번/이름')
        )
        .addIntegerOption((option) =>
          option
            .setName('가격')
            .setDescription('판매 가격')
            .setMinValue(1)
        )
        .addIntegerOption((option) =>
          option
            .setName('수량')
            .setDescription('판매 수량')
            .setMinValue(1)
            .setMaxValue(99)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('레이드')
        .setDescription('강력한 레이드 보스에 도전합니다.')
        .addStringOption((option) =>
          option
            .setName('레이드')
            .setDescription('도전할 레이드')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('길드레이드')
        .setDescription('서버 RPG 파티원을 모아 길드 레이드를 진행합니다.')
        .addStringOption((option) =>
          option
            .setName('레이드')
            .setDescription('도전할 길드 레이드')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('지역')
        .setDescription('RPG 월드맵을 확인하거나 현재 지역을 이동합니다.')
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('이동할 지역. 비우면 월드맵을 봅니다.')
        )
    )
];

export function getRpgCommandPayloads() {
  return rpgCommands.map((command) => command.toJSON());
}

export async function handleRpgCommand(interaction, economy, services = {}) {
  if (interaction.isButton?.()) {
    if (interaction.customId.startsWith('rpg_start:')) {
      return handleRpgStartButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_advance:')) {
      return handleRpgAdvanceButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_area:')) {
      return handleRpgAreaButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_shop_buy:')) {
      return handleRpgShopBuyButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_item_equip:')) {
      return handleRpgItemEquipButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_item_use:')) {
      return handleRpgItemUseButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_item_sell:')) {
      return handleRpgItemSellButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_gear_equip:')) {
      return handleRpgGearEquipButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_gear_recommend:')) {
      return handleRpgGearRecommendButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_gear_enhance:')) {
      return handleRpgGearEnhanceButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_gear_disassemble:')) {
      return handleRpgGearDisassembleButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_daily:')) {
      return handleRpgDailyMissionButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_quest:')) {
      return handleRpgQuestButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_skill:')) {
      return handleRpgSkillButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_story:')) {
      return handleRpgStoryButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_dungeon:')) {
      return handleRpgDungeonButton(interaction, economy, services);
    }
    if (interaction.customId.startsWith('rpg_quick:')) {
      return handleRpgQuickButton(interaction, economy, services);
    }
    if (interaction.customId.startsWith('rpg_boss_action:')) {
      return handleRpgBossActionButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_raid_lobby:')) {
      return handleRpgRaidLobbyButton(interaction, economy);
    }
    return false;
  }

  if (interaction.isStringSelectMenu?.() && interaction.customId?.startsWith('rpg_select:')) {
    return handleRpgSelectMenu(interaction, economy);
  }

  if (!interaction.isChatInputCommand() || interaction.commandName !== 'rpg') {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: '서버에서만 사용할 수 있는 명령어입니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const subcommand = interaction.options.getSubcommand(true);
  const guildId = interaction.guildId;
  const user = interaction.user;

  if (subcommand === '시작') {
    const characterClass = interaction.options.getString('직업');
    const characterGender = interaction.options.getString('성별') ?? 'male';

    if (!characterClass) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgCharacterCreation(user, status), {
        components: createRpgStartRows(status, user.id)
      });
      return true;
    }

    const result = await economy.chooseRpgClass({
      guildId,
      userId: user.id,
      username: user.username,
      characterClass,
      characterGender
    });

    await replyWithRpgAssets(interaction, formatRpgStart(user, result), [result.heroAssetId], {
      components: createRpgPostStartRows(result.profile, user.id)
    });
    return true;
  }

  if (subcommand === '메뉴') {
    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithRpgAssets(
      interaction,
      formatRpgMainMenu(user, status),
      [status.heroAssetId, status.currentArea.backgroundAssetId],
      { components: createRpgMainMenuRows(status, user.id) }
    );
    return true;
  }

  if (subcommand === '튜토리얼') {
    const stepId = interaction.options.getString('보상');

    if (!stepId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgTutorial(status), [status.heroAssetId, status.currentArea.backgroundAssetId], {
        components: createRpgTutorialRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.claimRpgTutorialStep({
        guildId,
        userId: user.id,
        username: user.username,
        stepId
      });
      await replyWithRpgCard(interaction, formatRpgTutorialClaim(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `튜토리얼 보상 수령 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '전투' || subcommand === '사냥') {
    const difficulty = interaction.options.getString('난이도') ?? 'normal';
    const area = interaction.options.getString('지역');
    const skill = interaction.options.getString('스킬') ?? 'basic';

    try {
      const result = await economy.playRpgBattle({
        guildId,
        userId: user.id,
        username: user.username,
        difficulty,
        area,
        skill
      });

      if (!result.battled) {
        await interaction.reply({
          content: `⏳ 아직 다시 전투할 수 없습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
          flags: MessageFlags.Ephemeral
        });
        return true;
      }

      const seasonAward = await awardRpgBattleSeasonPoints(services, {
        guildId,
        user,
        result
      });
      await replyWithRpgAssets(interaction, appendSeasonAwardLine(formatBattleResult(user, result), seasonAward), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `RPG 전투 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '직업변경') {
    const characterClass = interaction.options.getString('직업', true);

    try {
      const result = await economy.switchRpgClass({
        guildId,
        userId: user.id,
        username: user.username,
        characterClass
      });
      await replyWithRpgAssets(interaction, formatRpgJobChange(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `직업 변경 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '탐험' || subcommand === '탐사') {
    const area = interaction.options.getString('지역');

    try {
      const result = await economy.exploreRpg({
        guildId,
        userId: user.id,
        username: user.username,
        area
      });
      await replyWithRpgAssets(interaction, formatRpgExplore(user, result), getExploreAssetIds(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `탐험 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '던전') {
    const dungeonId = interaction.options.getString('던전');
    const dungeon = dungeonId ? getRpgDungeonConfig(dungeonId) : null;
    const area = dungeon?.area ?? interaction.options.getString('지역');
    const depth = interaction.options.getInteger('깊이');

    try {
      const result = await economy.runRpgDungeon({
        guildId,
        userId: user.id,
        username: user.username,
        dungeonId,
        area,
        depth
      });
      await replyWithRpgAssets(interaction, formatRpgDungeon(user, result), getDungeonAssetIds(result), {
        components: createRpgDungeonRows(result, user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `던전 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '보스') {
    const bossId = interaction.options.getString('보스', true);

    try {
      const result = await economy.startRpgBossEncounter({
        guildId,
        userId: user.id,
        username: user.username,
        bossId
      });

      if (!result.battled) {
        await interaction.reply({
          content: `⏳ 아직 다시 전투할 수 없습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
          flags: MessageFlags.Ephemeral
        });
        return true;
      }

      activeRpgBossSessions.set(result.session.id, {
        session: result.session,
        expiresAt: Date.now() + RPG_BOSS_SESSION_TTL_MS
      });
      await replyWithRpgAssets(
        interaction,
        formatRpgBossEncounter(user, result),
        getBossEncounterAssetIds(result),
        { components: [createRpgBossActionRow(result.session)] }
      );
    } catch (error) {
      await interaction.reply({
        content: `보스전 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '상태' || subcommand === '프로필' || subcommand === '스탯') {
    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithRpgAssets(interaction, formatRpgStatus(user, status), [status.heroAssetId]);
    return true;
  }

  if (subcommand === '상점') {
    const itemId = interaction.options.getString('아이템');
    const quantity = interaction.options.getInteger('수량') ?? 1;

    if (!itemId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgShop(status), [status.heroAssetId], {
        components: createRpgShopViewRows(user.id)
      });
      return true;
    }

    try {
      const result = await economy.buyRpgItem({
        guildId,
        userId: user.id,
        username: user.username,
        itemId,
        quantity
      });
      await replyWithRpgAssets(interaction, formatRpgPurchase(result), [result.item.assetId], {
        components: createRpgPostPurchaseRows(result, user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `구매 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '제작') {
    const category = interaction.options.getString('종류');
    const recipeId = interaction.options.getString('레시피');
    const quantity = interaction.options.getInteger('수량') ?? 1;

    if (!recipeId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgCraftingMenu(status, category), [status.heroAssetId], {
        components: createRpgCraftingRows(status, user.id, category)
      });
      return true;
    }

    try {
      const result = await economy.craftRpgRecipe({
        guildId,
        userId: user.id,
        username: user.username,
        recipeId,
        quantity
      });
      const assetIds = result.createdGear.map((gear) => gear.assetId).filter(Boolean);
      await replyWithRpgAssets(interaction, formatRpgCraftingResult(result), assetIds.length > 0 ? assetIds : [getRpgItemConfig(result.recipe.resultItemId).assetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `제작 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '거래소') {
    const action = interaction.options.getString('작업') ?? 'view';
    const item = interaction.options.getString('품목');
    const price = interaction.options.getInteger('가격');
    const quantity = interaction.options.getInteger('수량') ?? 1;

    try {
      if (action === 'sell') {
        if (!item || !price) throw new Error('판매할 품목과 가격을 입력하세요.');
        const result = await economy.createRpgMarketListing({
          guildId,
          userId: user.id,
          username: user.username,
          item,
          price,
          quantity
        });
        await replyWithRpgCard(interaction, formatRpgMarketListingCreated(result), {
          components: createRpgMarketplaceRows(result, user.id, { mode: 'cancel' })
        });
        return true;
      }

      if (action === 'buy') {
        const marketplace = await economy.getRpgMarketplace({ guildId });
        if (!item) {
          await replyWithRpgCard(interaction, formatRpgMarketplace(marketplace, {
            viewerId: user.id,
            mode: 'buy'
          }), {
            components: createRpgMarketplaceRows(marketplace, user.id, { mode: 'buy' })
          });
          return true;
        }
        const listingId = resolveRpgMarketplaceListingId(marketplace.marketListings, item, {
          userId: user.id,
          mode: 'buy'
        });
        const result = await economy.buyRpgMarketListing({
          guildId,
          userId: user.id,
          username: user.username,
          listingId
        });
        await replyWithRpgCard(interaction, formatRpgMarketPurchase(result), {
          components: createRpgMarketplaceRows(result, user.id)
        });
        return true;
      }

      if (action === 'cancel') {
        const marketplace = await economy.getRpgMarketplace({ guildId });
        if (!item) {
          await replyWithRpgCard(interaction, formatRpgMarketplace(marketplace, {
            viewerId: user.id,
            mode: 'cancel'
          }), {
            components: createRpgMarketplaceRows(marketplace, user.id, { mode: 'cancel' })
          });
          return true;
        }
        const listingId = resolveRpgMarketplaceListingId(marketplace.marketListings, item, {
          userId: user.id,
          mode: 'cancel'
        });
        const result = await economy.cancelRpgMarketListing({
          guildId,
          userId: user.id,
          username: user.username,
          listingId
        });
        await replyWithRpgCard(interaction, formatRpgMarketCancel(result), {
          components: createRpgMarketplaceRows(result, user.id, { mode: 'cancel' })
        });
        return true;
      }

      const result = await economy.getRpgMarketplace({ guildId });
      if (action === 'search') {
        if (!item) throw new Error('검색할 품목 이름을 입력하세요.');
        const normalizedQuery = item.toLocaleLowerCase('ko-KR');
        const compactQuery = normalizedQuery.replace(/\s+/g, '');
        result.query = item;
        result.marketListings = result.marketListings.filter((listing) => {
          const haystack = [
            listing.id,
            listing.label,
            listing.itemId,
            listing.gear?.baseItemId
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('ko-KR');
          return haystack.includes(normalizedQuery) || haystack.replace(/\s+/g, '').includes(compactQuery);
        });
      }
      await replyWithRpgCard(interaction, formatRpgMarketplace(result, { viewerId: user.id, mode: action }), {
        components: createRpgMarketplaceRows(result, user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `거래소 처리 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '인벤토리') {
    const view = interaction.options.getString('보기') ?? 'all';
    const gearId = interaction.options.getString('장비');
    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });

    if (gearId && (view === 'all' || view === 'gear')) {
      try {
        const result = await economy.equipRpgGear({
          guildId,
          userId: user.id,
          username: user.username,
          gearId
        });
        await replyWithRpgAssets(interaction, formatRpgEquipGear(result), [result.gear.assetId], {
          components: createRpgActionLoopRows(user.id)
        });
      } catch (error) {
        await interaction.reply({
          content: `장비 장착 실패: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
      return true;
    }

    if (gearId && view === 'enhance') {
      try {
        const result = await economy.enhanceRpgGear({
          guildId,
          userId: user.id,
          username: user.username,
          gearId
        });
        await replyWithRpgAssets(interaction, formatRpgGearEnhance(result), [result.gear.assetId], {
          components: createRpgActionLoopRows(user.id)
        });
      } catch (error) {
        await interaction.reply({
          content: `장비 강화 실패: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
      return true;
    }

    if (gearId && view === 'disassemble') {
      try {
        const result = await economy.disassembleRpgGear({
          guildId,
          userId: user.id,
          username: user.username,
          gearId
        });
        await replyWithRpgAssets(interaction, formatRpgDisassembleGear(result), [result.gear.assetId], {
          components: createRpgActionLoopRows(user.id)
        });
      } catch (error) {
        await interaction.reply({
          content: `장비 분해 실패: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
      return true;
    }

    if (view === 'gear') {
      await replyWithRpgAssets(interaction, formatRpgGearInventory(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, user.id, 'gear')
      });
      return true;
    }

    if (view === 'enhance') {
      await replyWithRpgAssets(interaction, formatRpgGearEnhanceGuide(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, user.id, 'enhance')
      });
      return true;
    }

    if (view === 'disassemble') {
      await replyWithRpgAssets(interaction, formatRpgGearDisassembleGuide(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, user.id, 'disassemble')
      });
      return true;
    }

    await replyWithRpgAssets(interaction, formatRpgInventory(status), [status.heroAssetId], {
      components: createRpgInventoryRows(status, user.id)
    });
    return true;
  }

  if (subcommand === '사용') {
    const itemId = interaction.options.getString('아이템', true);

    try {
      const result = await economy.useRpgItem({
        guildId,
        userId: user.id,
        username: user.username,
        itemId
      });
      await replyWithRpgAssets(interaction, formatRpgUseItem(result), [result.item.assetId]);
    } catch (error) {
      await interaction.reply({
        content: `아이템 사용 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '장비') {
    const itemId = interaction.options.getString('아이템');

    if (!itemId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgEquipmentGuide(status), [status.heroAssetId], {
        components: createRpgEquipmentRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.equipRpgItem({
        guildId,
        userId: user.id,
        username: user.username,
        itemId
      });
      await replyWithRpgAssets(interaction, formatRpgEquipItem(result), [result.item.assetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `장비 장착 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '전리품') {
    const gearId = interaction.options.getString('장비');

    if (!gearId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgGearInventory(status), [status.heroAssetId], {
        components: createRpgGearRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.equipRpgGear({
        guildId,
        userId: user.id,
        username: user.username,
        gearId
      });
      await replyWithRpgAssets(interaction, formatRpgEquipGear(result), [result.gear.assetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `장비 장착 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '장비강화' || subcommand === '강화') {
    const gearId = interaction.options.getString('장비');

    if (!gearId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgGearEnhanceGuide(status), [status.heroAssetId], {
        components: createRpgGearEnhanceRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.enhanceRpgGear({
        guildId,
        userId: user.id,
        username: user.username,
        gearId
      });
      await replyWithRpgAssets(interaction, formatRpgGearEnhance(result), [result.gear.assetId]);
    } catch (error) {
      await interaction.reply({
        content: `장비 강화 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '퀘스트') {
    const questId = interaction.options.getString('퀘스트');

    if (!questId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgQuests(status), {
        components: createRpgQuestViewRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.claimRpgQuest({
        guildId,
        userId: user.id,
        username: user.username,
        questId
      });
      await replyWithRpgCard(interaction, formatRpgQuestClaim(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `퀘스트 보상 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '일일') {
    const missionId = interaction.options.getString('임무');

    if (!missionId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgDailyMissions(status), {
        components: createRpgDailyRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.claimRpgDailyMission({
        guildId,
        userId: user.id,
        username: user.username,
        missionId
      });
      await replyWithRpgCard(interaction, formatRpgDailyClaim(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `일일 의뢰 보상 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '휴식') {
    try {
      const result = await economy.restRpg({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgRest(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `휴식 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }
    return true;
  }

  if (subcommand === '듀얼직업') {
    const characterClass = interaction.options.getString('직업', true);

    try {
      const result = await economy.chooseRpgDualClass({
        guildId,
        userId: user.id,
        username: user.username,
        characterClass
      });
      await replyWithRpgAssets(interaction, formatRpgDualJob(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `듀얼 직업 선택 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '가챠') {
    await interaction.reply({
      content: '희희봇 RPG에서는 RPG 전용 가챠를 사용하지 않습니다. 장비는 사냥·탐사·던전·레이드·제작/강화 흐름에서 얻어주세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (subcommand === '스킬트리') {
    const skillId = interaction.options.getString('스킬');

    if (!skillId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgSkillTree(status), [status.heroAssetId], {
        components: createRpgSkillTreeViewRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.learnRpgSkill({
        guildId,
        userId: user.id,
        username: user.username,
        skillId
      });
      await replyWithRpgCard(interaction, formatRpgLearnSkill(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `스킬트리 학습 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '전직') {
    const advancedClass = interaction.options.getString('전직');

    if (!advancedClass) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgAssets(interaction, formatRpgClassPath(status), [status.heroAssetId], {
        components: createRpgClassPathViewRows(status, user.id)
      });
      return true;
    }

    try {
      let result;
      let normalizedClass = null;
      try {
        normalizedClass = normalizeRpgClass(advancedClass);
      } catch {
        normalizedClass = null;
      }
      if (getRpgFirstJobClassIds().includes(normalizedClass)) {
        result = await economy.chooseRpgFirstJob({
          guildId,
          userId: user.id,
          username: user.username,
          characterClass: advancedClass
        });
      } else {
        result = await economy.advanceRpgClass({
          guildId,
          userId: user.id,
          username: user.username,
          advancedClass
        });
      }
      await replyWithRpgAssets(interaction, formatRpgAdvanceClass(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `전직 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '스토리') {
    const chapterId = interaction.options.getString('챕터');

    if (!chapterId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgStory(status), {
        components: createRpgStoryViewRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.progressRpgStory({
        guildId,
        userId: user.id,
        username: user.username,
        chapterId
      });
      await replyWithRpgCard(interaction, formatRpgStoryProgress(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `메인 퀘스트 진행 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '도감') {
    const monsterName = interaction.options.getString('몬스터');

    if (!monsterName) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await replyWithRpgCard(interaction, formatRpgCodex(status), {
        components: createRpgCodexViewRows(status, user.id)
      });
      return true;
    }

    try {
      const result = await economy.claimRpgCodex({
        guildId,
        userId: user.id,
        username: user.username,
        monsterName
      });
      await replyWithRpgAssets(interaction, formatRpgCodexClaim(result), [result.codex.assetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `도감 보상 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '레이드') {
    const raidId = interaction.options.getString('레이드', true);
    const skill = interaction.options.getString('스킬') ?? 'basic';

    try {
      const result = await economy.playRpgRaid({
        guildId,
        userId: user.id,
        username: user.username,
        raidId,
        skill
      });
      await replyWithRpgAssets(interaction, formatRpgRaid(user, result), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `레이드 실패: ${error.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    return true;
  }

  if (subcommand === '길드레이드') {
    const raidId = interaction.options.getString('레이드', true);
    const skill = interaction.options.getString('스킬') ?? 'basic';

    try {
      const lobby = await createRpgRaidLobby({
        economy,
        guildId,
        channelId: interaction.channelId,
        leader: user,
        raidId,
        skill
      });
      activeRpgRaidLobbies.set(lobby.id, lobby);
      await replyWithRpgAssets(
        interaction,
        formatRpgRaidLobby(lobby),
        [lobby.raid.backgroundAssetId],
        { components: createRpgRaidLobbyRows(lobby) }
      );
    } catch (error) {
      const raid = getRpgRaidConfig(raidId);
      await replyWithRpgAssets(
        interaction,
        `🐉 **RPG 길드 레이드 모집 실패** — ${formatDiscordUserMention(user)}\n${error.message}`,
        [raid.backgroundAssetId],
        { flags: MessageFlags.Ephemeral }
      );
    }

    return true;
  }

  if (subcommand === '지역') {
    const area = interaction.options.getString('지역');

    if (area) {
      try {
        const result = await economy.enterRpgArea({
          guildId,
          userId: user.id,
          username: user.username,
          area
        });
        await replyWithRpgAssets(interaction, formatRpgAreaEnter(result), [result.areaConfig.backgroundAssetId], {
          components: createRpgActionLoopRows(user.id)
        });
      } catch (error) {
        await interaction.reply({
          content: `지역 이동 실패: ${error.message}`,
          flags: MessageFlags.Ephemeral
        });
      }
      return true;
    }

    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    await replyWithRpgAssets(interaction, formatRpgAreas(status), [status.currentArea.backgroundAssetId], {
      components: createRpgAreaRows(status, user.id)
    });
    return true;
  }

  return false;
}

async function handleRpgStartButton(interaction, economy) {
  const [, userId, characterClass, characterGender] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 캐릭터 생성 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.chooseRpgClass({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      characterClass,
      characterGender
    });
    await updateWithRpgAssets(interaction, formatRpgStart(interaction.user, result), [result.heroAssetId], {
      components: createRpgPostStartRows(result.profile, interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 시작 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgAdvanceButton(interaction, economy) {
  const [, userId, advancedClass] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 전직 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.advanceRpgClass({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      advancedClass
    });
    await updateWithRpgAssets(interaction, formatRpgAdvanceClass(result), [result.heroAssetId], {
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `전직 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgAreaButton(interaction, economy) {
  const [, userId, area] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 지역 이동 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.enterRpgArea({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      area
    });
    await updateWithRpgAssets(interaction, formatRpgAreaEnter(result), [result.areaConfig.backgroundAssetId], {
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `지역 이동 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgShopBuyButton(interaction, economy) {
  const [, userId, itemId, rawQuantity = '1'] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 상점 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.buyRpgItem({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      itemId,
      quantity: Number.parseInt(rawQuantity, 10) || 1
    });
    await updateWithRpgAssets(interaction, formatRpgPurchase(result), [result.item.assetId], {
      components: createRpgPostPurchaseRows(result, interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `구매 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgItemEquipButton(interaction, economy) {
  const [, userId, itemId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.equipRpgItem({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      itemId
    });
    await updateWithRpgAssets(interaction, formatRpgEquipItem(result), [result.item.assetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `장비 장착 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgItemUseButton(interaction, economy) {
  const [, userId, itemId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 아이템 사용 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.useRpgItem({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      itemId
    });
    await updateWithRpgAssets(interaction, formatRpgUseItem(result), [result.item.assetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `아이템 사용 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgItemSellButton(interaction, economy) {
  const [, userId, itemId, rawQuantity = '1'] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 아이템 판매 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.sellRpgItem({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      itemId,
      quantity: Number.parseInt(rawQuantity, 10) || 1
    });
    await updateWithRpgAssets(interaction, formatRpgSellItem(result), [result.item.assetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `아이템 판매 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgGearEquipButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.equipRpgGear({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      gearId
    });
    await updateWithRpgAssets(interaction, formatRpgEquipGear(result), [result.gear.assetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `장비 장착 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgGearRecommendButton(interaction, economy) {
  const [, userId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 추천 장착 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.equipRecommendedRpgGear({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username
    });
    await updateWithRpgAssets(interaction, formatRpgRecommendedGear(result), [], {
      components: createRpgInventoryManagementRows(result, interaction.user.id, 'all')
    });
  } catch (error) {
    await interaction.reply({
      content: `추천 장착 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgGearDisassembleButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 분해 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.disassembleRpgGear({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      gearId
    });
    await updateWithRpgAssets(interaction, formatRpgDisassembleGear(result), [result.gear.assetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `장비 분해 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgGearEnhanceButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 강화 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.enhanceRpgGear({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      gearId
    });
    await updateWithRpgAssets(interaction, formatRpgGearEnhance(result), [result.gear.assetId], {
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `장비 강화 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgDailyMissionButton(interaction, economy) {
  const [, userId, missionId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 일일 의뢰 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.claimRpgDailyMission({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      missionId
    });
    await updateWithRpgCard(interaction, formatRpgDailyClaim(result), {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `일일 의뢰 보상 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgQuestButton(interaction, economy) {
  const [, userId, questId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 퀘스트 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.claimRpgQuest({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      questId
    });
    await updateWithRpgAssets(interaction, formatRpgQuestClaim(result), [], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `퀘스트 보상 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgSkillButton(interaction, economy) {
  const [, userId, skillId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 스킬트리 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.learnRpgSkill({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      skillId
    });
    await updateWithRpgAssets(interaction, formatRpgLearnSkill(result), [result.heroAssetId], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `스킬트리 학습 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgStoryButton(interaction, economy) {
  const [, userId, chapterId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 메인 퀘스트 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.progressRpgStory({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username,
      chapterId
    });
    await updateWithRpgAssets(interaction, formatRpgStoryProgress(result), [], {
      components: createRpgActionLoopRows(interaction.user.id)
    });
  } catch (error) {
    await interaction.reply({
      content: `메인 퀘스트 진행 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function handleRpgSelectMenu(interaction, economy) {
  const [, userId, action] = interaction.customId.split(':');
  const selected = interaction.values?.[0];

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 RPG 선택 메뉴는 명령어를 실행한 유저만 사용할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (!selected) {
    await interaction.reply({
      content: '선택한 RPG 항목이 없습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    if (action === 'start') {
      const [characterClass, characterGender] = selected.split('|');
      const result = await economy.chooseRpgClass({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        characterClass,
        characterGender
      });
      await updateWithRpgAssets(interaction, formatRpgStart(interaction.user, result), [result.heroAssetId], {
        components: createRpgPostStartRows(result.profile, interaction.user.id)
      });
      return true;
    }

    if (action === 'advance') {
      const result = await economy.advanceRpgClass({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        advancedClass: selected
      });
      await updateWithRpgAssets(interaction, formatRpgAdvanceClass(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'area') {
      const result = await economy.enterRpgArea({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        area: selected
      });
      await updateWithRpgAssets(interaction, formatRpgAreaEnter(result), [result.areaConfig.backgroundAssetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'shop') {
      const result = await economy.buyRpgItem({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        itemId: selected,
        quantity: 1
      });
      await updateWithRpgAssets(interaction, formatRpgPurchase(result), [result.item.assetId], {
        components: createRpgPostPurchaseRows(result, interaction.user.id)
      });
      return true;
    }

    if (action === 'craft') {
      const result = await economy.craftRpgRecipe({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        recipeId: selected,
        quantity: 1
      });
      const assetIds = result.createdGear.map((gear) => gear.assetId).filter(Boolean);
      await updateWithRpgAssets(interaction, formatRpgCraftingResult(result), assetIds.length > 0 ? assetIds : [getRpgItemConfig(result.recipe.resultItemId).assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'use_item') {
      const result = await economy.useRpgItem({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        itemId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgUseItem(result), [result.item.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'equip_item') {
      const result = await economy.equipRpgItem({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        itemId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgEquipItem(result), [result.item.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'sell_item') {
      const result = await economy.sellRpgItem({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        itemId: selected,
        quantity: 1
      });
      await updateWithRpgAssets(interaction, formatRpgSellItem(result), [result.item.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'gear_equip') {
      const result = await economy.equipRpgGear({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        gearId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgEquipGear(result), [result.gear.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'gear_enhance') {
      const result = await economy.enhanceRpgGear({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        gearId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgGearEnhance(result), [result.gear.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'gear_disassemble') {
      const result = await economy.disassembleRpgGear({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        gearId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgDisassembleGear(result), [result.gear.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'daily') {
      const result = await economy.claimRpgDailyMission({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        missionId: selected
      });
      await updateWithRpgCard(interaction, formatRpgDailyClaim(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'tutorial') {
      const result = await economy.claimRpgTutorialStep({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        stepId: selected
      });
      await updateWithRpgCard(interaction, formatRpgTutorialClaim(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'quest') {
      const result = await economy.claimRpgQuest({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        questId: selected
      });
      await updateWithRpgCard(interaction, formatRpgQuestClaim(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'skill') {
      const result = await economy.learnRpgSkill({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        skillId: selected
      });
      await updateWithRpgAssets(interaction, formatRpgLearnSkill(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'story') {
      const result = await economy.progressRpgStory({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        chapterId: selected
      });
      await updateWithRpgCard(interaction, formatRpgStoryProgress(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'codex') {
      const result = await economy.claimRpgCodex({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        monsterName: selected
      });
      await updateWithRpgAssets(interaction, formatRpgCodexClaim(result), [result.codex.assetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'market_buy') {
      const result = await economy.buyRpgMarketListing({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        listingId: selected
      });
      await updateWithRpgCard(interaction, formatRpgMarketPurchase(result), {
        components: createRpgMarketplaceRows(result, interaction.user.id)
      });
      return true;
    }

    if (action === 'market_cancel') {
      const result = await economy.cancelRpgMarketListing({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        listingId: selected
      });
      await updateWithRpgCard(interaction, formatRpgMarketCancel(result), {
        components: createRpgMarketplaceRows(result, interaction.user.id, { mode: 'cancel' })
      });
      return true;
    }

    await interaction.reply({
      content: '알 수 없는 RPG 선택 메뉴입니다.',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 선택 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

async function createRpgRaidLobby({
  economy,
  guildId,
  channelId,
  leader,
  raidId = 'slime_horde',
  skill = 'basic',
  now = Date.now()
}) {
  const status = await economy.getRpgStatus({
    guildId,
    userId: leader.id,
    username: leader.username,
    now
  });
  const raid = getRpgRaidConfig(raidId);
  const normalizedSkillId = normalizeRpgSkillId(skill);
  const skillConfig = getRpgSkillConfig(normalizedSkillId);

  if (status.profile.rpg.startedAt <= 0) {
    throw new Error('먼저 `/rpg 시작`으로 캐릭터를 만들어야 합니다.');
  }
  if ((status.profile.rpg?.level ?? 1) < raid.unlockLevel) {
    throw new Error(`${raid.label} 길드 레이드는 Lv.${raid.unlockLevel}부터 모집할 수 있습니다.`);
  }
  if (!status.availableSkillIds.includes(normalizedSkillId)) {
    throw new Error(`${status.classConfig.label} 직업은 ${skillConfig.label} 스킬을 사용할 수 없습니다.`);
  }
  if (!status.actionAvailability.guildRaid.available) {
    throw new Error(`길드레이드 모집은 아직 할 수 없습니다. ${status.actionAvailability.guildRaid.reason}`);
  }

  const lobby = {
    id: createRpgRaidLobbyId(now),
    guildId,
    channelId,
    leaderUserId: leader.id,
    raidId,
    raid,
    skillId: normalizedSkillId,
    skill: skillConfig,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + RPG_RAID_LOBBY_TTL_MS,
    maxMembers: RPG_RAID_LOBBY_MAX_MEMBERS,
    members: [createRpgRaidLobbyMember(leader, status)]
  };

  return lobby;
}

async function handleRpgRaidLobbyButton(interaction, economy) {
  const [, action, lobbyId] = interaction.customId.split(':');
  const lobby = activeRpgRaidLobbies.get(lobbyId);
  const now = Date.now();

  if (!lobby || lobby.guildId !== interaction.guildId || lobby.expiresAt <= now) {
    activeRpgRaidLobbies.delete(lobbyId);
    await interaction.reply({
      content: '만료되었거나 종료된 RPG 길드 레이드 모집입니다. `/rpg 길드레이드`로 다시 모집하세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    if (action === 'join') {
      await joinRpgRaidLobby({ lobby, interaction, economy, now });
      await updateWithRpgAssets(
        interaction,
        formatRpgRaidLobby(lobby),
        [lobby.raid.backgroundAssetId],
        { components: createRpgRaidLobbyRows(lobby) }
      );
      return true;
    }

    if (action === 'leave') {
      if (interaction.user.id === lobby.leaderUserId) {
        throw new Error('파티장은 나가기 대신 모집 취소를 눌러주세요.');
      }
      lobby.members = lobby.members.filter((member) => member.userId !== interaction.user.id);
      lobby.updatedAt = now;
      await updateWithRpgAssets(
        interaction,
        formatRpgRaidLobby(lobby),
        [lobby.raid.backgroundAssetId],
        { components: createRpgRaidLobbyRows(lobby) }
      );
      return true;
    }

    if (action === 'cancel') {
      assertRpgRaidLobbyLeader(interaction, lobby);
      activeRpgRaidLobbies.delete(lobby.id);
      await updateWithRpgAssets(
        interaction,
        `🐉 **RPG 길드 레이드 모집 취소**\n${formatDiscordUserMention(interaction.user)}님이 **${lobby.raid.label}** 모집을 취소했습니다.`,
        [lobby.raid.backgroundAssetId],
        { components: [] }
      );
      return true;
    }

    if (action === 'start') {
      assertRpgRaidLobbyLeader(interaction, lobby);
      const result = await economy.playRpgGuildRaid({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        raidId: lobby.raidId,
        skill: lobby.skillId,
        partyMemberIds: lobby.members.map((member) => member.userId)
      });
      activeRpgRaidLobbies.delete(lobby.id);
      await updateWithRpgAssets(interaction, formatRpgGuildRaid(interaction.user, result), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    throw new Error('알 수 없는 레이드 모집 버튼입니다.');
  } catch (error) {
    await interaction.reply({
      content: `RPG 길드 레이드 모집 처리 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
    return true;
  }
}

async function joinRpgRaidLobby({ lobby, interaction, economy, now }) {
  if (lobby.members.some((member) => member.userId === interaction.user.id)) {
    throw new Error('이미 이 레이드 파티에 참가했습니다.');
  }
  if (lobby.members.length >= lobby.maxMembers) {
    throw new Error(`파티가 가득 찼습니다. 최대 ${lobby.maxMembers}명까지 참가할 수 있습니다.`);
  }

  const status = await economy.getRpgStatus({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username,
    now
  });

  if (status.profile.rpg.startedAt <= 0) {
    throw new Error('먼저 `/rpg 시작`으로 캐릭터를 만들어야 참가할 수 있습니다.');
  }
  if ((status.profile.rpg?.level ?? 1) < lobby.raid.unlockLevel) {
    throw new Error(`${lobby.raid.label} 참가 조건은 Lv.${lobby.raid.unlockLevel}+입니다.`);
  }
  if (status.profile.rpg.hp <= 1) {
    throw new Error('HP가 부족해서 참가할 수 없습니다. `/rpg 휴식` 또는 회복 포션을 사용하세요.');
  }
  if (!status.actionAvailability.guildRaid.available) {
    throw new Error(`길드레이드 참가는 아직 할 수 없습니다. ${status.actionAvailability.guildRaid.reason}`);
  }

  lobby.members.push(createRpgRaidLobbyMember(interaction.user, status));
  lobby.updatedAt = now;
}

function assertRpgRaidLobbyLeader(interaction, lobby) {
  if (interaction.user.id !== lobby.leaderUserId) {
    throw new Error('레이드 파티장만 누를 수 있습니다.');
  }
}

function createRpgRaidLobbyMember(user, status) {
  return {
    userId: user.id,
    username: user.username,
    mention: formatDiscordUserMention(user),
    level: status.profile.rpg?.level ?? 1,
    classLabel: status.classConfig.label,
    powerScore: status.adventureGuide.powerScore,
    hp: status.profile.rpg.hp,
    maxHp: status.derivedStats.maxHp
  };
}

function createRpgRaidLobbyId(now = Date.now()) {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function handleRpgDungeonButton(interaction, economy, services = {}) {
  const [, userId, action, runId, revision, targetId] = interaction.customId.split(':');
  if (interaction.user.id !== userId) {
    await safeReplyToInteraction(interaction, '이 던전 버튼은 던전을 시작한 유저만 누를 수 있습니다.', {
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) return true;

  const context = {
    guildId: interaction.guildId,
    userId: interaction.user.id,
    username: interaction.user.username
  };
  const runRevision = Number(revision);

  try {
    let result;
    if (action === 'room') {
      result = await economy.chooseRpgDungeonRoom({
        ...context,
        runId,
        revision: runRevision,
        choiceId: targetId
      });
    } else if (action === 'relic') {
      result = await economy.chooseRpgDungeonRelic({
        ...context,
        runId,
        revision: runRevision,
        relicId: targetId
      });
    } else if (action === 'abandon') {
      result = await economy.abandonRpgDungeonRun({ ...context, runId, revision: runRevision });
    } else if (action === 'resume') {
      result = await economy.runRpgDungeon(context);
    } else {
      throw new Error('알 수 없는 던전 버튼입니다.');
    }

    const seasonAward = await awardRpgDungeonSeasonPoints(services, {
      guildId: interaction.guildId,
      user: interaction.user,
      result
    });
    await updateWithRpgAssets(interaction, appendSeasonAwardLine(formatRpgDungeon(interaction.user, result), seasonAward), getDungeonAssetIds(result), {
      components: createRpgDungeonRows(result, interaction.user.id)
    });
  } catch (error) {
    await updateWithRpgCard(
      interaction,
      ['🏰 **던전 흐름 복구**', error.message, '`/rpg 던전`으로 현재 진행을 다시 열 수 있습니다.'].join('\n'),
      {
        components: createButtonRows([
          createRpgQuickButton(interaction.user.id, 'dungeon', '🏰 던전 다시 열기', ButtonStyle.Primary),
          createRpgQuickButton(interaction.user.id, 'menu', '🎮 허브', ButtonStyle.Secondary)
        ])
      }
    );
  }
  return true;
}

async function handleRpgQuickButton(interaction, economy, services = {}) {
  const [, userId, action] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await safeReplyToInteraction(interaction, '이 RPG 메뉴 버튼은 명령어를 실행한 유저만 누를 수 있습니다.', {
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const acknowledged = await safeDeferUpdate(interaction);
  if (!acknowledged) return true;

  try {
    if (action === 'menu') {
      const status = await economy.getRpgStatus({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await updateWithRpgAssets(
        interaction,
        formatRpgMainMenu(interaction.user, status),
        [status.heroAssetId, status.currentArea.backgroundAssetId],
        { components: createRpgMainMenuRows(status, interaction.user.id) }
      );
      return true;
    }

    if (isRpgMenuSectionAction(action)) {
      const status = await economy.getRpgStatus({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await updateWithRpgAssets(
        interaction,
        formatRpgSectionMenu(interaction.user, status, action),
        getRpgSectionAssetIds(status, action),
        { components: createRpgSectionRows(status, interaction.user.id, action) }
      );
      return true;
    }

    if (action === 'battle') {
      const result = await economy.playRpgBattle({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        difficulty: 'normal'
      });

      if (!result.battled) {
        await safeReplyToInteraction(interaction, `⏳ 아직 다시 전투할 수 없습니다. 남은 시간: ${formatDuration(result.remainingMs)}`, {
          flags: MessageFlags.Ephemeral
        });
        return true;
      }

      const seasonAward = await awardRpgBattleSeasonPoints(services, {
        guildId: interaction.guildId,
        user: interaction.user,
        result
      });
      await replyWithRpgAssets(interaction, appendSeasonAwardLine(formatBattleResult(interaction.user, result), seasonAward), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'explore') {
      const result = await economy.exploreRpg({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await replyWithRpgAssets(interaction, formatRpgExplore(interaction.user, result), getExploreAssetIds(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'dungeon') {
      const result = await economy.runRpgDungeon({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        depth: 3
      });
      await replyWithRpgAssets(interaction, formatRpgDungeon(interaction.user, result), getDungeonAssetIds(result), {
        components: createRpgDungeonRows(result, interaction.user.id)
      });
      return true;
    }

    if (action === 'raid') {
      const result = await economy.playRpgRaid({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username,
        raidId: 'slime_horde'
      });
      await replyWithRpgAssets(interaction, formatRpgRaid(interaction.user, result), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'guild_raid') {
      const lobby = await createRpgRaidLobby({
        economy,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        leader: interaction.user,
        raidId: 'slime_horde',
        skill: 'basic'
      });
      activeRpgRaidLobbies.set(lobby.id, lobby);
      await updateWithRpgAssets(
        interaction,
        formatRpgRaidLobby(lobby),
        [lobby.raid.backgroundAssetId],
        { components: createRpgRaidLobbyRows(lobby) }
      );
      return true;
    }

    if (action === 'rest') {
      const result = await economy.restRpg({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.user.username
      });
      await updateWithRpgAssets(interaction, formatRpgRest(result), [], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    const status = await economy.getRpgStatus({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username
    });

    if (action === 'tutorial') {
      await updateWithRpgAssets(interaction, formatRpgTutorial(status), [status.heroAssetId, status.currentArea.backgroundAssetId], {
        components: createRpgTutorialRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'daily') {
      await updateWithRpgAssets(interaction, formatRpgDailyMissions(status), [], {
        components: createRpgDailyRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'quest') {
      await updateWithRpgAssets(interaction, formatRpgQuests(status), [], {
        components: createRpgQuestViewRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'status') {
      await updateWithRpgAssets(interaction, formatRpgStatus(interaction.user, status), [status.heroAssetId], {
        components: createRpgActionLoopRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'inventory') {
      await updateWithRpgAssets(interaction, formatRpgInventory(status), [status.heroAssetId], {
        components: createRpgInventoryRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'shop') {
      await updateWithRpgAssets(interaction, formatRpgShop(status), [status.heroAssetId], {
        components: createRpgShopViewRows(interaction.user.id)
      });
      return true;
    }

    if (action === 'equipment') {
      await updateWithRpgAssets(interaction, formatRpgEquipmentGuide(status), [status.heroAssetId], {
        components: [
          ...createRpgEquipmentRows(status, interaction.user.id),
          ...createRpgActionLoopRows(interaction.user.id).slice(0, 1)
        ].slice(0, 5)
      });
      return true;
    }

    if (action === 'gear') {
      await updateWithRpgAssets(interaction, formatRpgGearInventory(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, interaction.user.id, 'gear')
      });
      return true;
    }

    if (action === 'enhance') {
      await updateWithRpgAssets(interaction, formatRpgGearEnhanceGuide(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, interaction.user.id, 'enhance')
      });
      return true;
    }

    if (action === 'disassemble') {
      await updateWithRpgAssets(interaction, formatRpgGearDisassembleGuide(status), [status.heroAssetId], {
        components: createRpgInventoryManagementRows(status, interaction.user.id, 'disassemble')
      });
      return true;
    }

    if (action === 'skill_tree') {
      await updateWithRpgAssets(interaction, formatRpgSkillTree(status), [status.heroAssetId], {
        components: createRpgSkillTreeViewRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'class_path') {
      await updateWithRpgAssets(interaction, formatRpgClassPath(status), [status.heroAssetId], {
        components: [
          ...createRpgAdvanceRows(status, interaction.user.id),
          ...createRpgActionLoopRows(interaction.user.id).slice(0, 1)
        ].slice(0, 5)
      });
      return true;
    }

    if (action === 'story') {
      await updateWithRpgAssets(interaction, formatRpgStory(status), [], {
        components: createRpgStoryViewRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'codex') {
      await updateWithRpgAssets(interaction, formatRpgCodex(status), [], {
        components: createRpgCodexViewRows(status, interaction.user.id)
      });
      return true;
    }

    if (action === 'area') {
      await updateWithRpgAssets(interaction, formatRpgAreas(status), [status.currentArea.backgroundAssetId], {
        components: createRpgAreaRows(status, interaction.user.id)
      });
      return true;
    }
  } catch (error) {
    await safeReplyToInteraction(interaction, `RPG 빠른 실행 실패: ${error.message}`, {
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  await safeReplyToInteraction(interaction, '알 수 없는 RPG 메뉴 버튼입니다.', {
    flags: MessageFlags.Ephemeral
  });
  return true;
}

async function handleRpgBossActionButton(interaction, economy) {
  const [, sessionId, action] = interaction.customId.split(':');
  const entry = activeRpgBossSessions.get(sessionId);

  if (!entry || entry.expiresAt < Date.now()) {
    activeRpgBossSessions.delete(sessionId);
    await interaction.reply({
      content: '만료된 RPG 보스전입니다. `/rpg 보스`로 다시 도전하세요.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (entry.session.userId !== interaction.user.id) {
    await interaction.reply({
      content: '이 RPG 보스전은 시작한 유저만 조작할 수 있습니다.',
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  try {
    const result = await economy.playRpgBossTurn({
      guildId: interaction.guildId,
      session: entry.session,
      userId: interaction.user.id,
      action
    });

    if (!result.completed) {
      activeRpgBossSessions.set(sessionId, {
        session: result.session,
        expiresAt: Date.now() + RPG_BOSS_SESSION_TTL_MS
      });
      await updateWithRpgAssets(
        interaction,
        formatRpgBossTurn(interaction.user, result),
        getBossEncounterAssetIds(result),
        { components: [createRpgBossActionRow(result.session)] }
      );
      return true;
    }

    activeRpgBossSessions.delete(sessionId);
    await updateWithRpgAssets(interaction, formatRpgBossFinish(interaction.user, result), getBattleAssetIds(result), {
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 보스 행동 실패: ${error.message}`,
      flags: MessageFlags.Ephemeral
    });
  }

  return true;
}

function formatRpgCharacterCreation(user, status) {
  const { profile, classConfig, genderConfig, currentArea } = status;
  const firstJobs = getRpgFirstJobOptions()
    .map((option) => option.name)
    .join(', ');

  return [
    `🎭 **희희봇 RPG 모험가 등록** — ${formatDiscordUserMention(user)}`,
    `현재 캐릭터: **${genderConfig.label} ${classConfig.label}** · 지역 **${currentArea.label}**`,
    '모든 유저는 **모험가**로 시작합니다. 아래에서 외형만 고르면 등록됩니다.',
    '',
    `Lv.10 1차 전직: ${firstJobs}`,
    'Lv.15 듀얼 직업으로 두 번째 1차 직업을 선택할 수 있습니다.'
  ].join('\n');
}

function formatRpgStart(user, result) {
  const { classConfig, genderConfig, profile, derivedStats, currentArea } = result;

  return [
    `🧭 **모험가 등록 완료** — ${formatDiscordUserMention(user)}`,
    `캐릭터: **${genderConfig.label} ${classConfig.label}**`,
    classConfig.description,
    `현재 레벨: **Lv.${profile.rpg.level}** / 경험치: **${profile.rpg.totalXp.toLocaleString()} XP**`,
    `스탯: 공격력 **${derivedStats.attack}** / 방어력 **${derivedStats.defense}** / HP **${profile.rpg.hp.toLocaleString()}/${derivedStats.maxHp.toLocaleString()}** / MP **${profile.rpg.mp.toLocaleString()}/${derivedStats.maxMp.toLocaleString()}**`,
    `시작 지역: **${currentArea.label}**`,
    '',
    '다음 추천: **초보자 여정**에서 보상을 받고 첫 전투로 넘어가세요.',
    '아래 버튼: `초보자 여정` → `첫 전투` → `허브` 순서로 누르면 됩니다.'
  ].join('\n');
}

function formatBattleResult(user, result) {
  const { battle, profile } = result;
  const outcomeText = battle.win ? '승리' : '패배';
  const rewardText = battle.win
    ? `+${result.xpGained.toLocaleString()} XP · +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)}`
    : '보상 없음';
  const monsterPowerText = battle.defenseBonus > 0
    ? `${battle.monsterPower} → ${battle.mitigatedMonsterPower} (방어 적용)`
    : `${battle.monsterPower}`;
  const statusEffectText = formatRpgStatusEffect(battle.statusEffect);
  const ultimateChargeText = result.ultimateCharge
    ? `🌟 궁극기 게이지 ${formatRpgMeter(result.ultimateCharge.after, result.ultimateCharge.max)} **${result.ultimateCharge.after}/${result.ultimateCharge.max}**`
    : '';
  const lootRows = [
    result.drop ? `🎁 드랍 **${result.drop.label}** × ${result.drop.quantity}` : null,
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    battle.ultimate ? `🌟 궁극기 **${battle.skillLabel}**${result.ultimateCharge?.spent ? ' · 게이지 소비' : ''}` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `⚔️ **RPG 전투 결과 — ${outcomeText}** — ${formatDiscordUserMention(user)}`,
    `📍 **${battle.areaLabel}** · ${battle.difficultyLabel} · **${battle.monster}**`,
    `🧙 ${battle.characterGenderLabel} ${battle.characterClassLabel} · ${battle.skillLabel} (MP -${battle.skillMpCost})`,
    `🎲 판정: 내 **${battle.playerPower}** vs 몬스터 **${monsterPowerText}** · Lv.${battle.playerLevel} · 주사위 ${battle.playerRoll} · 장비 +${battle.attackBonus}`,
    `🏁 피해 **-${battle.damageTaken.toLocaleString()} HP** · 🎁 ${rewardText}`,
    statusEffectText ? `🌀 상태효과: ${statusEffectText}` : null,
    lootRows.length > 0 ? lootRows.join('\n') : null,
    formatRpgCompactPostBattleState(profile),
    formatRpgNextAction(profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgBossEncounter(user, result) {
  const { session } = result;
  const bossPattern = getRpgBossPattern(session.bossId, session.turn);

  return [
    `🐲 **수동 보스전 시작** — ${formatDiscordUserMention(user)}`,
    `보스: **${session.bossLabel}** / 지역: **${session.areaLabel}**`,
    `예고 패턴: **${bossPattern.label}** — ${bossPattern.telegraph ?? bossPattern.description}`,
    `추천 대응: **${bossPattern.counterLabel ?? '상황에 맞는 행동'}** / 약점: **${bossPattern.weaknessLabel ?? '없음'}**`,
    '',
    `🧍 **내 상태**`,
    formatRpgCombatantVitals({
      hp: session.player.hp,
      maxHp: session.player.maxHp,
      mp: session.player.mp,
      maxMp: session.player.maxMp,
      potionCount: session.player.inventory?.potion ?? 0
    }),
    `🐲 **보스 상태**`,
    formatRpgCombatantVitals({
      hp: session.boss.hp,
      maxHp: session.boss.maxHp,
      mp: null,
      maxMp: null,
      extra: `위협도 **${session.boss.power}**`
    }),
    '',
    '아래 버튼으로 공격, 스킬, 방어, 포션을 직접 선택하세요.'
  ].join('\n');
}

function formatRpgBossTurn(user, result) {
  const { session, turn } = result;
  const bossPattern = turn.bossPattern ?? {
    label: '기본 공격',
    description: '특수 패턴 없이 반격합니다.'
  };
  const actionText = turn.action === 'guard'
    ? '방어 태세'
    : turn.action === 'potion'
      ? `회복 포션 사용 (+${turn.healed} HP)`
      : `${turn.skillLabel ?? '기본 공격'} (피해 ${turn.playerDamage})`;
  const statusEffectText = formatRpgStatusEffect(turn.statusEffect);
  const counterText = turn.patternCountered
    ? `패턴 대응 성공${turn.bossDamageReduction ? ` · 피해 ${turn.bossDamageReduction} 감소` : ''}`
    : `추천 대응: **${bossPattern.counterLabel ?? '상황 판단'}** / 약점 **${bossPattern.weaknessLabel ?? '없음'}**`;

  return [
    `🐲 **수동 보스전** — ${formatDiscordUserMention(user)}`,
    `🧭 전장 상태: **${session.bossLabel} ${session.turn}턴**`,
    `보스 패턴: **${bossPattern.label}** — ${bossPattern.telegraph ?? bossPattern.description}`,
    `최근 행동: **${actionText}** / 보스 반격 **-${turn.bossDamage} HP**`,
    `대응 판정: ${counterText}${turn.weaknessHit ? ' · 약점 적중' : ''}`,
    statusEffectText ? `상태효과: ${statusEffectText}` : null,
    '',
    `🧍 **내 상태**`,
    formatRpgCombatantVitals({
      hp: session.player.hp,
      maxHp: session.player.maxHp,
      mp: session.player.mp,
      maxMp: session.player.maxMp,
      potionCount: session.player.inventory?.potion ?? 0
    }),
    `🐲 **보스 상태**`,
    formatRpgCombatantVitals({
      hp: session.boss.hp,
      maxHp: session.boss.maxHp,
      mp: null,
      maxMp: null,
      extra: `위협도 **${session.boss.power}**`
    }),
    '',
    '다음 행동을 선택하세요.'
  ].filter(Boolean).join('\n');
}

function formatRpgBossFinish(user, result) {
  const { battle, profile, turn } = result;
  const bossPattern = turn.bossPattern ?? { label: '기본 공격' };
  const outcomeText = battle.win ? '승리' : '패배';
  const ultimateChargeText = result.ultimateCharge
    ? `🌟 궁극기 게이지 ${formatRpgMeter(result.ultimateCharge.after, result.ultimateCharge.max)} **${result.ultimateCharge.after}/${result.ultimateCharge.max}**`
    : '';
  const rewardRows = [
    result.gearDrop ? `🧰 보스 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐲 **수동 보스전 종료** — ${formatDiscordUserMention(user)}`,
    `보스: **${battle.bossLabel}** / 결과: **${outcomeText}**`,
    `마지막 패턴: **${bossPattern.label}**`,
    turn.patternCountered ? `마지막 대응: **성공**${turn.weaknessHit ? ' · 약점 적중' : ''}` : null,
    `마지막 행동 피해: **${turn.playerDamage}** / 보스 반격: **${turn.bossDamage}**`,
    battle.win
      ? `보상: +${result.xpGained.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)}`
      : '보상: 없음',
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    formatRpgPostActionState(profile),
    `보스 처치: **${profile.rpg.bossKills[battle.bossId] ?? 0}회**`,
    formatRpgNextAction(profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgCombatantVitals({
  hp = 0,
  maxHp = 1,
  mp = 0,
  maxMp = 1,
  inventory = {},
  potionCount = inventory?.potion,
  extra = ''
} = {}) {
  const hpLine = `HP ${formatRpgMeter(hp, maxHp)} **${Math.max(0, hp)}/${Math.max(1, maxHp)}**`;
  const mpLine = maxMp === null
    ? null
    : `MP ${formatRpgMeter(mp, maxMp)} **${Math.max(0, mp)}/${Math.max(1, maxMp)}**`;
  const potionLine = potionCount === undefined
    ? null
    : `포션 **${Math.max(0, Number(potionCount) || 0)}개**`;

  return [hpLine, mpLine, potionLine, extra]
    .filter(Boolean)
    .join(' · ');
}

function formatRpgStatusEffect(statusEffect) {
  if (!statusEffect) return '';
  const label = statusEffect.label ?? '상태이상';
  const description = statusEffect.description ? ` — ${statusEffect.description}` : '';
  return `**${label}**${description}`;
}

function formatRpgMeter(current, max, width = 8) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeCurrent = Math.max(0, Math.min(safeMax, Number(current) || 0));
  const filled = Math.max(0, Math.min(width, Math.round((safeCurrent / safeMax) * width)));
  return `${'▰'.repeat(filled)}${'▱'.repeat(width - filled)}`;
}

function getRpgProfileDerivedStats(profile) {
  return getRpgDerivedStats({
    level: profile.rpg.level,
    characterClass: profile.rpg?.characterClass,
    equipment: profile.rpg?.equipment,
    advancedClass: profile.rpg?.advancedClass,
    learnedSkills: profile.rpg?.learnedSkills,
    gearInventory: profile.rpg?.gearInventory,
    equippedGear: profile.rpg?.equippedGear
  });
}

function formatRpgPostActionState(profile) {
  const derivedStats = getRpgProfileDerivedStats(profile);
  return [
    `🧍 상태: HP ${formatRpgMeter(profile.rpg.hp, derivedStats.maxHp)} **${profile.rpg.hp.toLocaleString()}/${derivedStats.maxHp.toLocaleString()}**`,
    `MP ${formatRpgMeter(profile.rpg.mp, derivedStats.maxMp)} **${profile.rpg.mp.toLocaleString()}/${derivedStats.maxMp.toLocaleString()}**`,
    `골드 **${getRpgGold(profile).toLocaleString()}**`
  ].join(' · ');
}

function formatRpgCompactPostBattleState(profile) {
  const derivedStats = getRpgProfileDerivedStats(profile);
  return [
    `🧍 HP **${profile.rpg.hp.toLocaleString()}/${derivedStats.maxHp.toLocaleString()}**`,
    `MP **${profile.rpg.mp.toLocaleString()}/${derivedStats.maxMp.toLocaleString()}**`,
    `골드 **${getRpgGold(profile).toLocaleString()}**`,
    `전적 **${profile.rpg.wins}승 ${profile.rpg.losses}패**`
  ].join(' · ');
}

function formatRpgNextAction(profile, {
  cooldownRemainingMs = 0,
  actionAvailability = null,
  dailyGold = null,
  adventureGuide = null
} = {}) {
  const guide = adventureGuide ?? getRpgAdventureGuide(profile, {
    cooldownRemainingMs,
    actionAvailability,
    dailyGold
  });
  return [
    `➡️ 다음 추천: **${guide.recommendedAction.label}** · \`${guide.recommendedAction.command}\``,
    `   └ ${guide.recommendedAction.reason}`
  ].join('\n');
}

function formatRpgRewardCapHint(result) {
  const limit = result.rpgGoldLimit;
  if (!limit?.capped) return null;

  const earned = Math.max(0, Number(limit.earned ?? limit.earnedToday) || 0);
  const cap = Math.max(0, Number(limit.cap) || 0);

  return `⚠️ 일일 상한 적용: 오늘 RPG 골드 ${earned.toLocaleString()}/${cap.toLocaleString()}`;
}

function formatRpgMaterialDrops(drops = []) {
  if (!Array.isArray(drops) || drops.length <= 0) return null;
  return `⛏️ 재료 ${drops.map((drop) => `**${drop.label}** × ${drop.quantity}`).join(', ')}`;
}

function formatRpgAreaTierLabel(unlockLevel) {
  if (unlockLevel <= 1) return 'Lv.1 입문';
  if (unlockLevel <= 3) return 'Lv.2~3 성장';
  if (unlockLevel <= 6) return 'Lv.4~6 중급';
  if (unlockLevel <= 10) return 'Lv.7~10 상급';
  return 'Lv.11+ 심화';
}

function formatDiscordUserMention(user = {}) {
  const rendered = String(user ?? '').trim();
  if (rendered && rendered !== '[object Object]') return rendered;
  return user.id ? `<@${user.id}>` : user.username ?? '상대';
}

function formatRpgMainMenu(user, status) {
  const {
    profile,
    classConfig,
    genderConfig,
    advancedClassConfig,
    currentArea,
    derivedStats,
    adventureGuide
  } = status;
  const dailySummary = formatDailyMissionSummary(status.dailyMissions);
  const advancedText = advancedClassConfig ? ` → ${advancedClassConfig.label}` : '';
  const nextAreaText = adventureGuide.nextLockedArea
    ? `다음 지역: **${adventureGuide.nextLockedArea.label}** Lv.${adventureGuide.nextLockedArea.unlockLevel}+`
    : '모든 지역 해금 완료';
  const dailyGoldText = formatRpgDailyGoldLimit(status.dailyGold);
  const actionAvailabilityText = formatRpgActionAvailability(status.actionAvailability);
  const tutorialText = formatRpgTutorialMiniSummary(status.tutorial);
  const alertText = formatRpgHubAlerts(status);

  return [
    `🎮 **RPG 허브** — ${user.username}`,
    `**${genderConfig.label} ${classConfig.label}${advancedText}** · ${currentArea.label} · Lv.${profile.rpg.level}`,
    formatRpgHud(profile, derivedStats, adventureGuide),
    `🧭 **추천** ${adventureGuide.recommendedAction.label} · \`${adventureGuide.recommendedAction.command}\`\n└ ${adventureGuide.recommendedAction.reason}`,
    `🎯 **목표** ${adventureGuide.mainObjective.label} — ${adventureGuide.mainObjective.progressText}`,
    alertText ? `🔔 **알림** ${alertText}` : null,
    `🎓 **초보자** ${tutorialText}`,
    `📋 **오늘** ${dailySummary} · ${dailyGoldText}`,
    `🗺️ **진행** ${nextAreaText}`,
    `🎛️ 아래 버튼: **추천 행동** → **전투/모험/성장** → 필요하면 **관리/오늘**`
  ].join('\n');
}

function formatRpgSectionMenu(user, status, section) {
  const { profile, currentArea, derivedStats, adventureGuide } = status;
  const sectionConfig = getRpgMenuSectionConfig(section);
  const sectionHint = getRpgSectionHint(status, section);

  return [
    `${sectionConfig.emoji} **RPG ${sectionConfig.label} 탭** — ${user.username}`,
    `현재 지역 **${currentArea.label}** · Lv.${profile.rpg.level} · 이 탭: ${sectionConfig.description}`,
    formatRpgHud(profile, derivedStats, adventureGuide),
    `🧭 **추천** ${adventureGuide.recommendedAction.label} — ${adventureGuide.recommendedAction.reason}`,
    `⚡ **빠른 판단** ${formatRpgSmartRecommendationSummary(status)}`,
    sectionHint ? `📌 **이 탭에서** ${sectionHint}` : null
  ].join('\n');
}

function formatRpgHud(profile, derivedStats, adventureGuide) {
  const levelProgress = adventureGuide?.levelProgress ?? {
    current: 0,
    required: 1,
    percent: 0
  };
  const xpBar = levelProgress.bar
    ?? formatRpgMeter(levelProgress.current, levelProgress.required, 8);

  return [
    '```ansi',
    `HP ${formatRpgMeter(profile.rpg.hp, derivedStats.maxHp, 10)} ${profile.rpg.hp.toLocaleString()}/${derivedStats.maxHp.toLocaleString()}`,
    `MP ${formatRpgMeter(profile.rpg.mp, derivedStats.maxMp, 10)} ${profile.rpg.mp.toLocaleString()}/${derivedStats.maxMp.toLocaleString()}`,
    `XP ${xpBar} ${levelProgress.current.toLocaleString()}/${levelProgress.required.toLocaleString()} (${levelProgress.percent}%)`,
    `ATK ${derivedStats.attack}  DEF ${derivedStats.defense}  PWR ${adventureGuide?.powerScore ?? 0}  GOLD ${getRpgGold(profile).toLocaleString()}`,
    '```'
  ].join('\n');
}

function formatRpgHubAlerts(status) {
  const alerts = [];
  const hpRatio = status.derivedStats.maxHp > 0
    ? status.profile.rpg.hp / status.derivedStats.maxHp
    : 1;
  const claimableDailyCount = status.dailyMissions.filter((mission) => mission.canClaim).length;
  const claimableQuestCount = status.quests.filter((quest) => quest.canClaim).length;
  const claimableCodexCount = status.codex.filter((entry) => entry.canClaim).length;
  const skillPointCount = status.skillPoints?.available ?? 0;
  const advanceCount = status.classPaths.filter((advanced) => advanced.canAdvance).length;

  if (hpRatio <= 0.35) alerts.push('HP 낮음 · 휴식 추천');
  if (claimableDailyCount > 0) alerts.push(`일일 보상 ${claimableDailyCount}개`);
  if (claimableQuestCount > 0) alerts.push(`퀘스트 보상 ${claimableQuestCount}개`);
  if (claimableCodexCount > 0) alerts.push(`도감 보상 ${claimableCodexCount}개`);
  if (skillPointCount > 0) alerts.push(`스킬 포인트 ${skillPointCount}점`);
  if (advanceCount > 0) alerts.push(`전직 가능 ${advanceCount}개`);

  return alerts.slice(0, 4).join(' · ');
}

function getRpgSectionHint(status, section) {
  const hasGear = Object.keys(status.profile.rpg.gearInventory ?? {}).length > 0;
  const claimableDailyCount = status.dailyMissions.filter((mission) => mission.canClaim).length;
  const claimableQuestCount = status.quests.filter((quest) => quest.canClaim).length;
  const progressableStoryCount = status.storyChapters.filter((chapter) => chapter.canProgress).length;
  const claimableCodexCount = status.codex.filter((entry) => entry.canClaim).length;
  const hasSkillPoints = (status.skillPoints?.available ?? 0) > 0;
  const hasAdvance = status.classPaths.some((advanced) => advanced.canAdvance);

  if (section === 'combat') {
    return '사냥으로 기본 성장, 던전으로 장비, 위험하면 휴식부터.';
  }

  if (section === 'adventure') {
    return progressableStoryCount > 0
      ? `메인 퀘스트 ${progressableStoryCount}개 진행 가능 · 탐험으로 지역 탐사율을 올리세요.`
      : '탐험으로 지역 탐사율을 올리고 월드맵에서 다음 사냥터를 확인하세요.';
  }

  if (section === 'growth') {
    const parts = [];
    if (hasGear) parts.push('장비 장착/강화 가능');
    if (hasSkillPoints) parts.push(`스킬 ${status.skillPoints.available}점 사용 가능`);
    if (hasAdvance) parts.push('전직 가능');
    return parts.join(' · ') || '던전/레이드에서 장비를 얻으면 성장 버튼이 활성화됩니다.';
  }

  if (section === 'manage') {
    return '인벤토리, 상점, 장비 상태를 정비하는 화면입니다.';
  }

  const todoParts = [];
  if (claimableDailyCount > 0) todoParts.push(`일일 ${claimableDailyCount}`);
  if (claimableQuestCount > 0) todoParts.push(`퀘스트 ${claimableQuestCount}`);
  if (progressableStoryCount > 0) todoParts.push(`메인 ${progressableStoryCount}`);
  if (claimableCodexCount > 0) todoParts.push(`도감 ${claimableCodexCount}`);
  return todoParts.length > 0
    ? `지금 받을/진행할 보상: ${todoParts.join(', ')}`
    : '오늘 받을 보상이 없으면 전투나 탐험으로 새 진행도를 쌓으세요.';
}

function formatRpgTutorial(status) {
  const tutorial = status.tutorial;
  const claimable = tutorial.steps.filter((step) => step.canClaim);
  const nextActionStep = getRpgTutorialNextActionStep(tutorial);
  const visibleSteps = [
    ...claimable,
    ...(nextActionStep ? [nextActionStep] : [])
  ].filter((step, index, values) =>
    values.findIndex((candidate) => candidate.id === step.id) === index
  ).slice(0, 3);
  const rows = visibleSteps.map((step) => {
    const state = step.claimed
      ? '✅ 완료'
      : step.canClaim
        ? '🎁 보상 가능'
        : step.complete
          ? '완료'
          : '진행 중';
    return `- **${step.label}** ${state} · ${formatRpgProgress(step.current, step.required)} · \`${step.command}\``;
  });

  const nextLine = nextActionStep
    ? `다음 목표: **${nextActionStep.label}** · \`${nextActionStep.command}\``
    : '다음 목표: 모든 초보자 여정을 완료했습니다.';
  const claimLine = claimable.length > 0
    ? `보상 가능 **${claimable.map((step) => step.label).join(', ')}**`
    : '보상 가능 없음';

  return [
    '🎓 **RPG 초보자 여정**',
    `진행도 **${tutorial.claimedCount}/${tutorial.total}** · ${claimLine}`,
    nextLine,
    rows.join('\n') || '모든 튜토리얼 완료',
    status.profile.rpg.startedAt <= 0
      ? '아래 선택 메뉴에서 캐릭터 생성'
      : '선택 메뉴로 보상 수령'
  ].join('\n');
}

function formatRpgTutorialClaim(result) {
  const itemRewards = formatRewardItems(result.rewards.items);
  const nextActionStep = getRpgTutorialNextActionStep(result.tutorial);
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.rpg.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    '🎓 **튜토리얼 보상 수령**',
    `단계: **${result.step.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `초보자 여정: **${result.tutorial.claimedCount}/${result.tutorial.total}개 보상 수령**`,
    nextActionStep
      ? `다음 목표: **${nextActionStep.label}** · \`${nextActionStep.command}\``
      : '다음 목표: 초보자 여정을 모두 완료했습니다.',
    `현재 경험치: **${result.profile.rpg.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatRpgTutorialMiniSummary(tutorial) {
  if (!tutorial || tutorial.complete) {
    return '완료';
  }

  if (tutorial.claimableCount > 0) {
    return `받을 보상 **${tutorial.claimableCount}개** · \`/rpg 튜토리얼\``;
  }

  const nextStep = getRpgTutorialNextActionStep(tutorial);
  return nextStep
    ? `다음 **${nextStep.label}** · \`${nextStep.command}\``
    : `진행 중 **${tutorial.claimedCount}/${tutorial.total}**`;
}

function getRpgTutorialNextActionStep(tutorial) {
  if (!tutorial?.steps?.length) return null;
  return tutorial.steps.find((step) => !step.complete)
    ?? tutorial.steps.find((step) => !step.claimed)
    ?? null;
}

function formatRpgSmartRecommendationSummary(status) {
  const recommendations = getRpgSmartRecommendations(status);

  if (recommendations.length <= 0) {
    return '특별히 밀린 보상은 없습니다. `전투`나 `모험` 허브에서 다음 파밍을 이어가세요.';
  }

  return recommendations
    .slice(0, 3)
    .map((recommendation, index) => `${index + 1}) **${recommendation.label}**`)
    .join(' · ');
}

function formatRpgStatus(user, status) {
  const {
    profile,
    cooldownRemainingMs,
    classConfig,
    genderConfig,
    advancedClassConfig,
    currentArea,
    unlockedAreas,
    derivedStats,
    availableSkillIds
  } = status;
  const { adventureGuide } = status;
  const classMastery = status.classMastery;
  const currentAreaProgress = status.areaProgress.find((area) => area.id === profile.rpg.currentArea);
  const winRate = profile.rpg.battles === 0
    ? 0
    : Math.round((profile.rpg.wins / profile.rpg.battles) * 100);
  const cooldownText = cooldownRemainingMs > 0
    ? `전투 대기: **${formatDuration(cooldownRemainingMs)}**`
    : '전투 가능: **지금 가능**';
  const dailyGoldText = formatRpgDailyGoldLimit(status.dailyGold);
  const actionAvailabilityText = formatRpgActionAvailability(status.actionAvailability);
  const discoveredCount = Object.keys(profile.rpg.discoveredMonsters).length;
  const advancedText = advancedClassConfig ? ` / 전직: **${advancedClassConfig.label}**` : '';

  return [
    `📜 **${user.username}님의 RPG 상태**`,
    `레벨: **Lv.${profile.rpg.level}** / 경험치: **${profile.rpg.totalXp.toLocaleString()} XP**`,
    `레벨 진행: ${adventureGuide.levelProgress.bar} **${adventureGuide.levelProgress.current}/${adventureGuide.levelProgress.required} XP** (${adventureGuide.levelProgress.percent}%)`,
    `HP: **${profile.rpg.hp.toLocaleString()} / ${derivedStats.maxHp.toLocaleString()}**`,
    `MP: **${profile.rpg.mp.toLocaleString()} / ${derivedStats.maxMp.toLocaleString()}**`,
    `궁극기 게이지: ${formatRpgMeter(profile.rpg.ultimateCharge, 100)} **${profile.rpg.ultimateCharge}/100**${profile.rpg.ultimateCharge >= 100 ? ' · 준비 완료' : ''}`,
    `스탯: 공격력 **${derivedStats.attack}** / 방어력 **${derivedStats.defense}** / 전투력 **${adventureGuide.powerScore}**`,
    `직업: **${classConfig.label}**${advancedText} / 성별: **${genderConfig.label}** / 현재 지역: **${currentArea.label}**`,
    `직업 숙련: **${classMastery.classLabel} Lv.${classMastery.level}** ${classMastery.progressBar} ${classMastery.progress}/${classMastery.required}`,
    `지역 탐사율: **${currentArea.label} ${currentAreaProgress?.progress ?? 0}%** ${currentAreaProgress?.progressBar ?? ''}`,
    `다음 목표: **${adventureGuide.mainObjective.label}** — ${adventureGuide.mainObjective.progressText}`,
    `다음 행동: **${adventureGuide.recommendedAction.label}** · 버튼 또는 \`${adventureGuide.recommendedAction.command}\``,
    `스킬 포인트: **${status.skillPoints.available}/${status.skillPoints.earned} 사용 가능** / 인벤토리 장비: **${Object.keys(profile.rpg.gearInventory).length}개**`,
    `해금 직업: **${profile.rpg.unlockedClasses.length}개** / 사용 가능 스킬: **${availableSkillIds.length}개**`,
    `해금 지역: **${unlockedAreas.map((area) => area.label).join(', ')}**`,
    `전적: **${profile.rpg.wins}승 ${profile.rpg.losses}패 / ${profile.rpg.battles}전**`,
    `승률: **${winRate}%** / 발견 몬스터: **${discoveredCount}종**`,
    `오늘 RPG 반복 보상: ${dailyGoldText}`,
    `행동 가능: ${actionAvailabilityText}`,
    cooldownText,
    `오늘 의뢰: ${formatDailyMissionSummary(status.dailyMissions)}`,
    `골드: **${getRpgGold(profile).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgDailyMissions(status) {
  const rows = status.dailyMissions.map((mission) => {
    const state = mission.claimed ? '✅ 수령 완료' : mission.canClaim ? '🎁 보상 가능' : '진행 중';
    const itemText = formatRewardItems(mission.rewards.items);
    return `- **${mission.label}** — ${state} · 진행도 ${formatRpgProgress(mission.current, mission.required)}\n  ${mission.description} · 보상 ${mission.rewards.xp} XP, ${mission.rewards.coins}골드${itemText ? `, ${itemText}` : ''}`;
  });

  return [
    '📋 **오늘의 RPG 의뢰판**',
    `오늘 진행: 전투 **${status.profile.rpg.daily.battles}회**, 승리 **${status.profile.rpg.daily.wins}회**, 탐험 **${status.profile.rpg.daily.explores}회**, 던전 **${status.profile.rpg.daily.dungeons}회**`,
    rows.join('\n'),
    '',
    '보상 가능한 의뢰는 아래 선택 메뉴로 바로 수령하거나 `/rpg 일일 임무:<이름>`으로 받을 수 있습니다.'
  ].join('\n');
}

function formatRpgDailyClaim(result) {
  const itemRewards = formatRewardItems(result.rewards.items);
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.rpg.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    '📋 **일일 의뢰 보상 수령**',
    `의뢰: **${result.mission.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `오늘 완료한 의뢰: **${Object.keys(result.profile.rpg.daily.claimedMissions).length.toLocaleString()}개**`,
    `현재 경험치: **${result.profile.rpg.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatRpgShop(status = null) {
  const rows = getRpgShopItemOptions().map((option) => {
    const item = getRpgItemConfig(option.value);
    const typeLabel = item.type === 'equipment' ? `장비/${formatEquipmentSlot(item.slot)}` : '소비품';
    const statText = item.stats ? formatGearStats(item.stats) : '';
    return `- **${item.label}** — ${item.price.toLocaleString()}골드 · ${typeLabel}${statText ? ` · ${statText}` : ''}\n  ${item.description}`;
  });
  const goldText = status
    ? `보유 골드: **${getRpgGold(status.profile).toLocaleString()}골드**`
    : '보유 골드는 `/rpg 인벤토리`에서 확인할 수 있습니다.';

  return [
    '🏪 **RPG 상점**',
    goldText,
    rows.join('\n'),
    '',
    '아래 구매 선택 메뉴로 바로 살 수 있습니다. 아이템 이름만 보여주고 내부 코드는 숨깁니다.',
    '포션은 인벤토리에 보관되고, 장비는 구매 후 바로 장착 버튼이 표시됩니다.'
  ].join('\n');
}

function formatRpgPurchase(result) {
  return [
    `🛒 **구매 완료**`,
    `아이템: **${result.item.label}** × ${result.quantity.toLocaleString()}`,
    `사용 금액: **${result.totalPrice.toLocaleString()}골드**`,
    `현재 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgCraftingMenu(status, category = null) {
  const normalizedCategory = normalizeNullableRpgCraftingCategory(category);
  const recipes = status.craftingRecipes
    .filter((recipe) => !normalizedCategory || recipe.category === normalizedCategory)
    .slice(0, 8);
  const masteryRows = status.craftingMastery
    .slice(0, 4)
    .map((mastery) => `- ${mastery.label} Lv.${mastery.level} ${mastery.progressBar}`);
  const recipeRows = recipes.map((recipe) => {
    const resultItem = getRpgItemConfig(recipe.resultItemId);
    const materialText = recipe.materialRows
      .slice(0, 3)
      .map((row) => `${row.ready ? '✅' : '❌'} ${row.label} ${row.owned}/${row.required}`)
      .join(', ');
    const lockText = recipe.canCraft
      ? '제작 가능'
      : [
        recipe.levelReady ? null : `Lv.${recipe.requiredLevel}`,
        recipe.masteryReady ? null : `${recipe.mastery.label} Lv.${recipe.requiredMasteryLevel}`,
        recipe.classReady ? null : '대장장이 전용',
        recipe.materialsReady ? null : '재료 부족'
      ].filter(Boolean).join(' · ');
    return `- **${recipe.hidden ? '히든 ' : ''}${recipe.label}** → ${resultItem.label} · ${recipe.gold.toLocaleString()}골드 · ${lockText}\n  ${materialText || '재료 없음'}`;
  });

  return [
    '⚒️ **RPG 제작소**',
    `보유 골드: **${getRpgGold(status.profile).toLocaleString()}골드** · 제작 축복 **${status.craftingBlessing}%**`,
    masteryRows.length > 0 ? `숙련도\n${masteryRows.join('\n')}` : null,
    recipes.length > 0 ? `레시피\n${recipeRows.join('\n')}` : '표시할 레시피가 없습니다.',
    '',
    '명령어 예시: `/rpg 제작 레시피:철 장검` · 거래는 `/rpg 거래소`에서 합니다.'
  ].filter(Boolean).join('\n');
}

function formatRpgCraftingResult(result) {
  const resultRows = result.results.map((craft, index) => {
    if (!craft.success) {
      return `${index + 1}. ❌ 실패 · 판정 ${craft.roll}/${craft.successRate} · 축복 증가`;
    }
    const product = craft.gear
      ? `**${formatGearLabel(craft.gear)}**`
      : `**${craft.rewardItem.label}** × ${craft.rewardItem.quantity}`;
    return `${index + 1}. ✅ 성공 · ${craft.quality?.label ?? '보통'} · ${product}`;
  });

  return [
    `⚒️ **제작 결과: ${result.recipe.label}**`,
    `성공 **${result.successCount}회** / 실패 **${result.failureCount}회**`,
    resultRows.join('\n'),
    `숙련도: **${result.mastery.label} Lv.${result.mastery.level}** ${result.mastery.progressBar}`,
    `제작 축복: **${result.blessingBefore}% → ${result.blessingAfter}%**`,
    `현재 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgMarketplace(result, { viewerId = null, mode = 'view' } = {}) {
  const allListings = result.marketListings ?? [];
  const listings = mode === 'buy'
    ? allListings.filter((listing) => listing.sellerId !== viewerId)
    : mode === 'cancel'
      ? allListings.filter((listing) => listing.sellerId === viewerId)
      : allListings;
  const rows = listings.slice(0, 10).map((listing, index) => {
    const ownerText = listing.sellerId === viewerId ? ' · 🧾 내 판매' : '';
    const kindText = listing.kind === 'item' ? ` × ${listing.quantity}` : ' · 장비';
    return `**${index + 1}.** **${listing.label}**${kindText} · ${listing.price.toLocaleString()}골드 · 판매자 ${listing.sellerUsername}${ownerText}`;
  });
  const actionGuide = {
    buy: '구매: 아래 **구매 선택 메뉴**에서 고르면 바로 구매합니다.',
    cancel: '취소: 아래 **내 판매 취소 메뉴**에서 고르면 바로 회수합니다.',
    search: '검색 결과에서 바로 구매/취소할 수 있습니다.',
    view: '구매/취소: 아래 선택 메뉴를 쓰면 매물 코드를 복사할 필요가 없습니다.'
  }[mode] ?? '구매/취소: 아래 선택 메뉴를 쓰면 매물 코드를 복사할 필요가 없습니다.';

  return [
    `🏦 **RPG 거래소${result.query ? ` 검색: ${result.query}` : ''}**`,
    rows.length > 0 ? rows.join('\n') : formatRpgMarketplaceEmptyText(mode),
    '',
    actionGuide,
    '검색: `/rpg 거래소 작업:검색 품목:용비늘`',
    '판매: `/rpg 거래소 작업:판매 품목:철괴 가격:100 수량:1`',
    '직접 입력: `/rpg 거래소 작업:구매 품목:1`처럼 목록 순번/이름도 가능합니다.'
  ].join('\n');
}

function formatRpgMarketplaceEmptyText(mode) {
  if (mode === 'buy') return '구매 가능한 매물이 없습니다.';
  if (mode === 'cancel') return '취소할 내 판매 매물이 없습니다.';
  return '등록된 매물이 없습니다.';
}

function formatRpgMarketListingCreated(result) {
  const { listing } = result;
  return [
    '🏦 **거래소 등록 완료**',
    `품목: **${listing.label}**${listing.kind === 'item' ? ` × ${listing.quantity}` : ''}`,
    `가격: **${listing.price.toLocaleString()}골드**`,
    '취소하려면 아래 **내 판매 취소** 선택 메뉴를 사용하세요.'
  ].join('\n');
}

function formatRpgMarketPurchase(result) {
  const { listing } = result;
  return [
    '🏦 **거래소 구매 완료**',
    `품목: **${listing.label}**${listing.kind === 'item' ? ` × ${listing.quantity}` : ''}`,
    `가격: **${listing.price.toLocaleString()}골드**`,
    `현재 골드: **${getRpgGold(result.buyer).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgMarketCancel(result) {
  const { listing } = result;
  return [
    '🏦 **거래소 등록 취소**',
    `품목: **${listing.label}**${listing.kind === 'item' ? ` × ${listing.quantity}` : ''}`,
    '아이템이 인벤토리로 반환되었습니다.'
  ].join('\n');
}

function resolveRpgMarketplaceListingId(listings = [], input, { userId, mode = 'buy' } = {}) {
  const query = String(input ?? '').trim();
  if (!query) {
    throw new Error(mode === 'cancel' ? '취소할 내 판매 매물을 선택하세요.' : '구매할 매물을 선택하세요.');
  }

  const normalizedQuery = query.toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
  const entries = listings
    .filter((listing) => mode === 'cancel'
      ? listing.sellerId === userId
      : listing.sellerId !== userId)
    .map((listing, index) => ({ listing, displayIndex: index + 1 }));
  const byId = entries.find(({ listing }) => String(listing.id) === query);
  if (byId) return byId.listing.id;

  const numericIndex = Number.parseInt(query, 10);
  if (Number.isInteger(numericIndex) && String(numericIndex) === query) {
    const byNumber = entries.find((entry) => entry.displayIndex === numericIndex);
    if (byNumber) return byNumber.listing.id;
  }

  const matches = entries.filter(({ listing }) => {
    const haystack = [
      listing.label,
      listing.itemId,
      listing.gear?.baseItemId
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('ko-KR')
      .replace(/\s+/g, '');
    return haystack.includes(normalizedQuery);
  });

  if (matches.length === 1) return matches[0].listing.id;
  if (matches.length > 1) {
    throw new Error('같은 이름의 매물이 여러 개입니다. 거래소 목록의 순번을 입력하거나 선택 메뉴를 사용하세요.');
  }

  throw new Error(mode === 'cancel' ? '취소 가능한 내 판매 매물을 찾을 수 없습니다.' : '구매 가능한 매물을 찾을 수 없습니다.');
}

function formatRpgInventory(status) {
  const { profile, derivedStats } = status;
  const equippedRows = ['weapon', 'armor', 'accessory']
    .map((slot) => {
      const gearId = profile.rpg.equippedGear?.[slot];
      const gear = gearId ? profile.rpg.gearInventory[gearId] : null;
      const itemId = profile.rpg.equipment?.[slot];
      const item = itemId ? getRpgItemConfig(itemId) : null;
      const label = gear ? formatGearLabel(gear) : item?.label;
      const stats = gear ? formatGearStats(gear.stats) : formatGearStats(item?.stats);
      return `- ${formatEquipmentSlot(slot)}: **${label ?? '없음'}**${stats ? ` · ${stats}` : ''}`;
    });
  const gearRows = getSortedRpgGears(status)
    .slice(0, 5)
    .map((gear, index) => {
      const equipped = Object.values(profile.rpg.equippedGear).includes(gear.id) ? ' ✅착용중' : '';
      const stats = formatGearStats(gear.stats);
      return `${index + 1}. **${formatGearLabel(gear)}** · ${formatEquipmentSlot(gear.slot)} · 전투력 ${gear.power ?? 1}${stats ? ` · ${stats}` : ''}${equipped}`;
    });
  const inventoryEntries = Object.entries(profile.rpg.inventory)
    .filter(([, count]) => count > 0);
  const inventoryRows = inventoryEntries
    .slice(0, 8)
    .map(([itemId, count]) => {
      const item = getRpgItemConfig(itemId);
      const typeLabel = item.type === 'consumable' ? '소모품' : item.type === 'material' ? '재료' : '기본 장비';
      return `- ${typeLabel} **${item.label}** × ${count.toLocaleString()}`;
    });
  const hiddenItemCount = Math.max(0, inventoryEntries.length - inventoryRows.length);

  return [
    `🎒 **RPG 인벤토리**`,
    `HP: **${profile.rpg.hp.toLocaleString()} / ${derivedStats.maxHp.toLocaleString()}**`,
    `MP: **${profile.rpg.mp.toLocaleString()} / ${derivedStats.maxMp.toLocaleString()}**`,
    `궁극기 게이지: ${formatRpgMeter(profile.rpg.ultimateCharge, 100)} **${profile.rpg.ultimateCharge}/100**`,
    `공격력: **${derivedStats.attack}** / 방어력: **${derivedStats.defense}**`,
    `착용 중인 장비\n${equippedRows.join('\n')}`,
    `보유 장비\n${gearRows.length > 0 ? gearRows.join('\n') : '- 보유 장비 없음. `/rpg 던전`에서 장비를 얻어보세요.'}`,
    `아이템\n${inventoryRows.length > 0 ? inventoryRows.join('\n') : '- 비어 있음'}${hiddenItemCount > 0 ? `\n- 외 ${hiddenItemCount.toLocaleString()}종` : ''}`,
    '',
    '아래 선택 메뉴로 바로 장착하고, 추천 장착/장비 목록/강화/분해 버튼으로 관리하세요.'
  ].join('\n');
}

function formatRpgEquipmentGuide(status) {
  const { profile, derivedStats } = status;
  const ownedEquipment = getOwnedRpgEquipmentItems(status);
  const equippedRows = Object.entries(profile.rpg.equipment)
    .map(([slot, itemId]) => `- ${formatEquipmentSlot(slot)}: **${itemId ? getRpgItemConfig(itemId).label : '없음'}**`);
  const ownedRows = ownedEquipment
    .map(({ item, count }) => `- **${item.label}** × ${count.toLocaleString()} / ${formatEquipmentSlot(item.slot)} ${formatItemStats(item.stats)}`);
  const ownedText = ownedRows.length > 0
    ? ownedRows.join('\n')
    : '- 장착 가능한 보유 장비가 없습니다. /rpg 상점에서 장비를 구매하세요.';

  return [
    '🛡️ **RPG 장비 장착**',
    `현재 스탯: 공격력 **${derivedStats.attack}** / 방어력 **${derivedStats.defense}** / 최대 HP **${derivedStats.maxHp}** / 최대 MP **${derivedStats.maxMp}**`,
    `현재 장비:\n${equippedRows.join('\n')}`,
    `보유 장비:\n${ownedText}`,
    '',
    ownedRows.length > 0
      ? '아래 선택 메뉴로 바로 장착할 수 있습니다.'
      : '장비를 구매한 뒤 `/rpg 장비`를 다시 실행하면 선택 메뉴가 표시됩니다.'
  ].join('\n');
}

function formatRpgUseItem(result) {
  return [
    `🧪 **아이템 사용**`,
    `아이템: **${result.item.label}**`,
    `회복량: **${result.healed.toLocaleString()} HP / ${result.mpHealed.toLocaleString()} MP**`,
    `현재 HP/MP: **${result.profile.rpg.hp.toLocaleString()} / ${result.maxHp.toLocaleString()} HP**, **${result.profile.rpg.mp.toLocaleString()} / ${result.maxMp.toLocaleString()} MP**`
  ].join('\n');
}

function formatRpgSellItem(result) {
  return [
    `💰 **RPG 아이템 판매**`,
    `아이템: **${result.item.label}** × ${result.quantity.toLocaleString()}`,
    `판매가: **${result.unitPrice.toLocaleString()}골드 × ${result.quantity.toLocaleString()} = ${result.totalPrice.toLocaleString()}골드**`,
    result.item.type === 'equipment'
      ? `현재 스탯: 공격력 **${result.derivedStats.attack}** / 방어력 **${result.derivedStats.defense}** / 최대 HP **${result.derivedStats.maxHp}** / 최대 MP **${result.derivedStats.maxMp}**`
      : null,
    `현재 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`
  ].filter(Boolean).join('\n');
}

function formatRpgEquipItem(result) {
  return [
    `🛡️ **장비 장착**`,
    `슬롯: **${formatEquipmentSlot(result.slot)}**`,
    `아이템: **${result.item.label}**`,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
  ].join('\n');
}

function formatRpgGearInventory(status) {
  const recommendedIds = getRecommendedRpgGearIds(status);
  const gears = getSortedRpgGears(status)
    .slice(0, 10);
  const rows = gears.map((gear, index) => {
    const equipped = Object.values(status.profile.rpg.equippedGear).includes(gear.id) ? ' ✅장착중' : '';
    const recommended = recommendedIds.has(gear.id) ? ' ⭐추천' : '';
    const statsText = formatGearStats(gear.stats);
    const comparison = formatRpgGearComparison(compareRpgGearWithEquipped(status, gear));
    return `- **${index + 1}. ${formatGearLabel(gear)}** / ${formatEquipmentSlot(gear.slot)}${statsText ? ` / ${statsText}` : ''}${equipped}${recommended}${comparison ? `\n  ${comparison}` : ''}`;
  });

  return [
    '🧰 **RPG 인벤토리 장비 관리**',
    rows.length > 0 ? rows.join('\n') : '- 보유한 인벤토리 장비가 없습니다. `/rpg 던전` 또는 `/rpg 레이드`로 획득하세요.',
    '',
    rows.length > 0
      ? '⭐추천 장비는 현재 착용 장비보다 점수가 높은 장비입니다. 추천 장착 버튼으로 슬롯별 최고 장비를 한 번에 착용할 수 있습니다.'
      : '장비를 얻으면 여기서 선택 메뉴로 바로 장착할 수 있습니다.'
  ].join('\n');
}

function formatRpgEquipGear(result) {
  return [
    `🧰 **장비 장착**`,
    `슬롯: **${formatEquipmentSlot(result.slot)}**`,
    `장비: **${formatGearLabel(result.gear)}**`,
    `옵션: ${formatGearStats(result.gear.stats)}`,
    result.comparison ? `비교: ${formatRpgGearComparison(result.comparison)}` : null,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
  ].filter(Boolean).join('\n');
}

function formatRpgRecommendedGear(result) {
  const rows = result.equipped.length > 0
    ? result.equipped.map((entry) => `- ${formatEquipmentSlot(entry.slot)}: **${formatGearLabel(entry.gear)}** ${formatRpgGearComparison(entry.comparison)}`)
    : ['- 이미 슬롯별 추천 장비를 착용 중입니다.'];

  return [
    '⭐ **추천 장비 장착**',
    rows.join('\n'),
    `현재 스탯: 공격력 **${result.derivedStats.attack}** / 방어력 **${result.derivedStats.defense}** / 최대 HP **${result.derivedStats.maxHp}** / 최대 MP **${result.derivedStats.maxMp}**`
  ].join('\n');
}

function formatRpgGearEnhanceGuide(status) {
  const gears = getSortedRpgGears(status)
    .slice(0, 10);
  const rows = gears.map((gear, index) => {
    const equipped = Object.values(status.profile.rpg.equippedGear).includes(gear.id) ? ' ✅장착중' : '';
    return [
      `- **${index + 1}. ${formatGearLabel(gear)} +${gear.enhanceLevel ?? 0}**`,
      `${formatEquipmentSlot(gear.slot)} / ${formatGearStats(gear.stats) || '옵션 없음'}`,
      `강화비 ${getRpgGearEnhanceCost(gear).toLocaleString()}골드${equipped}`
    ].join(' — ');
  });

  return [
    '🛠️ **RPG 장비 강화**',
    `보유 골드: **${getRpgGold(status.profile).toLocaleString()}골드**`,
    `강화석: **${status.profile.rpg.inventory.enhancement_stone ?? 0}개** — 보유 시 강화비 20% 감소, 성공률 +8%`,
    rows.length > 0 ? rows.join('\n') : '- 강화할 인벤토리 장비가 없습니다. `/rpg 던전` 또는 `/rpg 레이드`로 획득하세요.',
    '',
    rows.length > 0
      ? '아래 선택 메뉴를 쓰거나 `/rpg 인벤토리 보기:강화`의 `장비` 옵션에 번호를 넣어 강화할 수 있습니다.'
      : '장비를 얻으면 여기서 선택 메뉴로 강화할 수 있습니다.'
  ].join('\n');
}

function formatRpgGearEnhance(result) {
  const outcome = result.success ? '성공' : '실패';
  const beforeStats = formatGearStats(result.beforeGear.stats) || '옵션 없음';
  const afterStats = formatGearStats(result.gear.stats) || '옵션 없음';
  const materialText = result.materialUsed
    ? ' / 강화석 1개 사용'
    : '';

  return [
    `🛠️ **RPG 장비 강화 ${outcome}**`,
    `장비: **${formatGearLabel(result.gear)} +${result.gear.enhanceLevel ?? 0}**`,
    `비용: **${result.cost.toLocaleString()}골드**${result.baseCost && result.baseCost !== result.cost ? ` (기본 ${result.baseCost.toLocaleString()}골드)` : ''}${materialText} / 판정: ${result.roll} ≤ ${result.successRate}`,
    `옵션: ${beforeStats} → **${afterStats}**`,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`,
    `남은 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgGearDisassembleGuide(status) {
  const gears = getSortedRpgGears(status)
    .slice(0, 10);
  const rows = gears.map((gear, index) => {
    const equipped = Object.values(status.profile.rpg.equippedGear).includes(gear.id) ? ' ✅장착중' : '';
    const rewards = getRpgGearDisassemblePreview(gear);
    return [
      `- **${index + 1}. ${formatGearLabel(gear)} +${gear.enhanceLevel ?? 0}**${equipped}`,
      `${formatEquipmentSlot(gear.slot)} / ${formatGearStats(gear.stats) || '옵션 없음'}`,
      `분해 보상 강화석 ${rewards.enhancementStones}개, ${rewards.coins.toLocaleString()}골드`
    ].join(' — ');
  });

  return [
    '♻️ **RPG 장비 분해**',
    `강화석: **${status.profile.rpg.inventory.enhancement_stone ?? 0}개**`,
    rows.length > 0 ? rows.join('\n') : '- 분해할 인벤토리 장비가 없습니다.',
    '',
    rows.length > 0
      ? '장착 중인 장비는 실수 방지를 위해 분해 선택지에서 제외합니다.'
      : '던전/레이드에서 장비를 얻은 뒤 다시 열어보세요.'
  ].join('\n');
}

function formatRpgDisassembleGear(result) {
  return [
    '♻️ **RPG 장비 분해 완료**',
    `분해 장비: **${formatGearLabel(result.gear)} +${result.gear.enhanceLevel ?? 0}**`,
    `획득: **강화석 ${result.rewards.enhancementStones}개**, **${result.rewards.coins.toLocaleString()}골드**`,
    `보유 강화석: **${result.profile.rpg.inventory.enhancement_stone ?? 0}개**`,
    `현재 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`
  ].join('\n');
}

function formatRpgQuests(status) {
  const rows = status.quests.map((quest) => {
    const state = quest.claimed ? '✅ 완료' : quest.canClaim ? '🎁 보상 가능' : '진행 중';
    const rewardText = formatRpgRewardSummary(quest.rewards);
    return `- **${quest.label}** — ${state} · 진행도 ${formatRpgProgress(quest.current, quest.required)}\n  보상 ${rewardText}`;
  });

  return [
    '📜 **RPG 퀘스트 보드**',
    rows.join('\n'),
    '',
    '보상 가능한 퀘스트는 선택 메뉴로 바로 받을 수 있습니다. 명령어로 받을 때도 한글 이름을 선택하세요.'
  ].join('\n');
}

function formatRpgRest(result) {
  return [
    `🛏️ **휴식 완료**`,
    `HP 회복: **${result.healed.toLocaleString()}** / MP 회복: **${result.mpRestored.toLocaleString()}**`,
    `현재 HP/MP: **${result.profile.rpg.hp.toLocaleString()} / ${result.derivedStats.maxHp.toLocaleString()} HP**, **${result.profile.rpg.mp.toLocaleString()} / ${result.derivedStats.maxMp.toLocaleString()} MP**`,
    formatRpgNextAction(result.profile, result)
  ].join('\n');
}

function formatRpgExplore(user, result) {
  const rewardRows = [
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 획득 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    result.leveledUp ? `🎉 레벨업 Lv.${result.profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🧭 **RPG 탐험 결과** — ${formatDiscordUserMention(user)}`,
    `📍 지역: **${result.exploration.areaLabel}** · 이벤트 **${result.exploration.eventLabel}**`,
    `📝 ${result.exploration.description}`,
    `🎁 보상: +${result.xpGained.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)}`,
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    `💫 변화: HP ${result.beforeHp.toLocaleString()} → **${result.profile.rpg.hp.toLocaleString()}** · MP ${result.beforeMp.toLocaleString()} → **${result.profile.rpg.mp.toLocaleString()}**`,
    formatRpgPostActionState(result.profile),
    `📊 누적 탐험: **${result.profile.rpg.explores.toLocaleString()}회**`,
    formatRpgNextAction(result.profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgDungeon(user, result) {
  if (result.type === 'dungeon_run') return formatRpgDungeonRun(user, result);
  if (result.type === 'dungeon_result') return formatRpgDungeonSettlement(user, result);

  const rows = result.floors.map((floor) =>
    `${floor.floor}층 ${floor.eventLabel}: +${floor.rewards.xp} XP, +${floor.rewards.coins}골드${floor.damageTaken ? `, 피해 ${floor.damageTaken}` : ''}`
  );
  const rewardRows = [
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 클리어 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    result.leveledUp ? `🎉 레벨업 Lv.${result.profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🏰 **RPG 던전 결과** — ${formatDiscordUserMention(user)}`,
    `📍 던전: **${result.dungeonConfig?.label ?? result.areaConfig.label}** · 지역 **${result.areaConfig.label}** · 깊이 **${result.depth}층**`,
    result.dungeonConfig?.hidden ? '🗝️ 히든 던전 탐사를 완료했습니다.' : null,
    rows.join('\n'),
    `🎁 합계: +${result.totalXp.toLocaleString()} XP, +${formatRpgGoldReward(result.totalCoins, result.requestedTotalCoins)} · 피해 **${result.totalDamage.toLocaleString()}**`,
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    formatRpgPostActionState(result.profile),
    `📊 던전 클리어: **${result.profile.rpg.dungeonClears[result.area].toLocaleString()}회**`,
    formatRpgNextAction(result.profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgDungeonRun(user, result) {
  const { run } = result;
  const choiceRows = run.state === 'awaiting_relic'
    ? run.pendingRelicChoices.map((relic, index) => `${index + 1}. 🧿 **${relic.label}** — ${relic.upside} / 대가: ${relic.downside}`)
    : run.currentChoices.map((choice, index) => `${index + 1}. ${choice.risk === 'high' ? '☠️ ' : ''}**${choice.label}** — ${choice.description}`);
  const relicRows = run.relics.length > 0
    ? run.relics.slice(-3).map((relic) => `- ${relic.label}: ${relic.upside} / ${relic.downside}`)
    : ['- 없음'];
  const resultLine = result.roomResult
    ? `최근: ${result.roomResult.description} (${result.roomResult.damageTaken ? `피해 ${result.roomResult.damageTaken}` : '피해 없음'})`
    : result.relic
      ? `최근: 유물 **${result.relic.label}** 획득`
      : null;
  const rewardPreview = formatRpgDungeonRewardPreview(run, result);
  return [
    `${run.state === 'awaiting_relic' ? '🧿 **유물 선택**' : '🏰 **던전 진행**'} — ${formatDiscordUserMention(user)}`,
    `📍 **${run.state === 'awaiting_relic' ? '유물 선택' : '던전 진행'}** · **${result.dungeonConfig?.label ?? result.areaConfig.label}** · ${result.areaConfig.label} · ${run.floor}/${run.maxFloors}방`,
    `❤️ HP **${run.hp}/${run.maxHp}** · 🔷 MP **${run.mp}/${run.maxMp}** · 보상풀 +${run.rewardPool.xp}XP/+${run.rewardPool.coins}G`,
    rewardPreview,
    resultLine,
    `🧿 유물\n${relicRows.join('\n')}`,
    run.state === 'awaiting_relic' ? `선택할 유물\n${choiceRows.join('\n')}` : `다음 방\n${choiceRows.join('\n')}`,
    run.currentChoices.some((choice) => choice.risk === 'high') ? '☠️ 표시는 선택형 고위험 방입니다.' : null
  ].filter(Boolean).join('\n');
}

function formatRpgDungeonRewardPreview(run, result) {
  const rewardMultiplier = result.dungeonConfig?.rewardMultiplier ?? (result.dungeonConfig?.hidden ? 1.2 : 1);
  const clearXp = Math.floor((run.rewardPool?.xp ?? 0) * rewardMultiplier);
  const clearCoins = Math.floor((run.rewardPool?.coins ?? 0) * rewardMultiplier);
  const abandonXp = Math.floor((run.rewardPool?.xp ?? 0) * 0.25);
  const abandonCoins = Math.floor((run.rewardPool?.coins ?? 0) * 0.25);
  const failureScale = run.highRiskTaken ? 0.2 : 0.35;
  const failXp = Math.floor((run.rewardPool?.xp ?? 0) * failureScale);
  const failCoins = Math.floor((run.rewardPool?.coins ?? 0) * failureScale);
  return `🎁 보상 미리보기: 포기 +${abandonXp}XP/+${abandonCoins}G · 실패 +${failXp}XP/+${failCoins}G · 클리어 최대 +${clearXp}XP/+${clearCoins}G`;
}

function formatRpgDungeonSettlement(user, result) {
  const outcomeLabels = { cleared: '클리어', failed: '실패', abandoned: '포기' };
  const rewardRows = [
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 획득 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    result.leveledUp ? `🎉 레벨업 Lv.${result.profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);
  return [
    `🏁 **RPG 던전 ${outcomeLabels[result.outcome] ?? '결과'}** — ${formatDiscordUserMention(user)}`,
    `📍 **${result.dungeonConfig?.label ?? result.areaConfig.label}** · ${result.areaConfig.label} · ${result.run.maxFloors}방`,
    result.roomResult?.description ? `마지막: ${result.roomResult.description}` : null,
    `🎁 정산: +${result.totalXp.toLocaleString()} XP, +${formatRpgGoldReward(result.totalCoins, result.requestedTotalCoins)}`,
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    `❤️ HP **${result.profile.rpg.hp.toLocaleString()}** · 🔷 MP **${result.profile.rpg.mp.toLocaleString()}**`,
    result.outcome === 'cleared' ? `📊 던전 클리어: **${result.profile.rpg.dungeonClears[result.area].toLocaleString()}회**` : '실패/포기는 돈이나 장비를 잃지 않습니다.',
    formatRpgNextAction(result.profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgGacha(result) {
  const rows = result.pulls.map((pull, index) => {
    const rewardText = formatGachaReward(pull);
    return `${index + 1}. **${formatGachaRarity(pull.rarity)}** — ${rewardText}`;
  });

  return [
    `✨ **${result.banner.label} 결과** × ${result.count}`,
    `사용 금액: **${result.totalCost.toLocaleString()}골드** / 남은 골드: **${getRpgGold(result.profile).toLocaleString()}골드**`,
    ...rows,
    `총 가챠: **${result.profile.rpg.gacha.totalPulls.toLocaleString()}회** / 천장 카운트: **${result.profile.rpg.gacha.pity.toLocaleString()}**`
  ].join('\n');
}

function formatGachaReward(pull) {
  const reward = pull.reward;

  if (reward.type === 'class') {
    const classLabel = getRpgClassConfig(reward.classId).label;
    const suffix = pull.newUnlock
      ? ' 해금!'
      : ` 중복 보상 +${pull.duplicateCompensation?.toLocaleString() ?? 0}골드`;
    return `직업 **${classLabel}**${suffix}`;
  }

  return `${getRpgItemConfig(reward.itemId).label} × ${reward.quantity ?? 1}`;
}

function formatRpgSkillTree(status) {
  const rows = status.skillTree.map((skill) => {
    const state = skill.learned
      ? '✅ 습득 완료'
      : skill.canLearn
        ? '✨ 학습 가능'
        : skill.classAllowed
          ? `스킬 포인트 ${skill.cost}점 필요`
          : '현재 직업으로 학습 불가';
    return `- **${skill.label}** — ${state} · 비용 ${skill.cost}SP\n  효과: ${skill.description}`;
  });

  return [
    `🌟 **RPG 스킬 보드**`,
    `스킬 포인트: **${status.skillPoints.available}점 사용 가능** · 총 ${status.skillPoints.earned}점 · 사용 ${status.skillPoints.spent}점`,
    rows.join('\n'),
    '',
    '학습 가능한 스킬은 선택 메뉴로 바로 배울 수 있습니다. 명령어를 쓸 때도 한글 스킬 이름을 선택하세요.'
  ].join('\n');
}

function formatRpgLearnSkill(result) {
  return [
    `🌟 **스킬트리 학습**`,
    `습득: **${result.skill.label}** — ${result.skill.description}`,
    `남은 스킬 포인트: **${result.skillPoints.available}점**`,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
  ].join('\n');
}

function formatRpgClassPath(status) {
  const { profile, classConfig, advancedClassConfig, derivedStats } = status;
  const rows = status.classPaths.map((advanced) => {
    const state = advanced.current
      ? '✅ 현재 전직'
      : !advanced.classAllowed
        ? `${advanced.baseClassLabel} 계열 전용`
        : advanced.canAdvance
          ? '✨ 전직 가능'
          : [
              advanced.levelReady ? null : `Lv.${advanced.unlockLevel}`,
              advanced.masteryReady ? null : `숙련 Lv.${advanced.requiredMasteryLevel}`,
              advanced.questReady ? null : `${advanced.questLabel} ${advanced.questCurrent}/${advanced.questRequired}`
            ].filter(Boolean).join(' 필요, ');

    return `- **${advanced.label}** — ${advanced.baseClassLabel} Lv.${advanced.unlockLevel}+ / 숙련 Lv.${advanced.requiredMasteryLevel}+ / 전직퀘 ${advanced.questLabel} (${advanced.questCurrent}/${advanced.questRequired}) / ${state}`;
  });
  const currentAdvanced = advancedClassConfig
    ? ` → **${advancedClassConfig.label}**`
    : '';

  return [
    '🧬 **RPG 전직 트리**',
    `현재 계열: **${classConfig.label}**${currentAdvanced}`,
    `직업 숙련: **Lv.${status.classMastery.level}** ${status.classMastery.progressBar} ${status.classMastery.progress}/${status.classMastery.required}`,
    `현재 레벨: **Lv.${profile.rpg.level}** / 스탯 공격력 **${derivedStats.attack}** · 방어력 **${derivedStats.defense}** · HP **${derivedStats.maxHp}** · MP **${derivedStats.maxMp}**`,
    rows.join('\n'),
    '',
    '전직 가능한 항목은 아래 선택 메뉴로 바로 진행할 수 있습니다.'
  ].join('\n');
}

function formatRpgAdvanceClass(result) {
  if (result.classConfig && !result.advancedClassConfig) {
    return [
      '🛡️ **1차 전직 완료**',
      `직업: **${result.classConfig.label}**`,
      result.classConfig.description,
      `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
    ].join('\n');
  }

  return [
    `🛡️ **전직 완료**`,
    `전직: **${result.advancedClassConfig.label}**`,
    result.advancedClassConfig.description,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
  ].join('\n');
}

function formatRpgDualJob(result) {
  return [
    '🧩 **듀얼 직업 등록 완료**',
    `보조 직업: **${result.classConfig.label}**`,
    result.classConfig.description,
    '전투 전 `/rpg 직업변경`으로 주/보조 직업을 전환할 수 있습니다.'
  ].join('\n');
}

function formatRpgJobChange(result) {
  return [
    '🔁 **직업 변경 완료**',
    `활성 직업: **${result.classConfig.label}** (${result.jobSlot === 'secondary' ? '보조' : '주'} 슬롯)`,
    `공격력 **${result.derivedStats.attack}** · 방어력 **${result.derivedStats.defense}** · HP **${result.derivedStats.maxHp}** · MP **${result.derivedStats.maxMp}**`
  ].join('\n');
}

function formatRpgAreaEnter(result) {
  const { areaConfig, profile, unlockedAreas } = result;
  const nextLocked = getRpgAreaOptions()
    .map((option) => ({
      id: option.value,
      ...getRpgAreaConfig(option.value)
    }))
    .find((area) => !unlockedAreas.some((unlocked) => unlocked.id === area.id));
  const nextText = nextLocked
    ? `다음 지역 해금: **${nextLocked.label}** Lv.${nextLocked.unlockLevel}+`
    : '모든 지역을 해금했습니다.';

  return [
    '🗺️ **지역 이동 완료**',
    `현재 지역: **${areaConfig.label}**`,
    areaConfig.description,
    `보상 배율: XP ×${areaConfig.xpMultiplier} / 골드 ×${areaConfig.coinMultiplier}`,
    `현재 레벨: **Lv.${profile.rpg.level}**`,
    nextText,
    '',
    '이제 지역 옵션을 비우고 `/rpg 탐사`, `/rpg 사냥`, `/rpg 던전`을 실행하면 현재 지역에서 진행됩니다.'
  ].join('\n');
}

function formatRpgStory(status) {
  const rows = status.storyChapters.map((chapter) => {
    const state = chapter.completed ? '✅ 완료' : chapter.canProgress ? '✨ 진행 가능' : '🔒 조건 미달';
    return `- **${chapter.label}** — ${state} · 진행도 ${formatRpgProgress(chapter.current, chapter.required)}\n  ${chapter.description}`;
  });

  return [
    '📖 **RPG 메인 퀘스트**',
    rows.join('\n'),
    '',
    '진행 가능한 메인 퀘스트는 선택 메뉴로 바로 완료할 수 있습니다.'
  ].join('\n');
}

function formatRpgStoryProgress(result) {
  const itemRewards = Object.entries(result.rewards.items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${result.profile.rpg.level}` : '';

  return [
    `📖 **메인 퀘스트 완료**`,
    `퀘스트: **${result.chapter.label}**`,
    result.chapter.description,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.rpg.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatRpgCodex(status) {
  const rows = status.codex
    .filter((entry) => entry.discovered > 0)
    .slice(0, 12)
    .map((entry) => {
      const state = entry.claimed ? '보상 완료' : entry.canClaim ? '보상 가능' : '발견';
      return `- **${entry.monster}** — 발견 ${entry.discovered}회 / 처치 ${entry.kills}회 / ${state}`;
    });

  return [
    `📚 **몬스터 도감**`,
    rows.length > 0 ? rows.join('\n') : '- 아직 발견한 몬스터가 없습니다.',
    '',
    '보상: `/rpg 도감 몬스터:<이름>`'
  ].join('\n');
}

function formatRpgCodexClaim(result) {
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${result.profile.rpg.level}` : '';

  return [
    `📚 **도감 보상 수령**`,
    `몬스터: **${result.codex.monster}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드`,
    `현재 경험치: **${result.profile.rpg.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatRpgRaid(user, result) {
  const { battle, profile } = result;
  const outcomeText = battle.win ? '승리' : '패배';
  const statusEffectText = formatRpgStatusEffect(battle.statusEffect);
  const ultimateChargeText = result.ultimateCharge
    ? `🌟 궁극기 게이지 ${formatRpgMeter(result.ultimateCharge.after, result.ultimateCharge.max)} **${result.ultimateCharge.after}/${result.ultimateCharge.max}**`
    : '';
  const rewardRows = [
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 레이드 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐉 **RPG 레이드 결과** — ${formatDiscordUserMention(user)}`,
    `📍 레이드: **${battle.raidLabel}** · 지역 **${battle.areaLabel}**`,
    `🧙 스킬: **${battle.skillLabel}** (MP -${battle.skillMpCost})`,
    `🎲 전투 판정: 파티 **${battle.playerPower}** (주사위 ${battle.playerRoll}, 지원 ${battle.allyPower}, 보너스 +${battle.attackBonus}) vs 레이드 **${battle.monsterPower} → ${battle.mitigatedMonsterPower}**`,
    statusEffectText ? `🌀 상태효과: ${statusEffectText}` : null,
    `🏁 결과: **${outcomeText}** · 피해 **-${battle.damageTaken.toLocaleString()} HP**`,
    battle.win
      ? `🎁 보상: +${result.xpGained.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)}`
      : '보상: 없음',
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    formatRpgPostActionState(profile),
    formatRpgNextAction(profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgRaidLobby(lobby) {
  const memberRows = lobby.members.map((member, index) =>
    `${index + 1}. ${member.mention} · Lv.${member.level} ${member.classLabel} · 전투력 ${member.powerScore} · HP ${member.hp}/${member.maxHp}`
  );
  const slotsText = `${lobby.members.length}/${lobby.maxMembers}`;
  const expiresIn = Math.max(0, lobby.expiresAt - Date.now());

  return [
    `🐉 **RPG 길드 레이드 모집**`,
    `레이드: **${lobby.raid.label}** · 지역 **${getRpgAreaConfig(lobby.raid.area).label}** · 참가 조건 Lv.${lobby.raid.unlockLevel}+`,
    `파티장: ${lobby.members[0]?.mention ?? `<@${lobby.leaderUserId}>`} · 스킬 **${lobby.skill.label}**`,
    `파티 슬롯: **${slotsText}** · 남은 시간 **${formatDuration(expiresIn)}**`,
    '',
    memberRows.join('\n'),
    '',
    '참가자는 `참가` 버튼을 누르고, 파티장이 `출발`을 누르면 참가자 기준으로 길드 레이드 보상이 정산됩니다.'
  ].join('\n');
}

function formatRpgGuildRaid(user, result) {
  const { battle, profile } = result;
  const outcomeText = battle.win ? '승리' : '패배';
  const partyText = battle.partyMembers
    .map((member) => `${member.username}(Lv.${member.level} ${member.characterClassLabel})`)
    .join(', ');
  const supportText = result.supportRewards.length > 0
    ? result.supportRewards
      .map((reward) => `${reward.username} +${reward.xpGained.toLocaleString()} XP/+${formatRpgGoldReward(reward.coinReward, reward.requestedCoinReward)}`)
      .join(', ')
    : '지원 보상 없음';
  const ultimateText = battle.ultimate ? ' 🌟궁극기' : '';
  const statusEffectText = formatRpgStatusEffect(battle.statusEffect);
  const ultimateChargeText = result.ultimateCharge
    ? `🌟 궁극기 게이지 ${formatRpgMeter(result.ultimateCharge.after, result.ultimateCharge.max)} **${result.ultimateCharge.after}/${result.ultimateCharge.max}**`
    : '';
  const rewardRows = [
    formatRpgMaterialDrops(result.materialDrops),
    result.gearDrop ? `🧰 길드 레이드 장비 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.rpg.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐉 **RPG 길드 레이드 결과** — ${formatDiscordUserMention(user)}`,
    `📍 레이드: **${battle.raidLabel}** · 지역 **${battle.areaLabel}** · 파티 **${battle.partySize}명**`,
    `🧙 스킬: **${battle.skillLabel}**${ultimateText} (MP -${battle.skillMpCost})`,
    `👥 참가자: ${partyText}`,
    `🎲 전투 판정: 파티 **${battle.playerPower}** (주사위 ${battle.playerRoll}, 지원 ${battle.supportPower}, 보너스 +${battle.attackBonus}) vs 레이드 **${battle.monsterPower} → ${battle.mitigatedMonsterPower}**`,
    statusEffectText ? `🌀 상태효과: ${statusEffectText}` : null,
    `🏁 결과: **${outcomeText}** · 피해 **-${battle.damageTaken.toLocaleString()} HP**`,
    battle.win
      ? `🎁 지휘 보상: +${result.xpGained.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)} / 지원 보상: ${supportText}`
      : '보상: 없음',
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    formatRpgPostActionState(profile),
    formatRpgNextAction(profile, result)
  ].filter(Boolean).join('\n');
}

async function awardRpgBattleSeasonPoints(services, { guildId, user, result }) {
  if (!result?.battled || !result.battle?.win || !services?.seasons?.awardPoints) {
    return null;
  }

  return services.seasons.awardPoints({
    guildId,
    userId: user.id,
    username: user.username,
    source: SEASON_POINT_SOURCES.RPG_BATTLE_WIN,
    points: 25
  });
}

async function awardRpgDungeonSeasonPoints(services, { guildId, user, result }) {
  if (result?.type !== 'dungeon_result' || result.outcome !== 'cleared' || !services?.seasons?.awardPoints) {
    return null;
  }

  return services.seasons.awardPoints({
    guildId,
    userId: user.id,
    username: user.username,
    source: SEASON_POINT_SOURCES.RPG_DUNGEON_CLEAR,
    points: 30
  });
}

function appendSeasonAwardLine(content, award) {
  const line = formatSeasonAwardLine(award);
  return line ? `${content}\n${line}` : content;
}

function formatRpgQuestClaim(result) {
  const itemRewards = Object.entries(result.rewards.items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.rpg.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    `✅ **퀘스트 보상 수령**`,
    `퀘스트: **${result.quest.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.rpg.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
  ].join('\n');
}

function formatRpgAreas(status) {
  const tiers = new Map();
  const recommendedArea = status.adventureGuide?.highestUnlockedArea ?? {
    id: status.profile.rpg.currentArea,
    ...status.currentArea
  };
  const nextLockedArea = status.adventureGuide?.nextLockedArea;

  for (const area of status.areaProgress) {
    const tier = formatRpgAreaTierLabel(area.unlockLevel);
    const state = area.current
      ? '📍 체류중'
      : area.unlocked
        ? area.mastered ? '✅ 마스터' : '✅ 입장 가능'
        : `🔒 Lv.${area.unlockLevel} 필요`;
    const row = `${area.current ? '📍' : area.unlocked ? '✅' : '🔒'} **${area.label}** ${state} · 진행도 ${area.progress}%`;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(row);
  }

  const tierRows = [...tiers.entries()]
    .slice(0, 3)
    .map(([tier, rows]) => `**${tier}** ${rows.slice(0, 3).join(' / ')}`);

  return [
    '🗺️ **RPG 월드맵 · 사냥터 선택**',
    `현재 **${status.currentArea.label}** · 추천 사냥터 **${recommendedArea.label}**`,
    '선택 가이드: ✅ 이동 가능 / 📍 현재 / 🔒 잠김',
    nextLockedArea
      ? `다음 해금: **${nextLockedArea.label}** Lv.${nextLockedArea.unlockLevel}+`
      : '다음 해금: 모든 지역 개방 완료',
    tierRows.join('\n'),
    '아래 선택 메뉴로 바로 이동'
  ].filter(Boolean).join('\n');
}

async function replyWithRpgAssets(interaction, content, assetIds = [], extraPayload = {}) {
  await sendRpgAssets(interaction, 'reply', content, assetIds, extraPayload);
}

async function updateWithRpgAssets(interaction, content, assetIds = [], extraPayload = {}) {
  await sendRpgAssets(interaction, 'update', content, assetIds, extraPayload);
}

async function replyWithRpgCard(interaction, content, extraPayload = {}) {
  await safeReplyToInteraction(interaction, createRpgVisualPayload(content, [], extraPayload));
}

async function updateWithRpgCard(interaction, content, extraPayload = {}) {
  await sendInteractionUpdate(interaction, createRpgVisualPayload(content, [], extraPayload));
}

async function sendRpgAssets(interaction, method, content, assetIds = [], extraPayload = {}) {
  const payload = createRpgVisualPayload(content, assetIds, extraPayload);
  if (method === 'update') {
    await sendInteractionUpdate(interaction, payload);
    return;
  }

  await safeReplyToInteraction(interaction, payload);
}

function getBattleAssetIds(result) {
  return [
    result.battle?.assets?.background,
    result.battle?.assets?.hero,
    result.battle?.assets?.monster,
    result.gearDrop?.assetId,
    result.drop?.itemId ? getRpgItemConfig(result.drop.itemId).assetId : null
  ];
}

function getExploreAssetIds(result) {
  return [
    result.exploration?.assets?.background,
    result.gearDrop?.assetId
  ];
}

function getDungeonAssetIds(result) {
  if (result.type === 'dungeon_run' || result.type === 'dungeon_result') {
    return [result.areaConfig?.backgroundAssetId, result.gearDrop?.assetId];
  }
  return [
    result.floors?.[0]?.assets?.background,
    result.gearDrop?.assetId
  ];
}

function getBossEncounterAssetIds(result) {
  return [
    result.session?.assets?.background,
    result.session?.assets?.hero,
    result.session?.assets?.monster
  ];
}

function getGachaAssetIds(result) {
  return result.pulls
    .map((pull) => pull.reward.type === 'item'
      ? getRpgItemConfig(pull.reward.itemId).assetId
      : null)
    .filter(Boolean);
}

function createRpgBossActionRow(session) {
  const buttons = session.player.availableSkillIds.map((skillId) => {
    const skill = getRpgSkillConfig(skillId);
    const costText = skill.mpCost > 0 ? ` (${skill.mpCost}MP)` : '';

    return new ButtonBuilder()
      .setCustomId(`rpg_boss_action:${session.id}:${skillId}`)
      .setLabel(`${skill.label}${costText}`)
      .setStyle(skillId === 'basic' ? ButtonStyle.Primary : ButtonStyle.Success)
      .setDisabled(session.player.mp < skill.mpCost);
  });

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`rpg_boss_action:${session.id}:guard`)
      .setLabel('방어')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rpg_boss_action:${session.id}:potion`)
      .setLabel(`포션 (${session.player.inventory.potion ?? 0})`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled((session.player.inventory.potion ?? 0) <= 0)
  );

  return new ActionRowBuilder().addComponents(...buttons.slice(0, 3));
}

function createRpgStartRows(status, userId) {
  const genderOptions = getRpgGenderOptions();
  const options = getRpgStartClassOptions()
    .map((option) => option.value)
    .flatMap((classId) => genderOptions.map((gender) => {
      const classConfig = getRpgClassConfig(classId);
      return createRpgSelectOption(
        `${gender.name} ${classConfig.label}`,
        `${classId}|${gender.value}`,
        `${classConfig.description} · 공격 ${classConfig.powerBonus >= 0 ? '+' : ''}${classConfig.powerBonus}`
      );
    }));

  return createRpgSelectRows(userId, 'start', '모험가 외형을 선택하세요', options);
}

function createRpgPostStartRows(_profile, userId) {
  return createButtonRows([
    createRpgQuickButton(userId, 'tutorial', '🎓 초보자 여정', ButtonStyle.Success),
    createRpgQuickButton(userId, 'battle', '⚔️ 첫 전투', ButtonStyle.Danger),
    createRpgQuickButton(userId, 'shop', '🏪 상점', ButtonStyle.Secondary),
    createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Primary)
  ]);
}

function createRpgTutorialRows(status, userId) {
  if (status.profile.rpg.startedAt <= 0) {
    return [
      ...createRpgStartRows(status, userId),
      ...createButtonRows([
        createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
      ])
    ].slice(0, 5);
  }

  const nextActionStep = getRpgTutorialNextActionStep(status.tutorial);
  const claimRows = createRpgTutorialClaimRows(status, userId);
  const buttonMap = new Map();
  const addButton = (action, label, style = ButtonStyle.Secondary, disabled = false) => {
    if (!action || buttonMap.has(action)) return;
    buttonMap.set(action, createRpgQuickButton(userId, action, label, style, disabled));
  };

  if (nextActionStep) {
    addButton(
      nextActionStep.action,
      `➡️ ${shortenButtonLabel(nextActionStep.actionLabel, 75)}`,
      nextActionStep.action === 'battle' ? ButtonStyle.Danger : ButtonStyle.Primary
    );
  }
  addButton('battle', '⚔️ 전투', ButtonStyle.Danger);
  addButton('shop', '🏪 상점', ButtonStyle.Secondary);
  addButton('quest', '🧾 퀘스트', ButtonStyle.Success);
  addButton('menu', '🎮 허브', ButtonStyle.Secondary);

  return [
    ...claimRows,
    ...createButtonRows([...buttonMap.values()].slice(0, 5))
  ].slice(0, 5);
}

function createRpgTutorialClaimRows(status, userId) {
  const options = status.tutorial.steps
    .filter((step) => step.canClaim)
    .map((step) =>
      createRpgSelectOption(
        `${step.label} 보상`,
        step.id,
        `진행도 ${step.current}/${step.required} · ${formatRpgRewardSummary(step.rewards)}`
      )
    );

  return createRpgSelectRows(userId, 'tutorial', '받을 튜토리얼 보상을 선택하세요', options);
}

function createRpgAdvanceRows(status, userId) {
  const options = status.classPaths
    .filter((advanced) => advanced.canAdvance)
    .map((advanced) =>
      createRpgSelectOption(
        `${advanced.label} 전직`,
        advanced.id,
        `${advanced.baseClassLabel} 계열 · Lv.${advanced.unlockLevel}+`
      )
    );

  return createRpgSelectRows(userId, 'advance', '전직할 상위 직업을 선택하세요', options);
}

function createRpgAreaRows(status, userId) {
  const currentAreaId = status.profile.rpg.currentArea;
  const options = status.unlockedAreas
    .filter((area) => area.id !== currentAreaId)
    .map((area) =>
      createRpgSelectOption(
        area.label,
        area.id,
        `Lv.${area.unlockLevel}+ · XP ×${area.xpMultiplier} / 골드 ×${area.coinMultiplier}`
      )
    );

  return [
    ...createRpgSelectRows(userId, 'area', '이동할 사냥터를 선택하세요', options),
    new ActionRowBuilder().addComponents(
      createRpgQuickButton(userId, 'combat', '⚔️ 전투 메뉴', ButtonStyle.Danger),
      createRpgQuickButton(userId, 'adventure', '🌍 모험 메뉴', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    )
  ];
}

function createRpgSelectOption(label, value, description = '') {
  const option = {
    label: shortenButtonLabel(String(label), 100),
    value: shortenButtonLabel(String(value), 100)
  };
  if (description) {
    option.description = shortenButtonLabel(String(description), 100);
  }
  return option;
}

function createRpgSelectRows(userId, action, placeholder, options) {
  const normalizedOptions = options
    .filter((option) => option?.label && option?.value)
    .slice(0, RPG_SELECT_OPTION_LIMIT);

  if (normalizedOptions.length <= 0) {
    return [];
  }

  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rpg_select:${userId}:${action}`)
        .setPlaceholder(shortenButtonLabel(placeholder, 100))
        .addOptions(normalizedOptions)
    )
  ];
}

function createRpgCompactViewRows(primaryRows, userId) {
  return [
    ...primaryRows,
    ...createRpgActionLoopRows(userId)
  ].slice(0, 5);
}

function createRpgMarketplaceRows(result, userId, { mode = 'view' } = {}) {
  const primaryRows = [
    ...(mode === 'cancel' ? [] : createRpgMarketBuyRows(result, userId)),
    ...(mode === 'buy' ? [] : createRpgMarketCancelRows(result, userId))
  ];

  return createRpgCompactViewRows(primaryRows, userId);
}

function createRpgMarketBuyRows(result, userId) {
  const options = (result.marketListings ?? [])
    .filter((listing) => listing.sellerId !== userId)
    .slice(0, RPG_SELECT_OPTION_LIMIT)
    .map((listing, index) => createRpgMarketplaceSelectOption(listing, index + 1, 'buy'));

  return createRpgSelectRows(userId, 'market_buy', '구매할 거래소 매물을 선택하세요', options);
}

function createRpgMarketCancelRows(result, userId) {
  const options = (result.marketListings ?? [])
    .filter((listing) => listing.sellerId === userId)
    .slice(0, RPG_SELECT_OPTION_LIMIT)
    .map((listing, index) => createRpgMarketplaceSelectOption(listing, index + 1, 'cancel'));

  return createRpgSelectRows(userId, 'market_cancel', '취소할 내 판매 매물을 선택하세요', options);
}

function createRpgMarketplaceSelectOption(listing, displayIndex, mode) {
  const quantityText = listing.kind === 'item' ? ` ×${listing.quantity}` : ' 장비';
  const ownerText = mode === 'cancel' ? '내 판매' : `판매자 ${listing.sellerUsername}`;
  return createRpgSelectOption(
    `${displayIndex}. ${listing.label}${quantityText}`,
    listing.id,
    `${listing.price.toLocaleString()}골드 · ${ownerText}`
  );
}

function createRpgEquipmentRows(status, userId) {
  const options = getOwnedRpgEquipmentItems(status)
    .map(({ itemId, item, count }) =>
      createRpgSelectOption(
        `${item.label} 장착`,
        itemId,
        `${item.slot} · 보유 ${count}개 ${formatItemStats(item.stats)}`
      )
    );

  return createRpgSelectRows(userId, 'equip_item', '장착할 기본 장비를 선택하세요', options);
}

function createRpgShopRows(userId) {
  const options = getRpgShopItemOptions().map((option) => {
    const item = getRpgItemConfig(option.value);
    return createRpgSelectOption(
      `${item.label} 구매`,
      option.value,
      `${item.price.toLocaleString()}골드 · ${item.type === 'equipment' ? '장비' : item.type === 'consumable' ? '소모품' : '재료'}`
    );
  });

  return createRpgSelectRows(userId, 'shop', '구매할 아이템을 선택하세요', options);
}

function createRpgShopViewRows(userId) {
  return createRpgCompactViewRows(createRpgShopRows(userId), userId);
}

function createRpgCraftingRows(status, userId, category = null) {
  const normalizedCategory = normalizeNullableRpgCraftingCategory(category);
  const options = status.craftingRecipes
    .filter((recipe) => !normalizedCategory || recipe.category === normalizedCategory)
    .slice(0, 10)
    .map((recipe) => {
      const resultItem = getRpgItemConfig(recipe.resultItemId);
      return createRpgSelectOption(
        `${recipe.hidden ? '히든 ' : ''}${recipe.label}`,
        recipe.id,
        `${resultItem.label} · ${recipe.canCraft ? '제작 가능' : '조건/재료 확인 필요'}`
      );
    });

  return createRpgCompactViewRows(
    createRpgSelectRows(userId, 'craft', '제작할 레시피를 선택하세요', options),
    userId
  );
}

function createRpgPostPurchaseRows(result, userId) {
  const buttons = [];
  if (result.item.type === 'equipment') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`rpg_item_equip:${userId}:${result.itemId}`)
        .setLabel(`${result.item.label} 장착`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`rpg_quick:${userId}:shop`)
      .setLabel('상점')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rpg_quick:${userId}:inventory`)
      .setLabel('인벤토리')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rpg_quick:${userId}:battle`)
      .setLabel('전투')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`rpg_quick:${userId}:menu`)
      .setLabel('메뉴')
      .setStyle(ButtonStyle.Secondary)
  );

  return createButtonRows(buttons);
}

function createRpgInventoryRows(status, userId) {
  return createRpgInventoryManagementRows(status, userId, 'all');
}

function createRpgInventoryManagementRows(status, userId, mode = 'all') {
  const primaryRows = getRpgInventoryPrimaryRows(status, userId, mode);
  return [
    ...primaryRows.slice(0, 1),
    ...createRpgInventoryNavigationRows(userId, mode)
  ].slice(0, 3);
}

function getRpgInventoryPrimaryRows(status, userId, mode = 'all') {
  if (mode === 'enhance') return createRpgGearEnhanceRows(status, userId);
  if (mode === 'disassemble') return createRpgGearDisassembleRows(status, userId);

  const gearRows = createRpgGearRows(status, userId);
  if (gearRows.length > 0) return gearRows;

  const equipmentRows = createRpgEquipmentRows(status, userId);
  if (equipmentRows.length > 0) return equipmentRows;

  return createRpgUsableItemRows(status, userId);
}

function createRpgInventoryNavigationRows(userId, activeMode = 'all') {
  void activeMode;
  const buttons = [
    createRpgInventoryNavButton(userId, 'inventory', '🎒 전체'),
    createRpgInventoryNavButton(userId, 'gear', '🧰 장착'),
    new ButtonBuilder()
      .setCustomId(`rpg_gear_recommend:${userId}:balanced`)
      .setLabel('⭐ 추천 장착')
      .setStyle(ButtonStyle.Success),
    createRpgInventoryNavButton(userId, 'enhance', '🛠 강화'),
    createRpgInventoryNavButton(userId, 'disassemble', '♻️ 분해'),
    createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
  ];
  return createButtonRows(buttons);
}

function createRpgInventoryNavButton(userId, action, label) {
  return createRpgQuickButton(userId, action, label, ButtonStyle.Secondary);
}

function createRpgUsableItemRows(status, userId) {
  const options = Object.entries(status.profile.rpg.inventory)
    .map(([itemId, count]) => ({
      itemId,
      item: getRpgItemConfig(itemId),
      count
    }))
    .filter(({ item, count }) => item.type === 'consumable' && count > 0)
    .map(({ itemId, item, count }) =>
      createRpgSelectOption(
        `${item.label} 사용`,
        itemId,
        `보유 ${count}개 ${formatItemStats(item.stats)}`
      )
    );

  return createRpgSelectRows(userId, 'use_item', '사용할 회복/소모품을 선택하세요', options);
}

function createRpgItemSellRows(status, userId) {
  const options = Object.entries(status.profile.rpg.inventory)
    .map(([itemId, count]) => ({
      itemId,
      item: getRpgItemConfig(itemId),
      count
    }))
    .filter(({ item, count }) => item.type !== 'material' && count > 0)
    .map(({ itemId, item, count }) =>
      createRpgSelectOption(
        `${item.label} 판매`,
        itemId,
        `보유 ${count}개 · 1개 판매`
      )
    );

  return createRpgSelectRows(userId, 'sell_item', '판매할 아이템을 선택하세요', options);
}

function createRpgGearRows(status, userId) {
  const options = getSortedRpgGears(status)
    .map((gear) =>
      createRpgSelectOption(
        formatGearLabel(gear),
        gear.id,
        `+${gear.enhanceLevel ?? 0} · 전투력 ${gear.power ?? 1} · ${formatGearStats(gear.stats) || '스탯 없음'}`
      )
    );

  return createRpgSelectRows(userId, 'gear_equip', '장착할 장비를 선택하세요', options);
}

function createRpgGearEnhanceRows(status, userId) {
  const options = getSortedRpgGears(status)
    .map((gear) =>
      createRpgSelectOption(
        `${formatGearLabel(gear)} +${gear.enhanceLevel ?? 0}`,
        gear.id,
        `강화 비용 ${getRpgGearEnhanceCost(gear).toLocaleString()}골드`
      )
    );

  return createRpgSelectRows(userId, 'gear_enhance', '강화할 장비를 선택하세요', options);
}

function createRpgGearDisassembleRows(status, userId) {
  const equippedGearIds = new Set(Object.values(status.profile.rpg.equippedGear).filter(Boolean));
  const options = getSortedRpgGears(status)
    .filter((gear) => !equippedGearIds.has(gear.id))
    .map((gear) => {
      const preview = getRpgGearDisassemblePreview(gear);
      return createRpgSelectOption(
        `${formatGearLabel(gear)} 분해`,
        gear.id,
        `강화석 ${preview.enhancementStones}개 · ${preview.coins.toLocaleString()}골드`
      );
    });

  return createRpgSelectRows(userId, 'gear_disassemble', '분해할 장비를 선택하세요', options);
}

function createRpgRaidLobbyRows(lobby) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rpg_raid_lobby:join:${lobby.id}`)
        .setLabel('참가')
        .setStyle(ButtonStyle.Success)
        .setDisabled(lobby.members.length >= lobby.maxMembers),
      new ButtonBuilder()
        .setCustomId(`rpg_raid_lobby:leave:${lobby.id}`)
        .setLabel('나가기')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rpg_raid_lobby:start:${lobby.id}`)
        .setLabel('출발')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

function createRpgDailyRows(status, userId) {
  const options = status.dailyMissions
    .filter((mission) => mission.canClaim)
    .map((mission) =>
      createRpgSelectOption(
        `${mission.label} 보상`,
        mission.id,
        `진행도 ${mission.current}/${mission.required}`
      )
    );

  return createRpgSelectRows(userId, 'daily', '받을 일일 의뢰 보상을 선택하세요', options);
}

function createRpgQuestRows(status, userId) {
  const options = status.quests
    .filter((quest) => quest.canClaim)
    .map((quest) =>
      createRpgSelectOption(
        `${quest.label} 보상`,
        quest.id,
        `진행도 ${quest.current}/${quest.required}`
      )
    );

  return createRpgSelectRows(userId, 'quest', '받을 퀘스트 보상을 선택하세요', options);
}

function createRpgQuestViewRows(status, userId) {
  return createRpgCompactViewRows(createRpgQuestRows(status, userId), userId);
}

function createRpgSkillTreeRows(status, userId) {
  const options = status.skillTree
    .filter((skill) => skill.canLearn)
    .map((skill) =>
      createRpgSelectOption(
        `${skill.label} 학습`,
        skill.id,
        `스킬 포인트 ${skill.cost}점 · ${skill.description}`
      )
    );

  return createRpgSelectRows(userId, 'skill', '배울 스킬을 선택하세요', options);
}

function createRpgSkillTreeViewRows(status, userId) {
  return createRpgCompactViewRows(createRpgSkillTreeRows(status, userId), userId);
}

function createRpgStoryRows(status, userId) {
  const options = status.storyChapters
    .filter((chapter) => chapter.canProgress)
    .map((chapter) =>
      createRpgSelectOption(
        `${chapter.label} 진행`,
        chapter.id,
        `진행도 ${chapter.current}/${chapter.required}`
      )
    );

  return createRpgSelectRows(userId, 'story', '진행할 메인 퀘스트를 선택하세요', options);
}

function createRpgStoryViewRows(status, userId) {
  return createRpgCompactViewRows(createRpgStoryRows(status, userId), userId);
}

function createRpgCodexViewRows(status, userId) {
  const options = status.codex
    .filter((entry) => entry.canClaim)
    .map((entry) =>
      createRpgSelectOption(
        `${entry.monster} 보상`,
        entry.monster,
        `발견 ${entry.discovered}회 · 처치 ${entry.kills}회`
      )
    );

  return createRpgCompactViewRows(
    createRpgSelectRows(userId, 'codex', '받을 도감 보상을 선택하세요', options),
    userId
  );
}

function createRpgClassPathViewRows(status, userId) {
  return createRpgCompactViewRows(createRpgAdvanceRows(status, userId), userId);
}

const RPG_MENU_SECTION_CONFIGS = Object.freeze({
  combat: Object.freeze({
    label: '전투',
    emoji: '⚔️',
    description: '사냥, 던전, 레이드, 회복처럼 전투 직후 바로 눌러야 하는 행동만 모았습니다.'
  }),
  adventure: Object.freeze({
    label: '모험',
    emoji: '🌍',
    description: '탐험, 월드맵 이동, 메인 퀘스트, 도감처럼 지역 진행과 기록을 이어가는 메뉴입니다.'
  }),
  growth: Object.freeze({
    label: '성장',
    emoji: '📈',
    description: '장비 장착, 장비 관리, 강화, 스킬, 전직처럼 캐릭터를 강하게 만드는 메뉴입니다.'
  }),
  manage: Object.freeze({
    label: '관리',
    emoji: '🎒',
    description: '상태, 인벤토리, 상점, 도감을 한곳에서 확인하는 정비 메뉴입니다.'
  }),
  today: Object.freeze({
    label: '오늘 할 일',
    emoji: '✅',
    description: '일일 의뢰, 퀘스트, 메인 퀘스트, 도감 보상처럼 오늘 먼저 챙길 보상을 모았습니다.'
  })
});

function isRpgMenuSectionAction(action) {
  return Object.hasOwn(RPG_MENU_SECTION_CONFIGS, action);
}

function getRpgMenuSectionConfig(section) {
  return RPG_MENU_SECTION_CONFIGS[section] ?? RPG_MENU_SECTION_CONFIGS.combat;
}

function getRpgSectionAssetIds(status, section) {
  if (section === 'combat' || section === 'adventure' || section === 'today') {
    return [status.currentArea.backgroundAssetId, status.heroAssetId];
  }

  return [status.heroAssetId, status.currentArea.backgroundAssetId];
}

function createRpgQuickButton(userId, action, label, style = ButtonStyle.Secondary, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(`rpg_quick:${userId}:${action}`)
    .setLabel(label)
    .setStyle(style)
    .setDisabled(disabled);
}

function getRpgSmartRecommendations(status) {
  const recommendations = [];
  const usedActions = new Set();
  const add = (action, label, style = ButtonStyle.Primary, disabled = false) => {
    if (usedActions.has(action)) return;
    usedActions.add(action);
    recommendations.push({ action, label, style, disabled });
  };
  const recommended = status.adventureGuide?.recommendedAction;
  const hpRatio = status.derivedStats.maxHp > 0
    ? status.profile.rpg.hp / status.derivedStats.maxHp
    : 1;
  const claimableDailyCount = status.dailyMissions.filter((mission) => mission.canClaim).length;
  const claimableQuestCount = status.quests.filter((quest) => quest.canClaim).length;
  const progressableStoryCount = status.storyChapters.filter((chapter) => chapter.canProgress).length;
  const claimableCodexCount = status.codex.filter((entry) => entry.canClaim).length;
  const canAdvanceCount = status.classPaths.filter((advanced) => advanced.canAdvance).length;
  const gearCount = Object.keys(status.profile.rpg.gearInventory ?? {}).length;
  const skillPointCount = status.skillPoints?.available ?? 0;
  const tutorial = status.tutorial;

  if (tutorial && !tutorial.complete) {
    add(
      'tutorial',
      tutorial.claimableCount > 0 ? `🎓 튜토리얼 보상 ${tutorial.claimableCount}개` : '🎓 초보자 여정',
      tutorial.claimableCount > 0 ? ButtonStyle.Success : ButtonStyle.Primary
    );
  }

  if (hpRatio <= 0.45 || recommended?.type === 'rest') {
    add('rest', '💤 HP 회복 필요', ButtonStyle.Success);
  }
  if (claimableDailyCount > 0) {
    add('daily', `🎁 일일 보상 ${claimableDailyCount}개`, ButtonStyle.Success);
  }
  if (claimableQuestCount > 0) {
    add('quest', `✅ 퀘스트 보상 ${claimableQuestCount}개`, ButtonStyle.Success);
  }
  if (canAdvanceCount > 0) {
    add('class_path', `🌟 전직 가능 ${canAdvanceCount}개`, ButtonStyle.Primary);
  }
  if (skillPointCount > 0) {
    add('skill_tree', `✨ 스킬 포인트 ${skillPointCount}개`, ButtonStyle.Primary);
  }
  if (gearCount > 0) {
    add('gear', `🛡️ 장비 ${gearCount}개 확인`, ButtonStyle.Primary);
  }
  if (progressableStoryCount > 0) {
    add('story', `📖 메인 퀘스트 ${progressableStoryCount}개`, ButtonStyle.Primary);
  }
  if (claimableCodexCount > 0) {
    add('codex', `📚 도감 보상 ${claimableCodexCount}개`, ButtonStyle.Success);
  }

  if (recommended) {
    const actionByType = {
      battle: 'battle',
      daily_claim: 'daily',
      quest_claim: 'quest',
      story: 'story',
      explore: 'explore',
      dungeon: 'dungeon',
      rest: 'rest',
      wait: 'status'
    };
    const action = actionByType[recommended.type] ?? 'status';
    add(action, `➡️ ${shortenButtonLabel(recommended.label)}`, ButtonStyle.Primary);
  }

  if (recommendations.length <= 0) {
    add('combat', '⚔️ 전투부터 하기', ButtonStyle.Danger);
  }

  return recommendations.slice(0, 5);
}

function createRpgSmartRecommendationRows(status, userId) {
  return createButtonRows(
    getRpgSmartRecommendations(status).map((recommendation) =>
      createRpgQuickButton(
        userId,
        recommendation.action,
        recommendation.label,
        recommendation.style,
        recommendation.disabled
      )
    )
  );
}

function createRpgSectionRows(status, userId, section) {
  const raidLocked = (status.profile.rpg?.level ?? 1) < getRpgRaidConfig('slime_horde').unlockLevel;
  const hasGear = Object.keys(status.profile.rpg.gearInventory ?? {}).length > 0;
  const hasSkillPoints = (status.skillPoints?.available ?? 0) > 0;
  const hasAdvance = status.classPaths.some((advanced) => advanced.canAdvance);
  const hasDailyClaim = status.dailyMissions.some((mission) => mission.canClaim);
  const hasQuestClaim = status.quests.some((quest) => quest.canClaim);
  const hasStoryProgress = status.storyChapters.some((chapter) => chapter.canProgress);
  const hasCodexClaim = status.codex.some((entry) => entry.canClaim);

  if (section === 'combat') {
    return createButtonRows([
      createRpgQuickButton(userId, 'battle', '⚔️ 사냥', ButtonStyle.Danger),
      createRpgQuickButton(userId, 'dungeon', '🏰 던전', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'raid', '🐉 레이드', ButtonStyle.Danger, raidLocked),
      createRpgQuickButton(userId, 'rest', '💤 휴식', ButtonStyle.Success),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    ]);
  }

  if (section === 'adventure') {
    return createButtonRows([
      createRpgQuickButton(userId, 'explore', '🧭 탐험', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'area', '🗺️ 월드맵', ButtonStyle.Secondary),
      createRpgQuickButton(userId, 'story', hasStoryProgress ? '📖 메인 퀘스트' : '📖 메인', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'codex', hasCodexClaim ? '📚 도감 보상' : '📚 도감', ButtonStyle.Success),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    ]);
  }

  if (section === 'growth') {
    return createButtonRows([
      createRpgQuickButton(userId, 'gear', hasGear ? '🛡️ 장비 장착' : '🛡️ 장비 없음', ButtonStyle.Primary, !hasGear),
      createRpgQuickButton(userId, 'enhance', hasGear ? '🛠️ 장비 강화' : '🛠️ 강화할 장비 없음', ButtonStyle.Success, !hasGear),
      createRpgQuickButton(userId, 'skill_tree', hasSkillPoints ? `✨ 스킬 ${hasSkillPoints}점` : '✨ 스킬', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'class_path', hasAdvance ? '🌟 전직 가능' : '🌟 전직 트리', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    ]);
  }

  if (section === 'manage') {
    return createButtonRows([
      createRpgQuickButton(userId, 'status', '📊 내 캐릭터', ButtonStyle.Secondary),
      createRpgQuickButton(userId, 'inventory', '🎒 인벤토리', ButtonStyle.Secondary),
      createRpgQuickButton(userId, 'shop', '🏪 상점', ButtonStyle.Success),
      createRpgQuickButton(userId, 'codex', hasCodexClaim ? '📚 도감 보상' : '📚 도감', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    ]);
  }

  return createButtonRows([
    createRpgQuickButton(userId, 'daily', hasDailyClaim ? '🎁 일일 보상 받기' : '📋 일일 의뢰', ButtonStyle.Success),
    createRpgQuickButton(userId, 'quest', hasQuestClaim ? '✅ 퀘스트 보상' : '🧾 퀘스트', ButtonStyle.Success),
    createRpgQuickButton(userId, 'story', hasStoryProgress ? '📖 메인 퀘스트' : '📖 메인', ButtonStyle.Primary),
    createRpgQuickButton(userId, 'codex', hasCodexClaim ? '📚 도감 보상' : '📚 도감', ButtonStyle.Primary),
    createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
  ]);
}

function createRpgMainMenuRows(status, userId) {
  return [
    ...createRpgSmartRecommendationRows(status, userId).slice(0, 1),
    new ActionRowBuilder().addComponents(
      createRpgQuickButton(userId, 'combat', '⚔️ 전투', ButtonStyle.Danger),
      createRpgQuickButton(userId, 'adventure', '🌍 모험', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'growth', '📈 성장', ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      createRpgQuickButton(userId, 'manage', '🎒 관리', ButtonStyle.Secondary),
      createRpgQuickButton(userId, 'today', '✅ 오늘 할 일', ButtonStyle.Success)
    )
  ];
}

function createRpgActionLoopRows(userId) {
  return createButtonRows([
    createRpgQuickButton(userId, 'battle', '⚔️ 다시 전투', ButtonStyle.Danger),
    createRpgQuickButton(userId, 'explore', '🧭 탐험', ButtonStyle.Primary),
    createRpgQuickButton(userId, 'today', '✅ 오늘', ButtonStyle.Success),
    createRpgQuickButton(userId, 'growth', '📈 성장', ButtonStyle.Primary),
    createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
  ]);
}

function createRpgDungeonRows(result, userId) {
  if (result.type === 'dungeon_result') return createRpgActionLoopRows(userId);
  if (result.type !== 'dungeon_run' || !result.run) return createRpgActionLoopRows(userId);

  const { run } = result;
  const buttons = [];
  if (run.state === 'awaiting_relic') {
    for (const relic of run.pendingRelicChoices.slice(0, 4)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`rpg_dungeon:${userId}:relic:${run.id}:${run.revision}:${relic.id}`)
          .setLabel(shortenButtonLabel(`🧿 ${relic.label}`, 80))
          .setStyle(ButtonStyle.Primary)
      );
    }
  } else {
    for (const choice of run.currentChoices.slice(0, 4)) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`rpg_dungeon:${userId}:room:${run.id}:${run.revision}:${choice.id}`)
          .setLabel(shortenButtonLabel(choice.risk === 'high' ? `☠️ ${choice.label}` : choice.label, 80))
          .setStyle(getRpgDungeonChoiceButtonStyle(choice))
      );
    }
  }

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`rpg_dungeon:${userId}:resume:${run.id}:${run.revision}:run`)
      .setLabel('📜 상태')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`rpg_dungeon:${userId}:abandon:${run.id}:${run.revision}:run`)
      .setLabel('🚪 포기')
      .setStyle(ButtonStyle.Secondary)
  );
  return createButtonRows(buttons);
}

function getRpgDungeonChoiceButtonStyle(choice) {
  if (choice.risk === 'high') return ButtonStyle.Danger;
  if (choice.risk === 'safe') return ButtonStyle.Success;
  return ButtonStyle.Primary;
}

function createButtonRows(buttons) {
  return createDiscordButtonRows(buttons, { maxPerRow: 3, maxRows: 3 });
}

function getOwnedRpgEquipmentItems(status) {
  return Object.entries(status.profile.rpg.inventory)
    .map(([itemId, count]) => ({
      itemId,
      item: getRpgItemConfig(itemId),
      count
    }))
    .filter(({ item, count }) => item.type === 'equipment' && count > 0)
    .sort((a, b) => a.item.slot.localeCompare(b.item.slot, 'ko-KR') || a.item.label.localeCompare(b.item.label, 'ko-KR'));
}

function getSortedRpgGears(status) {
  return Object.values(status.profile.rpg.gearInventory)
    .sort((a, b) =>
      (b.power ?? 0) - (a.power ?? 0)
      || formatGearLabel(a).localeCompare(formatGearLabel(b), 'ko-KR')
    );
}

function getRecommendedRpgGearIds(status) {
  return new Set(['weapon', 'armor', 'accessory']
    .map((slot) => getRecommendedRpgGearForSlot(status, slot))
    .filter((entry) => entry?.comparison?.scoreDelta > 0)
    .map((entry) => entry.gear.id));
}

function getRecommendedRpgGearForSlot(status, slot) {
  const candidates = Object.values(status.profile.rpg.gearInventory ?? {})
    .filter((gear) => gear?.slot === slot)
    .sort((a, b) =>
      getRpgGearUiScore(b) - getRpgGearUiScore(a)
      || formatGearLabel(a).localeCompare(formatGearLabel(b), 'ko-KR')
      || String(a.id ?? '').localeCompare(String(b.id ?? ''))
    );
  const gear = candidates[0] ?? null;
  if (!gear) return null;
  return {
    gear,
    comparison: compareRpgGearWithEquipped(status, gear)
  };
}

function compareRpgGearWithEquipped(status, gear) {
  const currentGearId = status.profile.rpg.equippedGear?.[gear.slot];
  const currentGear = currentGearId ? status.profile.rpg.gearInventory[currentGearId] ?? null : null;
  return compareRpgGearStats(currentGear, gear);
}

function compareRpgGearStats(beforeGear, afterGear) {
  const beforeStats = beforeGear?.stats ?? {};
  const afterStats = afterGear?.stats ?? {};
  return {
    scoreBefore: getRpgGearUiScore(beforeGear),
    scoreAfter: getRpgGearUiScore(afterGear),
    scoreDelta: getRpgGearUiScore(afterGear) - getRpgGearUiScore(beforeGear),
    statDelta: {
      attack: (afterStats.attack ?? 0) - (beforeStats.attack ?? 0),
      defense: (afterStats.defense ?? 0) - (beforeStats.defense ?? 0),
      maxHp: (afterStats.maxHp ?? 0) - (beforeStats.maxHp ?? 0),
      maxMp: (afterStats.maxMp ?? 0) - (beforeStats.maxMp ?? 0)
    }
  };
}

function getRpgGearUiScore(gear) {
  if (!gear) return 0;
  const stats = gear.stats ?? {};
  return (
    Math.max(1, Number(gear.power) || 1) * 10
    + Math.max(0, Number(gear.enhanceLevel) || 0) * 4
    + (stats.attack ?? 0) * 4
    + (stats.defense ?? 0) * 3
    + Math.floor((stats.maxHp ?? 0) / 8)
    + Math.floor((stats.maxMp ?? 0) / 6)
  );
}

function formatRpgGearComparison(comparison) {
  if (!comparison) return '';
  const deltas = [
    ['공격', comparison.statDelta?.attack ?? 0],
    ['방어', comparison.statDelta?.defense ?? 0],
    ['HP', comparison.statDelta?.maxHp ?? 0],
    ['MP', comparison.statDelta?.maxMp ?? 0]
  ]
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${label} ${value > 0 ? '+' : ''}${value}`);
  const scoreText = `추천점수 ${comparison.scoreDelta > 0 ? '+' : ''}${comparison.scoreDelta}`;
  return [scoreText, ...deltas].join(' · ');
}

function shortenButtonLabel(label, maxLength = 70) {
  return shortenComponentText(label, maxLength);
}

function formatRpgActionAvailability(actionAvailability = {}) {
  const keys = ['battle', 'explore', 'dungeon', 'boss', 'raid', 'guildRaid', 'rest'];
  const labels = keys
    .map((key) => actionAvailability[key])
    .filter(Boolean)
    .map((action) => {
      if (action.available) {
        return `✅ ${action.label}`;
      }

      if (action.hpBlocked) {
        return `🩹 ${action.label} HP 필요`;
      }

      if (action.levelBlocked || action.areaBlocked) {
        return `🔒 ${action.label} ${action.reason}`;
      }

      return action.cooldownRemainingMs > 0
        ? `⏳ ${action.label} ${formatDuration(action.cooldownRemainingMs)}`
        : `⏳ ${action.label} ${action.reason}`;
    });

  return labels.join(' · ') || '행동 정보 없음';
}

function getRpgGearEnhanceCost(gear) {
  const enhanceLevel = Math.max(0, Math.floor(Number(gear.enhanceLevel) || 0));
  const power = Math.max(1, Math.floor(Number(gear.power) || 1));

  return 120 * (enhanceLevel + 1) * power;
}

function getRpgGearDisassemblePreview(gear = {}) {
  const rarityBonus = {
    common: 1,
    rare: 2,
    epic: 3,
    legendary: 4,
    mythic: 5
  }[gear.rarity] ?? 1;
  const enhanceLevel = Math.max(0, Math.floor(Number(gear.enhanceLevel) || 0));
  const power = Math.max(1, Math.floor(Number(gear.power) || 1));

  return {
    enhancementStones: Math.max(1, rarityBonus + Math.floor(enhanceLevel / 2)),
    coins: Math.max(40, power * 60 + enhanceLevel * 40)
  };
}

function formatGearLabel(gear) {
  return `${gear.rarityLabel ?? gear.rarity} ${gear.label.replace(/^(일반|희귀|영웅|전설) /, '')}`;
}

function formatGearStats(stats = {}) {
  return Object.entries(stats)
    .filter(([, value]) => value > 0)
    .map(([stat, value]) => `${formatStatName(stat)} +${value}`)
    .join(', ');
}

function formatItemStats(stats = {}) {
  const text = formatGearStats(stats);
  return text ? `/ ${text}` : '';
}

function formatStatName(stat) {
  return {
    attack: '공격',
    defense: '방어',
    maxHp: 'HP',
    maxMp: 'MP'
  }[stat] ?? stat;
}

function formatEquipmentSlot(slot) {
  return {
    weapon: '무기',
    armor: '방어구',
    accessory: '장신구'
  }[slot] ?? slot;
}
