const STARTER_CLASS_IDS = Object.freeze(['novice']);
const FIRST_JOB_CLASS_IDS = Object.freeze(['warrior', 'mage', 'ranger', 'paladin', 'priest', 'rogue', 'tazza', 'blacksmith']);
const RPG_DAY_MS = 24 * 60 * 60 * 1000;
const RPG_CLASS_MASTERY_BASE_REQUIRED = 50;

const RPG_GENDERS = Object.freeze({
  male: Object.freeze({
    label: '남캐',
    description: '남성 캐릭터 외형'
  }),
  female: Object.freeze({
    label: '여캐',
    description: '여성 캐릭터 외형'
  })
});

const RPG_CLASSES = Object.freeze({
  novice: Object.freeze({
    label: '모험가',
    description: '왕국 길드에 막 등록한 범용 초보 직업. Lv.10에 1차 전직을 선택합니다.',
    role: '초보자',
    powerBonus: 0,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 0,
    primaryStats: Object.freeze(['힘', '체력']),
    assetId: 'hero_adventurer_idle',
    assetIds: Object.freeze({
      male: 'hero_adventurer_idle',
      female: 'hero_female_adventurer_idle'
    }),
    starter: true,
    firstJob: false
  }),
  warrior: Object.freeze({
    label: '검사',
    description: '안정적인 근접 딜러. 연속 베기, 반격, 차단으로 보스 패턴을 끊습니다.',
    role: '근접 딜러',
    powerBonus: 3,
    defenseBonus: 1,
    maxHpBonus: 10,
    maxMpBonus: 0,
    primaryStats: Object.freeze(['힘', '체력']),
    assetId: 'hero_warrior_idle',
    assetIds: Object.freeze({
      male: 'hero_warrior_idle',
      female: 'hero_female_warrior_idle'
    }),
    starter: false,
    firstJob: true
  }),
  mage: Object.freeze({
    label: '마법사',
    description: '마나 기반 광역 딜러. 화염, 냉기, 번개로 약점을 찌릅니다.',
    role: '광역 딜러',
    powerBonus: 2,
    defenseBonus: 0,
    maxHpBonus: -5,
    maxMpBonus: 30,
    primaryStats: Object.freeze(['지능', '정신']),
    assetId: 'hero_mage_idle',
    assetIds: Object.freeze({
      male: 'hero_mage_idle',
      female: 'hero_female_mage_idle'
    }),
    starter: false,
    firstJob: true
  }),
  ranger: Object.freeze({
    label: '궁수',
    description: '원거리 치명타 딜러. 약점 조준과 덫으로 비행/대형 적을 견제합니다.',
    role: '원거리 딜러',
    powerBonus: 2,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 10,
    primaryStats: Object.freeze(['민첩', '기술']),
    assetId: 'hero_ranger_idle',
    assetIds: Object.freeze({
      male: 'hero_ranger_idle',
      female: 'hero_female_ranger_idle'
    }),
    starter: false,
    firstJob: true
  }),
  paladin: Object.freeze({
    label: '성기사',
    description: '탱커/서포터. 도발, 보호막, 피해 분산으로 파티를 지킵니다.',
    role: '탱커/서포터',
    powerBonus: 2,
    defenseBonus: 4,
    maxHpBonus: 35,
    maxMpBonus: 15,
    primaryStats: Object.freeze(['체력', '정신']),
    assetId: 'hero_paladin_idle',
    assetIds: Object.freeze({
      male: 'hero_paladin_idle',
      female: 'hero_female_paladin_idle'
    }),
    starter: false,
    firstJob: true
  }),
  priest: Object.freeze({
    label: '성직자',
    description: '힐러/정화 담당. 회복, 정화, 성역으로 레이드 안정성을 높입니다.',
    role: '힐러/정화',
    powerBonus: 1,
    defenseBonus: 1,
    maxHpBonus: 10,
    maxMpBonus: 40,
    primaryStats: Object.freeze(['정신', '지능']),
    assetId: 'hero_priest_idle',
    assetIds: Object.freeze({
      male: 'hero_priest_idle',
      female: 'hero_female_priest_idle'
    }),
    starter: false,
    firstJob: true
  }),
  rogue: Object.freeze({
    label: '도적',
    description: '암살/회피 딜러. 은신, 독, 기습과 파밍 보너스에 강합니다.',
    role: '암살/회피 딜러',
    powerBonus: 4,
    defenseBonus: 0,
    maxHpBonus: -5,
    maxMpBonus: 10,
    primaryStats: Object.freeze(['민첩', '행운']),
    assetId: 'hero_rogue_idle',
    assetIds: Object.freeze({
      male: 'hero_rogue_idle',
      female: 'hero_female_rogue_idle'
    }),
    starter: false,
    firstJob: true
  }),
  tazza: Object.freeze({
    label: '타짜',
    description: '운 기반 트릭스터. 카드와 주사위로 전투를 지원하고 카지노 정산 금액 효과를 얻습니다.',
    role: '운 기반 트릭스터',
    powerBonus: 2,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 20,
    primaryStats: Object.freeze(['행운', '기술']),
    casinoWinMultiplier: 1.18,
    casinoLossMultiplier: 1.15,
    inactiveCasinoWinMultiplier: 1.07,
    inactiveCasinoLossMultiplier: 1.06,
    assetId: 'hero_tazza_idle',
    assetIds: Object.freeze({
      male: 'hero_tazza_idle',
      female: 'hero_female_tazza_idle'
    }),
    starter: false,
    firstJob: true
  }),
  blacksmith: Object.freeze({
    label: '대장장이',
    description: '제작/전투 보조. 망치, 방어구 파괴, 임시 강화, 장비 수리로 레이드를 돕습니다.',
    role: '제작/전투 보조',
    powerBonus: 3,
    defenseBonus: 2,
    maxHpBonus: 20,
    maxMpBonus: 5,
    primaryStats: Object.freeze(['기술', '힘']),
    assetId: 'hero_blacksmith_idle',
    assetIds: Object.freeze({
      male: 'hero_blacksmith_idle',
      female: 'hero_female_blacksmith_idle'
    }),
    starter: false,
    firstJob: true
  })
});

const RPG_SKILLS = Object.freeze({
  basic: Object.freeze({
    label: '기본 공격',
    description: 'MP를 쓰지 않는 기본 공격입니다.',
    mpCost: 0,
    attackBonus: 0,
    defenseBonus: 0,
    classes: Object.freeze(Object.keys(RPG_CLASSES))
  }),
  first_aid: Object.freeze({
    label: '응급 처치',
    description: '모험가 기본기. 피해를 줄이고 전투 후 회복 기회를 만듭니다.',
    mpCost: 4,
    attackBonus: 0,
    defenseBonus: 3,
    statusEffect: Object.freeze({ type: 'heal', label: '응급 처치', description: '상처를 묶어 버팁니다.' }),
    classes: Object.freeze(['novice', 'priest', 'paladin'])
  }),
  guard_stance: Object.freeze({
    label: '방어 자세',
    description: '1턴 동안 받는 피해를 줄이는 기본 방어기입니다.',
    mpCost: 3,
    attackBonus: 0,
    defenseBonus: 5,
    statusEffect: Object.freeze({ type: 'barrier', label: '방어 자세', description: '방패나 무기로 급소를 가립니다.' }),
    classes: Object.freeze(['novice', 'warrior', 'paladin', 'blacksmith'])
  }),
  weak_spot: Object.freeze({
    label: '약점 찌르기',
    description: '낮은 확률의 치명타를 노리는 모험가 기술입니다.',
    mpCost: 5,
    attackBonus: 3,
    defenseBonus: 0,
    statusEffect: Object.freeze({ type: 'vulnerable', label: '약점 노출', description: '적의 빈틈을 드러냅니다.' }),
    classes: Object.freeze(['novice', 'warrior', 'ranger', 'rogue'])
  }),
  combo_slash: Object.freeze({
    label: '연속 베기',
    description: '검사의 2연속 공격. 전투력 +6',
    mpCost: 8,
    attackBonus: 6,
    defenseBonus: 0,
    classes: Object.freeze(['warrior'])
  }),
  fireball: Object.freeze({
    label: '화염구',
    description: '마법사의 단일 화염 피해. 전투력 +7',
    mpCost: 10,
    attackBonus: 7,
    defenseBonus: 0,
    statusEffect: Object.freeze({ type: 'burn', label: '화상', description: '불길이 방어를 약화합니다.' }),
    classes: Object.freeze(['mage'])
  }),
  aimed_shot: Object.freeze({
    label: '약점 조준',
    description: '궁수의 정밀 사격. 전투력 +5',
    mpCost: 8,
    attackBonus: 5,
    defenseBonus: 0,
    statusEffect: Object.freeze({ type: 'pin', label: '조준 고정', description: '약점 사선을 확보합니다.' }),
    classes: Object.freeze(['ranger'])
  }),
  taunt: Object.freeze({
    label: '도발',
    description: '성기사의 도발. 전투력 +2, 방어 +7',
    mpCost: 9,
    attackBonus: 2,
    defenseBonus: 7,
    statusEffect: Object.freeze({ type: 'taunt', label: '도발', description: '적의 공격을 자신에게 집중시킵니다.' }),
    classes: Object.freeze(['paladin'])
  }),
  heal: Object.freeze({
    label: '치유',
    description: '성직자의 회복 주문. 전투력 +2, 방어 +6',
    mpCost: 10,
    attackBonus: 2,
    defenseBonus: 6,
    statusEffect: Object.freeze({ type: 'sanctuary', label: '치유', description: '빛으로 상처를 회복합니다.' }),
    classes: Object.freeze(['priest'])
  }),
  backstab: Object.freeze({
    label: '기습',
    description: '도적의 첫 턴 폭딜. 전투력 +8',
    mpCost: 9,
    attackBonus: 8,
    defenseBonus: 0,
    statusEffect: Object.freeze({ type: 'bleed', label: '출혈', description: '급소를 찔러 지속 피해를 줍니다.' }),
    classes: Object.freeze(['rogue'])
  }),
  card_draw: Object.freeze({
    label: '카드 뽑기',
    description: '타짜의 최소 보장 랜덤 카드 공격. 전투력 +5',
    mpCost: 8,
    attackBonus: 5,
    defenseBonus: 1,
    statusEffect: Object.freeze({ type: 'luck', label: '행운 카드', description: '실패해도 기본 피해는 보장됩니다.' }),
    classes: Object.freeze(['tazza'])
  }),
  fate_flip: Object.freeze({
    label: '운명 뒤집기',
    description: '실패 판정을 한 번 되굴리는 콘셉트의 파티 지원기. 전투력 +3, 방어 +4',
    mpCost: 12,
    attackBonus: 3,
    defenseBonus: 4,
    statusEffect: Object.freeze({ type: 'luck', label: '재굴림', description: '불리한 흐름을 한 번 뒤집습니다.' }),
    classes: Object.freeze(['tazza'])
  }),
  hammer_slam: Object.freeze({
    label: '망치 강타',
    description: '대장장이의 둔기 공격. 전투력 +5, 방어 +2',
    mpCost: 8,
    attackBonus: 5,
    defenseBonus: 2,
    statusEffect: Object.freeze({ type: 'stun', label: '기절', description: '육중한 망치로 행동을 지연시킵니다.' }),
    classes: Object.freeze(['blacksmith'])
  }),
  armor_break: Object.freeze({
    label: '방어구 파괴',
    description: '적 방어를 깎는 레이드 보조기. 전투력 +6',
    mpCost: 11,
    attackBonus: 6,
    defenseBonus: 0,
    statusEffect: Object.freeze({ type: 'vulnerable', label: '방어구 파괴', description: '보스 방어를 약화합니다.' }),
    classes: Object.freeze(['blacksmith'])
  })
});

const RPG_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    label: '쉬움',
    playerBonus: 2,
    monsterPowerMin: 4,
    monsterPowerMax: 12,
    xpMin: 35,
    xpMax: 80,
    coinReward: 80,
    monsters: Object.freeze(['슬라임', '회색 늑대', '들쥐'])
  }),
  normal: Object.freeze({
    label: '보통',
    playerBonus: 0,
    monsterPowerMin: 8,
    monsterPowerMax: 20,
    xpMin: 70,
    xpMax: 150,
    coinReward: 150,
    monsters: Object.freeze(['고블린', '숲거미', '박쥐'])
  }),
  hard: Object.freeze({
    label: '어려움',
    playerBonus: -2,
    monsterPowerMin: 16,
    monsterPowerMax: 34,
    xpMin: 120,
    xpMax: 240,
    coinReward: 300,
    monsters: Object.freeze(['오크 전사', '망령', '드레이크'])
  })
});

const RPG_AREAS = Object.freeze({
  forest: Object.freeze({
    label: '왕도 남쪽 초원',
    unlockLevel: 1,
    description: '슬라임, 늑대, 들쥐가 나오는 초보 모험가 사냥터',
    backgroundAssetId: 'map_royal_south_plains',
    coinMultiplier: 1,
    xpMultiplier: 1,
    monsters: Object.freeze({
      easy: Object.freeze(['슬라임', '회색 늑대', '들쥐']),
      normal: Object.freeze(['회색 늑대', '고블린 정찰병', '숲거미']),
      hard: Object.freeze(['고블린 전사', '숲거미', '오크 척후병'])
    })
  }),
  wildflower_plains: Object.freeze({
    label: '고블린 숲',
    unlockLevel: 5,
    description: '고블린과 숲거미가 자원을 숨겨둔 초반 숲',
    backgroundAssetId: 'map_goblin_forest',
    coinMultiplier: 1.08,
    xpMultiplier: 1.05,
    monsters: Object.freeze({
      easy: Object.freeze(['고블린 정찰병', '숲거미', '회색 늑대']),
      normal: Object.freeze(['고블린 전사', '숲거미', '독거미']),
      hard: Object.freeze(['고블린 주술사', '오크 척후병', '독거미'])
    })
  }),
  cave: Object.freeze({
    label: '버려진 은광',
    unlockLevel: 10,
    description: '박쥐와 광산 골렘이 지키는 광석 파밍 지역',
    backgroundAssetId: 'map_abandoned_silver_mine',
    coinMultiplier: 1.18,
    xpMultiplier: 1.12,
    monsters: Object.freeze({
      easy: Object.freeze(['박쥐', '광산 쥐', '고블린 광부']),
      normal: Object.freeze(['광산 골렘', '박쥐 떼', '고블린 광부']),
      hard: Object.freeze(['은광 골렘', '도적 광부', '오크 전사'])
    })
  }),
  moonlit_hill: Object.freeze({
    label: '안개 늪지',
    unlockLevel: 15,
    description: '독두꺼비와 늪지 망령이 떠도는 위험한 습지',
    backgroundAssetId: 'map_mist_marsh',
    coinMultiplier: 1.28,
    xpMultiplier: 1.2,
    monsters: Object.freeze({
      easy: Object.freeze(['독두꺼비', '늪지 쥐', '망령']),
      normal: Object.freeze(['늪지 망령', '독거미', '도적 정찰병']),
      hard: Object.freeze(['늪지 히드라 새끼', '망령 기사', '독두꺼비'])
    })
  }),
  marsh: Object.freeze({
    label: '도적단 요새',
    unlockLevel: 20,
    description: '도적, 암살자, 함정이 많은 인간형 전투 지역',
    backgroundAssetId: 'map_bandit_fortress',
    coinMultiplier: 1.4,
    xpMultiplier: 1.28,
    monsters: Object.freeze({
      easy: Object.freeze(['도적 정찰병', '도적 궁수', '고블린 전사']),
      normal: Object.freeze(['도적 암살자', '도적 방패병', '오크 전사']),
      hard: Object.freeze(['도적 두목', '암살자', '오크 전쟁병'])
    })
  }),
  mushroom_grove: Object.freeze({
    label: '저주받은 수도원',
    unlockLevel: 25,
    description: '스켈레톤과 망령이 배회하는 성직자 활약 지역',
    backgroundAssetId: 'map_cursed_monastery',
    coinMultiplier: 1.52,
    xpMultiplier: 1.36,
    monsters: Object.freeze({
      easy: Object.freeze(['스켈레톤', '망령', '타락한 수도사']),
      normal: Object.freeze(['스켈레톤 기사', '저주받은 사제', '망령']),
      hard: Object.freeze(['수도원 망령', '타락한 성기사', '언데드 군단'])
    })
  }),
  ruins: Object.freeze({
    label: '붉은 협곡',
    unlockLevel: 30,
    description: '오크와 와이번이 지키는 붉은 광석 협곡',
    backgroundAssetId: 'map_red_canyon',
    coinMultiplier: 1.65,
    xpMultiplier: 1.48,
    monsters: Object.freeze({
      easy: Object.freeze(['오크 전사', '협곡 늑대', '와이번 새끼']),
      normal: Object.freeze(['오크 돌격병', '와이번', '협곡 주술사']),
      hard: Object.freeze(['오크 전쟁군주 친위대', '붉은 와이번', '암석 골렘'])
    })
  }),
  bandit_outpost: Object.freeze({
    label: '얼어붙은 산맥',
    unlockLevel: 40,
    description: '서리정령과 설인이 버티는 냉기 저항 요구 지역',
    backgroundAssetId: 'map_frozen_mountains',
    coinMultiplier: 1.85,
    xpMultiplier: 1.68,
    monsters: Object.freeze({
      easy: Object.freeze(['설인', '서리 늑대', '얼음 박쥐']),
      normal: Object.freeze(['서리정령', '설인 전사', '빙결 골렘']),
      hard: Object.freeze(['서리 거인', '빙결 리치 하수인', '서리정령'])
    })
  }),
  red_desert: Object.freeze({
    label: '고대 엘프 유적',
    unlockLevel: 45,
    description: '정령과 고대 수호자가 룬석을 지키는 유적',
    backgroundAssetId: 'map_ancient_elf_ruins',
    coinMultiplier: 2.05,
    xpMultiplier: 1.9,
    monsters: Object.freeze({
      easy: Object.freeze(['숲 정령', '고대 수호자', '룬 박쥐']),
      normal: Object.freeze(['고대 수호자', '엘프 망령', '룬 골렘']),
      hard: Object.freeze(['고대 리치', '룬 골렘', '엘프 망령'])
    })
  }),
  volcano: Object.freeze({
    label: '용의 둥지',
    unlockLevel: 55,
    description: '드레이크와 용족이 화염 장비 재료를 드롭하는 상위 지역',
    backgroundAssetId: 'map_dragon_nest',
    coinMultiplier: 2.35,
    xpMultiplier: 2.18,
    monsters: Object.freeze({
      easy: Object.freeze(['드레이크', '화염 박쥐', '용혈 추종자']),
      normal: Object.freeze(['용족 전사', '드레이크', '화염 정령']),
      hard: Object.freeze(['검은 용의 파수꾼', '상급 드레이크', '용족 전사'])
    })
  }),
  thunder_plateau: Object.freeze({
    label: '마탑 지하서고',
    unlockLevel: 60,
    description: '마법사와 성직자가 활약하는 고난도 마법 지역',
    backgroundAssetId: 'map_wizard_tower_archive',
    coinMultiplier: 2.55,
    xpMultiplier: 2.35,
    monsters: Object.freeze({
      easy: Object.freeze(['마법서 정령', '룬 감시자', '마력 박쥐']),
      normal: Object.freeze(['마탑 골렘', '저주받은 마도사', '룬 감시자']),
      hard: Object.freeze(['공중 골렘', '대마도사의 환영', '저주받은 마도사'])
    })
  }),
  frost: Object.freeze({
    label: '마왕성 외곽',
    unlockLevel: 70,
    description: '악마와 타락 기사가 등장하는 엔드게임 전초지',
    backgroundAssetId: 'map_demon_king_outer_wall',
    coinMultiplier: 2.9,
    xpMultiplier: 2.7,
    monsters: Object.freeze({
      easy: Object.freeze(['악마 정찰병', '타락 기사', '암흑 사제']),
      normal: Object.freeze(['마왕군 기사', '악마 주술사', '타락 기사']),
      hard: Object.freeze(['마왕의 사도', '악몽의 기사', '악마 군단'])
    })
  }),
  crystal_lake: Object.freeze({
    label: '성지 아르덴',
    unlockLevel: 60,
    description: '성역과 부활 의식이 얽힌 고난도 성지',
    backgroundAssetId: 'map_sacred_arden',
    coinMultiplier: 2.5,
    xpMultiplier: 2.3,
    monsters: Object.freeze({
      easy: Object.freeze(['성지 수호자', '빛 정령', '타락한 순례자']),
      normal: Object.freeze(['성역 파수꾼', '타락한 성기사', '빛 정령']),
      hard: Object.freeze(['심판관의 그림자', '타락한 성기사', '성역 파수꾼'])
    })
  }),
  sky: Object.freeze({
    label: '왕국 수도 성벽',
    unlockLevel: 65,
    description: '서버 공동 방어전과 길드 활동의 거점',
    backgroundAssetId: 'map_royal_capital_wall',
    coinMultiplier: 2.65,
    xpMultiplier: 2.45,
    monsters: Object.freeze({
      easy: Object.freeze(['공성 고블린', '오크 투척병', '마왕군 척후병']),
      normal: Object.freeze(['공성 오크', '마왕군 기사', '악마 정찰병']),
      hard: Object.freeze(['공성 거인', '마왕군 기사', '악몽의 기사'])
    })
  }),
  phantom_forest: Object.freeze({
    label: '왕국 대장간 거리',
    unlockLevel: 25,
    description: '대장장이 제작 재료와 강화석을 얻기 쉬운 도시 외곽',
    backgroundAssetId: 'map_blacksmith_district',
    coinMultiplier: 1.45,
    xpMultiplier: 1.3,
    monsters: Object.freeze({
      easy: Object.freeze(['도둑 견습생', '고장난 골렘', '거리 쥐']),
      normal: Object.freeze(['장물아비', '고장난 골렘', '도적 정찰병']),
      hard: Object.freeze(['검은 대장장이', '강철 골렘', '장물아비'])
    })
  }),
  abyss_mine: Object.freeze({
    label: '왕국 비밀 광산',
    unlockLevel: 35,
    description: '히든 무기 재료를 노리는 위험한 광산',
    backgroundAssetId: 'map_royal_secret_mine',
    coinMultiplier: 1.78,
    xpMultiplier: 1.6,
    monsters: Object.freeze({
      easy: Object.freeze(['광산 박쥐', '광산 골렘', '고블린 광부']),
      normal: Object.freeze(['은광 골렘', '도적 광부', '룬 골렘']),
      hard: Object.freeze(['미스릴 골렘', '검은 대장장이', '룬 골렘'])
    })
  }),
  starfall_crater: Object.freeze({
    label: '길드 훈련장',
    unlockLevel: 1,
    description: '직업 전환과 전투 튜토리얼을 연습하는 길드 시설',
    backgroundAssetId: 'map_guild_training_ground',
    coinMultiplier: 0.95,
    xpMultiplier: 0.95,
    monsters: Object.freeze({
      easy: Object.freeze(['훈련용 허수아비', '길드 슬라임', '들쥐']),
      normal: Object.freeze(['훈련용 골렘', '고블린 정찰병', '회색 늑대']),
      hard: Object.freeze(['훈련 교관', '오크 척후병', '훈련용 골렘'])
    })
  }),
  dragon_nest: Object.freeze({
    label: '검은 용의 둥지',
    unlockLevel: 75,
    description: '검은 용 베르카르에게 도전하기 전 최상위 용족 사냥터',
    backgroundAssetId: 'map_black_dragon_lair',
    coinMultiplier: 3.1,
    xpMultiplier: 2.95,
    monsters: Object.freeze({
      easy: Object.freeze(['상급 드레이크', '용족 전사', '화염 정령']),
      normal: Object.freeze(['검은 용의 파수꾼', '상급 드레이크', '용혈 기사']),
      hard: Object.freeze(['검은 용 베르카르의 환영', '용혈 기사', '상급 드레이크'])
    })
  }),
  void_gate: Object.freeze({
    label: '마왕성 내부',
    unlockLevel: 80,
    description: '마왕 발타르와 시즌 최종 보스를 향하는 최심부',
    backgroundAssetId: 'map_demon_king_castle',
    coinMultiplier: 3.35,
    xpMultiplier: 3.1,
    monsters: Object.freeze({
      easy: Object.freeze(['마왕군 기사', '악마 주술사', '암흑 사제']),
      normal: Object.freeze(['마왕의 사도', '악몽의 기사', '악마 군단']),
      hard: Object.freeze(['마왕 발타르의 환영', '마왕의 사도', '악몽의 기사'])
    })
  }),
  sunken_catacombs: Object.freeze({
    label: '가라앉은 지하묘지',
    unlockLevel: 30,
    description: '왕국 옛 묘지가 늪 아래로 잠긴 언데드 탐사 지역',
    backgroundAssetId: 'map_cursed_monastery',
    coinMultiplier: 1.72,
    xpMultiplier: 1.55,
    monsters: Object.freeze({
      easy: Object.freeze(['묘지 스켈레톤', '왕릉 망령', '늪지 망령']),
      normal: Object.freeze(['왕릉 수호병', '왕가의 망령', '스켈레톤 기사']),
      hard: Object.freeze(['왕릉 기사', '저주받은 수도원장', '왕가의 망령'])
    })
  }),
  dwarven_ironhold: Object.freeze({
    label: '드워프 철산',
    unlockLevel: 45,
    description: '드워프 폐요새와 용광로가 남은 고급 금속 탐사 지역',
    backgroundAssetId: 'map_royal_secret_mine',
    coinMultiplier: 2.08,
    xpMultiplier: 1.95,
    monsters: Object.freeze({
      easy: Object.freeze(['철산 광부 망령', '광산 골렘', '드워프 골렘']),
      normal: Object.freeze(['철산 골렘', '룬 단조골렘', '검은 대장장이']),
      hard: Object.freeze(['드워프 철문지기', '미스릴 골렘', '룬 단조골렘'])
    })
  }),
  moonlit_feywood: Object.freeze({
    label: '달빛 요정숲',
    unlockLevel: 55,
    description: '고대 숲의 결계와 달샘이 숨겨진 유물 탐사 지역',
    backgroundAssetId: 'map_ancient_elf_ruins',
    coinMultiplier: 2.38,
    xpMultiplier: 2.18,
    monsters: Object.freeze({
      easy: Object.freeze(['달빛 요정', '숲 정령', '요정 궁수']),
      normal: Object.freeze(['달샘 수호자', '고대 나무정령', '엘프 망령']),
      hard: Object.freeze(['달빛 군주', '고대 수호자', '룬 골렘'])
    })
  }),
  ancient_dragon_altar: Object.freeze({
    label: '고룡의 제단',
    unlockLevel: 70,
    description: '용의심장과 검은 용창 전승이 남은 최상위 제단',
    backgroundAssetId: 'map_black_dragon_lair',
    coinMultiplier: 3,
    xpMultiplier: 2.82,
    monsters: Object.freeze({
      easy: Object.freeze(['용혈 사제', '상급 드레이크', '화염 정령']),
      normal: Object.freeze(['고룡 제단수호자', '용혈 기사', '검은 용의 파수꾼']),
      hard: Object.freeze(['고룡의 환영', '검은 용 베르카르의 환영', '용혈 기사'])
    })
  })
});

const MONSTER_ASSET_IDS = Object.freeze({
  슬라임: 'monster_slime_idle',
  들쥐: 'monster_forest_wolf_idle',
  '회색 늑대': 'monster_forest_wolf_idle',
  '고블린 정찰병': 'monster_goblin_idle',
  '고블린 전사': 'monster_goblin_idle',
  '고블린 주술사': 'monster_goblin_idle',
  숲거미: 'monster_cave_bat_idle',
  독거미: 'monster_cave_bat_idle',
  박쥐: 'monster_cave_bat_idle',
  '박쥐 떼': 'monster_cave_bat_idle',
  '광산 쥐': 'monster_forest_wolf_idle',
  '고블린 광부': 'monster_goblin_idle',
  '광산 골렘': 'boss_sky_golem_idle',
  '은광 골렘': 'boss_sky_golem_idle',
  '미스릴 골렘': 'boss_sky_golem_idle',
  '독두꺼비': 'monster_slime_idle',
  망령: 'monster_skeleton_soldier_idle',
  '늪지 망령': 'monster_skeleton_soldier_idle',
  '늪지 히드라': 'boss_marsh_behemoth_idle',
  '도적 정찰병': 'monster_dark_knight_idle',
  '도적 궁수': 'monster_dark_knight_idle',
  '도적 암살자': 'monster_dark_knight_idle',
  암살자: 'monster_dark_knight_idle',
  스켈레톤: 'monster_skeleton_soldier_idle',
  '스켈레톤 기사': 'monster_skeleton_soldier_idle',
  '저주받은 사제': 'monster_skeleton_soldier_idle',
  '오크 척후병': 'monster_orc_warrior_idle',
  '오크 전사': 'monster_orc_warrior_idle',
  와이번: 'boss_storm_wyvern_idle',
  '붉은 와이번': 'boss_storm_wyvern_idle',
  드레이크: 'monster_mini_dragon_idle',
  '상급 드레이크': 'monster_mini_dragon_idle',
  '용족 전사': 'monster_mini_dragon_idle',
  '악마 정찰병': 'monster_dark_knight_idle',
  '타락 기사': 'monster_dark_knight_idle',
  '타락한 성기사': 'monster_dark_knight_idle',
  '서리 거인': 'boss_sky_golem_idle',
  '늑대 우두머리': 'monster_forest_wolf_idle',
  '악몽의 기사': 'boss_void_knights_idle',
  '마왕의 사도': 'boss_void_knights_idle',
  '묘지 스켈레톤': 'monster_skeleton_soldier_idle',
  '왕릉 망령': 'monster_skeleton_soldier_idle',
  '왕릉 수호병': 'monster_skeleton_soldier_idle',
  '왕가의 망령': 'monster_skeleton_soldier_idle',
  '왕릉 기사': 'monster_dark_knight_idle',
  '철산 광부 망령': 'monster_skeleton_soldier_idle',
  '드워프 골렘': 'boss_sky_golem_idle',
  '철산 골렘': 'boss_sky_golem_idle',
  '룬 단조골렘': 'boss_sky_golem_idle',
  '드워프 철문지기': 'boss_sky_golem_idle',
  '달빛 요정': 'monster_dark_knight_idle',
  '요정 궁수': 'monster_dark_knight_idle',
  '달샘 수호자': 'monster_dark_knight_idle',
  '고대 나무정령': 'monster_dark_knight_idle',
  '달빛 군주': 'monster_dark_knight_idle',
  '용혈 사제': 'monster_dark_knight_idle',
  '고룡 제단수호자': 'monster_mini_dragon_idle',
  '고룡의 환영': 'boss_ancient_dragon_idle',
  '고블린 족장': 'boss_goblin_warband_idle',
  '폐광 박쥐왕': 'monster_cave_bat_idle',
  '숲거미 여왕': 'boss_marsh_behemoth_idle',
  '오크 전쟁군주': 'monster_orc_warrior_idle',
  '고대 리치': 'boss_frost_lich_idle',
  '검은 용 베르카르': 'boss_ancient_dragon_idle',
  '마왕 발타르': 'boss_apocalypse_dragon_idle'
});

const RPG_ITEMS = Object.freeze({
  potion: Object.freeze({ label: '회복 포션', description: 'HP를 40 회복합니다.', type: 'consumable', category: 'consumable', price: 120, heal: 40, mpHeal: 0, assetId: 'item_potion_icon' }),
  mana_potion: Object.freeze({ label: '마나 포션', description: 'MP를 25 회복합니다.', type: 'consumable', category: 'consumable', price: 140, heal: 0, mpHeal: 25, assetId: 'item_mana_potion_icon' }),
  detox_potion: Object.freeze({ label: '해독제', description: '독/저주 계열 상태이상 대응 소모품입니다.', type: 'consumable', category: 'consumable', price: 180, heal: 12, mpHeal: 0, assetId: 'item_potion_icon' }),
  guard_elixir: Object.freeze({ label: '수호 비약', description: '전투 전 방어를 보강하는 제작 소모품입니다.', type: 'consumable', category: 'consumable', price: 260, heal: 0, mpHeal: 10, assetId: 'item_mana_potion_icon' }),
  enhancement_stone: Object.freeze({ label: '강화석', description: '전리품 강화 보조 재료입니다.', type: 'material', category: 'upgrade', price: 0, assetId: 'item_enhancement_stone_icon', shopHidden: true }),
  artisan_hammer: Object.freeze({ label: '장인의 망치', description: '제작 성공률을 높이는 보조 재료입니다.', type: 'material', category: 'upgrade', price: 0, assetId: 'item_blacksmith_hammer_icon', shopHidden: true }),
  healing_herb: Object.freeze({ label: '약초', description: '초원과 숲에서 얻는 포션 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_potion_icon', shopHidden: true }),
  iron_ore: Object.freeze({ label: '철광석', description: '광산에서 캐는 기본 무기 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_iron_ore_icon', shopHidden: true }),
  iron_ingot: Object.freeze({ label: '철괴', description: '철광석을 가공한 초급 금속 재료입니다.', type: 'material', category: 'processed', price: 0, assetId: 'item_iron_ore_icon', shopHidden: true }),
  silver_ore: Object.freeze({ label: '은광석', description: '성속성 장비와 장신구에 쓰이는 광석입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_iron_ore_icon', shopHidden: true }),
  silver_ingot: Object.freeze({ label: '은괴', description: '은광석을 가공한 중급 금속 재료입니다.', type: 'material', category: 'processed', price: 0, assetId: 'item_iron_ore_icon', shopHidden: true }),
  steel_ingot: Object.freeze({ label: '강철괴', description: '중급 이상 장비 제작에 쓰는 단단한 금속입니다.', type: 'material', category: 'processed', price: 0, assetId: 'item_iron_ore_icon', shopHidden: true }),
  blessed_silver_ingot: Object.freeze({ label: '축복받은 은괴', description: '성지와 레이드에서 얻는 고급 성속성 금속입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_holy_relic_icon', shopHidden: true }),
  blessed_metal: Object.freeze({ label: '축복받은 금속', description: '레이드 장비와 상위 강화에 쓰는 금속입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_holy_relic_icon', shopHidden: true }),
  mythic_metal: Object.freeze({ label: '신화 금속', description: '신화/히든 장비 제작의 핵심 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_blacksmith_hammer_icon', shopHidden: true }),
  tough_leather: Object.freeze({ label: '질긴 가죽', description: '야수에게서 얻는 방어구 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_leather_armor_icon', shopHidden: true }),
  black_leather: Object.freeze({ label: '검은 가죽', description: '도적 장비와 그림자 장비 제작 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_leather_armor_icon', shopHidden: true }),
  hardwood: Object.freeze({ label: '단단한 나무', description: '활과 지팡이 제작에 쓰이는 목재입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_crossbow_icon', shopHidden: true }),
  ancient_wood: Object.freeze({ label: '고대 나무', description: '유적과 성지에서 얻는 상위 목재입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_crossbow_icon', shopHidden: true }),
  lesser_magic_stone: Object.freeze({ label: '하급 마력석', description: '초급 마법 장비와 철 장검 보조 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  magic_crystal: Object.freeze({ label: '마력 결정', description: '마탑과 유적에서 얻는 마법 장비 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  holy_water: Object.freeze({ label: '성수', description: '성직자 장비와 정화 아이템 제작 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_holy_relic_icon', shopHidden: true }),
  poison_sac: Object.freeze({ label: '독주머니', description: '거미와 늪지 몬스터에게서 얻는 도적 장비 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_potion_icon', shopHidden: true }),
  wolf_fang: Object.freeze({ label: '늑대 송곳니', description: '초원과 숲 야수에게서 얻는 장비 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_crossbow_icon', shopHidden: true }),
  rune_stone: Object.freeze({ label: '룬석', description: '룬 제작과 룬 갑옷 제작 재료입니다.', type: 'material', category: 'material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  fire_rune: Object.freeze({ label: '화염 룬', description: '장비에 화염 속성 콘셉트를 부여하는 룬입니다.', type: 'rune', category: 'rune', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  ice_rune: Object.freeze({ label: '냉기 룬', description: '장비에 냉기 속성 콘셉트를 부여하는 룬입니다.', type: 'rune', category: 'rune', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  holy_rune: Object.freeze({ label: '신성 룬', description: '성속성 장비 제작과 각인에 쓰는 룬입니다.', type: 'rune', category: 'rune', price: 0, assetId: 'item_holy_relic_icon', shopHidden: true }),
  lightning_rune: Object.freeze({ label: '번개 룬', description: '폭풍 지팡이와 번개 장비 제작 재료입니다.', type: 'rune', category: 'rune', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  dragon_scale: Object.freeze({ label: '용비늘', description: '용족과 월드 보스에게서 얻는 전설 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_dragon_scale_icon', shopHidden: true }),
  dragon_claw: Object.freeze({ label: '용의 발톱', description: '용비늘 대검과 히든 장비 제작 핵심 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_dragon_scale_icon', shopHidden: true }),
  dragon_heart: Object.freeze({ label: '용의심장', description: '상위 용족에게서 아주 드물게 얻는 히든 제작 핵심 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_dragon_scale_icon', shopHidden: true }),
  ancient_lich_core: Object.freeze({ label: '고대 리치의 핵', description: '리치의 마도서 제작 핵심 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  dark_stone: Object.freeze({ label: '암흑석', description: '마왕성 몬스터에게서 얻는 암흑 장비 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  demon_horn: Object.freeze({ label: '악마의 뿔', description: '마왕성 장비와 히든 제작에 쓰는 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_dragon_scale_icon', shopHidden: true }),
  angel_feather: Object.freeze({ label: '천사의 깃털', description: '성역의 갑옷 제작 핵심 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_holy_relic_icon', shopHidden: true }),
  nightmare_thread: Object.freeze({ label: '악몽의 실', description: '그림자 망토 제작 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_treasure_chest_icon', shopHidden: true }),
  shadow_crystal: Object.freeze({ label: '그림자 결정', description: '그림자/도적 계열 히든 장비 재료입니다.', type: 'material', category: 'rare_material', price: 0, assetId: 'item_rune_stone_icon', shopHidden: true }),
  iron_sword: Object.freeze({ label: '낡은 장검', description: '공격력 +4', type: 'equipment', category: 'weapon', slot: 'weapon', price: 500, stats: Object.freeze({ attack: 4 }), assetId: 'item_iron_sword_icon' }),
  leather_armor: Object.freeze({ label: '가죽 갑옷', description: '방어력 +3, 최대 HP +20', type: 'equipment', category: 'armor', slot: 'armor', price: 450, stats: Object.freeze({ defense: 3, maxHp: 20 }), assetId: 'item_leather_armor_icon' }),
  mystic_ring: Object.freeze({ label: '낡은 광부의 반지', description: '공격력 +2, 최대 HP +10, 최대 MP +10', type: 'equipment', category: 'accessory', slot: 'accessory', price: 800, stats: Object.freeze({ attack: 2, maxHp: 10, maxMp: 10 }), assetId: 'item_mystic_ring_icon' }),
  slime_charm: Object.freeze({ label: '슬라임 부적', description: '초원 사냥 드롭 장신구. 최대 HP +8, 최대 MP +6', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ maxHp: 8, maxMp: 6 }), assetId: 'item_slime_charm_icon', dropOnly: true, shopHidden: true }),
  wolfhide_vest: Object.freeze({ label: '늑대가죽 조끼', description: '야수 사냥 드롭 방어구. 방어력 +2, 최대 HP +18', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 2, maxHp: 18 }), assetId: 'item_wolfhide_vest_icon', dropOnly: true, shopHidden: true }),
  goblin_spear: Object.freeze({ label: '고블린 창', description: '고블린 숲 드롭 무기. 공격력 +5', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 5 }), assetId: 'item_goblin_spear_icon', dropOnly: true, shopHidden: true }),
  spider_silk_cloak: Object.freeze({ label: '거미줄 망토', description: '거미와 늪지 드롭 장신구. 방어력 +1, 최대 MP +18', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ defense: 1, maxMp: 18 }), assetId: 'item_spider_silk_cloak_icon', dropOnly: true, shopHidden: true }),
  miner_pickaxe: Object.freeze({ label: '광부의 곡괭이', description: '버려진 은광 드롭 무기. 공격력 +6, 방어력 +1', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 6, defense: 1 }), assetId: 'item_miner_pickaxe_icon', dropOnly: true, shopHidden: true }),
  batwing_earring: Object.freeze({ label: '박쥐날개 귀걸이', description: '광산과 성채 드롭 장신구. 공격력 +2, 최대 MP +18', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ attack: 2, maxMp: 18 }), assetId: 'item_batwing_earring_icon', dropOnly: true, shopHidden: true }),
  marshbone_talisman: Object.freeze({ label: '늪뼈 부적', description: '안개 늪지 드롭 장신구. 방어력 +2, 최대 HP +16', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ defense: 2, maxHp: 16 }), assetId: 'item_marshbone_talisman_icon', dropOnly: true, shopHidden: true }),
  bandit_cutlass: Object.freeze({ label: '도적단 곡도', description: '도적단 요새 드롭 무기. 공격력 +8, 최대 MP +8', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 8, maxMp: 8 }), assetId: 'item_bandit_cutlass_icon', dropOnly: true, shopHidden: true }),
  monastery_censer: Object.freeze({ label: '수도원 향로', description: '저주받은 수도원 드롭 무기. 공격력 +5, 최대 MP +25', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 5, maxMp: 25 }), assetId: 'item_monastery_censer_icon', dropOnly: true, shopHidden: true }),
  orc_war_axe: Object.freeze({ label: '오크 전투도끼', description: '오크 전쟁기지 드롭 무기. 공격력 +10', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 10 }), assetId: 'item_orc_war_axe_icon', dropOnly: true, shopHidden: true }),
  frost_guard_armor: Object.freeze({ label: '서리수호 갑옷', description: '얼어붙은 성채 드롭 방어구. 방어력 +7, 최대 HP +35', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 7, maxHp: 35 }), assetId: 'item_frost_guard_armor_icon', dropOnly: true, shopHidden: true }),
  elf_rune_ring: Object.freeze({ label: '엘프 룬 반지', description: '고대 엘프 유적 드롭 장신구. 공격력 +4, 최대 MP +35', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ attack: 4, maxMp: 35 }), assetId: 'item_elf_rune_ring_icon', dropOnly: true, shopHidden: true }),
  wyvern_scale_mail: Object.freeze({ label: '와이번 비늘갑옷', description: '용의 둥지 드롭 방어구. 방어력 +9, 최대 HP +45', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 9, maxHp: 45 }), assetId: 'item_wyvern_scale_mail_icon', dropOnly: true, shopHidden: true }),
  demon_knight_blade: Object.freeze({ label: '마왕군 흑검', description: '마왕성 드롭 무기. 공격력 +13, 최대 MP +20', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 13, maxMp: 20 }), assetId: 'item_demon_knight_blade_icon', dropOnly: true, shopHidden: true }),
  arden_prayer_beads: Object.freeze({ label: '아르덴 묵주', description: '성지 아르덴 드롭 장신구. 방어력 +3, 최대 MP +40', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ defense: 3, maxMp: 40 }), assetId: 'item_arden_prayer_beads_icon', dropOnly: true, shopHidden: true }),
  black_dragon_scaleplate: Object.freeze({ label: '검은 용비늘 갑옷', description: '검은 용의 둥지 드롭 방어구. 방어력 +12, 최대 HP +65', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 12, maxHp: 65 }), assetId: 'item_black_dragon_scaleplate_icon', dropOnly: true, shopHidden: true }),
  iron_longsword: Object.freeze({ label: '철 장검', description: '제작 장비. 공격력 +5', type: 'equipment', category: 'weapon', slot: 'weapon', price: 650, stats: Object.freeze({ attack: 5 }), assetId: 'item_iron_longsword_icon', craftedOnly: true, shopHidden: true }),
  oak_shortbow: Object.freeze({ label: '참나무 단궁', description: '제작 장비. 공격력 +4, 최대 MP +8', type: 'equipment', category: 'weapon', slot: 'weapon', price: 560, stats: Object.freeze({ attack: 4, maxMp: 8 }), assetId: 'item_oak_shortbow_icon', craftedOnly: true, shopHidden: true }),
  iron_dagger: Object.freeze({ label: '철 단검', description: '제작 장비. 공격력 +5, 최대 MP +4', type: 'equipment', category: 'weapon', slot: 'weapon', price: 580, stats: Object.freeze({ attack: 5, maxMp: 4 }), assetId: 'item_iron_dagger_icon', craftedOnly: true, shopHidden: true }),
  iron_spear: Object.freeze({ label: '철창', description: '제작 장비. 공격력 +6', type: 'equipment', category: 'weapon', slot: 'weapon', price: 700, stats: Object.freeze({ attack: 6 }), assetId: 'item_iron_spear_icon', craftedOnly: true, shopHidden: true }),
  reinforced_leather_armor: Object.freeze({ label: '보강 가죽갑옷', description: '제작 방어구. 방어력 +4, 최대 HP +24', type: 'equipment', category: 'armor', slot: 'armor', price: 820, stats: Object.freeze({ defense: 4, maxHp: 24 }), assetId: 'item_reinforced_leather_armor_icon', craftedOnly: true, shopHidden: true }),
  silver_ring: Object.freeze({ label: '은 반지', description: '제작 장신구. 방어력 +1, 최대 MP +22', type: 'equipment', category: 'accessory', slot: 'accessory', price: 900, stats: Object.freeze({ defense: 1, maxMp: 22 }), assetId: 'item_silver_ring_icon', craftedOnly: true, shopHidden: true }),
  hunter_bow: Object.freeze({ label: '사냥꾼의 활', description: '제작 장비. 공격력 +4, 최대 MP +10', type: 'equipment', category: 'weapon', slot: 'weapon', price: 620, stats: Object.freeze({ attack: 4, maxMp: 10 }), assetId: 'item_hunter_bow_icon', craftedOnly: true, shopHidden: true }),
  apprentice_staff: Object.freeze({ label: '수습 마법사의 지팡이', description: '제작 장비. 공격력 +4, 최대 MP +20', type: 'equipment', category: 'weapon', slot: 'weapon', price: 640, stats: Object.freeze({ attack: 4, maxMp: 20 }), assetId: 'item_apprentice_staff_icon', craftedOnly: true, shopHidden: true }),
  holy_mace: Object.freeze({ label: '신성한 철퇴', description: '제작 장비. 공격력 +4, 방어력 +1', type: 'equipment', category: 'weapon', slot: 'weapon', price: 720, stats: Object.freeze({ attack: 4, defense: 1 }), assetId: 'item_holy_mace_icon', craftedOnly: true, shopHidden: true }),
  rogue_dagger: Object.freeze({ label: '도적의 단검', description: '제작 장비. 공격력 +5, 최대 MP +5', type: 'equipment', category: 'weapon', slot: 'weapon', price: 700, stats: Object.freeze({ attack: 5, maxMp: 5 }), assetId: 'item_rogue_dagger_icon', craftedOnly: true, shopHidden: true }),
  healer_charm: Object.freeze({ label: '치유사의 부적', description: '제작 장신구. 방어력 +2, 최대 MP +28', type: 'equipment', category: 'accessory', slot: 'accessory', price: 1120, stats: Object.freeze({ defense: 2, maxMp: 28 }), assetId: 'item_healer_charm_icon', craftedOnly: true, shopHidden: true }),
  silver_longsword: Object.freeze({ label: '은빛 장검', description: '희귀 제작 장비. 공격력 +8', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1500, stats: Object.freeze({ attack: 8 }), assetId: 'item_silver_longsword_icon', craftedOnly: true, shopHidden: true }),
  steel_halberd: Object.freeze({ label: '강철 할버드', description: '희귀 제작 장비. 공격력 +9, 방어력 +1', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1600, stats: Object.freeze({ attack: 9, defense: 1 }), assetId: 'item_steel_halberd_icon', craftedOnly: true, shopHidden: true }),
  steel_crossbow: Object.freeze({ label: '강철 석궁', description: '희귀 제작 장비. 공격력 +8, 최대 MP +18', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1550, stats: Object.freeze({ attack: 8, maxMp: 18 }), assetId: 'item_steel_crossbow_icon', craftedOnly: true, shopHidden: true }),
  battle_axe: Object.freeze({ label: '전투도끼', description: '희귀 제작 장비. 공격력 +10', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1650, stats: Object.freeze({ attack: 10 }), assetId: 'item_battle_axe_icon', craftedOnly: true, shopHidden: true }),
  priest_codex: Object.freeze({ label: '사제의 성서', description: '희귀 제작 장비. 방어력 +2, 최대 MP +35', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1500, stats: Object.freeze({ defense: 2, maxMp: 35 }), assetId: 'item_priest_codex_icon', craftedOnly: true, shopHidden: true }),
  assassin_twinblades: Object.freeze({ label: '암살자의 쌍검', description: '희귀 제작 장비. 공격력 +9', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1800, stats: Object.freeze({ attack: 9 }), assetId: 'item_assassin_twinblades_icon', craftedOnly: true, shopHidden: true }),
  poison_dagger: Object.freeze({ label: '맹독 단검', description: '희귀 제작 장비. 공격력 +8, 최대 MP +16', type: 'equipment', category: 'weapon', slot: 'weapon', price: 1700, stats: Object.freeze({ attack: 8, maxMp: 16 }), assetId: 'item_poison_dagger_icon', craftedOnly: true, shopHidden: true }),
  rune_armor: Object.freeze({ label: '룬 갑옷', description: '희귀 제작 방어구. 방어력 +6, 최대 HP +30', type: 'equipment', category: 'armor', slot: 'armor', price: 2000, stats: Object.freeze({ defense: 6, maxHp: 30 }), assetId: 'item_rune_armor_icon', craftedOnly: true, shopHidden: true }),
  shadow_hood: Object.freeze({ label: '그림자 두건', description: '희귀 제작 장신구. 공격력 +4, 방어력 +2, 최대 MP +18', type: 'equipment', category: 'accessory', slot: 'accessory', price: 1900, stats: Object.freeze({ attack: 4, defense: 2, maxMp: 18 }), assetId: 'item_shadow_hood_icon', craftedOnly: true, shopHidden: true }),
  fire_rune_blade: Object.freeze({ label: '화염 룬검', description: '영웅 제작 장비. 공격력 +11, 최대 MP +20', type: 'equipment', category: 'weapon', slot: 'weapon', price: 2600, stats: Object.freeze({ attack: 11, maxMp: 20 }), assetId: 'item_fire_rune_blade_icon', craftedOnly: true, shopHidden: true }),
  ice_guard_plate: Object.freeze({ label: '냉기 수호갑옷', description: '영웅 제작 방어구. 방어력 +8, 최대 HP +48', type: 'equipment', category: 'armor', slot: 'armor', price: 2800, stats: Object.freeze({ defense: 8, maxHp: 48 }), assetId: 'item_ice_guard_plate_icon', craftedOnly: true, shopHidden: true }),
  lightning_wand: Object.freeze({ label: '번개 완드', description: '영웅 제작 장비. 공격력 +10, 최대 MP +50', type: 'equipment', category: 'weapon', slot: 'weapon', price: 2750, stats: Object.freeze({ attack: 10, maxMp: 50 }), assetId: 'item_lightning_wand_icon', craftedOnly: true, shopHidden: true }),
  storm_staff: Object.freeze({ label: '폭풍 지팡이', description: '영웅 제작 장비. 공격력 +10, 최대 MP +45', type: 'equipment', category: 'weapon', slot: 'weapon', price: 2600, stats: Object.freeze({ attack: 10, maxMp: 45 }), assetId: 'item_storm_staff_icon', craftedOnly: true, shopHidden: true }),
  blessed_plate: Object.freeze({ label: '축복받은 판금갑옷', description: '영웅 제작 방어구. 방어력 +9, 최대 HP +55', type: 'equipment', category: 'armor', slot: 'armor', price: 3200, stats: Object.freeze({ defense: 9, maxHp: 55 }), assetId: 'item_blessed_plate_icon', craftedOnly: true, shopHidden: true }),
  sacred_silver_staff: Object.freeze({ label: '성은 지팡이', description: '영웅 제작 장비. 공격력 +9, 방어력 +2, 최대 MP +55', type: 'equipment', category: 'weapon', slot: 'weapon', price: 3300, stats: Object.freeze({ attack: 9, defense: 2, maxMp: 55 }), assetId: 'item_sacred_silver_staff_icon', craftedOnly: true, shopHidden: true }),
  ancient_elf_bow: Object.freeze({ label: '고대 엘프 장궁', description: '영웅 제작 장비. 공격력 +12, 최대 MP +30', type: 'equipment', category: 'weapon', slot: 'weapon', price: 3600, stats: Object.freeze({ attack: 12, maxMp: 30 }), assetId: 'item_ancient_elf_bow_icon', craftedOnly: true, shopHidden: true }),
  demonbone_axe: Object.freeze({ label: '악마뼈 도끼', description: '전설 제작 장비. 공격력 +14, 최대 HP +20', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 14, maxHp: 20 }), assetId: 'item_demonbone_axe_icon', craftedOnly: true, shopHidden: true }),
  dragon_scale_shield: Object.freeze({ label: '용비늘 방패', description: '전설 제작 방어구. 방어력 +12, 최대 HP +55', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 12, maxHp: 55 }), assetId: 'item_dragon_scale_shield_icon', craftedOnly: true, shopHidden: true }),
  dragon_scale_greatsword: Object.freeze({ label: '용비늘 대검', description: '전설 제작 장비. 공격력 +15', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 15 }), assetId: 'item_dragon_scale_greatsword_icon', craftedOnly: true, shopHidden: true }),
  black_dragon_spear: Object.freeze({ label: '검은 용창', description: '전설 제작 장비. 공격력 +16, 방어력 +2', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 16, defense: 2 }), assetId: 'item_black_dragon_spear_icon', craftedOnly: true, shopHidden: true }),
  lich_grimoire: Object.freeze({ label: '리치의 마도서', description: '전설 제작 장비. 공격력 +12, 최대 MP +80', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 12, maxMp: 80 }), assetId: 'item_lich_grimoire_icon', craftedOnly: true, shopHidden: true }),
  sanctuary_armor: Object.freeze({ label: '성역의 갑옷', description: '전설 제작 방어구. 방어력 +11, 최대 HP +70', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 11, maxHp: 70 }), assetId: 'item_sanctuary_armor_icon', craftedOnly: true, shopHidden: true }),
  shadow_cloak: Object.freeze({ label: '그림자 망토', description: '영웅 제작 장신구. 공격력 +6, 방어력 +4', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ attack: 6, defense: 4, maxMp: 25 }), assetId: 'item_shadow_cloak_icon', craftedOnly: true, shopHidden: true }),
  nidhogg_plate: Object.freeze({ label: '니드호그 갑옷', description: '신화 제작 방어구. 방어력 +15, 최대 HP +95', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 15, maxHp: 95 }), assetId: 'item_nidhogg_plate_icon', craftedOnly: true, shopHidden: true }),
  kings_crown: Object.freeze({ label: '왕국의 왕관', description: '전설 제작 장신구. 공격력 +5, 방어력 +5, 최대 MP +55', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ attack: 5, defense: 5, maxMp: 55 }), assetId: 'item_kings_crown_icon', craftedOnly: true, shopHidden: true }),
  hidden_moonfang_blade: Object.freeze({ label: '월아의 비밀검', description: '히든 제작 장비. 공격력 +17, 최대 MP +25', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 17, maxMp: 25 }), assetId: 'item_hidden_moonfang_blade_icon', craftedOnly: true, hidden: true, shopHidden: true }),
  hidden_arden_halo: Object.freeze({ label: '아르덴 성광륜', description: '히든 제작 유물. 방어력 +7, 최대 MP +90', type: 'equipment', category: 'accessory', slot: 'accessory', price: 0, stats: Object.freeze({ defense: 7, maxMp: 90 }), assetId: 'item_hidden_arden_halo_icon', craftedOnly: true, hidden: true, shopHidden: true }),
  hidden_dragonheart_hammer: Object.freeze({ label: '용의심장 대장장이 망치', description: '히든 제작 장비. 공격력 +14, 방어력 +8', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 14, defense: 8 }), assetId: 'item_hidden_dragonheart_hammer_icon', craftedOnly: true, hidden: true, shopHidden: true }),
  hidden_forest_king_bow: Object.freeze({ label: '숲왕의 장궁', description: '히든 제작 장비. 공격력 +16, 최대 MP +35', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 16, maxMp: 35 }), assetId: 'item_hidden_forest_king_bow_icon', craftedOnly: true, hidden: true, shopHidden: true }),
  dragon_blade: Object.freeze({ label: '용비늘 대검', description: '전설 장비. 공격력 +9', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 9 }), assetId: 'item_dragon_blade_icon', gachaOnly: true }),
  archmage_staff: Object.freeze({ label: '마탑 지팡이', description: '영웅 장비. 공격력 +6, 최대 MP +35', type: 'equipment', category: 'weapon', slot: 'weapon', price: 0, stats: Object.freeze({ attack: 6, maxMp: 35 }), assetId: 'item_archmage_staff_icon', gachaOnly: true }),
  guardian_plate: Object.freeze({ label: '수호자의 판금갑옷', description: '영웅 장비. 방어력 +7, 최대 HP +35', type: 'equipment', category: 'armor', slot: 'armor', price: 0, stats: Object.freeze({ defense: 7, maxHp: 35 }), assetId: 'item_guardian_plate_icon', gachaOnly: true })
});

const RPG_GEAR_DROP_POOLS = Object.freeze({
  forest: Object.freeze(['iron_sword', 'leather_armor', 'slime_charm', 'wolfhide_vest']),
  wildflower_plains: Object.freeze(['goblin_spear', 'wolfhide_vest', 'spider_silk_cloak', 'slime_charm']),
  cave: Object.freeze(['miner_pickaxe', 'batwing_earring', 'mystic_ring', 'iron_sword']),
  moonlit_hill: Object.freeze(['marshbone_talisman', 'spider_silk_cloak', 'leather_armor', 'holy_mace']),
  marsh: Object.freeze(['marshbone_talisman', 'bandit_cutlass', 'spider_silk_cloak', 'poison_dagger']),
  mushroom_grove: Object.freeze(['monastery_censer', 'arden_prayer_beads', 'priest_codex', 'silver_ring']),
  ruins: Object.freeze(['orc_war_axe', 'bandit_cutlass', 'guardian_plate', 'steel_halberd']),
  bandit_outpost: Object.freeze(['frost_guard_armor', 'batwing_earring', 'ice_guard_plate', 'storm_staff']),
  red_desert: Object.freeze(['elf_rune_ring', 'ancient_elf_bow', 'rune_armor', 'storm_staff']),
  volcano: Object.freeze(['wyvern_scale_mail', 'dragon_blade', 'dragon_scale_greatsword', 'fire_rune_blade']),
  thunder_plateau: Object.freeze(['lightning_wand', 'archmage_staff', 'elf_rune_ring', 'lich_grimoire']),
  frost: Object.freeze(['demon_knight_blade', 'demonbone_axe', 'sanctuary_armor', 'shadow_cloak']),
  crystal_lake: Object.freeze(['arden_prayer_beads', 'sacred_silver_staff', 'blessed_plate', 'sanctuary_armor']),
  sky: Object.freeze(['guardian_plate', 'blessed_plate', 'kings_crown', 'orc_war_axe']),
  phantom_forest: Object.freeze(['battle_axe', 'steel_crossbow', 'reinforced_leather_armor', 'healer_charm']),
  abyss_mine: Object.freeze(['miner_pickaxe', 'shadow_hood', 'demon_knight_blade', 'black_dragon_spear']),
  starfall_crater: Object.freeze(['iron_sword', 'leather_armor', 'slime_charm', 'oak_shortbow']),
  dragon_nest: Object.freeze(['black_dragon_scaleplate', 'black_dragon_spear', 'dragon_blade', 'dragon_scale_shield']),
  void_gate: Object.freeze(['demon_knight_blade', 'demonbone_axe', 'nidhogg_plate', 'kings_crown']),
  sunken_catacombs: Object.freeze(['monastery_censer', 'marshbone_talisman', 'hidden_moonfang_blade', 'lich_grimoire']),
  dwarven_ironhold: Object.freeze(['battle_axe', 'rune_armor', 'dragon_scale_shield', 'hidden_dragonheart_hammer']),
  moonlit_feywood: Object.freeze(['ancient_elf_bow', 'elf_rune_ring', 'hidden_forest_king_bow', 'hidden_arden_halo']),
  ancient_dragon_altar: Object.freeze(['black_dragon_scaleplate', 'black_dragon_spear', 'nidhogg_plate', 'hidden_dragonheart_hammer'])
});

const RPG_CRAFTING_MASTERIES = Object.freeze({
  weapon: Object.freeze({ label: '무기 제작', description: '검, 활, 지팡이, 단검 제작 숙련도' }),
  armor: Object.freeze({ label: '방어구 제작', description: '갑옷, 투구, 장갑, 신발 제작 숙련도' }),
  accessory: Object.freeze({ label: '장신구 제작', description: '반지, 목걸이, 망토 제작 숙련도' }),
  alchemy: Object.freeze({ label: '연금술', description: '포션, 해독제, 비약 제작 숙련도' }),
  rune: Object.freeze({ label: '룬 각인', description: '속성 룬과 장비 각인 숙련도' }),
  processing: Object.freeze({ label: '재료 가공', description: '광석, 가죽, 목재 가공 숙련도' }),
  engineering: Object.freeze({ label: '공학 제작', description: '함정, 골렘, 레이드 장치 제작 숙련도' })
});

const RPG_CRAFTING_QUALITIES = Object.freeze({
  crude: Object.freeze({ label: '조잡한', multiplier: 0.85 }),
  normal: Object.freeze({ label: '보통', multiplier: 1 }),
  fine: Object.freeze({ label: '상급', multiplier: 1.1 }),
  masterwork: Object.freeze({ label: '명품', multiplier: 1.25 }),
  masterpiece: Object.freeze({ label: '걸작', multiplier: 1.4, extraOption: true })
});

const RPG_DUNGEONS = Object.freeze({
  goblin_cave: Object.freeze({ label: '고블린 동굴', area: 'wildflower_plains', unlockLevel: 5, recommendedLevel: '5~15', rooms: 3, drops: Object.freeze(['tough_leather', 'hardwood', 'iron_ore', 'goblin_spear', 'spider_silk_cloak']) }),
  spider_nest: Object.freeze({ label: '숲거미 굴', area: 'wildflower_plains', unlockLevel: 12, recommendedLevel: '12~22', rooms: 4, drops: Object.freeze(['poison_sac', 'tough_leather', 'spider_silk_cloak', 'poison_dagger']) }),
  abandoned_silver_mine: Object.freeze({ label: '버려진 은광', area: 'cave', unlockLevel: 10, recommendedLevel: '10~25', rooms: 5, drops: Object.freeze(['iron_ore', 'silver_ore', 'lesser_magic_stone', 'miner_pickaxe', 'batwing_earring']) }),
  mist_marsh_ruins: Object.freeze({ label: '안개 늪지 폐허', area: 'moonlit_hill', unlockLevel: 15, recommendedLevel: '15~30', rooms: 4, drops: Object.freeze(['poison_sac', 'holy_water', 'marshbone_talisman', 'healer_charm']) }),
  bandit_underground_passage: Object.freeze({ label: '도적단 지하통로', area: 'marsh', unlockLevel: 20, recommendedLevel: '20~35', rooms: 4, drops: Object.freeze(['black_leather', 'poison_sac', 'bandit_cutlass', 'shadow_hood']) }),
  cursed_monastery: Object.freeze({ label: '저주받은 수도원', area: 'mushroom_grove', unlockLevel: 20, recommendedLevel: '20~35', rooms: 5, drops: Object.freeze(['holy_water', 'silver_ore', 'rune_stone', 'monastery_censer', 'arden_prayer_beads']) }),
  sunken_catacombs: Object.freeze({ label: '가라앉은 지하묘지', area: 'sunken_catacombs', unlockLevel: 30, recommendedLevel: '30~45', rooms: 5, drops: Object.freeze(['holy_water', 'nightmare_thread', 'ancient_lich_core', 'monastery_censer', 'lich_grimoire']) }),
  orc_war_camp: Object.freeze({ label: '오크 전쟁기지', area: 'ruins', unlockLevel: 25, recommendedLevel: '25~40', rooms: 5, drops: Object.freeze(['steel_ingot', 'wolf_fang', 'blessed_metal', 'orc_war_axe', 'bandit_cutlass']) }),
  frozen_citadel: Object.freeze({ label: '얼어붙은 성채', area: 'bandit_outpost', unlockLevel: 35, recommendedLevel: '35~55', rooms: 5, drops: Object.freeze(['ice_rune', 'magic_crystal', 'ancient_wood', 'frost_guard_armor', 'batwing_earring']) }),
  dwarven_ironhold: Object.freeze({ label: '드워프 철산로', area: 'dwarven_ironhold', unlockLevel: 45, recommendedLevel: '45~60', rooms: 5, drops: Object.freeze(['steel_ingot', 'mythic_metal', 'artisan_hammer', 'battle_axe', 'rune_armor']) }),
  ancient_elf_ruins: Object.freeze({ label: '고대 엘프 유적', area: 'red_desert', unlockLevel: 45, recommendedLevel: '45~65', rooms: 5, drops: Object.freeze(['rune_stone', 'magic_crystal', 'ancient_wood', 'ancient_elf_bow', 'elf_rune_ring']) }),
  dragon_lair: Object.freeze({ label: '용의 둥지', area: 'dragon_nest', unlockLevel: 45, recommendedLevel: '45~70', rooms: 5, drops: Object.freeze(['dragon_scale', 'dragon_claw', 'dragon_heart', 'fire_rune', 'wyvern_scale_mail', 'black_dragon_scaleplate']) }),
  wizard_tower_vault: Object.freeze({ label: '마탑 금서고', area: 'thunder_plateau', unlockLevel: 60, recommendedLevel: '60~75', rooms: 5, drops: Object.freeze(['magic_crystal', 'lightning_rune', 'dark_stone', 'lightning_wand', 'lich_grimoire']) }),
  sacred_arden_sanctum: Object.freeze({ label: '아르덴 성소', area: 'crystal_lake', unlockLevel: 60, recommendedLevel: '60~78', rooms: 5, drops: Object.freeze(['holy_water', 'blessed_silver_ingot', 'angel_feather', 'sacred_silver_staff', 'sanctuary_armor']) }),
  demon_king_outer_wall: Object.freeze({ label: '마왕성 외곽', area: 'frost', unlockLevel: 60, recommendedLevel: '60+', rooms: 5, drops: Object.freeze(['dark_stone', 'demon_horn', 'mythic_metal', 'demon_knight_blade', 'demonbone_axe']) }),
  black_dragon_shrine: Object.freeze({ label: '검은 용 제단', area: 'ancient_dragon_altar', unlockLevel: 70, recommendedLevel: '70~85', rooms: 5, drops: Object.freeze(['dragon_scale', 'dragon_claw', 'dragon_heart', 'black_dragon_spear', 'nidhogg_plate']) }),
  demon_king_keep: Object.freeze({ label: '마왕성 내성', area: 'void_gate', unlockLevel: 80, recommendedLevel: '80+', rooms: 5, drops: Object.freeze(['dark_stone', 'demon_horn', 'nightmare_thread', 'kings_crown', 'nidhogg_plate']) }),
  hidden_moonwell_ruins: Object.freeze({ label: '달샘 유적', area: 'moonlit_feywood', unlockLevel: 55, recommendedLevel: '55+', rooms: 5, hidden: true, unlockRequirement: Object.freeze({ type: 'areaProgress', area: 'moonlit_feywood', count: 35 }), rewardMultiplier: 1.2, drops: Object.freeze(['ancient_wood', 'rune_stone', 'shadow_crystal', 'ancient_elf_bow', 'hidden_forest_king_bow']) }),
  hidden_royal_crypt: Object.freeze({ label: '왕가의 비밀묘실', area: 'sunken_catacombs', unlockLevel: 60, recommendedLevel: '60+', rooms: 5, hidden: true, unlockRequirement: Object.freeze({ type: 'areaProgress', area: 'sunken_catacombs', count: 45 }), rewardMultiplier: 1.25, drops: Object.freeze(['ancient_lich_core', 'nightmare_thread', 'shadow_crystal', 'lich_grimoire', 'hidden_moonfang_blade']) }),
  hidden_dragon_forge: Object.freeze({ label: '용심장 화로', area: 'ancient_dragon_altar', unlockLevel: 75, recommendedLevel: '75+', rooms: 5, hidden: true, unlockRequirement: Object.freeze({ type: 'areaProgress', area: 'ancient_dragon_altar', count: 50 }), rewardMultiplier: 1.3, drops: Object.freeze(['dragon_scale', 'dragon_claw', 'dragon_heart', 'black_dragon_spear', 'hidden_dragonheart_hammer']) }),
  hidden_demon_treasury: Object.freeze({ label: '마왕의 보물고', area: 'void_gate', unlockLevel: 85, recommendedLevel: '85+', rooms: 5, hidden: true, unlockRequirement: Object.freeze({ type: 'areaProgress', area: 'void_gate', count: 60 }), rewardMultiplier: 1.35, drops: Object.freeze(['mythic_metal', 'demon_horn', 'nightmare_thread', 'kings_crown', 'nidhogg_plate']) })
});

const RPG_CRAFTING_RECIPES = Object.freeze({
  iron_ingot: Object.freeze({ label: '철괴 가공', category: 'processing', resultItemId: 'iron_ingot', resultQuantity: 1, materials: Object.freeze({ iron_ore: 3 }), gold: 20, requiredLevel: 1, requiredMasteryLevel: 1, masteryType: 'processing', baseSuccessRate: 100, xp: 8, rarity: 'common', resultType: 'item' }),
  silver_ingot: Object.freeze({ label: '은괴 가공', category: 'processing', resultItemId: 'silver_ingot', resultQuantity: 1, materials: Object.freeze({ silver_ore: 3 }), gold: 35, requiredLevel: 10, requiredMasteryLevel: 1, masteryType: 'processing', baseSuccessRate: 100, xp: 10, rarity: 'common', resultType: 'item' }),
  steel_ingot: Object.freeze({ label: '강철괴 제련', category: 'processing', resultItemId: 'steel_ingot', resultQuantity: 1, materials: Object.freeze({ iron_ingot: 2, blessed_metal: 1 }), gold: 80, requiredLevel: 20, requiredMasteryLevel: 2, masteryType: 'processing', baseSuccessRate: 95, xp: 16, rarity: 'rare', resultType: 'item' }),
  potion: Object.freeze({ label: '회복 포션 제작', category: 'consumable', resultItemId: 'potion', resultQuantity: 2, materials: Object.freeze({ healing_herb: 3 }), gold: 30, requiredLevel: 1, requiredMasteryLevel: 1, masteryType: 'alchemy', baseSuccessRate: 100, xp: 7, rarity: 'common', resultType: 'item' }),
  detox_potion: Object.freeze({ label: '해독제 제작', category: 'consumable', resultItemId: 'detox_potion', resultQuantity: 1, materials: Object.freeze({ healing_herb: 2, poison_sac: 1 }), gold: 50, requiredLevel: 8, requiredMasteryLevel: 1, masteryType: 'alchemy', baseSuccessRate: 95, xp: 9, rarity: 'common', resultType: 'item' }),
  fire_rune: Object.freeze({ label: '화염 룬 제작', category: 'rune', resultItemId: 'fire_rune', resultQuantity: 1, materials: Object.freeze({ rune_stone: 2, magic_crystal: 1 }), gold: 160, requiredLevel: 20, requiredMasteryLevel: 2, masteryType: 'rune', baseSuccessRate: 90, xp: 18, rarity: 'rare', resultType: 'item' }),
  lightning_rune: Object.freeze({ label: '번개 룬 제작', category: 'rune', resultItemId: 'lightning_rune', resultQuantity: 1, materials: Object.freeze({ rune_stone: 2, magic_crystal: 2 }), gold: 220, requiredLevel: 30, requiredMasteryLevel: 3, masteryType: 'rune', baseSuccessRate: 82, xp: 24, rarity: 'epic', resultType: 'item' }),
  iron_longsword: Object.freeze({ label: '철 장검', category: 'weapon', resultItemId: 'iron_longsword', materials: Object.freeze({ iron_ingot: 5, tough_leather: 2, lesser_magic_stone: 1 }), gold: 120, requiredLevel: 10, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 90, xp: 12, rarity: 'uncommon', resultType: 'gear', value: 420 }),
  oak_shortbow: Object.freeze({ label: '참나무 단궁', category: 'weapon', resultItemId: 'oak_shortbow', materials: Object.freeze({ hardwood: 3, tough_leather: 1 }), gold: 90, requiredLevel: 8, requiredMasteryLevel: 1, masteryType: 'weapon', baseSuccessRate: 94, xp: 10, rarity: 'uncommon', resultType: 'gear', value: 360 }),
  iron_dagger: Object.freeze({ label: '철 단검', category: 'weapon', resultItemId: 'iron_dagger', materials: Object.freeze({ iron_ingot: 3, tough_leather: 1 }), gold: 100, requiredLevel: 10, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 91, xp: 11, rarity: 'uncommon', resultType: 'gear', value: 380 }),
  iron_spear: Object.freeze({ label: '철창', category: 'weapon', resultItemId: 'iron_spear', materials: Object.freeze({ iron_ingot: 4, hardwood: 2 }), gold: 130, requiredLevel: 12, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 88, xp: 13, rarity: 'uncommon', resultType: 'gear', value: 470 }),
  reinforced_leather_armor: Object.freeze({ label: '보강 가죽갑옷', category: 'armor', resultItemId: 'reinforced_leather_armor', materials: Object.freeze({ tough_leather: 5, iron_ingot: 2 }), gold: 150, requiredLevel: 12, requiredMasteryLevel: 2, masteryType: 'armor', baseSuccessRate: 88, xp: 14, rarity: 'uncommon', resultType: 'gear', value: 520 }),
  silver_ring: Object.freeze({ label: '은 반지', category: 'accessory', resultItemId: 'silver_ring', materials: Object.freeze({ silver_ingot: 2, lesser_magic_stone: 1 }), gold: 190, requiredLevel: 18, requiredMasteryLevel: 2, masteryType: 'accessory', baseSuccessRate: 86, xp: 16, rarity: 'uncommon', resultType: 'gear', value: 620 }),
  hunter_bow: Object.freeze({ label: '사냥꾼의 활', category: 'weapon', resultItemId: 'hunter_bow', materials: Object.freeze({ hardwood: 4, tough_leather: 3 }), gold: 110, requiredLevel: 10, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 92, xp: 12, rarity: 'uncommon', resultType: 'gear', value: 400 }),
  apprentice_staff: Object.freeze({ label: '수습 마법사의 지팡이', category: 'weapon', resultItemId: 'apprentice_staff', materials: Object.freeze({ hardwood: 3, lesser_magic_stone: 2 }), gold: 110, requiredLevel: 10, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 92, xp: 12, rarity: 'uncommon', resultType: 'gear', value: 410 }),
  holy_mace: Object.freeze({ label: '신성한 철퇴', category: 'weapon', resultItemId: 'holy_mace', materials: Object.freeze({ iron_ingot: 4, holy_water: 1 }), gold: 140, requiredLevel: 12, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 88, xp: 14, rarity: 'uncommon', resultType: 'gear', value: 460 }),
  rogue_dagger: Object.freeze({ label: '도적의 단검', category: 'weapon', resultItemId: 'rogue_dagger', materials: Object.freeze({ iron_ingot: 3, poison_sac: 1 }), gold: 140, requiredLevel: 12, requiredMasteryLevel: 2, masteryType: 'weapon', baseSuccessRate: 88, xp: 14, rarity: 'uncommon', resultType: 'gear', value: 470 }),
  healer_charm: Object.freeze({ label: '치유사의 부적', category: 'accessory', resultItemId: 'healer_charm', materials: Object.freeze({ holy_water: 3, silver_ingot: 1, healing_herb: 3 }), gold: 280, requiredLevel: 18, requiredMasteryLevel: 3, masteryType: 'accessory', baseSuccessRate: 84, xp: 20, rarity: 'rare', resultType: 'gear', value: 820 }),
  silver_longsword: Object.freeze({ label: '은빛 장검', category: 'weapon', resultItemId: 'silver_longsword', materials: Object.freeze({ silver_ingot: 5, lesser_magic_stone: 3, wolf_fang: 2 }), gold: 420, requiredLevel: 25, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 78, xp: 30, rarity: 'rare', resultType: 'gear', value: 1050 }),
  steel_halberd: Object.freeze({ label: '강철 할버드', category: 'weapon', resultItemId: 'steel_halberd', materials: Object.freeze({ steel_ingot: 5, hardwood: 3, wolf_fang: 2 }), gold: 520, requiredLevel: 28, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 76, xp: 32, rarity: 'rare', resultType: 'gear', value: 1220 }),
  steel_crossbow: Object.freeze({ label: '강철 석궁', category: 'weapon', resultItemId: 'steel_crossbow', materials: Object.freeze({ steel_ingot: 4, hardwood: 5, tough_leather: 2 }), gold: 500, requiredLevel: 28, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 76, xp: 32, rarity: 'rare', resultType: 'gear', value: 1200 }),
  battle_axe: Object.freeze({ label: '전투도끼', category: 'weapon', resultItemId: 'battle_axe', materials: Object.freeze({ steel_ingot: 6, blessed_metal: 1 }), gold: 620, requiredLevel: 30, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 72, xp: 36, rarity: 'rare', resultType: 'gear', value: 1380 }),
  priest_codex: Object.freeze({ label: '사제의 성서', category: 'weapon', resultItemId: 'priest_codex', materials: Object.freeze({ holy_water: 5, silver_ingot: 2, ancient_wood: 1 }), gold: 460, requiredLevel: 25, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 78, xp: 30, rarity: 'rare', resultType: 'gear', value: 1120 }),
  assassin_twinblades: Object.freeze({ label: '암살자의 쌍검', category: 'weapon', resultItemId: 'assassin_twinblades', materials: Object.freeze({ steel_ingot: 6, poison_sac: 4, black_leather: 3 }), gold: 680, requiredLevel: 25, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 72, xp: 36, rarity: 'rare', resultType: 'gear', value: 1350 }),
  poison_dagger: Object.freeze({ label: '맹독 단검', category: 'weapon', resultItemId: 'poison_dagger', materials: Object.freeze({ steel_ingot: 4, poison_sac: 6, black_leather: 2 }), gold: 660, requiredLevel: 30, requiredMasteryLevel: 4, masteryType: 'weapon', baseSuccessRate: 72, xp: 36, rarity: 'rare', resultType: 'gear', value: 1340 }),
  rune_armor: Object.freeze({ label: '룬 갑옷', category: 'armor', resultItemId: 'rune_armor', materials: Object.freeze({ steel_ingot: 8, rune_stone: 2, tough_leather: 4 }), gold: 740, requiredLevel: 30, requiredMasteryLevel: 4, masteryType: 'armor', baseSuccessRate: 72, xp: 38, rarity: 'rare', resultType: 'gear', value: 1500 }),
  shadow_hood: Object.freeze({ label: '그림자 두건', category: 'accessory', resultItemId: 'shadow_hood', materials: Object.freeze({ black_leather: 4, shadow_crystal: 1, poison_sac: 2 }), gold: 720, requiredLevel: 32, requiredMasteryLevel: 4, masteryType: 'accessory', baseSuccessRate: 70, xp: 38, rarity: 'rare', resultType: 'gear', value: 1460 }),
  fire_rune_blade: Object.freeze({ label: '화염 룬검', category: 'weapon', resultItemId: 'fire_rune_blade', materials: Object.freeze({ steel_ingot: 6, fire_rune: 2, magic_crystal: 3 }), gold: 980, requiredLevel: 35, requiredMasteryLevel: 5, masteryType: 'weapon', baseSuccessRate: 64, xp: 50, rarity: 'epic', resultType: 'gear', value: 2300 }),
  ice_guard_plate: Object.freeze({ label: '냉기 수호갑옷', category: 'armor', resultItemId: 'ice_guard_plate', materials: Object.freeze({ steel_ingot: 8, ice_rune: 2, tough_leather: 5 }), gold: 1050, requiredLevel: 38, requiredMasteryLevel: 5, masteryType: 'armor', baseSuccessRate: 62, xp: 52, rarity: 'epic', resultType: 'gear', value: 2500 }),
  lightning_wand: Object.freeze({ label: '번개 완드', category: 'weapon', resultItemId: 'lightning_wand', materials: Object.freeze({ ancient_wood: 2, lightning_rune: 2, magic_crystal: 5 }), gold: 1060, requiredLevel: 38, requiredMasteryLevel: 5, masteryType: 'weapon', baseSuccessRate: 62, xp: 52, rarity: 'epic', resultType: 'gear', value: 2520 }),
  storm_staff: Object.freeze({ label: '폭풍 지팡이', category: 'weapon', resultItemId: 'storm_staff', materials: Object.freeze({ magic_crystal: 5, lightning_rune: 2, ancient_wood: 1 }), gold: 1100, requiredLevel: 35, requiredMasteryLevel: 5, masteryType: 'weapon', baseSuccessRate: 62, xp: 52, rarity: 'epic', resultType: 'gear', value: 2400 }),
  blessed_plate: Object.freeze({ label: '축복받은 판금갑옷', category: 'armor', resultItemId: 'blessed_plate', materials: Object.freeze({ steel_ingot: 10, blessed_metal: 3, holy_water: 8 }), gold: 1400, requiredLevel: 45, requiredMasteryLevel: 6, masteryType: 'armor', baseSuccessRate: 58, xp: 68, rarity: 'epic', resultType: 'gear', value: 3400 }),
  sacred_silver_staff: Object.freeze({ label: '성은 지팡이', category: 'weapon', resultItemId: 'sacred_silver_staff', materials: Object.freeze({ blessed_silver_ingot: 4, ancient_wood: 2, holy_rune: 2 }), gold: 1500, requiredLevel: 45, requiredMasteryLevel: 6, masteryType: 'weapon', baseSuccessRate: 56, xp: 70, rarity: 'epic', resultType: 'gear', value: 3600 }),
  ancient_elf_bow: Object.freeze({ label: '고대 엘프 장궁', category: 'weapon', resultItemId: 'ancient_elf_bow', materials: Object.freeze({ ancient_wood: 4, rune_stone: 5, magic_crystal: 4 }), gold: 1600, requiredLevel: 48, requiredMasteryLevel: 6, masteryType: 'weapon', baseSuccessRate: 55, xp: 74, rarity: 'epic', resultType: 'gear', value: 3900 }),
  demonbone_axe: Object.freeze({ label: '악마뼈 도끼', category: 'weapon', resultItemId: 'demonbone_axe', materials: Object.freeze({ demon_horn: 3, dark_stone: 8, mythic_metal: 1 }), gold: 2100, requiredLevel: 55, requiredMasteryLevel: 7, masteryType: 'weapon', baseSuccessRate: 44, xp: 92, rarity: 'legendary', resultType: 'gear', value: 6800, coreMaterials: Object.freeze(['demon_horn', 'mythic_metal']) }),
  dragon_scale_shield: Object.freeze({ label: '용비늘 방패', category: 'armor', resultItemId: 'dragon_scale_shield', materials: Object.freeze({ dragon_scale: 6, blessed_metal: 4, fire_rune: 2 }), gold: 2200, requiredLevel: 58, requiredMasteryLevel: 7, masteryType: 'armor', baseSuccessRate: 44, xp: 94, rarity: 'legendary', resultType: 'gear', value: 6900, coreMaterials: Object.freeze(['dragon_scale', 'blessed_metal']) }),
  dragon_scale_greatsword: Object.freeze({ label: '용비늘 대검', category: 'weapon', resultItemId: 'dragon_scale_greatsword', materials: Object.freeze({ dragon_scale: 8, dragon_claw: 2, mythic_metal: 1 }), gold: 2000, requiredLevel: 55, requiredMasteryLevel: 7, masteryType: 'weapon', baseSuccessRate: 45, xp: 90, rarity: 'legendary', resultType: 'gear', value: 6500, coreMaterials: Object.freeze(['dragon_scale', 'dragon_claw', 'mythic_metal']) }),
  black_dragon_spear: Object.freeze({ label: '검은 용창', category: 'weapon', resultItemId: 'black_dragon_spear', materials: Object.freeze({ dragon_scale: 10, dragon_claw: 3, dragon_heart: 1, mythic_metal: 1 }), gold: 3200, requiredLevel: 65, requiredMasteryLevel: 8, masteryType: 'weapon', baseSuccessRate: 34, xp: 125, rarity: 'legendary', resultType: 'gear', value: 9200, coreMaterials: Object.freeze(['dragon_claw', 'dragon_heart']) }),
  lich_grimoire: Object.freeze({ label: '리치의 마도서', category: 'weapon', resultItemId: 'lich_grimoire', materials: Object.freeze({ ancient_lich_core: 1, dark_stone: 10, magic_crystal: 15 }), gold: 2400, requiredLevel: 60, requiredMasteryLevel: 7, masteryType: 'weapon', baseSuccessRate: 42, xp: 100, rarity: 'legendary', resultType: 'gear', value: 7200, coreMaterials: Object.freeze(['ancient_lich_core']) }),
  sanctuary_armor: Object.freeze({ label: '성역의 갑옷', category: 'armor', resultItemId: 'sanctuary_armor', materials: Object.freeze({ blessed_silver_ingot: 10, holy_water: 20, angel_feather: 1 }), gold: 2400, requiredLevel: 60, requiredMasteryLevel: 7, masteryType: 'armor', baseSuccessRate: 42, xp: 100, rarity: 'legendary', resultType: 'gear', value: 7200, coreMaterials: Object.freeze(['angel_feather']) }),
  shadow_cloak: Object.freeze({ label: '그림자 망토', category: 'accessory', resultItemId: 'shadow_cloak', materials: Object.freeze({ nightmare_thread: 5, black_leather: 10, shadow_crystal: 2 }), gold: 1800, requiredLevel: 55, requiredMasteryLevel: 6, masteryType: 'accessory', baseSuccessRate: 55, xp: 80, rarity: 'epic', resultType: 'gear', value: 5200, coreMaterials: Object.freeze(['shadow_crystal']) }),
  kings_crown: Object.freeze({ label: '왕국의 왕관', category: 'accessory', resultItemId: 'kings_crown', materials: Object.freeze({ blessed_silver_ingot: 8, angel_feather: 1, mythic_metal: 1, holy_rune: 3 }), gold: 2800, requiredLevel: 70, requiredMasteryLevel: 8, masteryType: 'accessory', baseSuccessRate: 38, xp: 115, rarity: 'legendary', resultType: 'gear', value: 8400, coreMaterials: Object.freeze(['angel_feather', 'mythic_metal']) }),
  nidhogg_plate: Object.freeze({ label: '니드호그 갑옷', category: 'armor', resultItemId: 'nidhogg_plate', materials: Object.freeze({ dragon_scale: 16, dragon_heart: 2, mythic_metal: 3, demon_horn: 4 }), gold: 5200, requiredLevel: 80, requiredMasteryLevel: 9, masteryType: 'armor', baseSuccessRate: 24, xp: 180, rarity: 'mythic', resultType: 'gear', value: 16000, hidden: true, coreMaterials: Object.freeze(['dragon_heart', 'mythic_metal']) }),
  hidden_moonfang_blade: Object.freeze({ label: '월아의 비밀검', category: 'weapon', resultItemId: 'hidden_moonfang_blade', materials: Object.freeze({ silver_ingot: 8, shadow_crystal: 3, demon_horn: 1 }), gold: 3200, requiredLevel: 60, requiredMasteryLevel: 8, masteryType: 'weapon', baseSuccessRate: 32, xp: 130, rarity: 'mythic', resultType: 'gear', value: 9800, hidden: true, coreMaterials: Object.freeze(['shadow_crystal', 'demon_horn']) }),
  hidden_arden_halo: Object.freeze({ label: '아르덴 성광륜', category: 'accessory', resultItemId: 'hidden_arden_halo', materials: Object.freeze({ blessed_silver_ingot: 12, holy_rune: 3, angel_feather: 2 }), gold: 3600, requiredLevel: 65, requiredMasteryLevel: 8, masteryType: 'accessory', baseSuccessRate: 30, xp: 140, rarity: 'mythic', resultType: 'gear', value: 10500, hidden: true, coreMaterials: Object.freeze(['angel_feather']) }),
  hidden_dragonheart_hammer: Object.freeze({ label: '용의심장 대장장이 망치', category: 'blacksmith', resultItemId: 'hidden_dragonheart_hammer', materials: Object.freeze({ dragon_scale: 12, dragon_claw: 4, dragon_heart: 1, mythic_metal: 1, artisan_hammer: 1 }), gold: 4200, requiredLevel: 65, requiredMasteryLevel: 8, masteryType: 'engineering', baseSuccessRate: 28, xp: 150, rarity: 'mythic', resultType: 'gear', value: 12000, hidden: true, requiredClass: 'blacksmith', coreMaterials: Object.freeze(['dragon_claw', 'dragon_heart', 'mythic_metal']) }),
  hidden_forest_king_bow: Object.freeze({ label: '숲왕의 장궁', category: 'weapon', resultItemId: 'hidden_forest_king_bow', materials: Object.freeze({ ancient_wood: 4, dragon_claw: 1, rune_stone: 8, wolf_fang: 6 }), gold: 3000, requiredLevel: 55, requiredMasteryLevel: 7, masteryType: 'weapon', baseSuccessRate: 35, xp: 120, rarity: 'mythic', resultType: 'gear', value: 9400, hidden: true, coreMaterials: Object.freeze(['dragon_claw', 'ancient_wood']) })
});

const RPG_QUESTS = Object.freeze({
  first_blood: Object.freeze({ label: '첫 사냥', description: '아무 몬스터나 1회 승리', requirement: Object.freeze({ type: 'wins', count: 1 }), rewards: Object.freeze({ xp: 40, coins: 120, items: Object.freeze({ potion: 1 }) }) }),
  slime_slayer: Object.freeze({ label: '초원 정리', description: '슬라임 3마리 처치', requirement: Object.freeze({ type: 'monsterKills', monster: '슬라임', count: 3 }), rewards: Object.freeze({ xp: 120, coins: 300, items: Object.freeze({ potion: 2 }) }) }),
  cave_scout: Object.freeze({ label: '은광 정찰', description: '버려진 은광에서 2회 승리', requirement: Object.freeze({ type: 'areaWins', area: 'cave', count: 2 }), rewards: Object.freeze({ xp: 180, coins: 450, items: Object.freeze({ enhancement_stone: 1 }) }) }),
  boss_challenger: Object.freeze({ label: '보스 도전자', description: '보스 1회 처치', requirement: Object.freeze({ type: 'bossKills', count: 1 }), rewards: Object.freeze({ xp: 250, coins: 800, items: Object.freeze({ mana_potion: 2 }) }) }),
  first_job_preparation: Object.freeze({ label: '첫 전직 준비', description: 'RPG Lv.10을 달성해 1차 전직 준비를 마칩니다.', requirement: Object.freeze({ type: 'level', count: 10 }), rewards: Object.freeze({ xp: 180, coins: 500, items: Object.freeze({ iron_ingot: 2, tough_leather: 2 }) }) }),
  dual_path_oath: Object.freeze({ label: '두 번째 길의 맹세', description: 'RPG Lv.15를 달성해 듀얼 직업 자격을 얻습니다.', requirement: Object.freeze({ type: 'level', count: 15 }), rewards: Object.freeze({ xp: 260, coins: 700, items: Object.freeze({ mana_potion: 2, lesser_magic_stone: 2 }) }) }),
  forge_apprentice: Object.freeze({ label: '대장간 견습', description: '제작을 1회 완료해 장비 제작 흐름을 익힙니다.', requirement: Object.freeze({ type: 'craftedItems', count: 1 }), rewards: Object.freeze({ xp: 220, coins: 600, items: Object.freeze({ iron_ore: 4, artisan_hammer: 1 }) }) }),
  dungeon_mapper: Object.freeze({ label: '던전 지도 제작', description: '던전을 총 3회 클리어해 길드 지도를 보강합니다.', requirement: Object.freeze({ type: 'dungeons', count: 3 }), rewards: Object.freeze({ xp: 420, coins: 1_000, items: Object.freeze({ rune_stone: 1, magic_crystal: 2 }) }) }),
  sacred_relic_hunt: Object.freeze({ label: '성지 유물 수색', description: '저주받은 수도원에서 지역 진행도 40%를 달성합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'mushroom_grove', count: 40 }), rewards: Object.freeze({ xp: 520, coins: 1_200, items: Object.freeze({ holy_water: 5, silver_ingot: 1 }) }) }),
  moonwell_secret: Object.freeze({ label: '달샘의 비밀', description: '달빛 요정숲 진행도 35%를 달성해 숨겨진 길을 찾습니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'moonlit_feywood', count: 35 }), rewards: Object.freeze({ xp: 760, coins: 1_800, items: Object.freeze({ ancient_wood: 2, shadow_crystal: 1 }) }) }),
  dragon_altar_trial: Object.freeze({ label: '고룡 제단의 시련', description: '고룡의 제단 진행도 40%를 달성합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'ancient_dragon_altar', count: 40 }), rewards: Object.freeze({ xp: 1_000, coins: 2_600, items: Object.freeze({ dragon_scale: 2, dragon_claw: 1 }) }) }),
  kingdom_raid_vanguard: Object.freeze({ label: '왕국 레이드 선봉', description: '오크 전쟁군주 레이드를 1회 클리어합니다.', requirement: Object.freeze({ type: 'raidClears', raid: 'orc_warlord', count: 1 }), rewards: Object.freeze({ xp: 1_200, coins: 3_200, items: Object.freeze({ blessed_metal: 2, enhancement_stone: 2 }) }) }),
  demon_frontier_watch: Object.freeze({ label: '마왕성 전초 감시', description: '마왕성 지역 진행도 40%를 달성합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'void_gate', count: 40 }), rewards: Object.freeze({ xp: 1_500, coins: 4_000, items: Object.freeze({ dark_stone: 4, demon_horn: 1 }) }) })
});

const RPG_DAILY_MISSIONS = Object.freeze({
  field_training: Object.freeze({ label: '길드 사냥 의뢰', description: '오늘 사냥/전투를 2회 진행합니다.', requirement: Object.freeze({ type: 'battles', count: 2 }), rewards: Object.freeze({ xp: 120, coins: 300, items: Object.freeze({ potion: 1 }) }) }),
  route_scout: Object.freeze({ label: '탐사 의뢰', description: '오늘 아무 지역이나 1회 탐사합니다.', requirement: Object.freeze({ type: 'explores', count: 1 }), rewards: Object.freeze({ xp: 80, coins: 180, items: Object.freeze({}) }) }),
  dungeon_delver: Object.freeze({ label: '던전 조사', description: '오늘 던전을 1회 클리어합니다.', requirement: Object.freeze({ type: 'dungeons', count: 1 }), rewards: Object.freeze({ xp: 150, coins: 350, items: Object.freeze({ mana_potion: 1 }) }) }),
  victory_contract: Object.freeze({ label: '승리 계약', description: '오늘 전투에서 1회 승리합니다.', requirement: Object.freeze({ type: 'wins', count: 1 }), rewards: Object.freeze({ xp: 100, coins: 260, items: Object.freeze({}) }) }),
  herb_patrol: Object.freeze({ label: '약초 순찰', description: '오늘 탐사를 2회 완료해 길드 약초 지도를 채웁니다.', requirement: Object.freeze({ type: 'explores', count: 2 }), rewards: Object.freeze({ xp: 140, coins: 320, items: Object.freeze({ healing_herb: 2, potion: 1 }) }) }),
  guard_drill: Object.freeze({ label: '왕국 경비 훈련', description: '오늘 사냥/전투를 4회 진행합니다.', requirement: Object.freeze({ type: 'battles', count: 4 }), rewards: Object.freeze({ xp: 220, coins: 520, items: Object.freeze({ tough_leather: 2 }) }) }),
  deep_dungeon_report: Object.freeze({ label: '심층 던전 보고', description: '오늘 던전을 2회 클리어합니다.', requirement: Object.freeze({ type: 'dungeons', count: 2 }), rewards: Object.freeze({ xp: 280, coins: 680, items: Object.freeze({ enhancement_stone: 1, iron_ore: 2 }) }) }),
  boss_bounty: Object.freeze({ label: '현상수배 보스', description: '오늘 보스를 1회 처치합니다.', requirement: Object.freeze({ type: 'bosses', count: 1 }), rewards: Object.freeze({ xp: 320, coins: 900, items: Object.freeze({ mana_potion: 1, magic_crystal: 1 }) }) }),
  raid_supply: Object.freeze({ label: '레이드 보급 임무', description: '오늘 레이드를 1회 클리어합니다.', requirement: Object.freeze({ type: 'raids', count: 1 }), rewards: Object.freeze({ xp: 420, coins: 1_200, items: Object.freeze({ blessed_metal: 1, potion: 2 }) }) }),
  guild_tithe: Object.freeze({ label: '길드 공납 정산', description: '오늘 RPG 활동으로 골드 600 이상을 획득합니다.', requirement: Object.freeze({ type: 'goldEarned', count: 600 }), rewards: Object.freeze({ xp: 180, coins: 450, items: Object.freeze({ silver_ore: 2 }) }) })
});

const RPG_BOSSES = Object.freeze({
  slime_king: Object.freeze({ label: '고블린 족장', area: 'wildflower_plains', unlockLevel: 5, powerMin: 14, powerMax: 26, xpReward: 220, coinReward: 650, monster: '고블린 족장', backgroundAssetId: 'map_goblin_forest' }),
  cave_bat_king: Object.freeze({ label: '폐광 박쥐왕', area: 'cave', unlockLevel: 10, powerMin: 18, powerMax: 32, xpReward: 300, coinReward: 780, monster: '폐광 박쥐왕', backgroundAssetId: 'map_abandoned_silver_mine' }),
  wolf_alpha: Object.freeze({ label: '늑대 우두머리', area: 'forest', unlockLevel: 8, powerMin: 16, powerMax: 30, xpReward: 260, coinReward: 700, monster: '늑대 우두머리', backgroundAssetId: 'map_royal_south_plains' }),
  spider_queen: Object.freeze({ label: '숲거미 여왕', area: 'wildflower_plains', unlockLevel: 12, powerMin: 22, powerMax: 38, xpReward: 420, coinReward: 1000, monster: '숲거미 여왕', backgroundAssetId: 'map_goblin_forest' }),
  orc_warlord: Object.freeze({ label: '오크 전쟁군주', area: 'ruins', unlockLevel: 30, powerMin: 42, powerMax: 62, xpReward: 900, coinReward: 2300, monster: '오크 전쟁군주', backgroundAssetId: 'map_red_canyon' }),
  cursed_abbot: Object.freeze({ label: '저주받은 수도원장', area: 'mushroom_grove', unlockLevel: 28, powerMin: 38, powerMax: 58, xpReward: 820, coinReward: 2100, monster: '저주받은 사제', backgroundAssetId: 'map_cursed_monastery' }),
  marsh_hydra: Object.freeze({ label: '늪지 히드라', area: 'moonlit_hill', unlockLevel: 35, powerMin: 50, powerMax: 72, xpReward: 1300, coinReward: 3000, monster: '늪지 히드라', backgroundAssetId: 'map_mist_marsh' }),
  red_wyvern: Object.freeze({ label: '붉은 와이번', area: 'ruins', unlockLevel: 40, powerMin: 54, powerMax: 78, xpReward: 1500, coinReward: 3400, monster: '붉은 와이번', backgroundAssetId: 'map_red_canyon' }),
  frost_giant: Object.freeze({ label: '서리 거인', area: 'bandit_outpost', unlockLevel: 50, powerMin: 62, powerMax: 86, xpReward: 1900, coinReward: 4000, monster: '서리 거인', backgroundAssetId: 'map_frozen_mountains' }),
  ancient_lich: Object.freeze({ label: '고대 리치', area: 'red_desert', unlockLevel: 55, powerMin: 68, powerMax: 92, xpReward: 2200, coinReward: 4600, monster: '고대 리치', backgroundAssetId: 'map_ancient_elf_ruins' }),
  fallen_paladin: Object.freeze({ label: '타락한 성기사', area: 'crystal_lake', unlockLevel: 60, powerMin: 72, powerMax: 98, xpReward: 2600, coinReward: 5200, monster: '타락한 성기사', backgroundAssetId: 'map_sacred_arden' }),
  ancient_dragon: Object.freeze({ label: '검은 용 베르카르', area: 'dragon_nest', unlockLevel: 75, powerMin: 60, powerMax: 88, xpReward: 1500, coinReward: 4200, monster: '검은 용 베르카르', backgroundAssetId: 'map_black_dragon_lair' }),
  demon_apostle: Object.freeze({ label: '마왕의 사도', area: 'frost', unlockLevel: 80, powerMin: 92, powerMax: 120, xpReward: 4200, coinReward: 8200, monster: '마왕의 사도', backgroundAssetId: 'map_demon_king_outer_wall' }),
  nightmare_knight: Object.freeze({ label: '악몽의 기사', area: 'void_gate', unlockLevel: 82, powerMin: 96, powerMax: 126, xpReward: 4600, coinReward: 9000, monster: '악몽의 기사', backgroundAssetId: 'map_demon_king_castle' }),
  demon_king_valtar: Object.freeze({ label: '마왕 발타르', area: 'void_gate', unlockLevel: 85, powerMin: 108, powerMax: 142, xpReward: 6500, coinReward: 14000, monster: '마왕 발타르', backgroundAssetId: 'map_demon_king_castle' })
});

const RPG_BOSS_PATTERNS = Object.freeze({
  slime_king: Object.freeze([
    Object.freeze({ id: 'summon_goblins', label: '부하 소환', description: '고블린 족장이 부하를 불러 전열을 흔듭니다.', telegraph: '뿔나팔을 들어 올립니다.', counterAction: 'skill', counterLabel: '광역/정밀 스킬로 차단', weaknessSkillIds: Object.freeze(['fireball', 'aimed_shot', 'combo_slash']), weaknessLabel: '광역 또는 약점 공격', damageMultiplier: 1.05, guardMitigationRate: 0.55 }),
    Object.freeze({ id: 'chief_charge', label: '족장 돌진', description: '전방으로 돌진해 큰 피해를 줍니다.', telegraph: '방패를 낮추고 달려들 준비를 합니다.', counterAction: 'guard', counterLabel: '방어/도발로 막기', weaknessSkillIds: Object.freeze(['guard_stance', 'taunt', 'hammer_slam']), weaknessLabel: '방어/기절', damageMultiplier: 1.45, guardMitigationRate: 0.72 }),
    Object.freeze({ id: 'war_cry', label: '전쟁 함성', description: '파티 방어를 낮추는 함성입니다.', telegraph: '깃발이 붉게 흔들립니다.', counterAction: 'skill', counterLabel: '정화/운명 재굴림', weaknessSkillIds: Object.freeze(['heal', 'fate_flip', 'armor_break']), weaknessLabel: '정화/방어구 파괴/재굴림', damageMultiplier: 1.2, guardMitigationRate: 0.6 })
  ]),
  ancient_dragon: Object.freeze([
    Object.freeze({ id: 'flame_breath', label: '화염 브레스', description: '검은 용이 전장을 불길로 덮습니다.', telegraph: '목 안쪽에서 검붉은 불빛이 차오릅니다.', counterAction: 'guard', counterLabel: '보호막과 성역으로 분산', weaknessSkillIds: Object.freeze(['taunt', 'heal', 'guard_stance']), weaknessLabel: '보호/회복', damageMultiplier: 1.3, guardMitigationRate: 0.62 }),
    Object.freeze({ id: 'air_phase', label: '공중 비행', description: '하늘로 올라 약점 노출 시간이 짧아집니다.', telegraph: '날개를 크게 펼칩니다.', counterAction: 'skill', counterLabel: '궁수/마법사가 약점 조준', weaknessSkillIds: Object.freeze(['aimed_shot', 'fireball', 'card_draw']), weaknessLabel: '원거리/마법/행운', damageMultiplier: 1.5, guardMitigationRate: 0.65 }),
    Object.freeze({ id: 'dragon_rage', label: '용의 분노', description: '가장 위험한 광역 폭발 패턴입니다.', telegraph: '용비늘이 검게 달아오릅니다.', counterAction: 'ultimate', counterLabel: '차단, 방어구 파괴, 발리스타 대응', weaknessSkillIds: Object.freeze(['combo_slash', 'armor_break', 'hammer_slam', 'fate_flip']), weaknessLabel: '차단/방어구 파괴/운명 재굴림', damageMultiplier: 1.85, guardMitigationRate: 0.75 })
  ])
});

const RPG_ADVANCED_CLASSES = Object.freeze({
  berserker: Object.freeze({ label: '광전사', baseClass: 'warrior', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '피의 결의', requirement: Object.freeze({ type: 'wins', count: 5 }) }), description: 'HP가 낮을수록 강해지는 2차 검사 계열.', stats: Object.freeze({ attack: 6, maxHp: 15 }), assetId: 'hero_berserker_idle', assetIds: Object.freeze({ male: 'hero_berserker_idle', female: 'hero_female_berserker_idle' }) }),
  swordmaster: Object.freeze({ label: '검술가', baseClass: 'warrior', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '연계 수련', requirement: Object.freeze({ type: 'areaProgress', area: 'forest', count: 40 }) }), description: '연속 공격, 반격, 치명타에 특화된 2차 검사.', stats: Object.freeze({ attack: 5, defense: 2 }), assetId: 'hero_warrior_idle', assetIds: Object.freeze({ male: 'hero_warrior_idle', female: 'hero_female_warrior_idle' }) }),
  lancer: Object.freeze({ label: '창기사', baseClass: 'warrior', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '창술 시련', requirement: Object.freeze({ type: 'areaProgress', area: 'ruins', count: 35 }) }), description: '창과 할버드로 관통 피해와 전열 제압을 맡는 2차 검사.', stats: Object.freeze({ attack: 4, defense: 3, maxHp: 15 }), assetId: 'hero_warrior_idle', assetIds: Object.freeze({ male: 'hero_warrior_idle', female: 'hero_female_warrior_idle' }) }),
  blood_warlord: Object.freeze({ label: '피의 전쟁군주', baseClass: 'warrior', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '오크 전쟁군주 격파', requirement: Object.freeze({ type: 'raidClears', raid: 'orc_warlord', count: 1 }) }), description: '흡혈과 광폭화로 지속 전투를 이어가는 3차 직업.', stats: Object.freeze({ attack: 10, maxHp: 35 }), assetId: 'hero_berserker_idle', assetIds: Object.freeze({ male: 'hero_berserker_idle', female: 'hero_female_berserker_idle' }) }),
  giantslayer: Object.freeze({ label: '거인 학살자', baseClass: 'warrior', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '대형 보스 연구', requirement: Object.freeze({ type: 'bossKills', count: 3 }) }), description: '보스와 대형 몬스터 추가 피해에 특화된 3차 검사.', stats: Object.freeze({ attack: 11, defense: 2 }), assetId: 'hero_warrior_idle', assetIds: Object.freeze({ male: 'hero_warrior_idle', female: 'hero_female_warrior_idle' }) }),
  archmage: Object.freeze({ label: '원소술사', baseClass: 'mage', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '마력 정찰', requirement: Object.freeze({ type: 'explores', count: 3 }) }), description: '화염/냉기/번개 속성에 특화된 2차 마법사.', stats: Object.freeze({ attack: 5, maxMp: 35 }), assetId: 'hero_archmage_idle', assetIds: Object.freeze({ male: 'hero_archmage_idle', female: 'hero_female_archmage_idle' }) }),
  warlock: Object.freeze({ label: '흑마법사', baseClass: 'mage', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '저주 연구', requirement: Object.freeze({ type: 'monsterKills', monster: '망령', count: 3 }) }), description: '저주, 흡수, 지속 피해를 다루는 2차 마법사.', stats: Object.freeze({ attack: 6, maxMp: 25 }), assetId: 'hero_mage_idle', assetIds: Object.freeze({ male: 'hero_mage_idle', female: 'hero_female_mage_idle' }) }),
  ice_magus: Object.freeze({ label: '빙결술사', baseClass: 'mage', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '서리 정령 연구', requirement: Object.freeze({ type: 'monsterKills', monster: '서리정령', count: 3 }) }), description: '빙결과 감속으로 전장을 통제하는 2차 마법사.', stats: Object.freeze({ attack: 4, defense: 1, maxMp: 35 }), assetId: 'hero_mage_idle', assetIds: Object.freeze({ male: 'hero_mage_idle', female: 'hero_female_mage_idle' }) }),
  grand_magus: Object.freeze({ label: '대마도사', baseClass: 'mage', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '마탑 서고 개방', requirement: Object.freeze({ type: 'areaProgress', area: 'thunder_plateau', count: 40 }) }), description: '강력한 광역 마법을 쓰는 3차 마법사.', stats: Object.freeze({ attack: 10, maxMp: 60 }), assetId: 'hero_archmage_idle', assetIds: Object.freeze({ male: 'hero_archmage_idle', female: 'hero_female_archmage_idle' }) }),
  sniper: Object.freeze({ label: '명사수', baseClass: 'ranger', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '숲길 정찰', requirement: Object.freeze({ type: 'areaProgress', area: 'wildflower_plains', count: 35 }) }), description: '치명타와 약점 조준에 특화된 2차 궁수.', stats: Object.freeze({ attack: 5, defense: 1 }), assetId: 'hero_sniper_idle', assetIds: Object.freeze({ male: 'hero_sniper_idle', female: 'hero_female_sniper_idle' }) }),
  hunter: Object.freeze({ label: '사냥꾼', baseClass: 'ranger', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '덫 설치 훈련', requirement: Object.freeze({ type: 'explores', count: 4 }) }), description: '덫, 추적, 야수 동료를 활용하는 2차 궁수.', stats: Object.freeze({ attack: 4, maxHp: 15, maxMp: 10 }), assetId: 'hero_ranger_idle', assetIds: Object.freeze({ male: 'hero_ranger_idle', female: 'hero_female_ranger_idle' }) }),
  crossbowman: Object.freeze({ label: '쇠뇌병', baseClass: 'ranger', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '관통 사격 훈련', requirement: Object.freeze({ type: 'wins', count: 6 }) }), description: '석궁과 손쇠뇌로 방어구 관통 피해를 노리는 2차 궁수.', stats: Object.freeze({ attack: 6, defense: 1 }), assetId: 'hero_sniper_idle', assetIds: Object.freeze({ male: 'hero_sniper_idle', female: 'hero_female_sniper_idle' }) }),
  dragon_hunter: Object.freeze({ label: '용사냥꾼', baseClass: 'ranger', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '용의 둥지 정찰', requirement: Object.freeze({ type: 'areaProgress', area: 'dragon_nest', count: 40 }) }), description: '대형/비행 보스에 강한 3차 궁수.', stats: Object.freeze({ attack: 11, maxMp: 20 }), assetId: 'hero_sniper_idle', assetIds: Object.freeze({ male: 'hero_sniper_idle', female: 'hero_female_sniper_idle' }) }),
  guardian_knight: Object.freeze({ label: '수호기사', baseClass: 'paladin', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '보스 수호 맹세', requirement: Object.freeze({ type: 'bossKills', count: 1 }) }), description: '파티 보호에 특화된 2차 성기사.', stats: Object.freeze({ defense: 5, maxHp: 35 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  crusader: Object.freeze({ label: '성전사', baseClass: 'paladin', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '성전 선포', requirement: Object.freeze({ type: 'wins', count: 5 }) }), description: '방어와 공격 균형을 잡은 2차 성기사.', stats: Object.freeze({ attack: 4, defense: 4, maxHp: 20 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  templar_guardian: Object.freeze({ label: '성전 수호자', baseClass: 'paladin', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '성지 수호 서약', requirement: Object.freeze({ type: 'explores', count: 5 }) }), description: '성지 방어와 파티 보호에 특화된 2차 성기사.', stats: Object.freeze({ defense: 4, maxHp: 30, maxMp: 10 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  royal_shield: Object.freeze({ label: '왕국의 방패', baseClass: 'paladin', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '길드 레이드 방어', requirement: Object.freeze({ type: 'raidClears', raid: 'orc_warlord', count: 1 }) }), description: '광역 보호막과 피해 분산을 쓰는 3차 성기사.', stats: Object.freeze({ defense: 9, maxHp: 55, maxMp: 20 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  saint: Object.freeze({ label: '사제', baseClass: 'priest', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '성소 순례', requirement: Object.freeze({ type: 'explores', count: 3 }) }), description: '순수 회복에 특화된 2차 성직자.', stats: Object.freeze({ defense: 2, maxMp: 40 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  exorcist: Object.freeze({ label: '퇴마사', baseClass: 'priest', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '언데드 정화', requirement: Object.freeze({ type: 'monsterKills', monster: '스켈레톤', count: 3 }) }), description: '언데드/악마 특화 공격형 성직자.', stats: Object.freeze({ attack: 4, maxMp: 30 }), assetId: 'hero_priest_idle', assetIds: Object.freeze({ male: 'hero_priest_idle', female: 'hero_female_priest_idle' }) }),
  oracle: Object.freeze({ label: '예언자', baseClass: 'priest', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '성소 계시', requirement: Object.freeze({ type: 'explores', count: 5 }) }), description: '계시와 축복으로 아군의 전투 흐름을 안정시키는 2차 성직자.', stats: Object.freeze({ defense: 1, maxMp: 45 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  archbishop: Object.freeze({ label: '대주교', baseClass: 'priest', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '성역 유지', requirement: Object.freeze({ type: 'raidClears', raid: 'ancient_lich', count: 1 }) }), description: '대량 회복과 부활을 담당하는 3차 성직자.', stats: Object.freeze({ defense: 5, maxMp: 70, maxHp: 20 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  shadow: Object.freeze({ label: '암살자', baseClass: 'rogue', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '그림자 결투', requirement: Object.freeze({ type: 'wins', count: 5 }) }), description: '단일 폭딜에 특화된 2차 도적.', stats: Object.freeze({ attack: 7 }), assetId: 'hero_shadow_idle', assetIds: Object.freeze({ male: 'hero_shadow_idle', female: 'hero_female_shadow_idle' }) }),
  phantom_thief: Object.freeze({ label: '괴도', baseClass: 'rogue', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '보물 회수', requirement: Object.freeze({ type: 'explores', count: 4 }) }), description: '아이템 획득, 회피, 교란에 강한 2차 도적.', stats: Object.freeze({ attack: 4, defense: 2, maxMp: 20 }), assetId: 'hero_rogue_idle', assetIds: Object.freeze({ male: 'hero_rogue_idle', female: 'hero_female_rogue_idle' }) }),
  scout: Object.freeze({ label: '척후병', baseClass: 'rogue', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '늪지 정찰', requirement: Object.freeze({ type: 'areaProgress', area: 'marsh', count: 30 }) }), description: '정찰, 기습, 함정 탐지로 탐사와 던전을 유리하게 여는 2차 도적.', stats: Object.freeze({ attack: 4, defense: 2, maxMp: 15 }), assetId: 'hero_rogue_idle', assetIds: Object.freeze({ male: 'hero_rogue_idle', female: 'hero_female_rogue_idle' }) }),
  treasure_hunter: Object.freeze({ label: '보물 사냥꾼', baseClass: 'rogue', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '유물 탐색', requirement: Object.freeze({ type: 'dungeonClears', area: 'red_desert', count: 1 }) }), description: '드롭률과 유물 탐색에 특화된 3차 도적.', stats: Object.freeze({ attack: 8, defense: 3, maxMp: 30 }), assetId: 'hero_rogue_idle', assetIds: Object.freeze({ male: 'hero_rogue_idle', female: 'hero_female_rogue_idle' }) }),
  card_mage: Object.freeze({ label: '카드술사', baseClass: 'tazza', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '행운의 카드', requirement: Object.freeze({ type: 'wins', count: 5 }) }), description: '카드 효과로 버프와 약화를 거는 2차 타짜.', stats: Object.freeze({ attack: 4, maxMp: 25 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  dice_gambler: Object.freeze({ label: '주사위꾼', baseClass: 'tazza', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '주사위 운명', requirement: Object.freeze({ type: 'battles', count: 8 }) }), description: '주사위 눈에 따라 전투 흐름을 바꾸는 2차 타짜.', stats: Object.freeze({ attack: 5, defense: 1, maxMp: 15 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  coin_trickster: Object.freeze({ label: '동전술사', baseClass: 'tazza', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '왕국 은화 내기', requirement: Object.freeze({ type: 'wins', count: 6 }) }), description: '동전과 손재주로 위험을 보정하고 한 번의 승부를 노리는 2차 타짜.', stats: Object.freeze({ attack: 4, defense: 2, maxMp: 20 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  arcana_lord: Object.freeze({ label: '아르카나 군주', baseClass: 'tazza', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '운명의 패 완성', requirement: Object.freeze({ type: 'raidClears', raid: 'ancient_lich', count: 1 }) }), description: '아르카나 패 조합 전투를 완성한 3차 타짜.', stats: Object.freeze({ attack: 8, maxMp: 45 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  battle_smith: Object.freeze({ label: '전투 대장장이', baseClass: 'blacksmith', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '망치 담금질', requirement: Object.freeze({ type: 'dungeons', count: 1 }) }), description: '망치, 도끼, 방어구 파괴에 특화된 2차 대장장이.', stats: Object.freeze({ attack: 5, defense: 3, maxHp: 20 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  siege_engineer: Object.freeze({ label: '공성 기술자', baseClass: 'blacksmith', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '장치 설치', requirement: Object.freeze({ type: 'explores', count: 4 }) }), description: '함정, 장치, 설치형 무기를 쓰는 2차 대장장이.', stats: Object.freeze({ attack: 4, defense: 4, maxMp: 15 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  rune_smith: Object.freeze({ label: '룬 대장장이', baseClass: 'blacksmith', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '룬 각인', requirement: Object.freeze({ type: 'areaProgress', area: 'red_desert', count: 40 }) }), description: '장비에 속성을 부여하는 3차 대장장이.', stats: Object.freeze({ attack: 8, defense: 6, maxMp: 25 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  sword_saint: Object.freeze({ label: '검성', baseClass: 'warrior', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '검의 성지 수련', requirement: Object.freeze({ type: 'areaProgress', area: 'crystal_lake', count: 40 }) }), description: '빠른 연계기와 높은 치명타를 완성한 3차 검사.', stats: Object.freeze({ attack: 12, defense: 1, maxMp: 20 }), assetId: 'hero_warrior_idle', assetIds: Object.freeze({ male: 'hero_warrior_idle', female: 'hero_female_warrior_idle' }) }),
  shadow_swordsman: Object.freeze({ label: '그림자 검사', baseClass: 'warrior', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '그림자 반격 훈련', requirement: Object.freeze({ type: 'wins', count: 12 }) }), description: '회피 후 반격과 암살형 검술에 특화된 3차 검사.', stats: Object.freeze({ attack: 10, defense: 4, maxMp: 25 }), assetId: 'hero_shadow_idle', assetIds: Object.freeze({ male: 'hero_shadow_idle', female: 'hero_female_shadow_idle' }) }),
  stormcaller: Object.freeze({ label: '폭풍술사', baseClass: 'mage', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '번개 룬 각성', requirement: Object.freeze({ type: 'areaProgress', area: 'thunder_plateau', count: 50 }) }), description: '번개, 기절, 연쇄 피해를 다루는 3차 마법사.', stats: Object.freeze({ attack: 11, maxMp: 55 }), assetId: 'hero_archmage_idle', assetIds: Object.freeze({ male: 'hero_archmage_idle', female: 'hero_female_archmage_idle' }) }),
  curseweaver: Object.freeze({ label: '저주술사', baseClass: 'mage', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '저주 해석', requirement: Object.freeze({ type: 'monsterKills', monster: '저주받은 마도사', count: 5 }) }), description: '약화, 독, 저주 중첩으로 장기전을 압박하는 3차 마법사.', stats: Object.freeze({ attack: 9, maxMp: 65 }), assetId: 'hero_mage_idle', assetIds: Object.freeze({ male: 'hero_mage_idle', female: 'hero_female_mage_idle' }) }),
  falconer: Object.freeze({ label: '매 조련사', baseClass: 'ranger', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '매와의 협공', requirement: Object.freeze({ type: 'explores', count: 10 }) }), description: '야수 동료와 협공하는 3차 궁수.', stats: Object.freeze({ attack: 9, defense: 2, maxMp: 35 }), assetId: 'hero_ranger_idle', assetIds: Object.freeze({ male: 'hero_ranger_idle', female: 'hero_female_ranger_idle' }) }),
  forest_stalker: Object.freeze({ label: '숲의 추적자', baseClass: 'ranger', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '숲길 추적', requirement: Object.freeze({ type: 'areaProgress', area: 'wildflower_plains', count: 60 }) }), description: '은신, 독화살, 지속 피해에 강한 3차 궁수.', stats: Object.freeze({ attack: 10, maxMp: 30 }), assetId: 'hero_sniper_idle', assetIds: Object.freeze({ male: 'hero_sniper_idle', female: 'hero_female_sniper_idle' }) }),
  iron_guardian: Object.freeze({ label: '철벽 수호자', baseClass: 'paladin', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '철벽 맹세', requirement: Object.freeze({ type: 'bossKills', count: 3 }) }), description: '최고 수준의 탱킹을 담당하는 3차 성기사.', stats: Object.freeze({ defense: 11, maxHp: 70 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  sun_knight: Object.freeze({ label: '태양 기사', baseClass: 'paladin', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '태양의 성소', requirement: Object.freeze({ type: 'areaProgress', area: 'crystal_lake', count: 45 }) }), description: '성속성 공격과 회복 보조를 겸하는 3차 성기사.', stats: Object.freeze({ attack: 8, defense: 7, maxMp: 35 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  judgment_knight: Object.freeze({ label: '심판관', baseClass: 'paladin', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '타락 기사 심판', requirement: Object.freeze({ type: 'raidClears', raid: 'frost_lich', count: 1 }) }), description: '보스 약화와 신성 폭발을 쓰는 3차 성기사.', stats: Object.freeze({ attack: 9, defense: 6, maxMp: 30 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  sanctuary_weaver: Object.freeze({ label: '성역술사', baseClass: 'priest', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '성역 결계', requirement: Object.freeze({ type: 'areaProgress', area: 'crystal_lake', count: 40 }) }), description: '보호 구역 생성과 지속 회복에 특화된 3차 성직자.', stats: Object.freeze({ defense: 6, maxMp: 75, maxHp: 25 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  heresy_inquisitor: Object.freeze({ label: '이단 심문관', baseClass: 'priest', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '악마 사냥 허가', requirement: Object.freeze({ type: 'monsterKills', monster: '악마 정찰병', count: 5 }) }), description: '저주 해제와 악마 추가 피해에 특화된 3차 성직자.', stats: Object.freeze({ attack: 8, defense: 4, maxMp: 55 }), assetId: 'hero_priest_idle', assetIds: Object.freeze({ male: 'hero_priest_idle', female: 'hero_female_priest_idle' }) }),
  light_apostle: Object.freeze({ label: '빛의 사도', baseClass: 'priest', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '빛의 순례', requirement: Object.freeze({ type: 'explores', count: 12 }) }), description: '회복과 공격을 동시에 수행하는 3차 성직자.', stats: Object.freeze({ attack: 7, defense: 5, maxMp: 65 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  shadow_slayer: Object.freeze({ label: '그림자 살수', baseClass: 'rogue', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '은신 급소 수련', requirement: Object.freeze({ type: 'wins', count: 12 }) }), description: '은신 후 치명타에 특화된 3차 도적.', stats: Object.freeze({ attack: 12, maxMp: 20 }), assetId: 'hero_shadow_idle', assetIds: Object.freeze({ male: 'hero_shadow_idle', female: 'hero_female_shadow_idle' }) }),
  poison_blade: Object.freeze({ label: '독검사', baseClass: 'rogue', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '맹독 조제', requirement: Object.freeze({ type: 'monsterKills', monster: '독거미', count: 6 }) }), description: '독 중첩과 지속 피해를 다루는 3차 도적.', stats: Object.freeze({ attack: 10, defense: 2, maxMp: 30 }), assetId: 'hero_shadow_idle', assetIds: Object.freeze({ male: 'hero_shadow_idle', female: 'hero_female_shadow_idle' }) }),
  illusion_thief: Object.freeze({ label: '환영 도적', baseClass: 'rogue', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '분신 교란', requirement: Object.freeze({ type: 'explores', count: 12 }) }), description: '분신, 회피, 반격 유도에 특화된 3차 도적.', stats: Object.freeze({ attack: 8, defense: 5, maxMp: 35 }), assetId: 'hero_rogue_idle', assetIds: Object.freeze({ male: 'hero_rogue_idle', female: 'hero_female_rogue_idle' }) }),
  fate_dealer: Object.freeze({ label: '운명의 딜러', baseClass: 'tazza', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '운명 카드 완성', requirement: Object.freeze({ type: 'wins', count: 12 }) }), description: '파티 치명타와 회피 흐름을 조율하는 3차 타짜.', stats: Object.freeze({ attack: 7, defense: 3, maxMp: 55 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  chance_weaver: Object.freeze({ label: '운명 조율사', baseClass: 'tazza', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '재굴림 숙달', requirement: Object.freeze({ type: 'battles', count: 20 }) }), description: '실패 확률을 낮추고 성공 흐름을 높이는 3차 타짜.', stats: Object.freeze({ attack: 6, defense: 4, maxMp: 65 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  mad_gambler: Object.freeze({ label: '광기의 도박사', baseClass: 'tazza', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '올인 생존', requirement: Object.freeze({ type: 'wins', count: 15 }) }), description: '큰 위험과 큰 보상을 다루는 3차 타짜.', stats: Object.freeze({ attack: 12, maxMp: 35 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  armor_smith: Object.freeze({ label: '방어구 장인', baseClass: 'blacksmith', unlockLevel: 25, masteryLevel: 3, classQuest: Object.freeze({ label: '판금 보수 의뢰', requirement: Object.freeze({ type: 'craftedItems', count: 3 }) }), description: '갑옷 제작과 방패 보수에 강한 2차 대장장이.', stats: Object.freeze({ defense: 5, maxHp: 25 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  weapon_master: Object.freeze({ label: '무기 장인', baseClass: 'blacksmith', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '명품 무기 제작', requirement: Object.freeze({ type: 'craftedItems', count: 5 }) }), description: '파티 무기 강화와 추가 옵션 제작에 특화된 3차 대장장이.', stats: Object.freeze({ attack: 9, defense: 5, maxHp: 35 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  golem_maker: Object.freeze({ label: '골렘 제작자', baseClass: 'blacksmith', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '골렘 핵 조립', requirement: Object.freeze({ type: 'dungeons', count: 3 }) }), description: '골렘 동료를 제작하고 운용하는 3차 대장장이.', stats: Object.freeze({ attack: 7, defense: 8, maxMp: 30 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  battlefield_architect: Object.freeze({ label: '전장 설계자', baseClass: 'blacksmith', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '전장 장치 설계', requirement: Object.freeze({ type: 'raidClears', raid: 'orc_warlord', count: 1 }) }), description: '레이드 장치와 방어 구조물을 설치하는 3차 대장장이.', stats: Object.freeze({ attack: 7, defense: 7, maxMp: 40 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) }),
  royal_dragoon: Object.freeze({ label: '왕국 용기병', baseClass: 'warrior', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '검은 용 돌파', requirement: Object.freeze({ type: 'raidClears', raid: 'black_dragon', count: 1 }) }), description: '창과 대검으로 용족 전열을 돌파하는 3차 검사.', stats: Object.freeze({ attack: 11, defense: 4, maxHp: 25 }), assetId: 'hero_warrior_idle', assetIds: Object.freeze({ male: 'hero_warrior_idle', female: 'hero_female_warrior_idle' }) }),
  frost_sage: Object.freeze({ label: '서리 현자', baseClass: 'mage', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '얼어붙은 성채 연구', requirement: Object.freeze({ type: 'areaProgress', area: 'bandit_outpost', count: 50 }) }), description: '서리 마법과 보호 결계로 적의 행동을 늦추는 3차 마법사.', stats: Object.freeze({ attack: 9, defense: 2, maxMp: 70 }), assetId: 'hero_archmage_idle', assetIds: Object.freeze({ male: 'hero_archmage_idle', female: 'hero_female_archmage_idle' }) }),
  storm_marksman: Object.freeze({ label: '폭풍 명궁', baseClass: 'ranger', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '붉은 와이번 격추', requirement: Object.freeze({ type: 'raidClears', raid: 'storm_wyvern', count: 1 }) }), description: '폭풍 속에서도 약점을 꿰뚫는 3차 궁수.', stats: Object.freeze({ attack: 12, maxMp: 25 }), assetId: 'hero_sniper_idle', assetIds: Object.freeze({ male: 'hero_sniper_idle', female: 'hero_female_sniper_idle' }) }),
  holy_avenger: Object.freeze({ label: '성검의 복수자', baseClass: 'paladin', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '악마 군세 응징', requirement: Object.freeze({ type: 'bossKills', count: 4 }) }), description: '성검과 방패로 악마를 몰아붙이는 공격형 3차 성기사.', stats: Object.freeze({ attack: 9, defense: 7, maxHp: 35 }), assetId: 'hero_crusader_idle', assetIds: Object.freeze({ male: 'hero_crusader_idle', female: 'hero_female_crusader_idle' }) }),
  miracle_worker: Object.freeze({ label: '기적술사', baseClass: 'priest', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '리치의 저주 정화', requirement: Object.freeze({ type: 'raidClears', raid: 'ancient_lich', count: 1 }) }), description: '위기 순간의 회복과 부활에 특화된 3차 성직자.', stats: Object.freeze({ defense: 4, maxHp: 25, maxMp: 85 }), assetId: 'hero_saint_idle', assetIds: Object.freeze({ male: 'hero_saint_idle', female: 'hero_female_saint_idle' }) }),
  night_raven: Object.freeze({ label: '밤까마귀', baseClass: 'rogue', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '안개 늪지 잠입', requirement: Object.freeze({ type: 'areaProgress', area: 'marsh', count: 60 }) }), description: '밤길 기습과 함정 회피에 특화된 3차 도적.', stats: Object.freeze({ attack: 11, defense: 3, maxMp: 30 }), assetId: 'hero_shadow_idle', assetIds: Object.freeze({ male: 'hero_shadow_idle', female: 'hero_female_shadow_idle' }) }),
  royal_jester: Object.freeze({ label: '왕실 광대', baseClass: 'tazza', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '왕실 연회 승부', requirement: Object.freeze({ type: 'battles', count: 20 }) }), description: '기묘한 패와 익살로 적의 판단을 흔드는 3차 타짜.', stats: Object.freeze({ attack: 8, defense: 5, maxMp: 55 }), assetId: 'hero_tazza_idle', assetIds: Object.freeze({ male: 'hero_tazza_idle', female: 'hero_female_tazza_idle' }) }),
  dragon_forge_master: Object.freeze({ label: '용화로 장인', baseClass: 'blacksmith', unlockLevel: 45, masteryLevel: 7, classQuest: Object.freeze({ label: '용의심장 담금질', requirement: Object.freeze({ type: 'craftedItems', count: 8 }) }), description: '용비늘과 용의심장으로 최상위 무기를 벼리는 3차 대장장이.', stats: Object.freeze({ attack: 8, defense: 8, maxHp: 35, maxMp: 20 }), assetId: 'hero_blacksmith_idle', assetIds: Object.freeze({ male: 'hero_blacksmith_idle', female: 'hero_female_blacksmith_idle' }) })
});

const RPG_SKILL_TREE = Object.freeze({
  weapon_training: Object.freeze({ label: '무기 숙련', description: '공격력 +2', cost: 1, stats: Object.freeze({ attack: 2 }), classes: Object.freeze(Object.keys(RPG_CLASSES)) }),
  iron_body: Object.freeze({ label: '강철 체력', description: '최대 HP +20, 방어력 +1', cost: 1, stats: Object.freeze({ maxHp: 20, defense: 1 }), classes: Object.freeze(Object.keys(RPG_CLASSES)) }),
  mana_flow: Object.freeze({ label: '마나 순환', description: '최대 MP +20', cost: 1, stats: Object.freeze({ maxMp: 20 }), classes: Object.freeze(['novice', 'mage', 'paladin', 'priest', 'tazza', 'blacksmith']) }),
  luck_craft: Object.freeze({ label: '행운과 손재주', description: '공격력 +1, 최대 MP +10', cost: 1, stats: Object.freeze({ attack: 1, maxMp: 10 }), classes: Object.freeze(['ranger', 'rogue', 'tazza', 'blacksmith']) }),
  class_mastery: Object.freeze({ label: '직업 숙련', description: '공격력 +1, 방어력 +1', cost: 1, stats: Object.freeze({ attack: 1, defense: 1 }), classes: Object.freeze(Object.keys(RPG_CLASSES)) })
});

const RPG_GEAR_RARITIES = Object.freeze({
  common: Object.freeze({ label: '일반', power: 1, statBudget: 2, dropFloor: 1 }),
  uncommon: Object.freeze({ label: '고급', power: 2, statBudget: 3, dropFloor: 35 }),
  rare: Object.freeze({ label: '희귀', power: 2, statBudget: 4, dropFloor: 55 }),
  epic: Object.freeze({ label: '영웅', power: 3, statBudget: 7, dropFloor: 82 }),
  legendary: Object.freeze({ label: '전설', power: 4, statBudget: 11, dropFloor: 96 }),
  mythic: Object.freeze({ label: '신화', power: 5, statBudget: 15, dropFloor: 100 })
});

const RPG_EXPLORATION_EVENTS = Object.freeze({
  battle: Object.freeze({ label: '몬스터 조우', description: '길목에서 몬스터와 교전했습니다.' }),
  treasure: Object.freeze({ label: '보물상자', description: '낡은 상자에서 보상과 재료를 발견했습니다.' }),
  trap: Object.freeze({ label: '함정', description: '숨겨진 함정에 피해를 입었습니다.' }),
  shrine: Object.freeze({ label: '성지의 축복', description: '작은 성소에서 HP/MP를 회복했습니다.' }),
  secret_passage: Object.freeze({ label: '비밀 문양', description: '숨겨진 던전으로 이어질 법한 낡은 문양과 희귀 재료 흔적을 발견했습니다.' })
});

const RPG_STORY_CHAPTERS = Object.freeze({
  forest_oath: Object.freeze({ label: '길드 등록', description: '왕도 남쪽 초원에서 모험가로 인정받습니다.', requirement: Object.freeze({ type: 'level', count: 1 }), rewards: Object.freeze({ xp: 80, coins: 180, items: Object.freeze({ potion: 1 }) }) }),
  guild_first_job: Object.freeze({ label: '첫 전직 허가', description: 'RPG Lv.10을 달성해 왕국 길드의 1차 전직 허가를 받습니다.', requirement: Object.freeze({ type: 'level', count: 10 }), rewards: Object.freeze({ xp: 180, coins: 420, items: Object.freeze({ iron_ingot: 2 }) }) }),
  dual_oath: Object.freeze({ label: '두 직업의 서약', description: 'RPG Lv.15를 달성해 두 번째 직업을 품을 자격을 증명합니다.', requirement: Object.freeze({ type: 'level', count: 15 }), rewards: Object.freeze({ xp: 240, coins: 620, items: Object.freeze({ mana_potion: 2 }) }) }),
  cave_signal: Object.freeze({ label: '은광의 그림자', description: '버려진 은광에서 숨겨진 광맥과 도적 흔적을 추적합니다.', requirement: Object.freeze({ type: 'areaWins', area: 'cave', count: 1 }), rewards: Object.freeze({ xp: 160, coins: 360, items: Object.freeze({ mana_potion: 1 }) }) }),
  ruins_key: Object.freeze({ label: '수도원의 저주', description: '저주받은 수도원의 언데드 소동을 정화합니다.', requirement: Object.freeze({ type: 'bossKills', count: 1 }), rewards: Object.freeze({ xp: 280, coins: 700, items: Object.freeze({ mystic_ring: 1 }) }) }),
  bandit_fortress: Object.freeze({ label: '도적단 요새 추적', description: '도적단 요새 지역 진행도 35%를 달성해 은광 배후를 추적합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'marsh', count: 35 }), rewards: Object.freeze({ xp: 340, coins: 840, items: Object.freeze({ black_leather: 3, poison_sac: 2 }) }) }),
  marsh_plague: Object.freeze({ label: '늪지 독안개', description: '안개 늪지의 독안개 원인을 추적합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'moonlit_hill', count: 30 }), rewards: Object.freeze({ xp: 360, coins: 900, items: Object.freeze({ potion: 2 }) }) }),
  second_job_trial: Object.freeze({ label: '전문 계열의 증명', description: 'RPG Lv.25를 달성해 2차 전직 미션을 받을 자격을 갖춥니다.', requirement: Object.freeze({ type: 'level', count: 25 }), rewards: Object.freeze({ xp: 420, coins: 1_000, items: Object.freeze({ enhancement_stone: 2, rune_stone: 1 }) }) }),
  volcano_core: Object.freeze({ label: '용의 둥지', description: '용비늘 장비의 재료를 찾아 드레이크 둥지를 조사합니다.', requirement: Object.freeze({ type: 'dungeonClears', area: 'volcano', count: 1 }), rewards: Object.freeze({ xp: 520, coins: 1400, items: Object.freeze({ mana_potion: 2 }) }) }),
  moonwell_path: Object.freeze({ label: '달샘 유적의 문양', description: '달빛 요정숲 진행도 35%를 달성해 히든 던전의 문양을 해독합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'moonlit_feywood', count: 35 }), rewards: Object.freeze({ xp: 760, coins: 1_800, items: Object.freeze({ ancient_wood: 2, shadow_crystal: 1 }) }) }),
  royal_crypt_oath: Object.freeze({ label: '왕가 지하묘의 봉인', description: '가라앉은 지하묘 진행도 45%를 달성해 왕가 봉인을 확인합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'sunken_catacombs', count: 45 }), rewards: Object.freeze({ xp: 900, coins: 2_200, items: Object.freeze({ holy_water: 6, nightmare_thread: 1 }) }) }),
  third_job_trial: Object.freeze({ label: '고급 직업의 각서', description: 'RPG Lv.45를 달성해 3차 전직 미션을 받을 자격을 갖춥니다.', requirement: Object.freeze({ type: 'level', count: 45 }), rewards: Object.freeze({ xp: 1_000, coins: 2_600, items: Object.freeze({ magic_crystal: 3, blessed_metal: 2 }) }) }),
  dragon_altar_seal: Object.freeze({ label: '고룡 제단의 봉인', description: '고룡의 제단 진행도 40%를 달성해 용화로의 단서를 얻습니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'ancient_dragon_altar', count: 40 }), rewards: Object.freeze({ xp: 1_200, coins: 3_200, items: Object.freeze({ dragon_scale: 3, dragon_claw: 1 }) }) }),
  frost_beacon: Object.freeze({ label: '마왕성의 불길', description: '마왕성 외곽의 악마 군세를 막습니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'frost', count: 50 }), rewards: Object.freeze({ xp: 680, coins: 1900, items: Object.freeze({ guardian_plate: 1 }) }) }),
  black_dragon_hunt: Object.freeze({ label: '검은 용 베르카르 토벌', description: '검은 용 베르카르 레이드를 1회 클리어해 왕국 상공을 되찾습니다.', requirement: Object.freeze({ type: 'raidClears', raid: 'black_dragon', count: 1 }), rewards: Object.freeze({ xp: 1_600, coins: 4_500, items: Object.freeze({ dragon_blade: 1, dragon_scale: 4 }) }) }),
  demon_treasury_map: Object.freeze({ label: '마왕의 보물고 지도', description: '마왕성 진행도 60%를 달성해 히든 보물고 지도를 완성합니다.', requirement: Object.freeze({ type: 'areaProgress', area: 'void_gate', count: 60 }), rewards: Object.freeze({ xp: 1_900, coins: 5_400, items: Object.freeze({ dark_stone: 6, demon_horn: 2 }) }) }),
  sky_throne: Object.freeze({ label: '왕국의 방패', description: '왕국 수도 성벽에서 서버 공동 목표를 지킵니다.', requirement: Object.freeze({ type: 'raidClears', raid: 'black_dragon', count: 1 }), rewards: Object.freeze({ xp: 1000, coins: 3200, items: Object.freeze({ dragon_blade: 1 }) }) }),
  valtar_shadow: Object.freeze({ label: '마왕 발타르의 그림자', description: '마왕 발타르 레이드를 1회 클리어해 시즌 최종 위협을 봉인합니다.', requirement: Object.freeze({ type: 'raidClears', raid: 'apocalypse_dragon', count: 1 }), rewards: Object.freeze({ xp: 2_800, coins: 8_000, items: Object.freeze({ mythic_metal: 1, demon_horn: 3 }) }) })
});

const RPG_TUTORIAL_STEPS = Object.freeze({
  create_character: Object.freeze({ label: '모험가 등록', description: '모든 유저는 모험가로 시작합니다.', command: '/rpg 시작', action: 'start', actionLabel: '모험가 등록', requirement: Object.freeze({ type: 'started', count: 1 }), rewards: Object.freeze({ xp: 30, coins: 50, items: Object.freeze({ potion: 1 }) }) }),
  first_battle: Object.freeze({ label: '첫 사냥', description: '사냥을 한 번 진행해 전투 보상 흐름을 익힙니다.', command: '/rpg 사냥', action: 'battle', actionLabel: '사냥하기', requirement: Object.freeze({ type: 'battles', count: 1 }), rewards: Object.freeze({ xp: 50, coins: 80, items: Object.freeze({ potion: 1 }) }) }),
  first_recovery: Object.freeze({ label: '첫 정비', description: '휴식이나 회복 아이템으로 HP/MP를 정비합니다.', command: '/rpg 휴식 또는 /rpg 인벤토리', action: 'rest', actionLabel: '휴식하기', requirement: Object.freeze({ type: 'recoveryActions', count: 1 }), rewards: Object.freeze({ xp: 40, coins: 40, items: Object.freeze({ mana_potion: 1 }) }) }),
  first_shop: Object.freeze({ label: '첫 상점 정비', description: '상점에서 포션이나 장비를 구매합니다.', command: '/rpg 상점', action: 'shop', actionLabel: '상점 가기', requirement: Object.freeze({ type: 'shopPurchases', count: 1 }), rewards: Object.freeze({ xp: 60, coins: 120, items: Object.freeze({ enhancement_stone: 1 }) }) }),
  first_quest: Object.freeze({ label: '첫 퀘스트 보상', description: '완료한 퀘스트 보상을 받습니다.', command: '/rpg 퀘스트', action: 'quest', actionLabel: '퀘스트 보기', requirement: Object.freeze({ type: 'claimedQuests', count: 1 }), rewards: Object.freeze({ xp: 80, coins: 160, items: Object.freeze({ potion: 1 }) }) }),
  first_world_step: Object.freeze({ label: '월드맵 첫걸음', description: '탐사, 지역 이동, 보스전 중 하나로 월드 진행도를 열어봅니다.', command: '/rpg 지역 또는 /rpg 탐사', action: 'area', actionLabel: '월드맵 보기', requirement: Object.freeze({ type: 'worldSteps', count: 1 }), rewards: Object.freeze({ xp: 100, coins: 200, items: Object.freeze({ potion: 1 }) }) })
});

const RPG_RAIDS = Object.freeze({
  slime_horde: Object.freeze({ label: '숲거미 여왕', area: 'wildflower_plains', unlockLevel: 10, powerMin: 24, powerMax: 38, xpReward: 420, coinReward: 1100, monster: '숲거미 여왕', backgroundAssetId: 'map_goblin_forest' }),
  goblin_warband: Object.freeze({ label: '오크 전쟁군주', area: 'ruins', unlockLevel: 30, powerMin: 42, powerMax: 62, xpReward: 900, coinReward: 2300, monster: '오크 전쟁군주', backgroundAssetId: 'map_red_canyon' }),
  orc_warlord: Object.freeze({ label: '오크 전쟁군주', area: 'ruins', unlockLevel: 30, powerMin: 42, powerMax: 62, xpReward: 900, coinReward: 2300, monster: '오크 전쟁군주', backgroundAssetId: 'map_red_canyon' }),
  crystal_hydra: Object.freeze({ label: '늪지 히드라', area: 'moonlit_hill', unlockLevel: 35, powerMin: 50, powerMax: 72, xpReward: 1300, coinReward: 3000, monster: '늪지 히드라', backgroundAssetId: 'map_mist_marsh' }),
  marsh_behemoth: Object.freeze({ label: '붉은 와이번', area: 'ruins', unlockLevel: 40, powerMin: 54, powerMax: 78, xpReward: 1500, coinReward: 3400, monster: '붉은 와이번', backgroundAssetId: 'map_red_canyon' }),
  ruins_sentinel: Object.freeze({ label: '고대 리치', area: 'red_desert', unlockLevel: 55, powerMin: 68, powerMax: 92, xpReward: 2200, coinReward: 4600, monster: '고대 리치', backgroundAssetId: 'map_ancient_elf_ruins' }),
  ancient_lich: Object.freeze({ label: '고대 리치', area: 'red_desert', unlockLevel: 55, powerMin: 68, powerMax: 92, xpReward: 2200, coinReward: 4600, monster: '고대 리치', backgroundAssetId: 'map_ancient_elf_ruins' }),
  flame_giant: Object.freeze({ label: '서리 거인', area: 'bandit_outpost', unlockLevel: 50, powerMin: 62, powerMax: 86, xpReward: 1900, coinReward: 4000, monster: '서리 거인', backgroundAssetId: 'map_frozen_mountains' }),
  frost_lich: Object.freeze({ label: '타락한 성기사', area: 'crystal_lake', unlockLevel: 60, powerMin: 72, powerMax: 98, xpReward: 2600, coinReward: 5200, monster: '타락한 성기사', backgroundAssetId: 'map_sacred_arden' }),
  storm_wyvern: Object.freeze({ label: '검은 용 베르카르', area: 'dragon_nest', unlockLevel: 75, powerMin: 84, powerMax: 112, xpReward: 3600, coinReward: 7000, monster: '검은 용 베르카르', backgroundAssetId: 'map_black_dragon_lair' }),
  black_dragon: Object.freeze({ label: '검은 용 베르카르', area: 'dragon_nest', unlockLevel: 75, powerMin: 84, powerMax: 112, xpReward: 3600, coinReward: 7000, monster: '검은 용 베르카르', backgroundAssetId: 'map_black_dragon_lair' }),
  void_knights: Object.freeze({ label: '마왕의 사도', area: 'frost', unlockLevel: 80, powerMin: 92, powerMax: 120, xpReward: 4200, coinReward: 8200, monster: '마왕의 사도', backgroundAssetId: 'map_demon_king_outer_wall' }),
  sky_golem: Object.freeze({ label: '악몽의 기사', area: 'void_gate', unlockLevel: 82, powerMin: 96, powerMax: 126, xpReward: 4600, coinReward: 9000, monster: '악몽의 기사', backgroundAssetId: 'map_demon_king_castle' }),
  dragon_rift: Object.freeze({ label: '재앙룡 니드호그', area: 'dragon_nest', unlockLevel: 80, powerMin: 100, powerMax: 132, xpReward: 5400, coinReward: 11000, monster: '검은 용 베르카르', backgroundAssetId: 'map_black_dragon_lair' }),
  apocalypse_dragon: Object.freeze({ label: '마왕 발타르', area: 'void_gate', unlockLevel: 85, powerMin: 108, powerMax: 142, xpReward: 6500, coinReward: 14000, monster: '마왕 발타르', backgroundAssetId: 'map_demon_king_castle' })
});

const RPG_GACHA_BANNERS = Object.freeze({
  standard: Object.freeze({
    label: '길드 보급품',
    cost: 300,
    description: '직업 해금 없이 소모품과 장비만 얻는 구형 호환 보급품입니다.',
    rarityRates: Object.freeze({ ssr: 300, sr: 1700, r: 8000 }),
    pools: Object.freeze({
      ssr: Object.freeze([itemReward('dragon_blade'), itemReward('archmage_staff')]),
      sr: Object.freeze([itemReward('guardian_plate'), itemReward('mystic_ring'), itemReward('leather_armor'), itemReward('iron_sword')]),
      r: Object.freeze([itemReward('potion', 2), itemReward('mana_potion', 2), itemReward('potion', 1), itemReward('mana_potion', 1)])
    })
  })
});

const DEFAULT_RPG_EQUIPMENT = Object.freeze({
  weapon: null,
  armor: null,
  accessory: null
});

export function getStarterRpgClassIds() {
  return [...STARTER_CLASS_IDS];
}

export function getRpgClassOptions() {
  return getRpgFirstJobOptions();
}

export function getRpgFirstJobClassIds() {
  return [...FIRST_JOB_CLASS_IDS];
}

export function getRpgFirstJobOptions() {
  return FIRST_JOB_CLASS_IDS.map((value) => ({
    name: RPG_CLASSES[value].label,
    value
  }));
}

export function getRpgStartClassOptions() {
  return STARTER_CLASS_IDS.map((value) => ({
    name: RPG_CLASSES[value].label,
    value
  }));
}

export function getRpgGenderOptions() {
  return Object.entries(RPG_GENDERS).map(([value, gender]) => ({
    name: gender.label,
    value
  }));
}

export function getRpgDifficultyOptions() {
  return Object.entries(RPG_DIFFICULTIES).map(([value, config]) => ({
    name: config.label,
    value
  }));
}

export function getRpgAreaOptions() {
  return Object.entries(RPG_AREAS).map(([value, config]) => ({
    name: `${config.label} (Lv.${config.unlockLevel}+)`,
    value
  }));
}

export function getRpgSkillOptions() {
  return Object.entries(RPG_SKILLS).map(([value, skill]) => ({
    name: skill.label,
    value
  }));
}

export function getRpgShopItemOptions() {
  return Object.entries(RPG_ITEMS)
    .filter(([, item]) => !item.gachaOnly && !item.shopHidden)
    .map(([value, item]) => ({
      name: `${item.label} (${item.price}골드)`,
      value
    }));
}

export function getRpgUsableItemOptions() {
  return Object.entries(RPG_ITEMS)
    .filter(([, item]) => item.type === 'consumable')
    .map(([value, item]) => ({
      name: item.label,
      value
    }));
}

export function getRpgEquipmentItemOptions() {
  return Object.entries(RPG_ITEMS)
    .filter(([, item]) => item.type === 'equipment' && !item.craftedOnly && !item.dropOnly)
    .map(([value, item]) => ({
      name: item.label,
      value
    }));
}

export function getRpgCraftingCategoryOptions() {
  return [
    { name: '무기', value: 'weapon' },
    { name: '방어구', value: 'armor' },
    { name: '장신구', value: 'accessory' },
    { name: '소모품', value: 'consumable' },
    { name: '룬', value: 'rune' },
    { name: '재료 가공', value: 'processing' },
    { name: '대장장이 전용', value: 'blacksmith' }
  ];
}

export function getRpgCraftingRecipeOptions(category = null) {
  const normalizedCategory = normalizeNullableRpgCraftingCategory(category);
  return Object.entries(RPG_CRAFTING_RECIPES)
    .filter(([, recipe]) => !normalizedCategory || recipe.category === normalizedCategory)
    .slice(0, 25)
    .map(([value, recipe]) => ({
      name: `${recipe.hidden ? '히든 ' : ''}${recipe.label} (Lv.${recipe.requiredLevel}+)`,
      value
    }));
}

export function getRpgDungeonOptions() {
  return Object.entries(RPG_DUNGEONS).map(([value, dungeon]) => ({
    name: `${dungeon.hidden ? '히든 ' : ''}${dungeon.label} (Lv.${dungeon.unlockLevel}+)`,
    value
  }));
}

export function getRpgQuestOptions() {
  return Object.entries(RPG_QUESTS).map(([value, quest]) => ({
    name: quest.label,
    value
  }));
}

export function getRpgDailyMissionOptions() {
  return Object.entries(RPG_DAILY_MISSIONS).map(([value, mission]) => ({
    name: mission.label,
    value
  }));
}

export function getRpgTutorialStepOptions() {
  return Object.entries(RPG_TUTORIAL_STEPS).map(([value, step]) => ({
    name: step.label,
    value
  }));
}

export function getRpgBossOptions() {
  return Object.entries(RPG_BOSSES).map(([value, boss]) => ({
    name: `${boss.label} (Lv.${boss.unlockLevel}+)`,
    value
  }));
}

export function getRpgGachaBannerOptions() {
  return Object.entries(RPG_GACHA_BANNERS).map(([value, banner]) => ({
    name: `${banner.label} (${banner.cost}골드)`,
    value
  }));
}

export function getRpgAdvancedClassOptions() {
  return Object.entries(RPG_ADVANCED_CLASSES).map(([value, advancedClass]) => ({
    name: `${advancedClass.label} (${RPG_CLASSES[advancedClass.baseClass].label} Lv.${advancedClass.unlockLevel}+)`,
    value
  }));
}

export function getRpgSkillTreeOptions() {
  return Object.entries(RPG_SKILL_TREE).map(([value, skill]) => ({
    name: `${skill.label} (${skill.cost}점)`,
    value
  }));
}

export function getRpgStoryChapterOptions() {
  return Object.entries(RPG_STORY_CHAPTERS).map(([value, chapter]) => ({
    name: chapter.label,
    value
  }));
}

export function getRpgRaidOptions() {
  return Object.entries(RPG_RAIDS)
    .sort(([, a], [, b]) => a.unlockLevel - b.unlockLevel || a.powerMin - b.powerMin)
    .map(([value, raid]) => ({
      name: `${raid.label} (Lv.${raid.unlockLevel}+)`,
      value
    }));
}

export function getRpgClassConfig(characterClass = 'novice') {
  return RPG_CLASSES[normalizeRpgClass(characterClass)];
}

export function getRpgGenderConfig(characterGender = 'male') {
  return RPG_GENDERS[normalizeRpgGender(characterGender)];
}

export function getRpgClassAssetId(characterClass = 'novice', characterGender = 'male') {
  const classConfig = getRpgClassConfig(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);

  return classConfig.assetIds?.[normalizedGender] ?? classConfig.assetId;
}

export function getRpgAdvancedClassAssetId(advancedClass, characterGender = 'male', characterClass = null) {
  let normalizedAdvancedClass = null;
  try {
    normalizedAdvancedClass = normalizeNullableRpgAdvancedClass(advancedClass);
  } catch {
    return null;
  }
  if (!normalizedAdvancedClass) return null;

  const advancedClassConfig = RPG_ADVANCED_CLASSES[normalizedAdvancedClass];
  const normalizedClass = characterClass ? normalizeRpgClass(characterClass) : null;
  if (normalizedClass && advancedClassConfig.baseClass !== normalizedClass) return null;

  const normalizedGender = normalizeRpgGender(characterGender);
  return advancedClassConfig.assetIds?.[normalizedGender] ?? advancedClassConfig.assetId ?? null;
}

export function getRpgHeroAssetId({
  characterClass = 'novice',
  characterGender = 'male',
  advancedClass = null
} = {}) {
  const normalizedClass = normalizeRpgClass(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);

  return getRpgAdvancedClassAssetId(advancedClass, normalizedGender, normalizedClass)
    ?? getRpgClassAssetId(normalizedClass, normalizedGender);
}

export function getRpgMonsterAssetId(monsterName) {
  return MONSTER_ASSET_IDS[normalizeRpgMonsterName(monsterName)] ?? 'monster_unknown_idle';
}

export function getRpgAreaConfig(area = 'forest') {
  return RPG_AREAS[normalizeRpgArea(area)];
}

export function getRpgSkillConfig(skillId = 'basic') {
  return RPG_SKILLS[normalizeRpgSkillId(skillId)];
}

export function getRpgItemConfig(itemId) {
  return RPG_ITEMS[normalizeRpgItemId(itemId)];
}

export function getRpgCraftingRecipeConfig(recipeId) {
  return RPG_CRAFTING_RECIPES[normalizeRpgCraftingRecipeId(recipeId)];
}

export function getRpgCraftingMasteryConfig(masteryType) {
  return RPG_CRAFTING_MASTERIES[normalizeRpgCraftingMasteryType(masteryType)];
}

export function getRpgCraftingQualityConfig(qualityId) {
  return RPG_CRAFTING_QUALITIES[normalizeRpgCraftingQualityId(qualityId)];
}

export function getRpgDungeonConfig(dungeonId) {
  return RPG_DUNGEONS[normalizeRpgDungeonId(dungeonId)];
}

export function getRpgQuestConfig(questId) {
  return RPG_QUESTS[normalizeRpgQuestId(questId)];
}

export function getRpgDailyMissionConfig(missionId) {
  return RPG_DAILY_MISSIONS[normalizeRpgDailyMissionId(missionId)];
}

export function getRpgBossConfig(bossId) {
  return RPG_BOSSES[normalizeRpgBossId(bossId)];
}

export function getRpgBossPattern(bossId = 'slime_king', turnNumber = 1) {
  const normalizedBossId = normalizeRpgBossId(bossId);
  const patterns = RPG_BOSS_PATTERNS[normalizedBossId] ?? RPG_BOSS_PATTERNS.slime_king;
  const safeTurn = Math.max(1, Number(turnNumber) || 1);

  return patterns[(safeTurn - 1) % patterns.length];
}

export function getRpgGachaBannerConfig(bannerId = 'standard') {
  return RPG_GACHA_BANNERS[normalizeRpgGachaBannerId(bannerId)];
}

export function getRpgAdvancedClassConfig(advancedClass) {
  const normalized = normalizeRpgAdvancedClass(advancedClass);
  return normalized ? RPG_ADVANCED_CLASSES[normalized] : null;
}

export function getRpgSkillTreeConfig(skillId) {
  return RPG_SKILL_TREE[normalizeRpgSkillTreeNodeId(skillId)];
}

export function getRpgStoryChapterConfig(chapterId) {
  return RPG_STORY_CHAPTERS[normalizeRpgStoryChapterId(chapterId)];
}

export function getRpgRaidConfig(raidId) {
  return RPG_RAIDS[normalizeRpgRaidId(raidId)];
}

export function getDefaultRpgEquipment() {
  return { ...DEFAULT_RPG_EQUIPMENT };
}

export function getUnlockedRpgAreaIds(level) {
  const safeLevel = Math.max(1, Number(level) || 1);

  return Object.entries(RPG_AREAS)
    .filter(([, area]) => safeLevel >= area.unlockLevel)
    .map(([id]) => id);
}

export function getRpgDerivedStats({
  level = 1,
  characterClass = 'novice',
  equipment = {},
  advancedClass = null,
  learnedSkills = [],
  gearInventory = {},
  equippedGear = {}
} = {}) {
  const safeLevel = Math.max(1, Number(level) || 1);
  const classConfig = getRpgClassConfig(characterClass);
  const normalizedEquipment = normalizeRpgEquipment(equipment);
  const normalizedAdvancedClass = normalizeNullableRpgAdvancedClass(advancedClass);
  const normalizedLearnedSkills = normalizeRpgSkillTreeNodes(learnedSkills);
  const stats = {
    maxHp: Math.max(1, 100 + safeLevel * 10 + (classConfig.maxHpBonus ?? 0)),
    maxMp: Math.max(0, 30 + safeLevel * 5 + (classConfig.maxMpBonus ?? 0)),
    attack: safeLevel * 2 + classConfig.powerBonus,
    defense: Math.floor(safeLevel / 2) + (classConfig.defenseBonus ?? 0)
  };

  for (const itemId of Object.values(normalizedEquipment)) {
    if (!itemId) continue;

    const item = RPG_ITEMS[itemId];
    stats.attack += item.stats?.attack ?? 0;
    stats.defense += item.stats?.defense ?? 0;
    stats.maxHp += item.stats?.maxHp ?? 0;
    stats.maxMp += item.stats?.maxMp ?? 0;
  }

  if (normalizedAdvancedClass) {
    addStats(stats, RPG_ADVANCED_CLASSES[normalizedAdvancedClass].stats);
  }

  for (const skillId of normalizedLearnedSkills) {
    addStats(stats, RPG_SKILL_TREE[skillId].stats);
  }

  for (const [slot, gearId] of Object.entries(equippedGear ?? {})) {
    const gear = gearInventory?.[gearId];
    if (!gear || gear.slot !== slot) continue;
    addStats(stats, gear.stats);
  }

  return stats;
}

export function getAvailableRpgSkillIds(characterClass = 'novice', advancedClass = null) {
  const normalizedClass = normalizeRpgClass(characterClass);
  let normalizedAdvancedClass = null;
  try {
    normalizedAdvancedClass = normalizeNullableRpgAdvancedClass(advancedClass);
  } catch {
    normalizedAdvancedClass = null;
  }
  return Object.entries(RPG_SKILLS)
    .filter(([, skill]) =>
      skill.classes.includes(normalizedClass)
      && (!skill.advancedClasses || skill.advancedClasses.includes(normalizedAdvancedClass))
    )
    .map(([id]) => id);
}

export function getRpgQuestStatuses(profile) {
  return Object.entries(RPG_QUESTS).map(([id, quest]) => getRpgQuestStatus(profile, id, quest));
}

export function getRpgQuestStatus(profile, questId, quest = getRpgQuestConfig(questId)) {
  const id = normalizeRpgQuestId(questId);
  const current = getQuestProgress(profile, quest);
  const required = quest.requirement.count;
  const claimed = Boolean(profile.rpg.claimedQuests?.[id]);

  return {
    id,
    ...quest,
    current,
    required,
    complete: current >= required,
    claimed,
    canClaim: current >= required && !claimed
  };
}

export function getRpgDailyMissionStatuses(profile, now = Date.now()) {
  const daily = getRpgDailyStatsForDay(profile.rpg?.daily, now);

  return Object.entries(RPG_DAILY_MISSIONS).map(([id, mission]) => {
    const current = getDailyMissionProgress(daily, mission);
    const required = mission.requirement.count;
    const claimed = Boolean(daily.claimedMissions?.[id]);

    return {
      id,
      ...mission,
      current,
      required,
      complete: current >= required,
      claimed,
      canClaim: current >= required && !claimed
    };
  });
}

export function getRpgTutorialStepConfig(stepId) {
  return RPG_TUTORIAL_STEPS[normalizeRpgTutorialStepId(stepId)];
}

export function getRpgTutorialStatuses(profile) {
  return Object.entries(RPG_TUTORIAL_STEPS).map(([id, step], index) => {
    const current = getTutorialProgress(profile, step.requirement);
    const required = step.requirement.count;
    const claimed = Boolean(profile.rpg?.tutorial?.claimedSteps?.[id]);

    return {
      id,
      order: index + 1,
      ...step,
      current,
      required,
      complete: current >= required,
      claimed,
      canClaim: current >= required && !claimed
    };
  });
}

export function getRpgTutorialSummary(profile) {
  const steps = getRpgTutorialStatuses(profile);
  const claimedCount = steps.filter((step) => step.claimed).length;
  const claimableCount = steps.filter((step) => step.canClaim).length;
  const nextStep = steps.find((step) => !step.claimed) ?? null;

  return {
    steps,
    total: steps.length,
    claimedCount,
    claimableCount,
    complete: claimedCount >= steps.length,
    nextStep
  };
}

export function getRpgAdventureGuide(profile, {
  now = Date.now(),
  cooldownRemainingMs = 0,
  actionAvailability = null,
  dailyGold = null,
  xpForNextLevel = defaultRpgXpForNextLevel
} = {}) {
  const level = Math.max(1, Number(profile.rpg?.level) || 1);
  const currentXp = Math.max(0, Number(profile.rpg?.xp) || 0);
  const requiredXp = Math.max(1, Number(xpForNextLevel(level)) || defaultRpgXpForNextLevel(level));
  const derivedStats = getRpgDerivedStats({
    level,
    characterClass: profile.rpg?.characterClass,
    equipment: profile.rpg?.equipment,
    advancedClass: profile.rpg?.advancedClass,
    learnedSkills: profile.rpg?.learnedSkills,
    gearInventory: profile.rpg?.gearInventory,
    equippedGear: profile.rpg?.equippedGear
  });
  const dailyMissions = getRpgDailyMissionStatuses(profile, now);
  const claimableDailyMissions = dailyMissions.filter((mission) => mission.canClaim);
  const claimableQuests = getRpgQuestStatuses(profile).filter((quest) => quest.canClaim);
  const storyChapters = getRpgStoryChapterStatuses(profile);
  const progressableStoryChapters = storyChapters.filter((chapter) => chapter.canProgress);
  const currentArea = getRpgAreaConfig(profile.rpg?.currentArea);
  const unlockedAreaIds = getUnlockedRpgAreaIds(level);
  const highestUnlockedAreaId = unlockedAreaIds[unlockedAreaIds.length - 1] ?? 'forest';
  const highestUnlockedArea = getRpgAreaConfig(highestUnlockedAreaId);
  const nextLockedArea = Object.entries(RPG_AREAS)
    .map(([id, area]) => ({ id, ...area }))
    .find((area) => !unlockedAreaIds.includes(area.id));
  const levelProgress = {
    current: Math.min(currentXp, requiredXp),
    required: requiredXp,
    percent: Math.min(100, Math.floor((currentXp / requiredXp) * 100)),
    bar: createRpgProgressBar(currentXp, requiredXp)
  };
  const mainObjective = claimableDailyMissions[0]
    ? createObjective('daily', claimableDailyMissions[0])
    : claimableQuests[0]
      ? createObjective('quest', claimableQuests[0])
      : progressableStoryChapters[0]
        ? createObjective('story', progressableStoryChapters[0])
        : nextLockedArea
          ? {
            type: 'area_unlock',
            label: `${nextLockedArea.label} 해금`,
            progressText: `Lv.${level}/${nextLockedArea.unlockLevel}`,
            description: `${nextLockedArea.label} 입장까지 ${Math.max(0, nextLockedArea.unlockLevel - level)}레벨`
          }
          : {
            type: 'endgame',
            label: '엔드게임 파밍',
            progressText: `${highestUnlockedArea.label} 진행 중`,
            description: '레이드, 던전, 전리품 파밍으로 캐릭터를 강화하세요.'
          };

  return {
    levelProgress,
    powerScore: calculateRpgPowerScore(derivedStats),
    currentArea: {
      id: normalizeRpgArea(profile.rpg?.currentArea),
      ...currentArea
    },
    highestUnlockedArea: {
      id: highestUnlockedAreaId,
      ...highestUnlockedArea
    },
    nextLockedArea: nextLockedArea ?? null,
    mainObjective,
    claimableDailyMissions,
    claimableQuests,
    progressableStoryChapters,
    actionAvailability,
    dailyGold,
    recommendedAction: getRecommendedRpgAction({
      profile,
      cooldownRemainingMs,
      actionAvailability,
      claimableDailyMissions,
      claimableQuests,
      progressableStoryChapters,
      currentArea,
      nextLockedArea
    })
  };
}

export function getRpgSkillPointSummary(profile) {
  const learnedSkills = normalizeRpgSkillTreeNodes(profile.rpg?.learnedSkills ?? []);
  const earned = Math.floor(Math.max(1, Number(profile.rpg?.level) || 1) / 2);
  const spent = learnedSkills.reduce((sum, skillId) => sum + RPG_SKILL_TREE[skillId].cost, 0);

  return {
    earned,
    spent,
    available: Math.max(0, earned - spent)
  };
}

export function getRpgSkillTreeStatuses(profile) {
  const learned = new Set(normalizeRpgSkillTreeNodes(profile.rpg?.learnedSkills ?? []));
  const points = getRpgSkillPointSummary(profile);
  const characterClass = normalizeRpgClass(profile.rpg?.characterClass);

  return Object.entries(RPG_SKILL_TREE).map(([id, skill]) => ({
    id,
    ...skill,
    learned: learned.has(id),
    classAllowed: skill.classes.includes(characterClass),
    canLearn: !learned.has(id) && skill.classes.includes(characterClass) && points.available >= skill.cost
  }));
}

export function getRpgAreaProgressStatuses(profile) {
  const level = Math.max(1, Number(profile.rpg?.level) || 1);
  const unlockedAreaIds = new Set(getUnlockedRpgAreaIds(level));
  const currentArea = normalizeRpgArea(profile.rpg?.currentArea);

  return Object.entries(RPG_AREAS).map(([id, area]) => {
    const progress = normalizeRpgProgressValue(profile.rpg?.areaProgress?.[id]);
    return {
      id,
      ...area,
      progress,
      progressBar: createRpgProgressBar(progress, 100),
      unlocked: unlockedAreaIds.has(id),
      current: id === currentArea,
      mastered: progress >= 100
    };
  });
}

export function getRpgClassMasteryStatus(profile) {
  const classId = normalizeRpgClass(profile.rpg?.characterClass);
  const classConfig = getRpgClassConfig(classId);
  const mastery = normalizeRpgClassMasteryEntry(profile.rpg?.classMastery?.[classId]);
  const required = getRpgClassMasteryRequired(mastery.level);

  return {
    classId,
    classLabel: classConfig.label,
    level: mastery.level,
    progress: Math.min(mastery.progress, required),
    required,
    percent: Math.min(100, Math.floor((mastery.progress / required) * 100)),
    progressBar: createRpgProgressBar(mastery.progress, required)
  };
}

export function getRpgCraftingMasteryRequired(level = 1) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return 90 + safeLevel * 45;
}

export function getRpgCraftingMasteryStatus(profile, masteryType = 'weapon') {
  const normalizedType = normalizeRpgCraftingMasteryType(masteryType);
  const mastery = normalizeRpgCraftingMasteryEntry(profile.rpg?.craftingMastery?.[normalizedType]);
  const required = getRpgCraftingMasteryRequired(mastery.level);

  return {
    type: normalizedType,
    ...RPG_CRAFTING_MASTERIES[normalizedType],
    level: mastery.level,
    xp: Math.min(mastery.xp, required),
    required,
    percent: Math.min(100, Math.floor((mastery.xp / required) * 100)),
    progressBar: createRpgProgressBar(mastery.xp, required)
  };
}

export function getRpgCraftingMasteryStatuses(profile) {
  return Object.keys(RPG_CRAFTING_MASTERIES).map((type) => getRpgCraftingMasteryStatus(profile, type));
}

export function getRpgCraftingRecipeStatus(profile, recipeId, recipe = getRpgCraftingRecipeConfig(recipeId)) {
  const id = normalizeRpgCraftingRecipeId(recipeId);
  const mastery = getRpgCraftingMasteryStatus(profile, recipe.masteryType);
  const levelReady = (Number(profile.rpg?.level) || 1) >= recipe.requiredLevel;
  const masteryReady = mastery.level >= recipe.requiredMasteryLevel;
  const classReady = !recipe.requiredClass || hasRpgClassAccess(profile, recipe.requiredClass);
  const materialRows = Object.entries(recipe.materials ?? {}).map(([itemId, required]) => {
    const normalizedItemId = normalizeRpgItemId(itemId);
    const owned = Number(profile.rpg?.inventory?.[normalizedItemId] ?? 0);
    return {
      itemId: normalizedItemId,
      label: getRpgItemConfig(normalizedItemId).label,
      owned,
      required,
      ready: owned >= required
    };
  });
  const materialsReady = materialRows.every((row) => row.ready);

  return {
    id,
    ...recipe,
    mastery,
    levelReady,
    masteryReady,
    classReady,
    materialRows,
    materialsReady,
    canCraft: levelReady && masteryReady && classReady && materialsReady
  };
}

export function getRpgCraftingRecipeStatuses(profile, category = null) {
  const normalizedCategory = normalizeNullableRpgCraftingCategory(category);
  return Object.entries(RPG_CRAFTING_RECIPES)
    .filter(([, recipe]) => !normalizedCategory || recipe.category === normalizedCategory)
    .map(([id, recipe]) => getRpgCraftingRecipeStatus(profile, id, recipe));
}

export function getRpgAdvancedClassStatuses(profile) {
  const classMastery = profile.rpg?.classMastery ?? {};

  return Object.entries(RPG_ADVANCED_CLASSES).map(([id, advancedClass]) => {
    const baseClass = getRpgClassConfig(advancedClass.baseClass);
    const mastery = normalizeRpgClassMasteryEntry(classMastery[advancedClass.baseClass]);
    const quest = advancedClass.classQuest;
    const questCurrent = quest ? getRequirementProgress(profile, quest.requirement) : 0;
    const questRequired = quest?.requirement.count ?? 0;
    const isCurrent = profile.rpg?.advancedClass === id;
    const classAllowed = profile.rpg?.characterClass === advancedClass.baseClass;
    const levelReady = (profile.rpg?.level ?? 1) >= advancedClass.unlockLevel;
    const masteryReady = mastery.level >= (advancedClass.masteryLevel ?? 1);
    const questReady = !quest || questCurrent >= questRequired;

    return {
      id,
      ...advancedClass,
      baseClassLabel: baseClass.label,
      current: isCurrent,
      classAllowed,
      levelReady,
      masteryLevel: mastery.level,
      requiredMasteryLevel: advancedClass.masteryLevel ?? 1,
      masteryReady,
      questLabel: quest?.label ?? null,
      questCurrent,
      questRequired,
      questReady,
      canAdvance: !isCurrent && classAllowed && levelReady && masteryReady && questReady
    };
  });
}

export function getRpgDungeonUnlockStatus(profile, dungeonId) {
  const normalizedDungeonId = normalizeRpgDungeonId(dungeonId);
  const dungeon = RPG_DUNGEONS[normalizedDungeonId];
  const rpgLevel = Math.max(1, Number(profile?.rpg?.level) || 1);
  const unlockedAreas = getUnlockedRpgAreaIds(rpgLevel);
  const levelReady = rpgLevel >= dungeon.unlockLevel;
  const areaReady = unlockedAreas.includes(dungeon.area);
  const requirement = dungeon.unlockRequirement ?? null;
  const requirementCurrent = requirement ? getRequirementProgress(profile, requirement) : 0;
  const requirementRequired = requirement?.count ?? 0;
  const requirementReady = !requirement || requirementCurrent >= requirementRequired;

  return {
    id: normalizedDungeonId,
    ...dungeon,
    levelReady,
    areaReady,
    requirement,
    requirementCurrent,
    requirementRequired,
    requirementReady,
    unlocked: levelReady && areaReady && requirementReady
  };
}

export function getRpgRequirementProgress(profile, requirement) {
  return getRequirementProgress(profile, requirement);
}

export function getRpgStoryChapterStatuses(profile) {
  return Object.entries(RPG_STORY_CHAPTERS).map(([id, chapter]) => {
    const current = getRequirementProgress(profile, chapter.requirement);
    const required = chapter.requirement.count;
    const completed = Boolean(profile.rpg?.storyChapters?.[id]);

    return {
      id,
      ...chapter,
      current,
      required,
      complete: current >= required,
      completed,
      canProgress: current >= required && !completed
    };
  });
}

export function getRpgMonsterCodexStatuses(profile) {
  return Object.entries(MONSTER_ASSET_IDS).map(([monster, assetId]) => {
    const discovered = Number(profile.rpg?.discoveredMonsters?.[monster] ?? 0);
    const kills = Number(profile.rpg?.monsterKills?.[monster] ?? 0);
    const claimed = Boolean(profile.rpg?.codexClaims?.[monster]);

    return {
      monster,
      assetId,
      discovered,
      kills,
      claimed,
      canClaim: discovered > 0 && !claimed,
      rewards: {
        xp: 40 + kills * 10,
        coins: 120 + kills * 30
      }
    };
  });
}

export function normalizeRpgClass(characterClass = 'novice') {
  const normalized = String(characterClass || 'novice').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');
  const aliases = {
    novice: ['초보자', '초보', 'novice', 'adventurer', '모험가'],
    warrior: ['검사', '전사', 'warrior', 'swordsman', 'swordman', 'w'],
    mage: ['마법사', '메이지', 'mage', 'wizard', 'm'],
    ranger: ['궁수', '레인저', 'ranger', 'archer', 'r'],
    paladin: ['성기사', 'paladin'],
    priest: ['성직자', '사제', '프리스트', 'priest', 'cleric'],
    rogue: ['도적', '로그', 'rogue', 'assassin', '암살자'],
    tazza: ['타짜', '도박사', '겜블러', 'tazza', 'gambler'],
    blacksmith: ['대장장이', '대장간', 'blacksmith', 'smith']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if ([id, id.replace(/_/g, ' '), ...names].map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) {
      return id;
    }
  }

  throw new Error('직업은 모험가, 검사, 마법사, 궁수, 성기사, 성직자, 도적, 타짜, 대장장이 중 하나여야 합니다.');
}

export function normalizeRpgGender(characterGender = 'male') {
  const normalized = String(characterGender || 'male').trim().toLocaleLowerCase('ko-KR');

  if (['남', '남자', '남성', '남캐', 'male', 'm', 'man'].includes(normalized)) return 'male';
  if (['여', '여자', '여성', '여캐', 'female', 'f', 'woman'].includes(normalized)) return 'female';

  throw new Error('성별은 남캐 또는 여캐 중 하나여야 합니다.');
}

export function normalizeRpgDifficulty(difficulty = 'normal') {
  const normalized = String(difficulty || 'normal').trim().toLocaleLowerCase('ko-KR');

  if (['쉬움', 'easy', 'e'].includes(normalized)) return 'easy';
  if (['보통', 'normal', 'n'].includes(normalized)) return 'normal';
  if (['어려움', 'hard', 'h'].includes(normalized)) return 'hard';

  throw new Error('난이도는 쉬움, 보통, 어려움 중 하나여야 합니다.');
}

export function normalizeRpgArea(area = 'forest') {
  const normalized = String(area || 'forest').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');
  const aliases = {
    forest: ['왕도 남쪽 초원', '왕도남쪽초원', '초원', '남쪽초원', 'forest', 'plains'],
    wildflower_plains: ['고블린 숲', '고블린숲', 'goblin forest', 'wildflower_plains'],
    cave: ['버려진 은광', '버려진은광', '은광', '광산', 'cave', 'silver mine'],
    moonlit_hill: ['안개 늪지', '안개늪지', '늪지', 'mist marsh', 'moonlit_hill'],
    marsh: ['도적단 요새', '도적단요새', '도적 요새', 'bandit fortress', 'marsh'],
    mushroom_grove: ['저주받은 수도원', '저주받은수도원', '수도원', 'cursed monastery', 'mushroom_grove'],
    ruins: ['붉은 협곡', '붉은협곡', '협곡', 'red canyon', 'ruins'],
    bandit_outpost: ['얼어붙은 산맥', '얼어붙은산맥', '산맥', 'frozen mountains', 'bandit_outpost'],
    red_desert: ['고대 엘프 유적', '고대엘프유적', '엘프 유적', 'ancient elf ruins', 'red_desert'],
    volcano: ['용의 둥지', '용의둥지', '용둥지', 'dragon nest', 'volcano'],
    thunder_plateau: ['마탑 지하서고', '마탑지하서고', '마탑', 'wizard tower', 'thunder_plateau'],
    frost: ['마왕성 외곽', '마왕성외곽', '외곽', 'demon king outer wall', 'frost'],
    crystal_lake: ['성지 아르덴', '성지아르덴', '성지', 'sacred arden', 'crystal_lake'],
    sky: ['왕국 수도 성벽', '왕국수도성벽', '성벽', 'capital wall', 'sky'],
    phantom_forest: ['왕국 대장간 거리', '왕국대장간거리', '대장간 거리', 'blacksmith district', 'phantom_forest'],
    abyss_mine: ['왕국 비밀 광산', '왕국비밀광산', '비밀 광산', 'secret mine', 'abyss_mine'],
    starfall_crater: ['길드 훈련장', '길드훈련장', '훈련장', 'training ground', 'starfall_crater'],
    dragon_nest: ['검은 용의 둥지', '검은용의둥지', '검은 용 둥지', 'black dragon lair', 'dragon_nest'],
    void_gate: ['마왕성 내부', '마왕성내부', '마왕성', 'demon king castle', 'void_gate'],
    sunken_catacombs: ['가라앉은 지하묘지', '가라앉은지하묘지', '지하묘지', '왕릉', 'sunken catacombs', 'sunken_catacombs'],
    dwarven_ironhold: ['드워프 철산', '드워프철산', '철산', 'ironhold', 'dwarven ironhold', 'dwarven_ironhold'],
    moonlit_feywood: ['달빛 요정숲', '달빛요정숲', '요정숲', '달샘 숲', 'moonlit feywood', 'moonlit_feywood'],
    ancient_dragon_altar: ['고룡의 제단', '고룡의제단', '고룡 제단', '용 제단', 'dragon altar', 'ancient_dragon_altar']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if ([id, id.replace(/_/g, ' '), ...names].map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) {
      return id;
    }
  }

  throw new Error(`지역은 ${Object.values(RPG_AREAS).map((areaConfig) => areaConfig.label).join(', ')} 중 하나여야 합니다.`);
}

export function normalizeRpgSkillId(skillId = 'basic') {
  const normalized = String(skillId || 'basic').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');
  const legacyAliases = {
    power_strike: 'combo_slash',
    holy_guard: 'guard_stance',
    holy_smite: 'taunt',
    blade_storm: 'combo_slash',
    meteor_storm: 'fireball',
    arrow_tempest: 'aimed_shot',
    divine_aegis: 'taunt',
    shadow_execute: 'backstab',
    miracle_judgement: 'heal',
    berserker_rage: 'combo_slash',
    archmage_arcana: 'fireball',
    sniper_deadeye: 'aimed_shot',
    crusader_oath: 'taunt',
    shadow_assault: 'backstab',
    saint_blessing: 'heal'
  };
  const aliases = {
    basic: ['기본', '기본 공격', 'attack'],
    first_aid: ['응급 처치', '응급처치', 'first aid'],
    guard_stance: ['방어 자세', '방어자세', '방어', 'guard stance', 'guard'],
    weak_spot: ['약점 찌르기', '약점찌르기', 'weak spot'],
    combo_slash: ['연속 베기', '연속베기', 'combo slash', 'power strike', '파워 스트라이크'],
    fireball: ['화염구', '파이어볼', 'fireball'],
    aimed_shot: ['약점 조준', '약점조준', '조준 사격', '조준사격', 'aimed shot'],
    taunt: ['도발', 'taunt', '성스러운 방패', '신성한 방벽'],
    heal: ['치유', 'heal', '성역', '기적의 심판', '성자의 축복'],
    backstab: ['기습', '백스탭', 'backstab'],
    card_draw: ['카드 뽑기', '카드뽑기', 'card draw'],
    fate_flip: ['운명 뒤집기', '운명뒤집기', 'fate flip'],
    hammer_slam: ['망치 강타', '망치강타', 'hammer slam'],
    armor_break: ['방어구 파괴', '방어구파괴', 'armor break']
  };

  if (legacyAliases[compact]) return legacyAliases[compact];
  for (const [id, names] of Object.entries(aliases)) {
    if ([id, id.replace(/_/g, ' '), ...names].map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) {
      return id;
    }
  }

  throw new Error('알 수 없는 RPG 스킬입니다.');
}

export function normalizeRpgBossActionId(action = 'basic') {
  const normalized = String(action || 'basic').trim().toLocaleLowerCase('ko-KR');

  if (['방어', '가드', 'guard', 'defend', 'defense'].includes(normalized)) return 'guard';
  if (['포션', '회복', 'potion', 'heal'].includes(normalized)) return 'potion';

  return normalizeRpgSkillId(normalized);
}

export function normalizeRpgItemId(itemId) {
  const normalized = String(itemId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, item] of Object.entries(RPG_ITEMS)) {
    const names = [id, id.replace(/_/g, ' '), item.label, item.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  if (['포션', '회복 포션', 'potion'].includes(normalized)) return 'potion';
  if (['마나 포션', '마나포션', 'mana_potion', 'mana potion'].includes(normalized)) return 'mana_potion';
  if (['강화석', '강화 돌', '강화돌', 'enhancement_stone', 'enhancement stone', 'stone'].includes(normalized)) return 'enhancement_stone';
  if (['철검', 'iron_sword', 'iron sword', 'sword'].includes(normalized)) return 'iron_sword';
  if (['가죽 갑옷', '가죽갑옷', 'leather_armor', 'leather armor', 'armor'].includes(normalized)) return 'leather_armor';
  if (['반지', '신비한 반지', 'mystic_ring', 'mystic ring', 'ring'].includes(normalized)) return 'mystic_ring';
  if (['용비늘 대검', '용비늘대검', 'dragon_blade', 'dragon blade'].includes(normalized)) return 'dragon_blade';
  if (['용심장', '용의심장', 'dragon_heart', 'dragon heart'].includes(normalized)) return 'dragon_heart';
  if (['대마도사의 지팡이', '대마도사지팡이', 'archmage_staff', 'archmage staff'].includes(normalized)) return 'archmage_staff';
  if (['수호자의 판금갑옷', '수호자 판금갑옷', 'guardian_plate', 'guardian plate'].includes(normalized)) return 'guardian_plate';

  throw new Error('알 수 없는 RPG 아이템입니다.');
}

export function normalizeRpgCraftingCategory(category = 'weapon') {
  const normalized = String(category || 'weapon').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');
  const aliases = {
    weapon: ['무기', '무기제작', 'weapon'],
    armor: ['방어구', '방어구제작', 'armor'],
    accessory: ['장신구', '장신구제작', 'accessory'],
    consumable: ['소모품', '포션', 'consumable', 'potion'],
    rune: ['룬', '룬제작', 'rune'],
    processing: ['재료가공', '가공', 'processing', 'material'],
    blacksmith: ['대장장이전용', '대장장이', 'blacksmith']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if ([id, id.replace(/_/g, ' '), ...names].map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('제작 종류는 무기, 방어구, 장신구, 소모품, 룬, 재료 가공, 대장장이 전용 중 하나여야 합니다.');
}

export function normalizeNullableRpgCraftingCategory(category) {
  if (!category) return null;
  return normalizeRpgCraftingCategory(category);
}

export function normalizeRpgCraftingMasteryType(masteryType = 'weapon') {
  const normalized = String(masteryType || 'weapon').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, mastery] of Object.entries(RPG_CRAFTING_MASTERIES)) {
    const names = [id, id.replace(/_/g, ' '), mastery.label, mastery.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  return normalizeRpgCraftingCategory(normalized) === 'blacksmith' ? 'engineering' : normalizeRpgCraftingCategory(normalized);
}

export function normalizeRpgCraftingRecipeId(recipeId) {
  const normalized = String(recipeId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, recipe] of Object.entries(RPG_CRAFTING_RECIPES)) {
    const resultItem = RPG_ITEMS[recipe.resultItemId];
    const names = [id, id.replace(/_/g, ' '), recipe.label, recipe.label.replace(/\s+/g, ''), resultItem?.label, resultItem?.label?.replace(/\s+/g, '')].filter(Boolean);
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  const legacyAliases = {
    용심장대장장이망치: 'hidden_dragonheart_hammer',
    dragonhearthammer: 'hidden_dragonheart_hammer'
  };
  if (legacyAliases[compact]) return legacyAliases[compact];

  throw new Error('알 수 없는 제작 레시피입니다.');
}

export function normalizeRpgCraftingQualityId(qualityId = 'normal') {
  const normalized = String(qualityId || 'normal').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, quality] of Object.entries(RPG_CRAFTING_QUALITIES)) {
    const names = [id, id.replace(/_/g, ' '), quality.label, quality.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 제작 품질입니다.');
}

export function normalizeRpgDungeonId(dungeonId) {
  const normalized = String(dungeonId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, dungeon] of Object.entries(RPG_DUNGEONS)) {
    const names = [id, id.replace(/_/g, ' '), dungeon.label, dungeon.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 던전입니다.');
}

export function normalizeRpgQuestId(questId) {
  const normalized = String(questId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, quest] of Object.entries(RPG_QUESTS)) {
    const names = [id, id.replace(/_/g, ' '), quest.label, quest.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  const aliases = {
    first_blood: ['첫 승리', '첫승리'],
    slime_slayer: ['슬라임 사냥꾼', '슬라임사냥꾼'],
    cave_scout: ['동굴 정찰', '동굴정찰'],
    boss_challenger: ['보스 도전자', '보스도전자']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 RPG 퀘스트입니다.');
}

export function normalizeRpgDailyMissionId(missionId) {
  const normalized = String(missionId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, mission] of Object.entries(RPG_DAILY_MISSIONS)) {
    const names = [id, id.replace(/_/g, ' '), mission.label, mission.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  const aliases = {
    field_training: ['전장 훈련', '전장훈련', '훈련'],
    route_scout: ['정찰 의뢰', '정찰의뢰', '정찰'],
    dungeon_delver: ['던전 조사', '던전조사', '던전'],
    victory_contract: ['승리 계약', '승리계약', '승리']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 일일 의뢰입니다.');
}

export function normalizeRpgTutorialStepId(stepId) {
  const normalized = String(stepId || '').trim().toLocaleLowerCase('ko-KR');

  if (['캐릭터 만들기', '캐릭터만들기', '캐릭터 생성', '캐릭터생성', 'create_character', 'create character', 'start'].includes(normalized)) return 'create_character';
  if (['첫 전투', '첫전투', 'first_battle', 'first battle', 'battle'].includes(normalized)) return 'first_battle';
  if (['첫 정비', '첫정비', '첫 회복', '첫회복', 'first_recovery', 'first recovery', 'recovery', 'rest'].includes(normalized)) return 'first_recovery';
  if (['첫 상점 정비', '첫상점정비', '첫 상점', '첫상점', 'first_shop', 'first shop', 'shop'].includes(normalized)) return 'first_shop';
  if (['첫 퀘스트 보상', '첫퀘스트보상', '첫 퀘스트', '첫퀘스트', 'first_quest', 'first quest', 'quest'].includes(normalized)) return 'first_quest';
  if (['월드맵 첫걸음', '월드맵첫걸음', '월드 첫걸음', '월드첫걸음', 'first_world_step', 'first world step', 'world', 'area'].includes(normalized)) return 'first_world_step';

  throw new Error('알 수 없는 RPG 튜토리얼 단계입니다.');
}

export function normalizeRpgBossId(bossId) {
  const normalized = String(bossId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');
  for (const [id, boss] of Object.entries(RPG_BOSSES)) {
    const names = [id, id.replace(/_/g, ' '), boss.label, boss.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }
  const aliases = {
    slime_king: ['고블린 족장', '고블린족장', 'goblin chief', 'slime king'],
    ancient_dragon: ['검은 용 베르카르', '검은용베르카르', '베르카르', 'black dragon', 'ancient dragon']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if ([id, id.replace(/_/g, ' '), ...names].map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 RPG 보스입니다.');
}

export function normalizeRpgGachaBannerId(bannerId = 'standard') {
  const normalized = String(bannerId || 'standard').trim().toLocaleLowerCase('ko-KR');

  if (['일반', '일반 소환', 'standard', 'normal'].includes(normalized)) return 'standard';

  throw new Error('알 수 없는 가챠 배너입니다.');
}

export function normalizeRpgAdvancedClass(advancedClass) {
  const normalized = String(advancedClass || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, config] of Object.entries(RPG_ADVANCED_CLASSES)) {
    const names = [id, id.replace(/_/g, ' '), config.label, config.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  const legacyAliases = {
    아크메이지: 'archmage',
    성전사: 'crusader',
    쉐도우: 'shadow',
    성자: 'saint',
    카드술사: 'card_mage',
    주사위꾼: 'dice_gambler',
    아르카나로드: 'arcana_lord',
    운명의딜러: 'fate_dealer',
    광기의도박사: 'mad_gambler'
  };
  if (legacyAliases[normalized] || legacyAliases[compact]) return legacyAliases[normalized] ?? legacyAliases[compact];

  throw new Error('알 수 없는 전직입니다.');
}

export function normalizeNullableRpgAdvancedClass(advancedClass) {
  if (!advancedClass) return null;
  return normalizeRpgAdvancedClass(advancedClass);
}

export function normalizeRpgSkillTreeNodeId(skillId) {
  const normalized = String(skillId || '').trim().toLocaleLowerCase('ko-KR');

  if (['무기 숙련', '무기숙련', 'weapon_training', 'weapon training'].includes(normalized)) return 'weapon_training';
  if (['강철 체력', '강철체력', 'iron_body', 'iron body'].includes(normalized)) return 'iron_body';
  if (['마나 순환', '마나순환', 'mana_flow', 'mana flow'].includes(normalized)) return 'mana_flow';
  if (['행운과 손재주', '행운과손재주', 'luck_craft', 'luck craft'].includes(normalized)) return 'luck_craft';
  if (['직업 숙련', '직업숙련', 'class_mastery', 'class mastery'].includes(normalized)) return 'class_mastery';

  throw new Error('알 수 없는 스킬트리 노드입니다.');
}

export function normalizeRpgStoryChapterId(chapterId) {
  const normalized = String(chapterId || '').trim().toLocaleLowerCase('ko-KR');
  const compact = normalized.replace(/\s+/g, '');

  for (const [id, chapter] of Object.entries(RPG_STORY_CHAPTERS)) {
    const names = [id, id.replace(/_/g, ' '), chapter.label, chapter.label.replace(/\s+/g, '')];
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  const aliases = {
    forest_oath: ['숲의 맹세', '숲의맹세'],
    cave_signal: ['은광의 신호', '은광의신호'],
    ruins_key: ['유적의 열쇠', '유적의열쇠'],
    marsh_plague: ['늪의 독안개', '늪의독안개'],
    volcano_core: ['화산 심장부', '화산심장부'],
    frost_beacon: ['빙결 봉화', '빙결봉화'],
    sky_throne: ['하늘 왕좌', '하늘왕좌']
  };

  for (const [id, names] of Object.entries(aliases)) {
    if (names.map((name) => String(name).toLocaleLowerCase('ko-KR').replace(/\s+/g, '')).includes(compact)) return id;
  }

  throw new Error('알 수 없는 메인 퀘스트입니다.');
}

export function normalizeRpgRaidId(raidId) {
  const normalized = String(raidId || '').trim().toLocaleLowerCase('ko-KR');

  for (const [id, raid] of Object.entries(RPG_RAIDS)) {
    const label = raid.label.toLocaleLowerCase('ko-KR');
    const compactLabel = label.replace(/\s+/g, '');
    const spacedId = id.replace(/_/g, ' ');
    if ([id, spacedId, label, compactLabel].includes(normalized)) {
      return id;
    }
  }

  throw new Error('알 수 없는 레이드입니다.');
}

export function normalizeRpgMonsterName(monsterName) {
  const normalized = String(monsterName || '').trim().toLocaleLowerCase('ko-KR');
  const match = Object.keys(MONSTER_ASSET_IDS)
    .find((monster) => monster.toLocaleLowerCase('ko-KR') === normalized);
  if (match) return match;

  const aliases = {
    slime: '슬라임',
    goblin: '고블린 정찰병',
    wolf: '회색 늑대',
    forest_wolf: '회색 늑대',
    orc: '오크 전사',
    skeleton: '스켈레톤',
    bat: '박쥐',
    troll: '오크 전사',
    dark_knight: '타락 기사',
    mini_dragon: '드레이크',
    slime_king: '고블린 족장',
    ancient_dragon: '검은 용 베르카르'
  };

  if (aliases[normalized]) return aliases[normalized];
  throw new Error('알 수 없는 몬스터입니다.');
}

export function normalizeRpgEquipment(equipment = {}) {
  const safeEquipment = equipment && typeof equipment === 'object' ? equipment : {};
  const normalized = { ...DEFAULT_RPG_EQUIPMENT };

  for (const slot of Object.keys(DEFAULT_RPG_EQUIPMENT)) {
    const itemId = safeEquipment[slot];
    if (!itemId) continue;

    try {
      const normalizedItemId = normalizeRpgItemId(itemId);
      const item = RPG_ITEMS[normalizedItemId];
      if (item.type === 'equipment' && item.slot === slot) {
        normalized[slot] = normalizedItemId;
      }
    } catch {
      // Invalid legacy equipment is ignored.
    }
  }

  return normalized;
}

export function resolveRpgBattle({
  playerLevel,
  difficulty = 'normal',
  characterClass = 'novice',
  characterGender = 'male',
  advancedClass = null,
  area = 'forest',
  skillId = 'basic',
  statBonuses = {},
  randomInt = defaultRandomInt
}) {
  const normalizedDifficulty = normalizeRpgDifficulty(difficulty);
  const normalizedClass = normalizeRpgClass(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);
  const normalizedArea = normalizeRpgArea(area);
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const config = RPG_DIFFICULTIES[normalizedDifficulty];
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const skill = RPG_SKILLS[normalizedSkillId];
  const areaConfig = RPG_AREAS[normalizedArea];
  const monsterPool = areaConfig.monsters[normalizedDifficulty] ?? config.monsters;
  const safeLevel = Math.max(1, Number(playerLevel) || 1);
  const playerRoll = randomInt(1, 12);
  const monsterPower = randomInt(config.monsterPowerMin, config.monsterPowerMax);
  const monster = monsterPool[randomInt(0, monsterPool.length - 1)];
  const attackBonus = Math.max(0, Number(statBonuses.attack) || 0) + skill.attackBonus;
  const defenseBonus = Math.max(0, Number(statBonuses.defense) || 0) + skill.defenseBonus;
  const playerPower = safeLevel * 2 + playerRoll + config.playerBonus + classConfig.powerBonus + attackBonus;
  const mitigatedMonsterPower = Math.max(1, monsterPower - defenseBonus);
  const win = playerPower >= mitigatedMonsterPower;
  const baseXpReward = win ? randomInt(config.xpMin, config.xpMax) : 0;
  const xpReward = Math.floor(baseXpReward * areaConfig.xpMultiplier);
  const coinReward = win ? Math.floor(config.coinReward * areaConfig.coinMultiplier) : 0;
  const damageTaken = win
    ? Math.max(1, Math.floor(mitigatedMonsterPower / 4))
    : Math.max(5, Math.floor(mitigatedMonsterPower / 2));

  return {
    difficulty: normalizedDifficulty,
    difficultyLabel: config.label,
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    skillId: normalizedSkillId,
    skillLabel: skill.label,
    skillMpCost: skill.mpCost,
    ultimate: Boolean(skill.ultimate),
    statusEffect: cloneRpgStatusEffect(skill.statusEffect),
    area: normalizedArea,
    areaLabel: areaConfig.label,
    monster,
    playerLevel: safeLevel,
    playerRoll,
    playerPower,
    monsterPower,
    mitigatedMonsterPower,
    attackBonus,
    defenseBonus,
    damageTaken,
    win,
    rewards: {
      xp: xpReward,
      coins: coinReward
    },
    assets: {
      hero: getRpgHeroAssetId({
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        advancedClass
      }),
      monster: MONSTER_ASSET_IDS[monster] ?? 'monster_unknown_idle',
      background: areaConfig.backgroundAssetId
    }
  };
}

export function resolveRpgBossTurn({
  player = {},
  boss = {},
  action = 'basic',
  bossId = 'slime_king',
  turnNumber = 1,
  randomInt = defaultRandomInt
} = {}) {
  const normalizedAction = normalizeRpgBossActionId(action);
  const playerState = createRpgBossTurnPlayer(player);
  const bossState = createRpgBossTurnBoss(boss);
  const bossPattern = getRpgBossPattern(bossId, turnNumber);
  let roll = 0;
  let attackPower = 0;
  let playerDamage = 0;
  let healed = 0;
  let consumedItemId = null;
  let skillId = null;
  let skillLabel = null;
  let mpCost = 0;
  let ultimate = false;
  let statusEffect = null;
  let playerMpAfter = playerState.mp;
  const inventory = { ...playerState.inventory };

  if (normalizedAction === 'potion') {
    if ((inventory.potion ?? 0) <= 0) {
      throw new Error('회복 포션이 없습니다.');
    }

    consumedItemId = 'potion';
    inventory.potion -= 1;
    if (inventory.potion <= 0) {
      delete inventory.potion;
    }
    healed = Math.min(40, playerState.maxHp - playerState.hp);
  } else if (normalizedAction !== 'guard') {
    const skill = RPG_SKILLS[normalizedAction];
    if (!playerState.availableSkillIds.includes(normalizedAction)) {
      throw new Error(`${playerState.characterClassLabel} 직업은 ${skill.label} 스킬을 사용할 수 없습니다.`);
    }
    if (playerState.mp < skill.mpCost) {
      throw new Error(`MP가 부족합니다. 필요 MP: ${skill.mpCost}, 현재 MP: ${playerState.mp}`);
    }

    skillId = normalizedAction;
    skillLabel = skill.label;
    mpCost = skill.mpCost;
    ultimate = Boolean(skill.ultimate);
    statusEffect = cloneRpgStatusEffect(skill.statusEffect);
    playerMpAfter = Math.max(0, playerState.mp - skill.mpCost);
    roll = randomInt(1, 20);
    attackPower = playerState.stats.attack + skill.attackBonus + playerState.level + roll;
    playerDamage = Math.max(1, Math.floor(attackPower / 2));
  }

  const weaknessHit = Boolean(skillId && bossPattern.weaknessSkillIds?.includes(skillId));
  const patternCountered = isRpgBossPatternCountered({
    bossPattern,
    action: normalizedAction,
    skillId,
    ultimate
  });
  if (weaknessHit) {
    playerDamage += Math.max(2, Math.ceil(playerDamage * 0.35));
  }
  if (patternCountered && normalizedAction !== 'guard' && normalizedAction !== 'potion') {
    playerDamage += Math.max(1, Math.ceil(playerState.level / 2));
  }

  const bossHpAfter = Math.max(0, bossState.hp - playerDamage);
  const bossDefeated = bossHpAfter <= 0;
  const patternedBossPower = Math.max(1, Math.ceil(bossState.power * bossPattern.damageMultiplier));
  const guardMitigation = normalizedAction === 'guard'
    ? Math.ceil(patternedBossPower * bossPattern.guardMitigationRate)
    : 0;
  const rawBossDamage = bossDefeated
    ? 0
    : Math.max(1, Math.floor(Math.max(1, patternedBossPower - playerState.stats.defense - guardMitigation) / 3));
  const bossDamageReduction = patternCountered && !bossDefeated
    ? Math.max(1, Math.ceil(rawBossDamage * 0.4))
    : 0;
  const bossDamage = Math.max(0, rawBossDamage - bossDamageReduction);
  const playerHpAfterHeal = Math.min(playerState.maxHp, playerState.hp + healed);
  const playerHpAfter = Math.max(1, playerHpAfterHeal - bossDamage);

  return {
    action: normalizedAction,
    skillId,
    skillLabel,
    mpCost,
    ultimate,
    statusEffect,
    roll,
    attackPower,
    playerDamage,
    healed,
    consumedItemId,
    bossPattern,
    patternCountered,
    weaknessHit,
    bossDamageReduction,
    bossDamage,
    bossHpBefore: bossState.hp,
    bossHpAfter,
    playerHpBefore: playerState.hp,
    playerHpAfter,
    playerMpBefore: playerState.mp,
    playerMpAfter,
    inventory,
    win: bossDefeated,
    playerDefeated: playerHpAfter <= 1 && !bossDefeated
  };
}

export function resolveRpgBossBattle({
  playerLevel,
  bossId,
  characterClass = 'novice',
  characterGender = 'male',
  advancedClass = null,
  skillId = 'basic',
  statBonuses = {},
  randomInt = defaultRandomInt
}) {
  const normalizedBossId = normalizeRpgBossId(bossId);
  const boss = RPG_BOSSES[normalizedBossId];
  const normalizedClass = normalizeRpgClass(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = RPG_SKILLS[normalizedSkillId];
  const safeLevel = Math.max(1, Number(playerLevel) || 1);
  const playerRoll = randomInt(1, 12);
  const bossPower = randomInt(boss.powerMin, boss.powerMax);
  const attackBonus = Math.max(0, Number(statBonuses.attack) || 0) + skill.attackBonus;
  const defenseBonus = Math.max(0, Number(statBonuses.defense) || 0) + skill.defenseBonus;
  const playerPower = safeLevel * 2 + playerRoll + classConfig.powerBonus + attackBonus;
  const mitigatedMonsterPower = Math.max(1, bossPower - defenseBonus);
  const win = playerPower >= mitigatedMonsterPower;
  const damageTaken = win
    ? Math.max(3, Math.floor(mitigatedMonsterPower / 3))
    : Math.max(10, Math.floor(mitigatedMonsterPower / 2));

  return {
    bossId: normalizedBossId,
    bossLabel: boss.label,
    difficulty: 'boss',
    difficultyLabel: '보스',
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    skillId: normalizedSkillId,
    skillLabel: skill.label,
    skillMpCost: skill.mpCost,
    ultimate: Boolean(skill.ultimate),
    area: boss.area,
    areaLabel: RPG_AREAS[boss.area].label,
    monster: boss.monster,
    playerLevel: safeLevel,
    playerRoll,
    playerPower,
    monsterPower: bossPower,
    mitigatedMonsterPower,
    attackBonus,
    defenseBonus,
    damageTaken,
    win,
    rewards: {
      xp: win ? boss.xpReward : 0,
      coins: win ? boss.coinReward : 0
    },
    assets: {
      hero: getRpgHeroAssetId({
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        advancedClass
      }),
      monster: MONSTER_ASSET_IDS[boss.monster] ?? 'boss_unknown_idle',
      background: boss.backgroundAssetId
    }
  };
}

function createRpgBossTurnPlayer(player) {
  const safePlayer = player && typeof player === 'object' ? player : {};
  const normalizedClass = normalizeRpgClass(safePlayer.characterClass ?? 'novice');
  const normalizedGender = normalizeRpgGender(safePlayer.characterGender ?? 'male');
  const normalizedAdvancedClass = normalizeNullableRpgAdvancedClass(safePlayer.advancedClass);
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const safeLevel = Math.max(1, Number(safePlayer.level) || 1);
  const fallbackStats = getRpgDerivedStats({
    level: safeLevel,
    characterClass: normalizedClass
  });
  const safeStats = safePlayer.stats && typeof safePlayer.stats === 'object'
    ? safePlayer.stats
    : {};

  return {
    level: safeLevel,
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    advancedClass: normalizedAdvancedClass,
    advancedClassLabel: normalizedAdvancedClass
      ? RPG_ADVANCED_CLASSES[normalizedAdvancedClass].label
      : null,
    hp: Math.max(1, Number(safePlayer.hp) || fallbackStats.maxHp),
    maxHp: Math.max(1, Number(safePlayer.maxHp) || fallbackStats.maxHp),
    mp: Math.max(0, Number(safePlayer.mp) || 0),
    maxMp: Math.max(0, Number(safePlayer.maxMp) || fallbackStats.maxMp),
    stats: {
      attack: normalizeRpgPvpStat(safeStats.attack, fallbackStats.attack),
      defense: normalizeRpgPvpStat(safeStats.defense, fallbackStats.defense)
    },
    inventory: normalizeRpgBossInventory(safePlayer.inventory),
    availableSkillIds: Array.isArray(safePlayer.availableSkillIds)
      ? safePlayer.availableSkillIds.map((skillId) => normalizeRpgSkillId(skillId))
      : getAvailableRpgSkillIds(normalizedClass, normalizedAdvancedClass),
    assets: {
      hero: getRpgHeroAssetId({
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        advancedClass: normalizedAdvancedClass
      })
    }
  };
}

function createRpgBossTurnBoss(boss) {
  const safeBoss = boss && typeof boss === 'object' ? boss : {};
  const maxHp = Math.max(1, Number(safeBoss.maxHp) || 30);

  return {
    hp: Math.max(0, Math.min(maxHp, Number(safeBoss.hp) || maxHp)),
    maxHp,
    power: Math.max(1, Number(safeBoss.power) || 10)
  };
}

function normalizeRpgBossInventory(inventory = {}) {
  const safeInventory = inventory && typeof inventory === 'object' ? inventory : {};
  return {
    potion: Math.max(0, Number(safeInventory.potion) || 0),
    mana_potion: Math.max(0, Number(safeInventory.mana_potion) || 0)
  };
}

function normalizeRpgGuildRaidMembers(partyMembers = []) {
  const source = Array.isArray(partyMembers) ? partyMembers : [];
  return source
    .filter((member) => member && typeof member === 'object')
    .map((member, index) => {
      const characterClass = normalizeRpgClass(member.characterClass ?? 'novice');
      const characterGender = normalizeRpgGender(member.characterGender ?? 'male');
      const advancedClass = normalizeNullableRpgAdvancedClass(member.advancedClass);
      const level = Math.max(1, Number(member.level) || 1);
      const fallbackStats = getRpgDerivedStats({ level, characterClass });
      const stats = member.stats && typeof member.stats === 'object'
        ? member.stats
        : fallbackStats;
      const attack = normalizeRpgPvpStat(stats.attack, fallbackStats.attack);
      const defense = normalizeRpgPvpStat(stats.defense, fallbackStats.defense);

      return {
        userId: member.userId ?? `member-${index + 1}`,
        username: member.username ?? `파티원 ${index + 1}`,
        level,
        characterClass,
        characterClassLabel: RPG_CLASSES[characterClass].label,
        characterGender,
        characterGenderLabel: RPG_GENDERS[characterGender].label,
        advancedClass,
        advancedClassLabel: advancedClass ? RPG_ADVANCED_CLASSES[advancedClass].label : null,
        stats: { attack, defense },
        power: Math.max(1, attack + Math.floor(defense / 2) + Math.floor(level / 2)),
        assets: {
          hero: getRpgHeroAssetId({
            characterClass,
            characterGender,
            advancedClass
          })
        }
      };
    });
}

export function resolveRpgExploration({
  playerLevel,
  area = 'forest',
  randomInt = defaultRandomInt
}) {
  const normalizedArea = normalizeRpgArea(area);
  const areaConfig = RPG_AREAS[normalizedArea];
  const safeLevel = Math.max(1, Number(playerLevel) || 1);
  const eventRoll = randomInt(1, 100);
  const secretAreas = new Set(['sunken_catacombs', 'dwarven_ironhold', 'moonlit_feywood', 'ancient_dragon_altar']);
  const event = secretAreas.has(normalizedArea) && eventRoll >= 92
    ? 'secret_passage'
    : eventRoll <= 35
    ? 'battle'
    : eventRoll <= 60
      ? 'treasure'
      : eventRoll <= 80
        ? 'trap'
        : 'shrine';
  const hiddenTrailMultiplier = event === 'secret_passage' ? 1.45 : 1;
  const xpReward = event === 'trap' ? 0 : Math.floor(randomInt(20, 70) * areaConfig.xpMultiplier * hiddenTrailMultiplier);
  const coinReward = event === 'trap' ? 0 : Math.floor(randomInt(50, 160) * areaConfig.coinMultiplier * hiddenTrailMultiplier);
  const damageTaken = event === 'trap'
    ? Math.max(3, randomInt(8, 20) - Math.floor(safeLevel / 2))
    : 0;
  const hpRecovered = event === 'shrine' ? randomInt(15, 35) : 0;
  const mpRecovered = event === 'shrine' ? randomInt(8, 20) : 0;

  return {
    area: normalizedArea,
    areaLabel: areaConfig.label,
    event,
    eventLabel: RPG_EXPLORATION_EVENTS[event].label,
    description: RPG_EXPLORATION_EVENTS[event].description,
    rewards: {
      xp: xpReward,
      coins: coinReward
    },
    damageTaken,
    hpRecovered,
    mpRecovered,
    assets: {
      background: areaConfig.backgroundAssetId
    }
  };
}

export function resolveRpgRaidBattle({
  playerLevel,
  raidId,
  characterClass = 'novice',
  characterGender = 'male',
  advancedClass = null,
  skillId = 'basic',
  statBonuses = {},
  randomInt = defaultRandomInt
}) {
  const normalizedRaidId = normalizeRpgRaidId(raidId);
  const raid = RPG_RAIDS[normalizedRaidId];
  const normalizedClass = normalizeRpgClass(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = RPG_SKILLS[normalizedSkillId];
  const safeLevel = Math.max(1, Number(playerLevel) || 1);
  const playerRoll = randomInt(1, 20);
  const allyPower = randomInt(6, 18);
  const raidPower = randomInt(raid.powerMin, raid.powerMax);
  const attackBonus = Math.max(0, Number(statBonuses.attack) || 0) + skill.attackBonus;
  const defenseBonus = Math.max(0, Number(statBonuses.defense) || 0) + skill.defenseBonus;
  const partyPower = safeLevel * 2 + playerRoll + allyPower + classConfig.powerBonus + attackBonus;
  const mitigatedRaidPower = Math.max(1, raidPower - defenseBonus);
  const win = partyPower >= mitigatedRaidPower;
  const damageTaken = win
    ? Math.max(6, Math.floor(mitigatedRaidPower / 4))
    : Math.max(14, Math.floor(mitigatedRaidPower / 2));

  return {
    raidId: normalizedRaidId,
    raidLabel: raid.label,
    difficulty: 'raid',
    difficultyLabel: '레이드',
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    skillId: normalizedSkillId,
    skillLabel: skill.label,
    skillMpCost: skill.mpCost,
    ultimate: Boolean(skill.ultimate),
    statusEffect: cloneRpgStatusEffect(skill.statusEffect),
    area: raid.area,
    areaLabel: RPG_AREAS[raid.area].label,
    monster: raid.monster,
    playerLevel: safeLevel,
    playerRoll,
    allyPower,
    playerPower: partyPower,
    monsterPower: raidPower,
    mitigatedMonsterPower: mitigatedRaidPower,
    attackBonus,
    defenseBonus,
    damageTaken,
    win,
    rewards: {
      xp: win ? raid.xpReward : 0,
      coins: win ? raid.coinReward : 0
    },
    assets: {
      hero: getRpgHeroAssetId({
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        advancedClass
      }),
      monster: MONSTER_ASSET_IDS[raid.monster] ?? 'boss_unknown_idle',
      background: raid.backgroundAssetId
    }
  };
}

export function resolveRpgGuildRaidBattle({
  playerLevel,
  raidId,
  characterClass = 'novice',
  characterGender = 'male',
  advancedClass = null,
  skillId = 'basic',
  statBonuses = {},
  partyMembers = [],
  randomInt = defaultRandomInt
}) {
  const normalizedRaidId = normalizeRpgRaidId(raidId);
  const raid = RPG_RAIDS[normalizedRaidId];
  const normalizedClass = normalizeRpgClass(characterClass);
  const normalizedGender = normalizeRpgGender(characterGender);
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = RPG_SKILLS[normalizedSkillId];
  const safeLevel = Math.max(1, Number(playerLevel) || 1);
  const members = normalizeRpgGuildRaidMembers(partyMembers);
  const supportMembers = members.slice(1);
  const playerRoll = randomInt(1, 20);
  const supportPower = supportMembers.reduce((sum, member) => sum + member.power, 0);
  const raidPower = randomInt(raid.powerMin, raid.powerMax);
  const attackBonus = Math.max(0, Number(statBonuses.attack) || 0) + skill.attackBonus;
  const defenseBonus = Math.max(0, Number(statBonuses.defense) || 0) + skill.defenseBonus;
  const partyPower = safeLevel * 2 + playerRoll + supportPower + classConfig.powerBonus + attackBonus;
  const mitigatedRaidPower = Math.max(1, raidPower - defenseBonus - Math.floor(supportMembers.length / 2));
  const win = partyPower >= mitigatedRaidPower;
  const damageTaken = win
    ? Math.max(4, Math.floor(mitigatedRaidPower / 5))
    : Math.max(12, Math.floor(mitigatedRaidPower / 2));

  return {
    type: 'guild_raid',
    raidId: normalizedRaidId,
    raidLabel: raid.label,
    difficulty: 'guild_raid',
    difficultyLabel: '길드 레이드',
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    skillId: normalizedSkillId,
    skillLabel: skill.label,
    skillMpCost: skill.mpCost,
    ultimate: Boolean(skill.ultimate),
    statusEffect: cloneRpgStatusEffect(skill.statusEffect),
    area: raid.area,
    areaLabel: RPG_AREAS[raid.area].label,
    monster: raid.monster,
    playerLevel: safeLevel,
    playerRoll,
    allyPower: supportPower,
    supportPower,
    partySize: members.length,
    partyMembers: members,
    playerPower: partyPower,
    monsterPower: raidPower,
    mitigatedMonsterPower: mitigatedRaidPower,
    attackBonus,
    defenseBonus,
    damageTaken,
    win,
    rewards: {
      xp: win ? raid.xpReward : 0,
      coins: win ? raid.coinReward : 0
    },
    supportRewards: {
      xp: win ? Math.floor(raid.xpReward / 4) : 0,
      coins: win ? Math.floor(raid.coinReward / 4) : 0
    },
    assets: {
      hero: getRpgHeroAssetId({
        characterClass: normalizedClass,
        characterGender: normalizedGender,
        advancedClass
      }),
      monster: MONSTER_ASSET_IDS[raid.monster] ?? 'boss_unknown_idle',
      background: raid.backgroundAssetId
    }
  };
}

export function rollRpgGearDrop({
  source = 'battle',
  area = 'forest',
  difficulty = 'normal',
  pool = null,
  randomInt = defaultRandomInt
} = {}) {
  const roll = randomInt(1, 100);
  const threshold = source === 'raid'
    ? 25
    : source === 'hiddenDungeon'
      ? 35
      : source === 'dungeon'
        ? 45
        : difficulty === 'boss'
          ? 70
          : difficulty === 'hard'
            ? 88
            : 94;
  if (roll < threshold) return null;

  const rarityRoll = randomInt(1, 100);
  const rarity = Object.entries(RPG_GEAR_RARITIES)
    .reverse()
    .find(([, config]) => rarityRoll >= config.dropFloor)?.[0] ?? 'common';
  const configuredPool = Array.isArray(pool)
    ? pool
      .map((itemId) => {
        try {
          return normalizeRpgItemId(itemId);
        } catch {
          return null;
        }
      })
      .filter((itemId) => itemId && RPG_ITEMS[itemId]?.type === 'equipment')
    : [];
  const basePool = configuredPool.length > 0
    ? configuredPool
    : RPG_GEAR_DROP_POOLS[area] ?? RPG_GEAR_DROP_POOLS.forest;
  const baseItemId = basePool[randomInt(0, basePool.length - 1)];

  return createRpgGearBlueprint({ baseItemId, rarity, randomInt });
}

export function createRpgGearBlueprint({ baseItemId, rarity = 'common', randomInt = defaultRandomInt }) {
  const item = RPG_ITEMS[normalizeRpgItemId(baseItemId)];
  const rarityConfig = RPG_GEAR_RARITIES[rarity] ?? RPG_GEAR_RARITIES.common;
  const stats = { ...(item.stats ?? {}) };
  const bonusKey = item.slot === 'armor'
    ? 'defense'
    : item.slot === 'accessory'
      ? (randomInt(0, 1) === 0 ? 'maxHp' : 'maxMp')
      : 'attack';
  stats[bonusKey] = (stats[bonusKey] ?? 0) + rarityConfig.statBudget;

  return {
    baseItemId,
    slot: item.slot,
    rarity,
    rarityLabel: rarityConfig.label,
    label: `${rarityConfig.label} ${item.label}`,
    stats,
    power: rarityConfig.power,
    enhanceLevel: 0,
    assetId: item.assetId,
    hidden: Boolean(item.hidden),
    marketValue: item.price ?? 0
  };
}

export function createCraftedRpgGearBlueprint({
  recipeId,
  qualityId = 'normal',
  craftedBy = null,
  now = Date.now(),
  randomInt = defaultRandomInt
} = {}) {
  const normalizedRecipeId = normalizeRpgCraftingRecipeId(recipeId);
  const recipe = RPG_CRAFTING_RECIPES[normalizedRecipeId];
  const item = RPG_ITEMS[recipe.resultItemId];
  const normalizedQualityId = normalizeRpgCraftingQualityId(qualityId);
  const quality = RPG_CRAFTING_QUALITIES[normalizedQualityId];
  const rarityConfig = RPG_GEAR_RARITIES[recipe.rarity] ?? RPG_GEAR_RARITIES.common;
  const stats = {};

  for (const [stat, value] of Object.entries(item.stats ?? {})) {
    stats[stat] = Math.max(1, Math.round(value * quality.multiplier));
  }

  if (quality.extraOption) {
    const extraKey = item.slot === 'armor'
      ? 'defense'
      : item.slot === 'accessory'
        ? (randomInt(0, 1) === 0 ? 'maxHp' : 'maxMp')
        : 'attack';
    stats[extraKey] = (stats[extraKey] ?? 0) + Math.max(2, rarityConfig.statBudget);
  }

  return {
    baseItemId: recipe.resultItemId,
    recipeId: normalizedRecipeId,
    slot: item.slot,
    rarity: recipe.rarity,
    rarityLabel: rarityConfig.label,
    label: `${quality.label} ${item.label}`,
    stats,
    power: rarityConfig.power,
    enhanceLevel: 0,
    assetId: item.assetId,
    crafted: true,
    craftedBy,
    craftedAt: now,
    quality: normalizedQualityId,
    qualityLabel: quality.label,
    hidden: Boolean(recipe.hidden || item.hidden),
    marketValue: recipe.value ?? item.price ?? 0
  };
}

export function rollRpgDrop({ battle, randomInt = defaultRandomInt }) {
  if (!battle.win) return null;

  const roll = randomInt(1, 100);
  if (battle.difficulty === 'boss' && roll >= 75) {
    return { itemId: 'mystic_ring', quantity: 1, label: RPG_ITEMS.mystic_ring.label };
  }

  if (roll >= 90) {
    const itemId = battle.area === 'cave' ? 'mana_potion' : 'potion';
    return { itemId, quantity: 1, label: RPG_ITEMS[itemId].label };
  }

  return null;
}

export function rollRpgMaterialDrops({
  source = 'battle',
  area = 'forest',
  difficulty = 'normal',
  win = true,
  randomInt = defaultRandomInt
} = {}) {
  if (source === 'battle' && !win) return {};

  const normalizedArea = (() => {
    try {
      return normalizeRpgArea(area);
    } catch {
      return 'forest';
    }
  })();
  const pools = {
    forest: ['healing_herb', 'tough_leather', 'wolf_fang'],
    wildflower_plains: ['hardwood', 'poison_sac', 'tough_leather'],
    cave: ['iron_ore', 'silver_ore', 'lesser_magic_stone'],
    moonlit_hill: ['poison_sac', 'healing_herb', 'holy_water'],
    marsh: ['black_leather', 'poison_sac', 'iron_ore'],
    mushroom_grove: ['holy_water', 'silver_ore', 'rune_stone'],
    ruins: ['steel_ingot', 'wolf_fang', 'blessed_metal'],
    bandit_outpost: ['ice_rune', 'magic_crystal', 'ancient_wood'],
    red_desert: ['rune_stone', 'magic_crystal', 'ancient_wood'],
    volcano: ['dragon_scale', 'dragon_claw', 'fire_rune'],
    thunder_plateau: ['magic_crystal', 'rune_stone', 'lightning_rune'],
    frost: ['dark_stone', 'demon_horn', 'blessed_metal'],
    crystal_lake: ['holy_water', 'blessed_silver_ingot', 'angel_feather'],
    sky: ['blessed_metal', 'artisan_hammer', 'iron_ingot'],
    phantom_forest: ['artisan_hammer', 'iron_ore', 'enhancement_stone'],
    abyss_mine: ['silver_ore', 'mythic_metal', 'rune_stone'],
    starfall_crater: ['healing_herb', 'iron_ore', 'hardwood'],
    dragon_nest: ['dragon_scale', 'dragon_claw', 'dragon_heart', 'mythic_metal'],
    void_gate: ['dark_stone', 'demon_horn', 'nightmare_thread'],
    sunken_catacombs: ['holy_water', 'nightmare_thread', 'ancient_lich_core'],
    dwarven_ironhold: ['steel_ingot', 'mythic_metal', 'artisan_hammer'],
    moonlit_feywood: ['ancient_wood', 'rune_stone', 'shadow_crystal'],
    ancient_dragon_altar: ['dragon_scale', 'dragon_claw', 'dragon_heart']
  };
  const pool = pools[normalizedArea] ?? pools.forest;
  const guaranteed = ['explore', 'dungeon', 'raid', 'boss'].includes(source);
  const attempts = source === 'raid' ? 4 : source === 'dungeon' ? 3 : source === 'explore' ? 2 : source === 'boss' ? 2 : 1;
  const chance = source === 'battle'
    ? (difficulty === 'hard' ? 70 : difficulty === 'easy' ? 42 : 55)
    : 100;
  const drops = {};

  for (let index = 0; index < attempts; index += 1) {
    if (!guaranteed && randomInt(1, 100) > chance) continue;
    const itemId = pool[randomInt(0, pool.length - 1)];
    const amount = source === 'raid'
      ? randomInt(2, 4)
      : source === 'dungeon'
        ? randomInt(1, 3)
        : source === 'explore'
          ? randomInt(1, 2)
          : 1;
    drops[itemId] = (drops[itemId] ?? 0) + amount;
  }

  return Object.fromEntries(Object.entries(drops).map(([itemId, quantity]) => [normalizeRpgItemId(itemId), quantity]));
}

export function rollRpgGachaPull({ bannerId = 'standard', randomInt = defaultRandomInt }) {
  const normalizedBannerId = normalizeRpgGachaBannerId(bannerId);
  const banner = RPG_GACHA_BANNERS[normalizedBannerId];
  const rarityRoll = randomInt(1, 10_000);
  const rarity = getGachaRarity(rarityRoll, banner.rarityRates);
  const pool = banner.pools[rarity];
  const reward = pool[randomInt(0, pool.length - 1)];

  return {
    bannerId: normalizedBannerId,
    bannerLabel: banner.label,
    rarity,
    reward: cloneReward(reward)
  };
}

function getQuestProgress(profile, quest) {
  return getRequirementProgress(profile, quest.requirement);
}

function getRequirementProgress(profile, requirement) {
  const rpg = profile.rpg ?? {};

  if (requirement.type === 'wins') {
    return rpg.wins ?? 0;
  }

  if (requirement.type === 'battles') {
    return Math.max(0, Number(rpg.battles) || 0);
  }

  if (requirement.type === 'explores') {
    return rpg.explores ?? 0;
  }

  if (requirement.type === 'level') {
    return profile.rpg?.level ?? 1;
  }

  if (requirement.type === 'monsterKills') {
    return rpg.monsterKills?.[requirement.monster] ?? 0;
  }

  if (requirement.type === 'areaWins') {
    return rpg.areaWins?.[requirement.area] ?? 0;
  }

  if (requirement.type === 'bossKills') {
    return Object.values(rpg.bossKills ?? {}).reduce((sum, count) => sum + count, 0);
  }

  if (requirement.type === 'dungeonClears') {
    if (requirement.area) {
      return rpg.dungeonClears?.[requirement.area] ?? 0;
    }
    return Object.values(rpg.dungeonClears ?? {}).reduce((sum, count) => sum + count, 0);
  }

  if (requirement.type === 'dungeons') {
    return Object.values(rpg.dungeonClears ?? {}).reduce((sum, count) => sum + count, 0);
  }

  if (requirement.type === 'raidClears') {
    if (requirement.raid) {
      return rpg.raidClears?.[requirement.raid] ?? 0;
    }
    return Object.values(rpg.raidClears ?? {}).reduce((sum, count) => sum + count, 0);
  }

  if (requirement.type === 'areaProgress') {
    return rpg.areaProgress?.[requirement.area] ?? 0;
  }

  if (requirement.type === 'classMastery') {
    const classId = normalizeRpgClass(requirement.class ?? rpg.characterClass);
    return normalizeRpgClassMasteryEntry(rpg.classMastery?.[classId]).level;
  }

  if (requirement.type === 'craftedItems') {
    return rpg.craftedItems ?? 0;
  }

  return 0;
}

function hasRpgClassAccess(profile, classId) {
  const normalizedClass = normalizeRpgClass(classId);
  const rpg = profile.rpg ?? {};
  return rpg.characterClass === normalizedClass
    || rpg.primaryClass === normalizedClass
    || rpg.secondaryClass === normalizedClass
    || Array.isArray(rpg.unlockedClasses) && rpg.unlockedClasses.includes(normalizedClass);
}

function normalizeRpgProgressValue(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized)
    ? Math.min(100, Math.max(0, Math.floor(normalized)))
    : 0;
}

function normalizeRpgClassMasteryEntry(entry = {}) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};

  return {
    level: Math.max(1, Number.isSafeInteger(Number(safeEntry.level)) ? Number(safeEntry.level) : 1),
    progress: Math.max(0, Number.isSafeInteger(Number(safeEntry.progress)) ? Number(safeEntry.progress) : 0)
  };
}

function normalizeRpgCraftingMasteryEntry(entry = {}) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};

  return {
    level: Math.max(1, Number.isSafeInteger(Number(safeEntry.level)) ? Number(safeEntry.level) : 1),
    xp: Math.max(0, Number.isSafeInteger(Number(safeEntry.xp)) ? Number(safeEntry.xp) : 0)
  };
}

function getRpgClassMasteryRequired(level) {
  return RPG_CLASS_MASTERY_BASE_REQUIRED * Math.max(1, Number(level) || 1);
}

function getRpgDailyStatsForDay(daily = {}, now = Date.now()) {
  const today = getRpgDayIndex(now);
  const safeDaily = daily && typeof daily === 'object' ? daily : {};

  if (safeDaily.day !== today) {
    return {
      day: today,
      battles: 0,
      wins: 0,
      explores: 0,
      dungeons: 0,
      bosses: 0,
      raids: 0,
      goldEarned: 0,
      claimedMissions: {}
    };
  }

  return {
    day: today,
    battles: Math.max(0, Number(safeDaily.battles) || 0),
    wins: Math.max(0, Number(safeDaily.wins) || 0),
    explores: Math.max(0, Number(safeDaily.explores) || 0),
    dungeons: Math.max(0, Number(safeDaily.dungeons) || 0),
    bosses: Math.max(0, Number(safeDaily.bosses) || 0),
    raids: Math.max(0, Number(safeDaily.raids) || 0),
    goldEarned: Math.max(0, Number(safeDaily.goldEarned) || 0),
    claimedMissions: { ...(safeDaily.claimedMissions ?? {}) }
  };
}

function getDailyMissionProgress(daily, mission) {
  return Math.max(0, Number(daily[mission.requirement.type]) || 0);
}

function getTutorialProgress(profile, requirement) {
  const rpg = profile.rpg ?? {};

  if (requirement.type === 'started') {
    return rpg.startedAt > 0 ? 1 : 0;
  }

  if (requirement.type === 'battles') {
    return Math.max(0, Number(rpg.battles) || 0);
  }

  if (requirement.type === 'recoveryActions') {
    const restCount = rpg.lastRestAt > 0 ? 1 : 0;
    const usedItems = Math.max(0, Number(rpg.usedItems) || 0);
    return restCount + usedItems;
  }

  if (requirement.type === 'shopPurchases') {
    return Math.max(0, Number(rpg.shopPurchases) || 0);
  }

  if (requirement.type === 'claimedQuests') {
    return Object.keys(rpg.claimedQuests ?? {}).length;
  }

  if (requirement.type === 'worldSteps') {
    const movedArea = rpg.currentArea && rpg.currentArea !== 'forest' ? 1 : 0;
    const explores = Math.max(0, Number(rpg.explores) || 0);
    const bosses = Object.values(rpg.bossKills ?? {}).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
    return movedArea + explores + bosses;
  }

  return 0;
}

function createObjective(type, entry) {
  return {
    type,
    id: entry.id,
    label: entry.label,
    progressText: `${Math.min(entry.current, entry.required)}/${entry.required}`,
    description: entry.description
  };
}

function getRecommendedRpgAction({
  profile,
  cooldownRemainingMs,
  actionAvailability,
  claimableDailyMissions,
  claimableQuests,
  progressableStoryChapters,
  currentArea,
  nextLockedArea
}) {
  if ((profile.rpg?.hp ?? 0) <= 1) {
    return {
      type: 'rest',
      label: '휴식',
      command: '/rpg 휴식',
      reason: 'HP가 낮아서 먼저 회복해야 합니다.'
    };
  }

  if (claimableDailyMissions.length > 0) {
    const mission = claimableDailyMissions[0];
    return {
      type: 'daily_claim',
      label: `${mission.label} 보상`,
      command: `/rpg 일일 임무:${mission.label}`,
      reason: '오늘 완료한 일일 의뢰 보상이 있습니다.'
    };
  }

  if (claimableQuests.length > 0) {
    const quest = claimableQuests[0];
    return {
      type: 'quest_claim',
      label: `${quest.label} 보상`,
      command: `/rpg 퀘스트 퀘스트:${quest.label}`,
      reason: '완료한 일반 퀘스트 보상을 받을 수 있습니다.'
    };
  }

  const battleAction = actionAvailability?.battle;
  const exploreAction = actionAvailability?.explore;
  const dungeonAction = actionAvailability?.dungeon;
  const restAction = actionAvailability?.rest;

  if ((battleAction && !battleAction.available) || cooldownRemainingMs > 0) {
    if (!actionAvailability && cooldownRemainingMs > 0) {
      return {
        type: 'explore',
        label: `${currentArea.label} 탐험`,
        command: '/rpg 탐험',
        reason: '전투 대기시간 동안 탐험으로 보상과 전리품을 노릴 수 있습니다.'
      };
    }

    if (exploreAction?.available) {
      return {
        type: 'explore',
        label: `${currentArea.label} 탐험`,
        command: exploreAction.command,
        reason: '전투 대기시간 동안 탐험으로 보상과 전리품을 노릴 수 있습니다.'
      };
    }

    if (dungeonAction?.available) {
      return {
        type: 'dungeon',
        label: `${currentArea.label} 던전`,
        command: dungeonAction.command,
        reason: '전투 대기 중에도 던전 쿨다운이 비어 있어 장비 파밍을 할 수 있습니다.'
      };
    }

    if (restAction?.available) {
      return {
        type: 'rest',
        label: '휴식',
        command: restAction.command,
        reason: '주요 행동이 대기 중이면 HP/MP를 정비할 시간입니다.'
      };
    }

    return {
      type: 'wait',
      label: '쿨다운 대기',
      command: '/rpg 상태',
      reason: battleAction?.reason ?? '주요 RPG 행동이 아직 대기 중입니다.'
    };
  }

  if (progressableStoryChapters.length > 0 && (profile.rpg?.battles ?? 0) > 0) {
    const chapter = progressableStoryChapters[0];
    return {
      type: 'story',
      label: `${chapter.label} 진행`,
      command: 'RPG 허브 > 모험 > 메인 퀘스트',
      reason: '진행 가능한 메인 퀘스트가 열렸습니다.'
    };
  }

  return {
    type: 'battle',
    label: `${currentArea.label} 전투`,
    command: '/rpg 전투',
    reason: nextLockedArea
      ? `${nextLockedArea.label} 해금을 위해 레벨과 장비를 올리는 단계입니다.`
      : '엔드게임 파밍을 위해 전투와 던전을 반복하세요.'
  };
}

function calculateRpgPowerScore(stats) {
  return Math.floor(
    stats.attack * 8
    + stats.defense * 6
    + stats.maxHp / 3
    + stats.maxMp / 2
  );
}

function createRpgProgressBar(current, required, length = 10) {
  const safeRequired = Math.max(1, Number(required) || 1);
  const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / safeRequired));
  const filled = Math.floor(ratio * length);

  return `${'█'.repeat(filled)}${'░'.repeat(length - filled)}`;
}

function getRpgDayIndex(now) {
  return Math.floor(Number(now || 0) / RPG_DAY_MS);
}

function defaultRpgXpForNextLevel(level) {
  return Math.floor(100 * Math.max(1, Number(level) || 1) ** 1.5);
}

function normalizeRpgSkillTreeNodes(skillIds = []) {
  const source = Array.isArray(skillIds) ? skillIds : [];
  const normalized = new Set();

  for (const skillId of source) {
    try {
      normalized.add(normalizeRpgSkillTreeNodeId(skillId));
    } catch {
      // Invalid legacy skill nodes are ignored.
    }
  }

  return [...normalized];
}

function addStats(target, source = {}) {
  target.attack += source.attack ?? 0;
  target.defense += source.defense ?? 0;
  target.maxHp += source.maxHp ?? 0;
  target.maxMp += source.maxMp ?? 0;
}

function getGachaRarity(roll, rates) {
  if (roll <= rates.ssr) return 'ssr';
  if (roll <= rates.ssr + rates.sr) return 'sr';
  return 'r';
}

function itemReward(itemId, quantity = 1) {
  return Object.freeze({ type: 'item', itemId, quantity });
}

function classReward(classId) {
  return Object.freeze({ type: 'class', classId });
}

function cloneReward(reward) {
  return { ...reward };
}

function cloneRpgStatusEffect(statusEffect) {
  return statusEffect ? { ...statusEffect } : null;
}

function isRpgBossPatternCountered({
  bossPattern,
  action,
  skillId,
  ultimate = false
} = {}) {
  if (!bossPattern) return false;
  if (bossPattern.counterAction === 'guard') return action === 'guard';
  if (bossPattern.counterAction === 'ultimate') return Boolean(ultimate);
  if (bossPattern.counterAction === 'skill') return Boolean(skillId && skillId !== 'basic');
  if (bossPattern.counterAction === 'basic') return skillId === 'basic';
  return Boolean(skillId && bossPattern.weaknessSkillIds?.includes(skillId));
}

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
