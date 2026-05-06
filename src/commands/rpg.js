import { SlashCommandBuilder } from 'discord.js';
import {
  getRpgAdvancedClassOptions,
  getRpgAreaOptions,
  getRpgBossOptions,
  getRpgClassOptions,
  getRpgDifficultyOptions,
  getRpgEquipmentItemOptions,
  getRpgGachaBannerOptions,
  getRpgGenderOptions,
  getRpgItemConfig,
  getRpgQuestOptions,
  getRpgRaidOptions,
  getRpgShopItemOptions,
  getRpgSkillTreeOptions,
  getRpgSkillOptions,
  getRpgStoryChapterOptions,
  getRpgUsableItemOptions
} from '../systems/rpg.js';
import {
  formatRpgAssetLine,
  getRpgAssetAttachment,
  getRpgAssetBatch,
  getRpgAssetCount
} from '../systems/rpg-assets.js';
import { formatDuration } from './economy.js';

const ASSET_FILTER_CHOICES = Object.freeze([
  { name: '전체', value: 'all' },
  { name: '스프라이트', value: 'sprite' },
  { name: '맵', value: 'map' },
  { name: '영웅', value: 'hero' },
  { name: '몬스터', value: 'monster' },
  { name: '아이템', value: 'item' }
]);

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
            .setDescription('시작 직업')
            .setRequired(true)
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
            .setDescription('장착할 아이템')
            .setRequired(true)
            .addChoices(...getRpgEquipmentItemOptions())
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('전리품')
        .setDescription('랜덤 옵션 전리품 장비를 확인하거나 장착합니다.')
        .addStringOption((option) =>
          option
            .setName('장비id')
            .setDescription('장착할 전리품 장비 ID. 비우면 목록을 봅니다.')
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
            .setDescription('선택할 상위 직업')
            .setRequired(true)
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
        .setDescription('RPG 지역과 해금 조건을 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('에셋')
        .setDescription('agent-sprite-forge로 생성할 RPG 이미지 에셋 배치를 확인합니다.')
        .addStringOption((option) =>
          option
            .setName('종류')
            .setDescription('확인할 에셋 종류')
            .addChoices(...ASSET_FILTER_CHOICES)
        )
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('표시할 에셋 개수')
            .setMinValue(1)
            .setMaxValue(10)
        )
    )
];

export function getRpgCommandPayloads() {
  return rpgCommands.map((command) => command.toJSON());
}

export async function handleRpgCommand(interaction, economy) {
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
    const characterClass = interaction.options.getString('직업', true);
    const characterGender = interaction.options.getString('성별') ?? 'male';
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
    const area = interaction.options.getString('지역') ?? 'forest';
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

  if (subcommand === '탐험') {
    const area = interaction.options.getString('지역') ?? 'forest';

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
    const area = interaction.options.getString('지역') ?? 'forest';
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
    const itemId = interaction.options.getString('아이템', true);

    try {
      const result = await economy.equipRpgItem({
        guildId,
        userId: user.id,
        username: user.username,
        itemId
      });
      await replyWithRpgAssets(interaction, formatRpgEquipItem(result), [result.item.assetId]);
    } catch (error) {
      await interaction.reply({
        content: `장비 장착 실패: ${error.message}`,
        ephemeral: true
      });
    }

    return true;
  }

  if (subcommand === '전리품') {
    const gearId = interaction.options.getString('장비id');

    if (!gearId) {
      const status = await economy.getRpgStatus({
        guildId,
        userId: user.id,
        username: user.username
      });
      await interaction.reply(formatRpgGearInventory(status));
      return true;
    }

    try {
      const result = await economy.equipRpgGear({
        guildId,
        userId: user.id,
        username: user.username,
        gearId
      });
      await replyWithRpgAssets(interaction, formatRpgEquipGear(result), [result.gear.assetId]);
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
    const advancedClass = interaction.options.getString('전직', true);

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
    const status = await economy.getRpgStatus({
      guildId,
      userId: user.id,
      username: user.username
    });
    await interaction.reply(formatRpgAreas(status));
    return true;
  }

  if (subcommand === '에셋') {
    const filter = interaction.options.getString('종류') ?? 'all';
    const limit = interaction.options.getInteger('개수') ?? 8;
    await interaction.reply(formatAssetBatch(filter, limit));
    return true;
  }

  return false;
}

function formatRpgStart(user, result) {
  const { classConfig, genderConfig, heroAssetId, profile } = result;

  return [
    `🧭 **RPG 시작** — ${user}`,
    `직업: **${classConfig.label}** (${classConfig.description})`,
    `성별: **${genderConfig.label}**`,
    `전투력 보너스: **+${classConfig.powerBonus}**`,
    `영웅 이미지 에셋: \`${heroAssetId}\``,
    `현재 레벨: **Lv.${profile.level}** / 경험치: **${profile.totalXp.toLocaleString()} XP**`,
    `HP/MP: **${profile.rpg.hp.toLocaleString()} / ${profile.rpg.mp.toLocaleString()}**`
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
    ? `\n🧰 전리품: **${formatGearLabel(result.gearDrop)}** (\`${result.gearDrop.id}\`)`
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
    `이미지 에셋: 배경 \`${battle.assets.background}\` / 영웅 \`${battle.assets.hero}\` / 몬스터 \`${battle.assets.monster}\``,
    `전적: ${profile.rpg.wins}승 ${profile.rpg.losses}패 / 총 ${profile.rpg.battles}전`,
    `현재 잔액: **${profile.balance.toLocaleString()}원**${dropText}${gearText}${levelText}`
  ].join('\n');
}

function formatRpgStatus(user, status) {
  const {
    profile,
    cooldownRemainingMs,
    classConfig,
    genderConfig,
    advancedClassConfig,
    heroAssetId,
    currentArea,
    unlockedAreas,
    derivedStats,
    availableSkillIds
  } = status;
  const winRate = profile.rpg.battles === 0
    ? 0
    : Math.round((profile.rpg.wins / profile.rpg.battles) * 100);
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
    `영웅 이미지 에셋: \`${heroAssetId}\``,
    `스킬 포인트: **${status.skillPoints.available}/${status.skillPoints.earned} 사용 가능** / 전리품 장비: **${Object.keys(profile.rpg.gearInventory).length}개**`,
    `해금 직업: **${profile.rpg.unlockedClasses.length}개** / 사용 가능 스킬: **${availableSkillIds.length}개**`,
    `해금 지역: **${unlockedAreas.map((area) => area.label).join(', ')}**`,
    `전적: **${profile.rpg.wins}승 ${profile.rpg.losses}패 / ${profile.rpg.battles}전**`,
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
  const gears = Object.values(status.profile.rpg.gearInventory)
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0))
    .slice(0, 10);
  const rows = gears.map((gear) => {
    const equipped = Object.values(status.profile.rpg.equippedGear).includes(gear.id) ? ' ✅장착중' : '';
    return `- \`${gear.id}\` **${formatGearLabel(gear)}** ${formatGearStats(gear.stats)}${equipped}`;
  });

  return [
    '🧰 **RPG 전리품 장비**',
    rows.length > 0 ? rows.join('\n') : '- 보유한 전리품 장비가 없습니다. `/rpg 던전` 또는 `/rpg 레이드`로 획득하세요.',
    '',
    '장착: `/rpg 전리품 장비id:<gear_id>`'
  ].join('\n');
}

function formatRpgEquipGear(result) {
  return [
    `🧰 **전리품 장착**`,
    `슬롯: **${formatEquipmentSlot(result.slot)}**`,
    `장비: **${formatGearLabel(result.gear)}** (\`${result.gear.id}\`)`,
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
    ? `\n🧰 획득 전리품: **${formatGearLabel(result.gearDrop)}** (\`${result.gearDrop.id}\`)`
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
    ? `\n🧰 클리어 전리품: **${formatGearLabel(result.gearDrop)}** (\`${result.gearDrop.id}\`)`
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

function formatRpgAdvanceClass(result) {
  return [
    `🛡️ **전직 완료**`,
    `전직: **${result.advancedClassConfig.label}**`,
    result.advancedClassConfig.description,
    `공격력: **${result.derivedStats.attack}** / 방어력: **${result.derivedStats.defense}** / 최대 HP: **${result.derivedStats.maxHp}** / 최대 MP: **${result.derivedStats.maxMp}**`
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
    ? `\n🧰 레이드 전리품: **${formatGearLabel(result.gearDrop)}** (\`${result.gearDrop.id}\`)`
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
    `피해: -${battle.damageTaken.toLocaleString()} HP / 현재 HP: **${profile.rpg.hp.toLocaleString()}** / MP: **${profile.rpg.mp.toLocaleString()}**`,
    `이미지 에셋: 배경 \`${battle.assets.background}\` / 영웅 \`${battle.assets.hero}\` / 보스 \`${battle.assets.monster}\`${gearText}${levelText}`
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
  const rows = getRpgAreaOptions().map((option) => {
    const unlocked = unlockedAreaIds.has(option.value);
    return `${unlocked ? '✅' : '🔒'} **${option.name}** — ${unlocked ? '입장 가능' : '레벨 부족'}`;
  });

  return `🗺️ **RPG 지역**\n${rows.join('\n')}`;
}

function formatAssetBatch(filter, limit) {
  const { kind, category } = splitAssetFilter(filter);
  const assets = getRpgAssetBatch({ kind, category, limit });
  const body = assets.map(formatRpgAssetLine).join('\n');
  const firstPrompt = assets[0]
    ? `\n\n첫 번째 생성 프롬프트:\n\`\`\`\n${assets[0].prompt}\n\`\`\``
    : '';

  return [
    `🎨 **RPG 이미지 에셋 배치** (${assets.length}/${getRpgAssetCount()}개 표시)`,
    '설치한 agent-sprite-forge 기준으로 아래 skill을 배치 반복 실행하면 됩니다.',
    body || '표시할 에셋이 없습니다.',
    firstPrompt
  ].join('\n');
}

function splitAssetFilter(filter) {
  if (['sprite', 'map'].includes(filter)) {
    return { kind: filter, category: 'all' };
  }

  if (['hero', 'monster', 'item'].includes(filter)) {
    return { kind: 'all', category: filter };
  }

  return { kind: 'all', category: 'all' };
}

async function replyWithRpgAssets(interaction, content, assetIds = []) {
  const files = assetIds
    .filter(Boolean)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .map((assetId) => getRpgAssetAttachment(assetId))
    .filter(Boolean)
    .slice(0, 10);

  if (files.length === 0) {
    await interaction.reply(content);
    return;
  }

  await interaction.reply({ content, files });
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

function formatGearLabel(gear) {
  return `${gear.rarityLabel ?? gear.rarity} ${gear.label.replace(/^(일반|희귀|영웅|전설) /, '')}`;
}

function formatGearStats(stats = {}) {
  return Object.entries(stats)
    .filter(([, value]) => value > 0)
    .map(([stat, value]) => `${formatStatName(stat)} +${value}`)
    .join(', ');
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
