import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js';
import {
  getRpgAdvancedClassConfig,
  getRpgAdvancedClassOptions,
  getRpgAdventureGuide,
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgBossOptions,
  getRpgBossPattern,
  getRpgClassConfig,
  getRpgClassOptions,
  getRpgDailyMissionOptions,
  getRpgDifficultyOptions,
  getRpgDerivedStats,
  getRpgEquipmentItemOptions,
  getRpgGachaBannerOptions,
  getRpgGenderConfig,
  getRpgGenderOptions,
  getRpgItemConfig,
  getRpgQuestOptions,
  getRpgRaidConfig,
  getRpgRaidOptions,
  getRpgShopItemOptions,
  getRpgSkillConfig,
  getRpgSkillTreeOptions,
  getRpgSkillOptions,
  getRpgStoryChapterOptions,
  getRpgUsableItemOptions,
  normalizeRpgSkillId
} from '../systems/rpg.js';
import {
  getRpgAssetAttachment
} from '../systems/rpg-assets.js';
import { formatDuration } from './economy.js';

const RPG_PVP_CHALLENGE_TTL_MS = 60_000;
const RPG_PVP_SESSION_TTL_MS = 10 * 60_000;
const RPG_BOSS_SESSION_TTL_MS = 10 * 60_000;
const RPG_RAID_LOBBY_TTL_MS = 10 * 60_000;
const RPG_RAID_LOBBY_MAX_MEMBERS = 4;
const RPG_SELECT_OPTION_LIMIT = 25;
const pendingRpgPvpChallenges = new Map();
const activeRpgPvpSessions = new Map();
const activeRpgBossSessions = new Map();
// Discord button sessions are intentionally ephemeral; a bot restart invalidates
// in-flight raid lobbies the same way it invalidates pending PvP/boss buttons.
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
            .addChoices(...getRpgClassOptions())
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
        .setName('전투')
        .setDescription('몬스터와 전투합니다.')
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
            .addChoices(...getRpgAreaOptions())
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
            .addChoices(...getRpgSkillOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('대결')
        .setDescription('다른 유저에게 RPG PvP 대결을 신청합니다.')
        .addUserOption((option) =>
          option
            .setName('상대')
            .setDescription('대결을 신청할 상대')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('탐험')
        .setDescription('지역을 탐험해서 이벤트, 보물, 함정을 만납니다.')
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('탐험 지역')
            .addChoices(...getRpgAreaOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('던전')
        .setDescription('여러 층을 연속 탐험하고 전리품을 노립니다.')
        .addStringOption((option) =>
          option
            .setName('지역')
            .setDescription('던전 지역')
            .addChoices(...getRpgAreaOptions())
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
            .addChoices(...getRpgBossOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('내 RPG 전투 기록을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상점')
        .setDescription('RPG 아이템을 확인하거나 구매합니다.')
        .addStringOption((option) =>
          option
            .setName('아이템')
            .setDescription('구매할 아이템')
            .addChoices(...getRpgShopItemOptions())
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('사용')
        .setDescription('소비 아이템을 사용합니다.')
        .addStringOption((option) =>
          option
            .setName('아이템')
            .setDescription('사용할 아이템')
            .setRequired(true)
            .addChoices(...getRpgUsableItemOptions())
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
            .addChoices(...getRpgEquipmentItemOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전리품')
        .setDescription('랜덤 옵션 전리품 장비를 확인하거나 장착합니다.')
        .addStringOption((option) =>
          option
            .setName('장비')
            .setDescription('장착할 전리품 번호/이름. 비우면 전리품 선택 메뉴를 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('장비강화')
        .setDescription('전리품 장비를 골드로 강화합니다.')
        .addStringOption((option) =>
          option
            .setName('장비')
            .setDescription('강화할 전리품 번호/이름. 비우면 강화 선택 메뉴를 봅니다.')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('퀘스트')
        .setDescription('RPG 퀘스트를 확인하거나 보상을 받습니다.')
        .addStringOption((option) =>
          option
            .setName('퀘스트')
            .setDescription('보상을 받을 퀘스트')
            .addChoices(...getRpgQuestOptions())
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
            .addChoices(...getRpgDailyMissionOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('휴식')
        .setDescription('HP와 MP를 모두 회복합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('가챠')
        .setDescription('가챠로 장비와 고급 직업을 획득합니다.')
        .addStringOption((option) =>
          option
            .setName('배너')
            .setDescription('가챠 배너')
            .addChoices(...getRpgGachaBannerOptions())
        )
        .addIntegerOption((option) =>
          option
            .setName('횟수')
            .setDescription('가챠 횟수')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('스킬트리')
        .setDescription('스킬 포인트로 패시브 스킬을 배웁니다.')
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('배울 스킬트리')
            .addChoices(...getRpgSkillTreeOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전직')
        .setDescription('현재 직업의 상위 직업으로 전직합니다.')
        .addStringOption((option) =>
          option
            .setName('전직')
            .setDescription('선택할 상위 직업. 비우면 전직 트리를 봅니다.')
            .addChoices(...getRpgAdvancedClassOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('스토리')
        .setDescription('스토리 챕터를 확인하거나 진행합니다.')
        .addStringOption((option) =>
          option
            .setName('챕터')
            .setDescription('진행할 스토리 챕터')
            .addChoices(...getRpgStoryChapterOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도감')
        .setDescription('몬스터 도감을 확인하거나 발견 보상을 받습니다.')
        .addStringOption((option) =>
          option
            .setName('몬스터')
            .setDescription('보상을 받을 몬스터 이름')
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
            .addChoices(...getRpgRaidOptions())
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
            .addChoices(...getRpgSkillOptions())
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
            .addChoices(...getRpgRaidOptions())
        )
        .addStringOption((option) =>
          option
            .setName('스킬')
            .setDescription('사용할 전투 스킬')
            .addChoices(...getRpgSkillOptions())
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
            .addChoices(...getRpgAreaOptions())
        )
    )
];

export function getRpgCommandPayloads() {
  return rpgCommands.map((command) => command.toJSON());
}

export async function handleRpgCommand(interaction, economy) {
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
    if (interaction.customId.startsWith('rpg_quick:')) {
      return handleRpgQuickButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_boss_action:')) {
      return handleRpgBossActionButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_raid_lobby:')) {
      return handleRpgRaidLobbyButton(interaction, economy);
    }
    return handleRpgPvpButton(interaction, economy);
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
      ephemeral: true
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

    await replyWithRpgAssets(interaction, formatRpgStart(user, result), [result.heroAssetId]);
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

  if (subcommand === '전투') {
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
          ephemeral: true
        });
        return true;
      }

      await replyWithRpgAssets(interaction, formatBattleResult(user, result), getBattleAssetIds(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `RPG 전투 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '대결') {
    const target = interaction.options.getUser('상대', true);

    try {
      assertValidRpgPvpTarget(user, target);
      await createRpgPvpChallenge(interaction, target);
    } catch (error) {
      await interaction.reply({
        content: `RPG 대결 신청 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '탐험') {
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
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '던전') {
    const area = interaction.options.getString('지역');
    const depth = interaction.options.getInteger('깊이') ?? 3;

    try {
      const result = await economy.runRpgDungeon({
        guildId,
        userId: user.id,
        username: user.username,
        area,
        depth
      });
      await replyWithRpgAssets(interaction, formatRpgDungeon(user, result), getDungeonAssetIds(result), {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `던전 실패: ${error.message}`,
        ephemeral: true
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
          ephemeral: true
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
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '상태') {
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
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '인벤토리') {
    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
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
        ephemeral: true
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
        ephemeral: true
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
        content: `전리품 장착 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '장비강화') {
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
        ephemeral: true
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
        ephemeral: true
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
        ephemeral: true
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
        ephemeral: true
      });
    }
    return true;
  }

  if (subcommand === '가챠') {
    const bannerId = interaction.options.getString('배너') ?? 'standard';
    const count = interaction.options.getInteger('횟수') ?? 1;

    try {
      const result = await economy.pullRpgGacha({
        guildId,
        userId: user.id,
        username: user.username,
        bannerId,
        count
      });
      await replyWithRpgAssets(interaction, formatRpgGacha(result), getGachaAssetIds(result));
    } catch (error) {
      await interaction.reply({
        content: `가챠 실패: ${error.message}`,
        ephemeral: true
      });
    }

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
        ephemeral: true
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
      const result = await economy.advanceRpgClass({
        guildId,
        userId: user.id,
        username: user.username,
        advancedClass
      });
      await replyWithRpgAssets(interaction, formatRpgAdvanceClass(result), [result.heroAssetId], {
        components: createRpgActionLoopRows(user.id)
      });
    } catch (error) {
      await interaction.reply({
        content: `전직 실패: ${error.message}`,
        ephemeral: true
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
        content: `스토리 진행 실패: ${error.message}`,
        ephemeral: true
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
        ephemeral: true
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
        ephemeral: true
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
        `🐉 **RPG 길드 레이드 모집 실패** — ${user}\n${error.message}`,
        [raid.backgroundAssetId],
        { ephemeral: true }
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
          ephemeral: true
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

async function createRpgPvpChallenge(interaction, target) {
  const challengeId = createRpgPvpChallengeId();
  const challenge = {
    id: challengeId,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    challenger: {
      userId: interaction.user.id,
      username: interaction.user.username,
      mention: formatDiscordUserMention(interaction.user)
    },
    opponent: {
      userId: target.id,
      username: target.username,
      mention: formatDiscordUserMention(target)
    },
    createdAt: Date.now()
  };

  pendingRpgPvpChallenges.set(challengeId, challenge);

  await replyWithRpgCard(interaction, formatRpgPvpChallenge(challenge), {
    components: [createRpgPvpChallengeRow(challengeId)]
  });
}

async function handleRpgPvpButton(interaction, economy) {
  if (!interaction.customId.startsWith('rpg_pvp_')) return false;

  if (interaction.customId.startsWith('rpg_pvp_action:')) {
    return handleRpgPvpActionButton(interaction, economy);
  }

  const [action, challengeId] = interaction.customId.split(':');
  const challenge = pendingRpgPvpChallenges.get(challengeId);

  if (!challenge || Date.now() - challenge.createdAt > RPG_PVP_CHALLENGE_TTL_MS) {
    pendingRpgPvpChallenges.delete(challengeId);
    await interaction.reply({
      content: '이미 만료되었거나 처리된 RPG 대결입니다.',
      ephemeral: true
    });
    return true;
  }

  if (interaction.user.id !== challenge.opponent.userId) {
    await interaction.reply({
      content: 'RPG 대결을 신청받은 유저만 누를 수 있습니다.',
      ephemeral: true
    });
    return true;
  }

  if (action === 'rpg_pvp_decline') {
    pendingRpgPvpChallenges.delete(challengeId);
    await updateWithRpgCard(interaction, `🛡️ **RPG 대결 거절**\n${challenge.opponent.mention}님이 RPG 대결을 거절했습니다.`, {
      components: []
    });
    return true;
  }

  if (action !== 'rpg_pvp_accept') {
    await interaction.reply({
      content: '알 수 없는 RPG 대결 버튼입니다.',
      ephemeral: true
    });
    return true;
  }

  pendingRpgPvpChallenges.delete(challengeId);

  try {
    const result = await economy.startRpgPvpDuel({
      guildId: challenge.guildId,
      challenger: challenge.challenger,
      opponent: challenge.opponent
    });

    if (!result.started) {
      await updateWithRpgCard(interaction, formatRpgPvpBlocked(challenge, result), {
        components: []
      });
      return true;
    }

    activeRpgPvpSessions.set(result.session.id, result.session);
    await updateWithRpgCard(interaction, formatRpgPvpTurnBoard(challenge, result), {
      components: [createRpgPvpActionRow(result.session)]
    });
  } catch (error) {
    await updateWithRpgCard(interaction, `⚠️ **RPG 대결 실패**\n${error.message}`, {
      components: []
    });
  }

  return true;
}

async function handleRpgPvpActionButton(interaction, economy) {
  const [, sessionId, skillId] = interaction.customId.split(':');
  const session = activeRpgPvpSessions.get(sessionId);

  if (!session || Date.now() - session.updatedAt > RPG_PVP_SESSION_TTL_MS) {
    activeRpgPvpSessions.delete(sessionId);
    await interaction.reply({
      content: '이미 만료되었거나 종료된 RPG 턴제 대결입니다.',
      ephemeral: true
    });
    return true;
  }

  const activeFighter = session.fighters[session.turnSide];
  if (interaction.user.id !== activeFighter.userId) {
    await interaction.reply({
      content: `${activeFighter.mention}님의 차례입니다.`,
      ephemeral: true
    });
    return true;
  }

  try {
    const result = await economy.playRpgPvpTurn({
      guildId: session.guildId,
      session,
      actorUserId: interaction.user.id,
      skillId
    });

    if (result.completed) {
      activeRpgPvpSessions.delete(sessionId);
      await updateWithRpgCard(interaction, formatRpgPvpResult(result), {
        components: []
      });
      return true;
    }

    activeRpgPvpSessions.set(sessionId, result.session);
    await updateWithRpgCard(interaction, formatRpgPvpTurnBoard(null, result), {
      components: [createRpgPvpActionRow(result.session)]
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 턴 처리 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgStartButton(interaction, economy) {
  const [, userId, characterClass, characterGender] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 캐릭터 생성 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 시작 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgAdvanceButton(interaction, economy) {
  const [, userId, advancedClass] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 전직 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgAreaButton(interaction, economy) {
  const [, userId, area] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 지역 이동 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgShopBuyButton(interaction, economy) {
  const [, userId, itemId, rawQuantity = '1'] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 상점 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgItemEquipButton(interaction, economy) {
  const [, userId, itemId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgItemUseButton(interaction, economy) {
  const [, userId, itemId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 아이템 사용 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgItemSellButton(interaction, economy) {
  const [, userId, itemId, rawQuantity = '1'] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 아이템 판매 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgGearEquipButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 전리품 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      content: `전리품 장착 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgGearDisassembleButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 전리품 분해 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      content: `전리품 분해 실패: ${error.message}`,
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgGearEnhanceButton(interaction, economy) {
  const [, userId, gearId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 장비 강화 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgDailyMissionButton(interaction, economy) {
  const [, userId, missionId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 일일 의뢰 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgQuestButton(interaction, economy) {
  const [, userId, questId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 퀘스트 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgSkillButton(interaction, economy) {
  const [, userId, skillId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 스킬트리 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

async function handleRpgStoryButton(interaction, economy) {
  const [, userId, chapterId] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 스토리 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
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
      content: `스토리 진행 실패: ${error.message}`,
      ephemeral: true
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
      ephemeral: true
    });
    return true;
  }

  if (!selected) {
    await interaction.reply({
      content: '선택한 RPG 항목이 없습니다.',
      ephemeral: true
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
        components: []
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

    await interaction.reply({
      content: '알 수 없는 RPG 선택 메뉴입니다.',
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({
      content: `RPG 선택 처리 실패: ${error.message}`,
      ephemeral: true
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
  if (status.profile.level < raid.unlockLevel) {
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
      ephemeral: true
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
      ephemeral: true
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
  if (status.profile.level < lobby.raid.unlockLevel) {
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
    level: status.profile.level,
    classLabel: status.classConfig.label,
    powerScore: status.adventureGuide.powerScore,
    hp: status.profile.rpg.hp,
    maxHp: status.derivedStats.maxHp
  };
}

function createRpgRaidLobbyId(now = Date.now()) {
  return `${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function handleRpgQuickButton(interaction, economy) {
  const [, userId, action] = interaction.customId.split(':');

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '이 RPG 메뉴 버튼은 명령어를 실행한 유저만 누를 수 있습니다.',
      ephemeral: true
    });
    return true;
  }

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
        await interaction.reply({
          content: `⏳ 아직 다시 전투할 수 없습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
          ephemeral: true
        });
        return true;
      }

      await updateWithRpgAssets(interaction, formatBattleResult(interaction.user, result), getBattleAssetIds(result), {
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
      await updateWithRpgAssets(interaction, formatRpgExplore(interaction.user, result), getExploreAssetIds(result), {
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
      await updateWithRpgAssets(interaction, formatRpgDungeon(interaction.user, result), getDungeonAssetIds(result), {
        components: createRpgActionLoopRows(interaction.user.id)
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
      await updateWithRpgAssets(interaction, formatRpgRaid(interaction.user, result), getBattleAssetIds(result), {
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
        components: [
          ...createRpgGearRows(status, interaction.user.id),
          ...createRpgGearDisassembleRows(status, interaction.user.id),
          ...createRpgActionLoopRows(interaction.user.id).slice(0, 1)
        ].slice(0, 5)
      });
      return true;
    }

    if (action === 'enhance') {
      await updateWithRpgAssets(interaction, formatRpgGearEnhanceGuide(status), [status.heroAssetId], {
        components: [
          ...createRpgGearEnhanceRows(status, interaction.user.id),
          ...createRpgActionLoopRows(interaction.user.id).slice(0, 1)
        ].slice(0, 5)
      });
      return true;
    }

    if (action === 'disassemble') {
      await updateWithRpgAssets(interaction, formatRpgGearDisassembleGuide(status), [status.heroAssetId], {
        components: [
          ...createRpgGearDisassembleRows(status, interaction.user.id),
          ...createRpgActionLoopRows(interaction.user.id).slice(0, 1)
        ].slice(0, 5)
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
    await interaction.reply({
      content: `RPG 빠른 실행 실패: ${error.message}`,
      ephemeral: true
    });
    return true;
  }

  await interaction.reply({
    content: '알 수 없는 RPG 메뉴 버튼입니다.',
    ephemeral: true
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
      ephemeral: true
    });
    return true;
  }

  if (entry.session.userId !== interaction.user.id) {
    await interaction.reply({
      content: '이 RPG 보스전은 시작한 유저만 조작할 수 있습니다.',
      ephemeral: true
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
      ephemeral: true
    });
  }

  return true;
}

function formatRpgCharacterCreation(user, status) {
  const { profile, classConfig, genderConfig, currentArea } = status;
  const classRows = profile.rpg.unlockedClasses
    .map((classId) => getRpgClassConfig(classId))
    .map((config) => `- **${config.label}** — ${config.description}`);
  const lockedRows = getRpgClassOptions()
    .filter((option) => !profile.rpg.unlockedClasses.includes(option.value))
    .map((option) => option.name);
  const lockedText = lockedRows.length > 0
    ? `\n가챠 해금 직업: ${lockedRows.join(', ')}`
    : '';

  return [
    `🎭 **캐릭터 생성 / 직업 변경** — ${user}`,
    `현재 캐릭터: **${genderConfig.label} ${classConfig.label}** / 현재 지역: **${currentArea.label}**`,
    '아래 선택 메뉴에서 **성별 + 직업**을 한 번에 고르면 바로 적용됩니다.',
    '',
    `선택 가능 직업:\n${classRows.join('\n')}${lockedText}`,
    '',
    '직업을 바꿔도 레벨/아이템은 유지됩니다. 다른 계열로 바꾸면 기존 전직은 해제됩니다.'
  ].join('\n');
}

function formatRpgStart(user, result) {
  const { classConfig, genderConfig, profile, derivedStats, currentArea } = result;

  return [
    `🧭 **모험가 등록 완료** — ${user}`,
    `캐릭터: **${genderConfig.label} ${classConfig.label}**`,
    classConfig.description,
    `현재 레벨: **Lv.${profile.level}** / 경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `스탯: 공격력 **${derivedStats.attack}** / 방어력 **${derivedStats.defense}** / HP **${profile.rpg.hp.toLocaleString()}/${derivedStats.maxHp.toLocaleString()}** / MP **${profile.rpg.mp.toLocaleString()}/${derivedStats.maxMp.toLocaleString()}**`,
    `시작 지역: **${currentArea.label}**`,
    '',
    '다음 추천: `/rpg 지역`으로 월드맵 확인 → `/rpg 탐험` 또는 `/rpg 전투`'
  ].join('\n');
}

function formatBattleResult(user, result) {
  const { battle, profile } = result;
  const outcomeText = battle.win ? '승리' : '패배';
  const rewardText = battle.win
    ? `보상: +${result.xpGained.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward)}`
    : '보상: 없음';
  const monsterPowerText = battle.defenseBonus > 0
    ? `${battle.monsterPower} → ${battle.mitigatedMonsterPower} (방어 적용)`
    : `${battle.monsterPower}`;
  const statusEffectText = formatRpgStatusEffect(battle.statusEffect);
  const ultimateChargeText = result.ultimateCharge
    ? `🌟 궁극기 게이지 ${formatRpgMeter(result.ultimateCharge.after, result.ultimateCharge.max)} **${result.ultimateCharge.after}/${result.ultimateCharge.max}**`
    : '';
  const lootRows = [
    result.drop ? `🎁 드랍 **${result.drop.label}** × ${result.drop.quantity}` : null,
    result.gearDrop ? `🧰 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    battle.ultimate ? `🌟 궁극기 **${battle.skillLabel}**${result.ultimateCharge?.spent ? ' · 게이지 소비' : ''}` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `⚔️ **RPG 전투 결과** — ${user}`,
    `📍 전장: **${battle.areaLabel}** · 난이도 **${battle.difficultyLabel}** · 몬스터 **${battle.monster}**`,
    `🧙 캐릭터: **${battle.characterGenderLabel} ${battle.characterClassLabel}** · 스킬 **${battle.skillLabel}** (MP -${battle.skillMpCost})`,
    `🎲 전투 판정: 내 전투력 **${battle.playerPower}** (Lv.${battle.playerLevel}, 주사위 ${battle.playerRoll}, 장비 +${battle.attackBonus}) vs 몬스터 **${monsterPowerText}**`,
    `🏁 결과: **${outcomeText}** · 피해 **-${battle.damageTaken.toLocaleString()} HP**`,
    statusEffectText ? `🌀 상태효과: ${statusEffectText}` : null,
    `🎁 ${rewardText}`,
    lootRows.length > 0 ? lootRows.join('\n') : null,
    formatRpgPostActionState(profile),
    `📊 전적: **${profile.rpg.wins}승 ${profile.rpg.losses}패 / ${profile.rpg.battles}전**`,
    formatRpgNextAction(profile, result)
  ].filter(Boolean).join('\n');
}

function formatRpgBossEncounter(user, result) {
  const { session } = result;
  const bossPattern = getRpgBossPattern(session.bossId, session.turn);

  return [
    `🐲 **수동 보스전 시작** — ${user}`,
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
    `🐲 **수동 보스전** — ${user}`,
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
    result.gearDrop ? `🧰 보스 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐲 **수동 보스전 종료** — ${user}`,
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

function formatRpgPvpChallenge(challenge) {
  return [
    `⚔️ **RPG PvP 대결 신청**`,
    `${challenge.opponent.mention}, ${challenge.challenger.mention}님이 RPG 대결을 신청했습니다!`,
    '60초 안에 수락하면 포켓몬 배틀처럼 번갈아 스킬 버튼을 눌러 직접 싸웁니다.',
    '패배해도 골드는 잃지 않고, 승자만 보상을 받습니다.'
  ].join('\n');
}

function formatRpgPvpTurnBoard(challenge, result) {
  const { session } = result;
  const active = session.fighters[session.turnSide];
  const challenger = session.fighters.challenger;
  const opponent = session.fighters.opponent;
  const lastTurnText = result.turn
    ? `\n최근 행동: ${formatRpgPvpTurnSummary(result.turn)}`
    : '';
  const introText = challenge
    ? `\n${challenge.opponent.mention}님이 수락했습니다.`
    : '';

  return [
    `⚔️ **RPG 턴제 PvP**${introText}`,
    `🧭 전장 상태: **${session.turn}턴** · 현재 차례 **${formatRpgFighterName(active)}**`,
    '',
    `🔴 **신청자 · ${formatRpgFighterName(challenger)}**`,
    formatRpgCombatantVitals(challenger),
    `🔵 **상대 · ${formatRpgFighterName(opponent)}**`,
    formatRpgCombatantVitals(opponent),
    `🎒 현재 차례 소모품: 포션 **${active.inventory?.potion ?? 0}개**`,
    `${formatRpgFighterName(active)}님이 스킬 또는 포션을 선택하세요.${lastTurnText}`
  ].join('\n');
}

function formatRpgPvpResult(result) {
  const { session, turn } = result;
  const challenger = session.fighters.challenger;
  const opponent = session.fighters.opponent;
  const winnerFighter = result.winnerUserId === challenger.userId
    ? challenger
    : opponent;
  const winnerProfile = result.winnerUserId === challenger.userId
    ? result.challenger
    : result.opponent;
  const levelText = result.leveledUp
    ? `\n🎉 승자 레벨업! Lv.${winnerProfile.level} / 레벨 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}`
    : '';

  const rows = [
    `⚔️ **RPG 턴제 PvP 결과**`,
    `마지막 행동: **${turn.attacker.characterClassLabel}**의 **${turn.skillLabel}** / 주사위 ${turn.roll} / 피해 **-${turn.damage} HP**`,
    `${challenger.mention}: HP **${challenger.hp}/${challenger.maxHp}** / MP **${challenger.mp}/${challenger.maxMp}**`,
    `${opponent.mention}: HP **${opponent.hp}/${opponent.maxHp}** / MP **${opponent.mp}/${opponent.maxMp}**`,
    `승자: **${winnerFighter.mention}**`,
    `승리 보상: +${result.rewards.xp.toLocaleString()} XP, +${formatRpgGoldReward(result.coinReward, result.requestedCoinReward ?? result.rewards.coins)}`,
    `PvP 전적: 신청자 **${result.challenger.rpg.pvpWins}승 ${result.challenger.rpg.pvpLosses}패**, 상대 **${result.opponent.rpg.pvpWins}승 ${result.opponent.rpg.pvpLosses}패**`
  ];

  if (levelText) rows.push(levelText.trim());

  return rows.join('\n');
}

function formatRpgPvpTurnSummary(turn) {
  if (turn.action === 'potion' || turn.skillId === 'potion') {
    return `**${formatRpgFighterName(turn.attacker)}**의 **회복 포션** · HP +${turn.healed}`;
  }

  const effectText = formatRpgStatusEffect(turn.statusEffect);
  return `**${formatRpgFighterName(turn.attacker)}**의 **${turn.skillLabel}** · 주사위 ${turn.roll} · 피해 **-${turn.damage} HP**${effectText ? ` · ${effectText}` : ''}`;
}

function formatRpgFighterName(fighter = {}) {
  const mention = String(fighter.mention ?? '').trim();
  if (fighter.username && mention && mention !== '[object Object]') return `${fighter.username} ${mention}`;
  if (fighter.username && fighter.userId) return `${fighter.username} <@${fighter.userId}>`;
  if (fighter.username) return fighter.username;
  if (mention && mention !== '[object Object]') return mention;
  if (fighter.userId) return `<@${fighter.userId}>`;
  return '전투원';
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
    level: profile.level,
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

function formatRpgPvpBlocked(challenge, result) {
  const blockedMention = result.blockedUserId === challenge.challenger.userId
    ? challenge.challenger.mention
    : challenge.opponent.mention;

  return [
    `⏳ **RPG PvP 대결 불가**`,
    `${blockedMention}님은 아직 전투 대기 중입니다.`,
    `남은 시간: **${formatDuration(result.remainingMs)}**`,
    '잠시 후 다시 대결을 신청하세요.'
  ].join('\n');
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

  return [
    `🎮 **RPG 메인 허브 · 스마트 허브** — ${user.username}`,
    `🧙 캐릭터: **${genderConfig.label} ${classConfig.label}${advancedText}** · 지역 **${currentArea.label}** · 전투력 **${adventureGuide.powerScore}**`,
    `📈 Lv.${profile.level} ${adventureGuide.levelProgress.bar} **${adventureGuide.levelProgress.current}/${adventureGuide.levelProgress.required} XP** (${adventureGuide.levelProgress.percent}%)`,
    `❤️ HP **${profile.rpg.hp}/${derivedStats.maxHp}** · 🔷 MP **${profile.rpg.mp}/${derivedStats.maxMp}** · 🪙 골드 **${getRpgGold(profile).toLocaleString()}**`,
    `💰 오늘 RPG 반복 보상: ${dailyGoldText}`,
    `🌟 궁극기 게이지 ${formatRpgMeter(profile.rpg.ultimateCharge, 100)} **${profile.rpg.ultimateCharge}/100**${profile.rpg.ultimateCharge >= 100 ? ' · 사용 준비 완료' : ''}`,
    `🎯 메인 목표: **${adventureGuide.mainObjective.label}** — ${adventureGuide.mainObjective.progressText}`,
    `➡️ 다음 행동: **${adventureGuide.recommendedAction.label}** · 버튼 또는 \`${adventureGuide.recommendedAction.command}\``,
    `   └ ${adventureGuide.recommendedAction.reason}`,
    `⚙️ 행동 가능: ${actionAvailabilityText}`,
    `🗺️ ${nextAreaText}`,
    '',
    `📋 오늘 의뢰: ${dailySummary}`,
    '',
    `**스마트 추천**`,
    formatRpgSmartRecommendationSummary(status),
    '',
    '**버튼 배치**',
    '첫 줄은 지금 할 만한 추천 행동입니다.',
    '아래 허브에서 `전투`, `모험`, `성장`, `관리`, `오늘 할 일`만 골라 들어가면 됩니다.'
  ].join('\n');
}

function formatRpgSectionMenu(user, status, section) {
  const { profile, currentArea, derivedStats, adventureGuide } = status;
  const sectionConfig = getRpgMenuSectionConfig(section);
  const hpText = `${profile.rpg.hp}/${derivedStats.maxHp}`;
  const mpText = `${profile.rpg.mp}/${derivedStats.maxMp}`;

  return [
    `${sectionConfig.emoji} **RPG ${sectionConfig.label} 메뉴** — ${user.username}`,
    `현재 지역 **${currentArea.label}** · Lv.${profile.level} · 전투력 **${adventureGuide.powerScore}** · HP **${hpText}** · MP **${mpText}**`,
    `다음 추천: **${adventureGuide.recommendedAction.label}** — ${adventureGuide.recommendedAction.reason}`,
    '',
    sectionConfig.description,
    '',
    `빠른 판단: ${formatRpgSmartRecommendationSummary(status)}`
  ].join('\n');
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
  const pvpWinRate = profile.rpg.pvpBattles === 0
    ? 0
    : Math.round((profile.rpg.pvpWins / profile.rpg.pvpBattles) * 100);
  const cooldownText = cooldownRemainingMs > 0
    ? `전투 대기: **${formatDuration(cooldownRemainingMs)}**`
    : '전투 가능: **지금 가능**';
  const dailyGoldText = formatRpgDailyGoldLimit(status.dailyGold);
  const actionAvailabilityText = formatRpgActionAvailability(status.actionAvailability);
  const discoveredCount = Object.keys(profile.rpg.discoveredMonsters).length;
  const advancedText = advancedClassConfig ? ` / 전직: **${advancedClassConfig.label}**` : '';

  return [
    `📜 **${user.username}님의 RPG 상태**`,
    `레벨: **Lv.${profile.level}** / 경험치: **${profile.totalXp.toLocaleString()} XP**`,
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
    `스킬 포인트: **${status.skillPoints.available}/${status.skillPoints.earned} 사용 가능** / 전리품 장비: **${Object.keys(profile.rpg.gearInventory).length}개**`,
    `해금 직업: **${profile.rpg.unlockedClasses.length}개** / 사용 가능 스킬: **${availableSkillIds.length}개**`,
    `해금 지역: **${unlockedAreas.map((area) => area.label).join(', ')}**`,
    `전적: **${profile.rpg.wins}승 ${profile.rpg.losses}패 / ${profile.rpg.battles}전**`,
    `PvP: **${profile.rpg.pvpWins}승 ${profile.rpg.pvpLosses}패 / ${profile.rpg.pvpBattles}전** (승률 ${pvpWinRate}%)`,
    `승률: **${winRate}%** / 발견 몬스터: **${discoveredCount}종**`,
    `가챠: **${profile.rpg.gacha.totalPulls.toLocaleString()}회** / 천장 카운트: **${profile.rpg.gacha.pity.toLocaleString()}**`,
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
    ? `\n🎉 레벨업! Lv.${result.profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    '📋 **일일 의뢰 보상 수령**',
    `의뢰: **${result.mission.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `오늘 완료한 의뢰: **${Object.keys(result.profile.rpg.daily.claimedMissions).length.toLocaleString()}개**`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
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

function formatRpgInventory(status) {
  const { profile, derivedStats } = status;
  const inventoryRows = Object.entries(profile.rpg.inventory)
    .map(([itemId, count]) => `- **${getRpgItemConfig(itemId).label}** × ${count.toLocaleString()}`);
  const equipmentRows = Object.entries(profile.rpg.equipment)
    .map(([slot, itemId]) => `- ${formatEquipmentSlot(slot)}: **${itemId ? getRpgItemConfig(itemId).label : '없음'}**`);
  const gearRows = Object.entries(profile.rpg.equippedGear)
    .map(([slot, gearId]) => {
      const gear = gearId ? profile.rpg.gearInventory[gearId] : null;
      return `- ${formatEquipmentSlot(slot)} 전리품: **${gear ? formatGearLabel(gear) : '없음'}**`;
    });

  return [
    `🎒 **RPG 인벤토리**`,
    `HP: **${profile.rpg.hp.toLocaleString()} / ${derivedStats.maxHp.toLocaleString()}**`,
    `MP: **${profile.rpg.mp.toLocaleString()} / ${derivedStats.maxMp.toLocaleString()}**`,
    `궁극기 게이지: ${formatRpgMeter(profile.rpg.ultimateCharge, 100)} **${profile.rpg.ultimateCharge}/100**`,
    `공격력: **${derivedStats.attack}** / 방어력: **${derivedStats.defense}**`,
    `장비:\n${equipmentRows.join('\n')}`,
    `전리품 장비:\n${gearRows.join('\n')}`,
    `아이템:\n${inventoryRows.length > 0 ? inventoryRows.join('\n') : '- 비어 있음'}`,
    '',
    '아래 선택 메뉴로 포션 사용, 장비 장착, 아이템 판매를 바로 처리할 수 있습니다.'
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
  const gears = getSortedRpgGears(status)
    .slice(0, 10);
  const rows = gears.map((gear, index) => {
    const equipped = Object.values(status.profile.rpg.equippedGear).includes(gear.id) ? ' ✅장착중' : '';
    const statsText = formatGearStats(gear.stats);
    return `- **${index + 1}. ${formatGearLabel(gear)}** / ${formatEquipmentSlot(gear.slot)}${statsText ? ` / ${statsText}` : ''}${equipped}`;
  });

  return [
    '🧰 **RPG 전리품 장비**',
    rows.length > 0 ? rows.join('\n') : '- 보유한 전리품 장비가 없습니다. `/rpg 던전` 또는 `/rpg 레이드`로 획득하세요.',
    '',
    rows.length > 0
      ? '아래 선택 메뉴를 쓰거나 `/rpg 전리품 장비:1`처럼 번호로 장착할 수 있습니다. 필요 없는 전리품은 `분해` 메뉴에서 강화석으로 바꾸세요.'
      : '전리품을 얻으면 여기서 선택 메뉴로 바로 장착할 수 있습니다.'
  ].join('\n');
}

function formatRpgEquipGear(result) {
  return [
    `🧰 **전리품 장착**`,
    `슬롯: **${formatEquipmentSlot(result.slot)}**`,
    `장비: **${formatGearLabel(result.gear)}**`,
    `옵션: ${formatGearStats(result.gear.stats)}`,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
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
    rows.length > 0 ? rows.join('\n') : '- 강화할 전리품 장비가 없습니다. `/rpg 던전` 또는 `/rpg 레이드`로 획득하세요.',
    '',
    rows.length > 0
      ? '아래 선택 메뉴를 쓰거나 `/rpg 장비강화 장비:1`처럼 번호로 강화할 수 있습니다.'
      : '전리품을 얻으면 여기서 선택 메뉴로 강화할 수 있습니다.'
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
    '♻️ **RPG 전리품 분해**',
    `강화석: **${status.profile.rpg.inventory.enhancement_stone ?? 0}개**`,
    rows.length > 0 ? rows.join('\n') : '- 분해할 전리품 장비가 없습니다.',
    '',
    rows.length > 0
      ? '장착 중인 전리품은 실수 방지를 위해 분해 선택지에서 제외합니다.'
      : '던전/레이드에서 전리품을 얻은 뒤 다시 열어보세요.'
  ].join('\n');
}

function formatRpgDisassembleGear(result) {
  return [
    '♻️ **RPG 전리품 분해 완료**',
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
    result.gearDrop ? `🧰 획득 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    result.leveledUp ? `🎉 레벨업 Lv.${result.profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🧭 **RPG 탐험 결과** — ${user}`,
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
  const rows = result.floors.map((floor) =>
    `${floor.floor}층 ${floor.eventLabel}: +${floor.rewards.xp} XP, +${floor.rewards.coins}골드${floor.damageTaken ? `, 피해 ${floor.damageTaken}` : ''}`
  );
  const rewardRows = [
    result.gearDrop ? `🧰 클리어 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    result.leveledUp ? `🎉 레벨업 Lv.${result.profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🏰 **RPG 던전 결과** — ${user}`,
    `📍 지역: **${result.areaConfig.label}** · 깊이 **${result.depth}층**`,
    rows.join('\n'),
    `🎁 합계: +${result.totalXp.toLocaleString()} XP, +${formatRpgGoldReward(result.totalCoins, result.requestedTotalCoins)} · 피해 **${result.totalDamage.toLocaleString()}**`,
    rewardRows.length > 0 ? rewardRows.join('\n') : null,
    formatRpgPostActionState(result.profile),
    `📊 던전 클리어: **${result.profile.rpg.dungeonClears[result.area].toLocaleString()}회**`,
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
    `현재 레벨: **Lv.${profile.level}** / 스탯 공격력 **${derivedStats.attack}** · 방어력 **${derivedStats.defense}** · HP **${derivedStats.maxHp}** · MP **${derivedStats.maxMp}**`,
    rows.join('\n'),
    '',
    '전직 가능한 항목은 아래 선택 메뉴로 바로 진행할 수 있습니다.'
  ].join('\n');
}

function formatRpgAdvanceClass(result) {
  return [
    `🛡️ **전직 완료**`,
    `전직: **${result.advancedClassConfig.label}**`,
    result.advancedClassConfig.description,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
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
    `현재 레벨: **Lv.${profile.level}**`,
    nextText,
    '',
    '이제 지역 옵션을 비우고 `/rpg 탐험`, `/rpg 전투`, `/rpg 던전`을 실행하면 현재 지역에서 진행됩니다.'
  ].join('\n');
}

function formatRpgStory(status) {
  const rows = status.storyChapters.map((chapter) => {
    const state = chapter.completed ? '✅ 완료' : chapter.canProgress ? '✨ 진행 가능' : '🔒 조건 미달';
    return `- **${chapter.label}** — ${state} · 진행도 ${formatRpgProgress(chapter.current, chapter.required)}\n  ${chapter.description}`;
  });

  return [
    '📖 **RPG 스토리 로그**',
    rows.join('\n'),
    '',
    '진행 가능한 챕터는 선택 메뉴로 바로 완료할 수 있습니다. 명령어를 쓸 때도 한글 챕터 이름을 선택하세요.'
  ].join('\n');
}

function formatRpgStoryProgress(result) {
  const itemRewards = Object.entries(result.rewards.items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${result.profile.level}` : '';

  return [
    `📖 **스토리 완료**`,
    `챕터: **${result.chapter.label}**`,
    result.chapter.description,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
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
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${result.profile.level}` : '';

  return [
    `📚 **도감 보상 수령**`,
    `몬스터: **${result.codex.monster}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
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
    result.gearDrop ? `🧰 레이드 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐉 **RPG 레이드 결과** — ${user}`,
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
    result.gearDrop ? `🧰 길드 레이드 전리품 **${formatGearLabel(result.gearDrop)}**` : null,
    ultimateChargeText,
    result.leveledUp ? `🎉 레벨업 Lv.${profile.level} / 보너스 +${formatRpgGoldReward(result.levelReward, result.levelRewardRequested)}` : null,
    formatRpgRewardCapHint(result)
  ].filter(Boolean);

  return [
    `🐉 **RPG 길드 레이드 결과** — ${user}`,
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

function formatRpgQuestClaim(result) {
  const itemRewards = Object.entries(result.rewards.items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}골드`
    : '';

  return [
    `✅ **퀘스트 보상 수령**`,
    `퀘스트: **${result.quest.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}골드${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 골드: **${getRpgGold(result.profile).toLocaleString()}골드**${levelText}`
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
    const row = `${area.current ? '📍' : area.unlocked ? '✅' : '🔒'} **${area.label}** · ${state} · 탐사 ${area.progress}% ${area.progressBar} · XP×${area.xpMultiplier}/골드×${area.coinMultiplier}`;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(row);
  }

  const tierRows = [...tiers.entries()].map(([tier, rows]) => [
    `**${tier}**`,
    rows.join('\n')
  ].join('\n'));

  return [
    '🗺️ **RPG 월드맵 · 사냥터 선택**',
    `현재 지역: **${status.currentArea.label}**`,
    `추천 사냥터: **${recommendedArea.label}** — 지금 해금된 가장 높은 보상 배율 지역`,
    nextLockedArea
      ? `다음 해금: **${nextLockedArea.label}** Lv.${nextLockedArea.unlockLevel}+`
      : '다음 해금: 모든 지역 개방 완료',
    '',
    tierRows.join('\n\n'),
    '',
    '선택 가이드 / 버튼 가이드: ✅ 이동 가능 / 📍 현재 지역 / 🔒 잠김. 아래 선택 메뉴나 빠른 버튼으로 이동하고, 이동 후 `/rpg 전투`, `/rpg 탐험`, `/rpg 던전`의 기본 지역이 바뀝니다.'
  ].filter(Boolean).join('\n');
}

async function replyWithRpgAssets(interaction, content, assetIds = [], extraPayload = {}) {
  await sendRpgAssets(interaction, 'reply', content, assetIds, extraPayload);
}

async function updateWithRpgAssets(interaction, content, assetIds = [], extraPayload = {}) {
  await sendRpgAssets(interaction, 'update', content, assetIds, extraPayload);
}

async function replyWithRpgCard(interaction, content, extraPayload = {}) {
  await interaction.reply(createRpgVisualPayload(content, [], extraPayload));
}

async function updateWithRpgCard(interaction, content, extraPayload = {}) {
  await interaction.update(createRpgVisualPayload(content, [], extraPayload));
}

async function sendRpgAssets(interaction, method, content, assetIds = [], extraPayload = {}) {
  const files = assetIds
    .filter(Boolean)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .map((assetId) => getRpgAssetAttachment(assetId))
    .filter(Boolean)
    // Embed cards can display one main image plus one thumbnail; extra files show as loose image dumps.
    .slice(0, 2);

  await interaction[method](createRpgVisualPayload(content, files, extraPayload));
}

function createRpgVisualPayload(content, files, extraPayload = {}) {
  const [rawTitle, ...bodyLines] = String(content).split('\n');
  const title = rawTitle.replace(/\*\*/g, '').slice(0, 256);
  const description = bodyLines.join('\n').trim() || rawTitle;
  const embed = new EmbedBuilder()
    .setColor(getRpgEmbedColor(title, description))
    .setTitle(title)
    .setDescription(truncateEmbedText(description))
    .setFooter({ text: 'RPG 카드 · 아래 메뉴/버튼으로 다음 행동을 이어가세요' });

  if (files[0]) {
    embed.setImage(`attachment://${files[0].name}`);
  }
  if (files[1]) {
    embed.setThumbnail(`attachment://${files[1].name}`);
  }

  return {
    embeds: [embed],
    files,
    ...extraPayload
  };
}

function getRpgEmbedColor(title, description) {
  const text = `${title}\n${description}`;

  if (/실패|패배|불가|만료|거절/.test(text)) return 0xef4444;
  if (/완료|승리|보상|학습|장착|전직|구매/.test(text)) return 0x22c55e;
  if (/상점|가챠|골드/.test(text)) return 0xf59e0b;
  if (/월드맵|탐험|지역|스토리/.test(text)) return 0x38bdf8;
  if (/전투|보스|레이드|대결|PvP/.test(text)) return 0xa855f7;

  return 0x7c3aed;
}

function truncateEmbedText(text) {
  const normalized = String(text || '').trim();
  return normalized.length > 4096
    ? `${normalized.slice(0, 4092)}…`
    : normalized;
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

function createRpgPvpChallengeRow(challengeId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rpg_pvp_accept:${challengeId}`)
      .setLabel('RPG 대결 수락')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`rpg_pvp_decline:${challengeId}`)
      .setLabel('거절')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createRpgPvpActionRow(session) {
  const active = session.fighters[session.turnSide];
  const buttons = active.availableSkillIds.slice(0, 4).map((skillId) => {
    const skill = getRpgSkillConfig(skillId);
    const costText = skill.mpCost > 0 ? ` (${skill.mpCost}MP)` : '';

    return new ButtonBuilder()
      .setCustomId(`rpg_pvp_action:${session.id}:${skillId}`)
      .setLabel(`${skill.label}${costText}`)
      .setStyle(skillId === 'basic' ? ButtonStyle.Primary : ButtonStyle.Success)
      .setDisabled(active.mp < skill.mpCost);
  });

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`rpg_pvp_action:${session.id}:potion`)
      .setLabel(`포션 (${active.inventory?.potion ?? 0})`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled((active.inventory?.potion ?? 0) <= 0 || active.hp >= active.maxHp)
  );

  return new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
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

  return new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
}

function createRpgStartRows(status, userId) {
  const genderOptions = getRpgGenderOptions();
  const options = status.profile.rpg.unlockedClasses
    .flatMap((classId) => genderOptions.map((gender) => {
      const classConfig = getRpgClassConfig(classId);
      return createRpgSelectOption(
        `${gender.name} ${classConfig.label}`,
        `${classId}|${gender.value}`,
        `${classConfig.description} · 공격 ${classConfig.attackBonus >= 0 ? '+' : ''}${classConfig.attackBonus}`
      );
    }));

  return createRpgSelectRows(userId, 'start', '성별과 직업을 한 번에 선택하세요', options);
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
  return createRpgCompactViewRows([
    ...createRpgUsableItemRows(status, userId),
    ...createRpgEquipmentRows(status, userId),
    ...createRpgItemSellRows(status, userId)
  ], userId);
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

  return createRpgSelectRows(userId, 'gear_equip', '장착할 전리품을 선택하세요', options);
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

  return createRpgSelectRows(userId, 'gear_enhance', '강화할 전리품을 선택하세요', options);
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

  return createRpgSelectRows(userId, 'gear_disassemble', '분해할 전리품을 선택하세요', options);
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
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`rpg_raid_lobby:cancel:${lobby.id}`)
        .setLabel('취소')
        .setStyle(ButtonStyle.Secondary)
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

  return createRpgSelectRows(userId, 'story', '진행할 스토리 챕터를 선택하세요', options);
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
    description: '탐험, 월드맵 이동, 스토리, 도감처럼 지역 진행과 기록을 이어가는 메뉴입니다.'
  }),
  growth: Object.freeze({
    label: '성장',
    emoji: '📈',
    description: '장비 장착, 전리품 관리, 강화, 스킬, 전직처럼 캐릭터를 강하게 만드는 메뉴입니다.'
  }),
  manage: Object.freeze({
    label: '관리',
    emoji: '🎒',
    description: '상태, 인벤토리, 상점, 도감을 한곳에서 확인하는 정비 메뉴입니다.'
  }),
  today: Object.freeze({
    label: '오늘 할 일',
    emoji: '✅',
    description: '일일 의뢰, 퀘스트, 스토리, 도감 보상처럼 오늘 먼저 챙길 보상을 모았습니다.'
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
    add('gear', `🛡️ 전리품 ${gearCount}개 확인`, ButtonStyle.Primary);
  }
  if (progressableStoryCount > 0) {
    add('story', `📖 스토리 진행 ${progressableStoryCount}개`, ButtonStyle.Primary);
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
  const raidLocked = status.profile.level < getRpgRaidConfig('slime_horde').unlockLevel;
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
      createRpgQuickButton(userId, 'story', hasStoryProgress ? '📖 스토리 진행' : '📖 스토리', ButtonStyle.Primary),
      createRpgQuickButton(userId, 'codex', hasCodexClaim ? '📚 도감 보상' : '📚 도감', ButtonStyle.Success),
      createRpgQuickButton(userId, 'menu', '🎮 허브', ButtonStyle.Secondary)
    ]);
  }

  if (section === 'growth') {
    return createButtonRows([
      createRpgQuickButton(userId, 'gear', hasGear ? '🛡️ 전리품 장착' : '🛡️ 전리품 없음', ButtonStyle.Primary, !hasGear),
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
    createRpgQuickButton(userId, 'story', hasStoryProgress ? '📖 스토리 진행' : '📖 스토리', ButtonStyle.Primary),
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
      createRpgQuickButton(userId, 'growth', '📈 성장', ButtonStyle.Primary),
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

function createButtonRows(buttons) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.slice(index, index + 5)));
  }
  return rows;
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

function shortenButtonLabel(label, maxLength = 70) {
  return label.length > maxLength
    ? `${label.slice(0, maxLength - 1)}…`
    : label;
}

function formatRpgProgress(current, required) {
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeRequired = Math.max(1, Number(required) || 1);
  const cappedCurrent = Math.min(safeCurrent, safeRequired);
  const percent = Math.round((cappedCurrent / safeRequired) * 100);
  const filled = Math.round((percent / 100) * 8);
  const bar = '▰'.repeat(filled) + '▱'.repeat(8 - filled);

  return `${bar} **${safeCurrent.toLocaleString()}/${safeRequired.toLocaleString()}** (${percent}%)`;
}

function formatRpgRewardSummary(rewards = {}) {
  const parts = [];
  if (rewards.xp) parts.push(`+${rewards.xp.toLocaleString()} XP`);
  if (rewards.coins) parts.push(`+${rewards.coins.toLocaleString()}골드`);
  const itemText = formatRewardItems(rewards.items);
  if (itemText) parts.push(itemText);
  return parts.join(', ') || '없음';
}

function formatGachaRarity(rarity) {
  return {
    ssr: 'SSR 전설',
    sr: 'SR 희귀',
    r: 'R 일반'
  }[rarity] ?? String(rarity).toUpperCase();
}

function formatDailyMissionSummary(dailyMissions = []) {
  const claimable = dailyMissions.filter((mission) => mission.canClaim);
  const claimed = dailyMissions.filter((mission) => mission.claimed).length;

  if (claimable.length > 0) {
    return `🎁 보상 가능 **${claimable.length}개** (${claimable.map((mission) => mission.label).join(', ')})`;
  }

  return `완료 **${claimed}/${dailyMissions.length}개**`;
}

function formatRewardItems(items = {}) {
  return Object.entries(items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
}

function getRpgGold(profile) {
  return profile.balance ?? profile.currencyBalances?.main ?? profile.currencyBalances?.rpg ?? 0;
}

function formatRpgGoldReward(granted, requested = granted) {
  const safeGranted = Math.max(0, Number(granted) || 0);
  const safeRequested = Math.max(safeGranted, Number(requested ?? safeGranted) || 0);
  const grantedText = `${safeGranted.toLocaleString()}골드`;

  if (safeRequested <= safeGranted) {
    return grantedText;
  }

  return `${grantedText} (일일 상한 적용, 원래 ${safeRequested.toLocaleString()}골드)`;
}

function formatRpgDailyGoldLimit(dailyGold) {
  if (!dailyGold) {
    return '정보 없음';
  }

  const cap = Math.max(0, Number(dailyGold.cap) || 0);
  const earned = Math.max(0, Number(dailyGold.earned) || 0);
  const remaining = Math.max(0, Number(dailyGold.remaining) || 0);
  const state = remaining > 0 ? `남은 ${remaining.toLocaleString()}골드` : '상한 도달';

  return `**${earned.toLocaleString()} / ${cap.toLocaleString()}골드** (${state})`;
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

function assertValidRpgPvpTarget(user, target) {
  if (target.bot) {
    throw new Error('봇과는 RPG 대결을 할 수 없습니다.');
  }

  if (target.id === user.id) {
    throw new Error('자기 자신과는 RPG 대결을 할 수 없습니다.');
  }
}

function createRpgPvpChallengeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
