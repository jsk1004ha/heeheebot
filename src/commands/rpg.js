import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import {
  getRpgAdvancedClassConfig,
  getRpgAdvancedClassOptions,
  getRpgAreaConfig,
  getRpgAreaOptions,
  getRpgBossOptions,
  getRpgClassConfig,
  getRpgClassOptions,
  getRpgDifficultyOptions,
  getRpgEquipmentItemOptions,
  getRpgGachaBannerOptions,
  getRpgGenderConfig,
  getRpgGenderOptions,
  getRpgItemConfig,
  getRpgQuestOptions,
  getRpgRaidOptions,
  getRpgShopItemOptions,
  getRpgSkillConfig,
  getRpgSkillTreeOptions,
  getRpgSkillOptions,
  getRpgStoryChapterOptions,
  getRpgUsableItemOptions
} from '../systems/rpg.js';
import {
  getRpgAssetAttachment
} from '../systems/rpg-assets.js';
import { formatDuration } from './economy.js';

const RPG_PVP_CHALLENGE_TTL_MS = 60_000;
const RPG_PVP_SESSION_TTL_MS = 10 * 60_000;
const pendingRpgPvpChallenges = new Map();
const activeRpgPvpSessions = new Map();

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
            .setDescription('시작 직업. 비우면 직업/성별 선택 버튼을 봅니다.')
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
        .setDescription('강력한 보스에게 도전합니다.')
        .addStringOption((option) =>
          option
            .setName('보스')
            .setDescription('도전할 보스')
            .setRequired(true)
            .addChoices(...getRpgBossOptions())
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
            .setDescription('장착할 아이템. 비우면 보유 장비 버튼을 봅니다.')
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
            .setDescription('장착할 전리품 번호/이름. 비우면 버튼 목록을 봅니다.')
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
    if (interaction.customId.startsWith('rpg_item_equip:')) {
      return handleRpgItemEquipButton(interaction, economy);
    }
    if (interaction.customId.startsWith('rpg_gear_equip:')) {
      return handleRpgGearEquipButton(interaction, economy);
    }
    return handleRpgPvpButton(interaction, economy);
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
      await interaction.reply({
        content: formatRpgCharacterCreation(user, status),
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

      await replyWithRpgAssets(interaction, formatBattleResult(user, result), getBattleAssetIds(result));
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
      await replyWithRpgAssets(interaction, formatRpgExplore(user, result), getExploreAssetIds(result));
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
      await replyWithRpgAssets(interaction, formatRpgDungeon(user, result), getDungeonAssetIds(result));
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
    const skill = interaction.options.getString('스킬') ?? 'basic';

    try {
      const result = await economy.playRpgBossBattle({
        guildId,
        userId: user.id,
        username: user.username,
        bossId,
        skill
      });

      if (!result.battled) {
        await interaction.reply({
          content: `⏳ 아직 다시 전투할 수 없습니다. 남은 시간: ${formatDuration(result.remainingMs)}`,
          ephemeral: true
        });
        return true;
      }

      await replyWithRpgAssets(interaction, formatBattleResult(user, result), getBattleAssetIds(result));
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
      await interaction.reply(formatRpgShop());
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
      await replyWithRpgAssets(interaction, formatRpgPurchase(result), [result.item.assetId]);
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
    await interaction.reply(formatRpgInventory(status));
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
      await interaction.reply({
        content: formatRpgEquipmentGuide(status),
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
      await interaction.reply(formatRpgEquipItem(result));
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
      await interaction.reply({
        content: formatRpgGearInventory(status),
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
      await interaction.reply(formatRpgEquipGear(result));
    } catch (error) {
      await interaction.reply({
        content: `전리품 장착 실패: ${error.message}`,
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
      await interaction.reply(formatRpgQuests(status));
      return true;
    }

    try {
      const result = await economy.claimRpgQuest({
        guildId,
        userId: user.id,
        username: user.username,
        questId
      });
      await interaction.reply(formatRpgQuestClaim(result));
    } catch (error) {
      await interaction.reply({
        content: `퀘스트 보상 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '휴식') {
    const result = await economy.restRpg({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatRpgRest(result));
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
      await interaction.reply(formatRpgSkillTree(status));
      return true;
    }

    try {
      const result = await economy.learnRpgSkill({
        guildId,
        userId: user.id,
        username: user.username,
        skillId
      });
      await interaction.reply(formatRpgLearnSkill(result));
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
      await interaction.reply({
        content: formatRpgClassPath(status),
        components: createRpgAdvanceRows(status, user.id)
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
      await replyWithRpgAssets(interaction, formatRpgAdvanceClass(result), [result.heroAssetId]);
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
      await interaction.reply(formatRpgStory(status));
      return true;
    }

    try {
      const result = await economy.progressRpgStory({
        guildId,
        userId: user.id,
        username: user.username,
        chapterId
      });
      await interaction.reply(formatRpgStoryProgress(result));
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
      await interaction.reply(formatRpgCodex(status));
      return true;
    }

    try {
      const result = await economy.claimRpgCodex({
        guildId,
        userId: user.id,
        username: user.username,
        monsterName
      });
      await replyWithRpgAssets(interaction, formatRpgCodexClaim(result), [result.codex.assetId]);
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
      await replyWithRpgAssets(interaction, formatRpgRaid(user, result), getBattleAssetIds(result));
    } catch (error) {
      await interaction.reply({
        content: `레이드 실패: ${error.message}`,
        ephemeral: true
      });
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
        await replyWithRpgAssets(interaction, formatRpgAreaEnter(result), [result.areaConfig.backgroundAssetId]);
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
    await interaction.reply({
      content: formatRpgAreas(status),
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
      mention: `${interaction.user}`
    },
    opponent: {
      userId: target.id,
      username: target.username,
      mention: `${target}`
    },
    createdAt: Date.now()
  };

  pendingRpgPvpChallenges.set(challengeId, challenge);

  await interaction.reply({
    content: formatRpgPvpChallenge(challenge),
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
    await interaction.update({
      content: `🛡️ ${challenge.opponent.mention}님이 RPG 대결을 거절했습니다.`,
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
      await interaction.update({
        content: formatRpgPvpBlocked(challenge, result),
        components: []
      });
      return true;
    }

    activeRpgPvpSessions.set(result.session.id, result.session);
    await interaction.update({
      content: formatRpgPvpTurnBoard(challenge, result),
      components: [createRpgPvpActionRow(result.session)]
    });
  } catch (error) {
    await interaction.update({
      content: `RPG 대결 실패: ${error.message}`,
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
      await interaction.update({
        content: formatRpgPvpResult(result),
        components: []
      });
      return true;
    }

    activeRpgPvpSessions.set(sessionId, result.session);
    await interaction.update({
      content: formatRpgPvpTurnBoard(null, result),
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
    await interaction.update({
      content: formatRpgEquipItem(result),
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `장비 장착 실패: ${error.message}`,
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
    await interaction.update({
      content: formatRpgEquipGear(result),
      components: []
    });
  } catch (error) {
    await interaction.reply({
      content: `전리품 장착 실패: ${error.message}`,
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
    '아래 버튼에서 **성별 + 직업**을 한 번에 고르면 바로 적용됩니다.',
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
    ? `보상: +${result.xpGained.toLocaleString()} XP, +${result.coinReward.toLocaleString()}원`
    : '보상: 없음';
  const monsterPowerText = battle.defenseBonus > 0
    ? `${battle.monsterPower} → ${battle.mitigatedMonsterPower} (방어 적용)`
    : `${battle.monsterPower}`;
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}원`
    : '';
  const dropText = result.drop
    ? `\n🎁 드랍: **${result.drop.label}** × ${result.drop.quantity}`
    : '';
  const gearText = result.gearDrop
    ? `\n🧰 전리품: **${formatGearLabel(result.gearDrop)}**`
    : '';

  return [
    `⚔️ **RPG 전투** — ${user}`,
    `지역: **${battle.areaLabel}** / 난이도: **${battle.difficultyLabel}** / 직업: **${battle.characterClassLabel}** / 성별: **${battle.characterGenderLabel}**`,
    `스킬: **${battle.skillLabel}** (MP -${battle.skillMpCost})`,
    `몬스터: **${battle.monster}**`,
    `내 전투력: ${battle.playerPower} (Lv.${battle.playerLevel}, 주사위 ${battle.playerRoll}, 장비 +${battle.attackBonus})`,
    `몬스터 전투력: ${monsterPowerText}`,
    `결과: **${outcomeText}**`,
    rewardText,
    `피해: -${battle.damageTaken.toLocaleString()} HP / 현재 HP: **${profile.rpg.hp.toLocaleString()}** / MP: **${profile.rpg.mp.toLocaleString()}**`,
    `전적: ${profile.rpg.wins}승 ${profile.rpg.losses}패 / 총 ${profile.rpg.battles}전`,
    `현재 잔액: **${profile.balance.toLocaleString()}원**${dropText}${gearText}${levelText}`
  ].join('\n');
}

function formatRpgPvpChallenge(challenge) {
  return [
    `⚔️ **RPG PvP 대결 신청**`,
    `${challenge.opponent.mention}, ${challenge.challenger.mention}님이 RPG 대결을 신청했습니다!`,
    '60초 안에 수락하면 포켓몬 배틀처럼 번갈아 스킬 버튼을 눌러 직접 싸웁니다.',
    '패배해도 돈은 잃지 않고, 승자만 보상을 받습니다.'
  ].join('\n');
}

function formatRpgPvpTurnBoard(challenge, result) {
  const { session } = result;
  const active = session.fighters[session.turnSide];
  const challenger = session.fighters.challenger;
  const opponent = session.fighters.opponent;
  const lastTurnText = result.turn
    ? [
        '',
        `최근 행동: **${result.turn.attacker.characterClassLabel}**의 **${result.turn.skillLabel}**`,
        `주사위 ${result.turn.roll} / 피해 **-${result.turn.damage} HP**`
      ].join('\n')
    : '';
  const introText = challenge
    ? `\n${challenge.opponent.mention}님이 수락했습니다.`
    : '';

  return [
    `⚔️ **RPG 턴제 PvP**${introText}`,
    `${challenger.mention}: **Lv.${challenger.level} ${challenger.characterClassLabel}** HP **${challenger.hp}/${challenger.maxHp}** / MP **${challenger.mp}/${challenger.maxMp}**`,
    `${opponent.mention}: **Lv.${opponent.level} ${opponent.characterClassLabel}** HP **${opponent.hp}/${opponent.maxHp}** / MP **${opponent.mp}/${opponent.maxMp}**`,
    `현재 턴: ${session.turn}턴 — ${active.mention}님이 스킬을 선택하세요.${lastTurnText}`
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
    ? `\n🎉 승자 레벨업! Lv.${winnerProfile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}원`
    : '';

  const rows = [
    `⚔️ **RPG 턴제 PvP 결과**`,
    `마지막 행동: **${turn.attacker.characterClassLabel}**의 **${turn.skillLabel}** / 주사위 ${turn.roll} / 피해 **-${turn.damage} HP**`,
    `${challenger.mention}: HP **${challenger.hp}/${challenger.maxHp}** / MP **${challenger.mp}/${challenger.maxMp}**`,
    `${opponent.mention}: HP **${opponent.hp}/${opponent.maxHp}** / MP **${opponent.mp}/${opponent.maxMp}**`,
    `승자: **${winnerFighter.mention}**`,
    `승리 보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}원`,
    `PvP 전적: 신청자 **${result.challenger.rpg.pvpWins}승 ${result.challenger.rpg.pvpLosses}패**, 상대 **${result.opponent.rpg.pvpWins}승 ${result.opponent.rpg.pvpLosses}패**`
  ];

  if (levelText) rows.push(levelText.trim());

  return rows.join('\n');
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
  const winRate = profile.rpg.battles === 0
    ? 0
    : Math.round((profile.rpg.wins / profile.rpg.battles) * 100);
  const pvpWinRate = profile.rpg.pvpBattles === 0
    ? 0
    : Math.round((profile.rpg.pvpWins / profile.rpg.pvpBattles) * 100);
  const cooldownText = cooldownRemainingMs > 0
    ? `전투 대기: **${formatDuration(cooldownRemainingMs)}**`
    : '전투 가능: **지금 가능**';
  const discoveredCount = Object.keys(profile.rpg.discoveredMonsters).length;
  const advancedText = advancedClassConfig ? ` / 전직: **${advancedClassConfig.label}**` : '';

  return [
    `📜 **${user.username}님의 RPG 상태**`,
    `레벨: **Lv.${profile.level}** / 경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `HP: **${profile.rpg.hp.toLocaleString()} / ${derivedStats.maxHp.toLocaleString()}**`,
    `MP: **${profile.rpg.mp.toLocaleString()} / ${derivedStats.maxMp.toLocaleString()}**`,
    `스탯: 공격력 **${derivedStats.attack}** / 방어력 **${derivedStats.defense}**`,
    `직업: **${classConfig.label}**${advancedText} / 성별: **${genderConfig.label}** / 현재 지역: **${currentArea.label}**`,
    `스킬 포인트: **${status.skillPoints.available}/${status.skillPoints.earned} 사용 가능** / 전리품 장비: **${Object.keys(profile.rpg.gearInventory).length}개**`,
    `해금 직업: **${profile.rpg.unlockedClasses.length}개** / 사용 가능 스킬: **${availableSkillIds.length}개**`,
    `해금 지역: **${unlockedAreas.map((area) => area.label).join(', ')}**`,
    `전적: **${profile.rpg.wins}승 ${profile.rpg.losses}패 / ${profile.rpg.battles}전**`,
    `PvP: **${profile.rpg.pvpWins}승 ${profile.rpg.pvpLosses}패 / ${profile.rpg.pvpBattles}전** (승률 ${pvpWinRate}%)`,
    `승률: **${winRate}%** / 발견 몬스터: **${discoveredCount}종**`,
    `가챠: **${profile.rpg.gacha.totalPulls.toLocaleString()}회** / 천장 카운트: **${profile.rpg.gacha.pity.toLocaleString()}**`,
    cooldownText,
    `보유금: **${profile.balance.toLocaleString()}원**`
  ].join('\n');
}

function formatRpgShop() {
  const rows = getRpgShopItemOptions().map((option) => {
    const item = getRpgItemConfig(option.value);
    return `- \`${option.value}\` **${item.label}** — ${item.price.toLocaleString()}원 / ${item.description}`;
  });

  return `🏪 **RPG 상점**\n${rows.join('\n')}\n\n구매: \`/rpg 상점 아이템:<이름> 수량:<개수>\``;
}

function formatRpgPurchase(result) {
  return [
    `🛒 **구매 완료**`,
    `아이템: **${result.item.label}** × ${result.quantity.toLocaleString()}`,
    `사용 금액: **${result.totalPrice.toLocaleString()}원**`,
    `현재 보유금: **${result.profile.balance.toLocaleString()}원**`
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
    `공격력: **${derivedStats.attack}** / 방어력: **${derivedStats.defense}**`,
    `장비:\n${equipmentRows.join('\n')}`,
    `전리품 장비:\n${gearRows.join('\n')}`,
    `아이템:\n${inventoryRows.length > 0 ? inventoryRows.join('\n') : '- 비어 있음'}`
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
      ? '아래 버튼을 눌러 바로 장착할 수 있습니다.'
      : '장비를 구매한 뒤 `/rpg 장비`를 다시 실행하면 버튼이 표시됩니다.'
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
      ? '아래 버튼을 누르거나 `/rpg 전리품 장비:1`처럼 번호로 장착할 수 있습니다.'
      : '전리품을 얻으면 여기서 버튼으로 바로 장착할 수 있습니다.'
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

function formatRpgQuests(status) {
  const rows = status.quests.map((quest) => {
    const state = quest.claimed ? '완료' : quest.canClaim ? '보상 가능' : '진행 중';
    return `- \`${quest.id}\` **${quest.label}** — ${state} (${quest.current}/${quest.required}) / 보상 ${quest.rewards.xp} XP, ${quest.rewards.coins}원`;
  });

  return `📜 **RPG 퀘스트**\n${rows.join('\n')}\n\n보상 받기: \`/rpg 퀘스트 퀘스트:<이름>\``;
}

function formatRpgRest(result) {
  return [
    `🛏️ **휴식 완료**`,
    `HP 회복: **${result.healed.toLocaleString()}** / MP 회복: **${result.mpRestored.toLocaleString()}**`,
    `현재 HP/MP: **${result.profile.rpg.hp.toLocaleString()} / ${result.derivedStats.maxHp.toLocaleString()} HP**, **${result.profile.rpg.mp.toLocaleString()} / ${result.derivedStats.maxMp.toLocaleString()} MP**`
  ].join('\n');
}

function formatRpgExplore(user, result) {
  const gearText = result.gearDrop
    ? `\n🧰 획득 전리품: **${formatGearLabel(result.gearDrop)}**`
    : '';
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.level}`
    : '';

  return [
    `🧭 **RPG 탐험** — ${user}`,
    `지역: **${result.exploration.areaLabel}** / 이벤트: **${result.exploration.eventLabel}**`,
    result.exploration.description,
    `보상: +${result.xpGained.toLocaleString()} XP, +${result.coinReward.toLocaleString()}원`,
    `HP: ${result.beforeHp.toLocaleString()} → **${result.profile.rpg.hp.toLocaleString()}** / MP: ${result.beforeMp.toLocaleString()} → **${result.profile.rpg.mp.toLocaleString()}**`,
    `누적 탐험: **${result.profile.rpg.explores.toLocaleString()}회**${gearText}${levelText}`
  ].join('\n');
}

function formatRpgDungeon(user, result) {
  const rows = result.floors.map((floor) =>
    `${floor.floor}층 ${floor.eventLabel}: +${floor.rewards.xp} XP, +${floor.rewards.coins}원${floor.damageTaken ? `, 피해 ${floor.damageTaken}` : ''}`
  );
  const gearText = result.gearDrop
    ? `\n🧰 클리어 전리품: **${formatGearLabel(result.gearDrop)}**`
    : '';
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${result.profile.level}` : '';

  return [
    `🏰 **RPG 던전** — ${user}`,
    `지역: **${result.areaConfig.label}** / 깊이: **${result.depth}층**`,
    rows.join('\n'),
    `합계: +${result.totalXp.toLocaleString()} XP, +${result.totalCoins.toLocaleString()}원 / 피해 ${result.totalDamage.toLocaleString()}`,
    `현재 HP/MP: **${result.profile.rpg.hp.toLocaleString()} / ${result.profile.rpg.mp.toLocaleString()}**`,
    `던전 클리어: **${result.profile.rpg.dungeonClears[result.area].toLocaleString()}회**${gearText}${levelText}`
  ].join('\n');
}

function formatRpgGacha(result) {
  const rows = result.pulls.map((pull, index) => {
    const rewardText = formatGachaReward(pull);
    return `${index + 1}. **${pull.rarity.toUpperCase()}** — ${rewardText}`;
  });

  return [
    `✨ **${result.banner.label} 결과** × ${result.count}`,
    `사용 금액: **${result.totalCost.toLocaleString()}원** / 남은 보유금: **${result.profile.balance.toLocaleString()}원**`,
    ...rows,
    `총 가챠: **${result.profile.rpg.gacha.totalPulls.toLocaleString()}회** / 천장 카운트: **${result.profile.rpg.gacha.pity.toLocaleString()}**`
  ].join('\n');
}

function formatGachaReward(pull) {
  const reward = pull.reward;

  if (reward.type === 'class') {
    const suffix = pull.newUnlock
      ? ' 해금!'
      : ` 중복 보상 +${pull.duplicateCompensation?.toLocaleString() ?? 0}원`;
    return `직업 \`${reward.classId}\`${suffix}`;
  }

  return `${getRpgItemConfig(reward.itemId).label} × ${reward.quantity ?? 1}`;
}

function formatRpgSkillTree(status) {
  const rows = status.skillTree.map((skill) => {
    const state = skill.learned ? '✅ 습득' : skill.canLearn ? '✨ 학습 가능' : skill.classAllowed ? '대기' : '직업 불가';
    return `- \`${skill.id}\` **${skill.label}** — ${state} / ${skill.description}`;
  });

  return [
    `🌟 **RPG 스킬트리**`,
    `스킬 포인트: **${status.skillPoints.available}점 사용 가능** / 획득 ${status.skillPoints.earned}점 / 사용 ${status.skillPoints.spent}점`,
    rows.join('\n'),
    '',
    '학습: `/rpg 스킬트리 스킬:<이름>`'
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
  const rows = getRpgAdvancedClassOptions().map((option) => {
    const advanced = getRpgAdvancedClassConfig(option.value);
    const baseClass = getRpgClassConfig(advanced.baseClass);
    const isCurrent = profile.rpg.advancedClass === option.value;
    const isSameLineage = profile.rpg.characterClass === advanced.baseClass;
    const levelReady = profile.level >= advanced.unlockLevel;
    const state = isCurrent
      ? '✅ 현재 전직'
      : !isSameLineage
        ? `${baseClass.label} 계열 전용`
        : levelReady
          ? '✨ 전직 가능'
          : `🔒 Lv.${advanced.unlockLevel} 필요`;

    return `- **${advanced.label}** — ${baseClass.label} Lv.${advanced.unlockLevel}+ / ${advanced.description} / ${state}`;
  });
  const currentAdvanced = advancedClassConfig
    ? ` → **${advancedClassConfig.label}**`
    : '';

  return [
    '🧬 **RPG 전직 트리**',
    `현재 계열: **${classConfig.label}**${currentAdvanced}`,
    `현재 레벨: **Lv.${profile.level}** / 스탯 공격력 **${derivedStats.attack}** · 방어력 **${derivedStats.defense}** · HP **${derivedStats.maxHp}** · MP **${derivedStats.maxMp}**`,
    rows.join('\n'),
    '',
    '전직 가능한 항목은 아래 버튼으로 바로 진행할 수 있습니다.'
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
    `보상 배율: XP ×${areaConfig.xpMultiplier} / 돈 ×${areaConfig.coinMultiplier}`,
    `현재 레벨: **Lv.${profile.level}**`,
    nextText,
    '',
    '이제 지역 옵션을 비우고 `/rpg 탐험`, `/rpg 전투`, `/rpg 던전`을 실행하면 현재 지역에서 진행됩니다.'
  ].join('\n');
}

function formatRpgStory(status) {
  const rows = status.storyChapters.map((chapter) => {
    const state = chapter.completed ? '완료' : chapter.canProgress ? '진행 가능' : '조건 미달';
    return `- \`${chapter.id}\` **${chapter.label}** — ${state} (${chapter.current}/${chapter.required}) / ${chapter.description}`;
  });

  return `📖 **RPG 스토리**\n${rows.join('\n')}\n\n진행: \`/rpg 스토리 챕터:<이름>\``;
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
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}원${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 보유금: **${result.profile.balance.toLocaleString()}원**${levelText}`
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
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}원`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 보유금: **${result.profile.balance.toLocaleString()}원**${levelText}`
  ].join('\n');
}

function formatRpgRaid(user, result) {
  const { battle, profile } = result;
  const outcomeText = battle.win ? '승리' : '패배';
  const gearText = result.gearDrop
    ? `\n🧰 레이드 전리품: **${formatGearLabel(result.gearDrop)}**`
    : '';
  const levelText = result.leveledUp ? `\n🎉 레벨업! Lv.${profile.level}` : '';

  return [
    `🐉 **RPG 레이드** — ${user}`,
    `레이드: **${battle.raidLabel}** / 지역: **${battle.areaLabel}**`,
    `스킬: **${battle.skillLabel}** (MP -${battle.skillMpCost})`,
    `파티 전투력: ${battle.playerPower} (내 주사위 ${battle.playerRoll}, 지원 ${battle.allyPower}, 보너스 +${battle.attackBonus})`,
    `레이드 전투력: ${battle.monsterPower} → ${battle.mitigatedMonsterPower}`,
    `결과: **${outcomeText}**`,
    battle.win
      ? `보상: +${result.xpGained.toLocaleString()} XP, +${result.coinReward.toLocaleString()}원`
      : '보상: 없음',
    `피해: -${battle.damageTaken.toLocaleString()} HP / 현재 HP: **${profile.rpg.hp.toLocaleString()}** / MP: **${profile.rpg.mp.toLocaleString()}**${gearText}${levelText}`
  ].join('\n');
}

function formatRpgQuestClaim(result) {
  const itemRewards = Object.entries(result.rewards.items)
    .map(([itemId, count]) => `${getRpgItemConfig(itemId).label} × ${count}`)
    .join(', ');
  const levelText = result.leveledUp
    ? `\n🎉 레벨업! Lv.${result.profile.level} / 레벨 보너스 +${result.levelReward.toLocaleString()}원`
    : '';

  return [
    `✅ **퀘스트 보상 수령**`,
    `퀘스트: **${result.quest.label}**`,
    `보상: +${result.rewards.xp.toLocaleString()} XP, +${result.rewards.coins.toLocaleString()}원${itemRewards ? `, ${itemRewards}` : ''}`,
    `현재 경험치: **${result.profile.totalXp.toLocaleString()} XP** / 보유금: **${result.profile.balance.toLocaleString()}원**${levelText}`
  ].join('\n');
}

function formatRpgAreas(status) {
  const unlockedAreaIds = new Set(status.unlockedAreas.map((area) => area.id));
  const currentAreaId = status.profile.rpg.currentArea;
  const rows = getRpgAreaOptions().map((option) => {
    const area = getRpgAreaConfig(option.value);
    const unlocked = unlockedAreaIds.has(option.value);
    const current = option.value === currentAreaId ? ' 📍현재' : '';
    const state = unlocked ? `입장 가능${current}` : `🔒 Lv.${area.unlockLevel} 필요`;
    return `${unlocked ? '✅' : '🔒'} **${area.label}** — ${state} / XP ×${area.xpMultiplier}, 돈 ×${area.coinMultiplier}\n  ${area.description}`;
  });

  return [
    '🗺️ **RPG 월드맵**',
    `현재 지역: **${status.currentArea.label}**`,
    rows.join('\n'),
    '',
    '아래 버튼으로 지역을 이동하면 이후 `/rpg 탐험`, `/rpg 전투`, `/rpg 던전`의 기본 지역이 바뀝니다.'
  ].join('\n');
}

async function replyWithRpgAssets(interaction, content, assetIds = []) {
  await sendRpgAssets(interaction, 'reply', content, assetIds);
}

async function updateWithRpgAssets(interaction, content, assetIds = [], extraPayload = {}) {
  await sendRpgAssets(interaction, 'update', content, assetIds, extraPayload);
}

async function sendRpgAssets(interaction, method, content, assetIds = [], extraPayload = {}) {
  const files = assetIds
    .filter(Boolean)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .map((assetId) => getRpgAssetAttachment(assetId))
    .filter(Boolean)
    .slice(0, 10);

  if (files.length === 0) {
    await interaction[method]({ content, ...extraPayload });
    return;
  }

  await interaction[method](createRpgVisualPayload(content, files, extraPayload));
}

function createRpgVisualPayload(content, files, extraPayload = {}) {
  const [rawTitle, ...bodyLines] = String(content).split('\n');
  const title = rawTitle.replace(/\*\*/g, '').slice(0, 256);
  const description = bodyLines.join('\n').trim() || rawTitle;
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle(title)
    .setDescription(truncateEmbedText(description));

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
  const buttons = active.availableSkillIds.map((skillId) => {
    const skill = getRpgSkillConfig(skillId);
    const costText = skill.mpCost > 0 ? ` (${skill.mpCost}MP)` : '';

    return new ButtonBuilder()
      .setCustomId(`rpg_pvp_action:${session.id}:${skillId}`)
      .setLabel(`${skill.label}${costText}`)
      .setStyle(skillId === 'basic' ? ButtonStyle.Primary : ButtonStyle.Success)
      .setDisabled(active.mp < skill.mpCost);
  });

  return new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
}

function createRpgStartRows(status, userId) {
  const genderOptions = getRpgGenderOptions();
  const buttons = status.profile.rpg.unlockedClasses
    .flatMap((classId) => genderOptions.map((gender) => {
      const classConfig = getRpgClassConfig(classId);
      return new ButtonBuilder()
        .setCustomId(`rpg_start:${userId}:${classId}:${gender.value}`)
        .setLabel(`${gender.name} ${classConfig.label}`)
        .setStyle(gender.value === 'female' ? ButtonStyle.Primary : ButtonStyle.Secondary);
    }));

  return createButtonRows(buttons);
}

function createRpgAdvanceRows(status, userId) {
  const buttons = getRpgAdvancedClassOptions()
    .filter((option) => {
      const advanced = getRpgAdvancedClassConfig(option.value);
      return status.profile.rpg.characterClass === advanced.baseClass
        && status.profile.level >= advanced.unlockLevel
        && status.profile.rpg.advancedClass !== option.value;
    })
    .map((option) => {
      const advanced = getRpgAdvancedClassConfig(option.value);
      return new ButtonBuilder()
        .setCustomId(`rpg_advance:${userId}:${option.value}`)
        .setLabel(`${advanced.label} 전직`)
        .setStyle(ButtonStyle.Success);
    });

  return createButtonRows(buttons);
}

function createRpgAreaRows(status, userId) {
  const currentAreaId = status.profile.rpg.currentArea;
  const buttons = status.unlockedAreas.map((area) =>
    new ButtonBuilder()
      .setCustomId(`rpg_area:${userId}:${area.id}`)
      .setLabel(area.id === currentAreaId ? `${area.label} 체류중` : `${area.label} 이동`)
      .setStyle(area.id === currentAreaId ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(area.id === currentAreaId)
  );

  return createButtonRows(buttons);
}

function createRpgEquipmentRows(status, userId) {
  const buttons = getOwnedRpgEquipmentItems(status)
    .slice(0, 10)
    .map(({ itemId, item }) =>
      new ButtonBuilder()
        .setCustomId(`rpg_item_equip:${userId}:${itemId}`)
        .setLabel(`${item.label} 장착`)
        .setStyle(ButtonStyle.Primary)
    );

  return createButtonRows(buttons);
}

function createRpgGearRows(status, userId) {
  const buttons = getSortedRpgGears(status)
    .slice(0, 10)
    .map((gear, index) =>
      new ButtonBuilder()
        .setCustomId(`rpg_gear_equip:${userId}:${gear.id}`)
        .setLabel(`${index + 1}. ${shortenButtonLabel(formatGearLabel(gear))}`)
        .setStyle(ButtonStyle.Primary)
    );

  return createButtonRows(buttons);
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
