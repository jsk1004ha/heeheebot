const STARTER_CLASS_IDS = Object.freeze(['novice', 'warrior', 'mage', 'ranger']);
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
    label: '초보자',
    description: '균형형 기본 직업',
    powerBonus: 0,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 0,
    assetId: 'hero_adventurer_idle',
    assetIds: Object.freeze({
      male: 'hero_adventurer_idle',
      female: 'hero_female_adventurer_idle'
    }),
    starter: true
  }),
  warrior: Object.freeze({
    label: '전사',
    description: '전투력 +2, 안정적인 근접형',
    powerBonus: 2,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 0,
    assetId: 'hero_warrior_idle',
    assetIds: Object.freeze({
      male: 'hero_warrior_idle',
      female: 'hero_female_warrior_idle'
    }),
    starter: true
  }),
  mage: Object.freeze({
    label: '마법사',
    description: 'MP와 마법 공격이 강한 원소형',
    powerBonus: 1,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 20,
    assetId: 'hero_mage_idle',
    assetIds: Object.freeze({
      male: 'hero_mage_idle',
      female: 'hero_female_mage_idle'
    }),
    starter: true
  }),
  ranger: Object.freeze({
    label: '궁수',
    description: '전투력 +1, 원거리 콘셉트 영웅',
    powerBonus: 1,
    defenseBonus: 0,
    maxHpBonus: 0,
    maxMpBonus: 5,
    assetId: 'hero_ranger_idle',
    assetIds: Object.freeze({
      male: 'hero_ranger_idle',
      female: 'hero_female_ranger_idle'
    }),
    starter: true
  }),
  paladin: Object.freeze({
    label: '팔라딘',
    description: '가챠 해금 직업. 높은 HP와 방어력을 가진 성기사',
    powerBonus: 2,
    defenseBonus: 3,
    maxHpBonus: 30,
    maxMpBonus: 10,
    assetId: 'hero_paladin_idle',
    assetIds: Object.freeze({
      male: 'hero_paladin_idle',
      female: 'hero_female_paladin_idle'
    }),
    starter: false
  }),
  rogue: Object.freeze({
    label: '도적',
    description: '가챠 해금 직업. 공격력이 높은 기습형',
    powerBonus: 4,
    defenseBonus: 0,
    maxHpBonus: -5,
    maxMpBonus: 5,
    assetId: 'hero_rogue_idle',
    assetIds: Object.freeze({
      male: 'hero_rogue_idle',
      female: 'hero_female_rogue_idle'
    }),
    starter: false
  }),
  priest: Object.freeze({
    label: '사제',
    description: '가챠 해금 직업. MP가 높고 회복 스킬에 특화',
    powerBonus: 0,
    defenseBonus: 1,
    maxHpBonus: 10,
    maxMpBonus: 35,
    assetId: 'hero_priest_idle',
    assetIds: Object.freeze({
      male: 'hero_priest_idle',
      female: 'hero_female_priest_idle'
    }),
    starter: false
  })
});

const RPG_SKILLS = Object.freeze({
  basic: Object.freeze({
    label: '기본 공격',
    description: 'MP를 쓰지 않는 기본 전투',
    mpCost: 0,
    attackBonus: 0,
    defenseBonus: 0,
    classes: Object.freeze(Object.keys(RPG_CLASSES))
  }),
  power_strike: Object.freeze({
    label: '파워 스트라이크',
    description: '강한 일격으로 전투력 +4',
    mpCost: 8,
    attackBonus: 4,
    defenseBonus: 0,
    classes: Object.freeze(['warrior', 'paladin'])
  }),
  fireball: Object.freeze({
    label: '파이어볼',
    description: '마법 화염구로 전투력 +6',
    mpCost: 10,
    attackBonus: 6,
    defenseBonus: 0,
    classes: Object.freeze(['mage'])
  }),
  aimed_shot: Object.freeze({
    label: '조준 사격',
    description: '정밀 사격으로 전투력 +4',
    mpCost: 8,
    attackBonus: 4,
    defenseBonus: 0,
    classes: Object.freeze(['ranger'])
  }),
  backstab: Object.freeze({
    label: '백스탭',
    description: '도적의 기습으로 전투력 +6',
    mpCost: 9,
    attackBonus: 6,
    defenseBonus: 0,
    classes: Object.freeze(['rogue'])
  }),
  holy_guard: Object.freeze({
    label: '성스러운 방패',
    description: '성스러운 보호로 전투력 +2, 방어 +5',
    mpCost: 10,
    attackBonus: 2,
    defenseBonus: 5,
    classes: Object.freeze(['paladin', 'priest'])
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
    monsters: Object.freeze(['슬라임', '고블린', '숲 늑대'])
  }),
  normal: Object.freeze({
    label: '보통',
    playerBonus: 0,
    monsterPowerMin: 8,
    monsterPowerMax: 20,
    xpMin: 70,
    xpMax: 150,
    coinReward: 150,
    monsters: Object.freeze(['오크 전사', '해골 병사', '동굴 박쥐'])
  }),
  hard: Object.freeze({
    label: '어려움',
    playerBonus: -2,
    monsterPowerMin: 16,
    monsterPowerMax: 34,
    xpMin: 120,
    xpMax: 240,
    coinReward: 300,
    monsters: Object.freeze(['트롤', '암흑 기사', '미니 드래곤'])
  })
});

const RPG_AREAS = Object.freeze({
  forest: Object.freeze({
    label: '초록 숲',
    unlockLevel: 1,
    description: '초보 모험가용 숲 지역',
    backgroundAssetId: 'map_forest_glade',
    coinMultiplier: 1,
    xpMultiplier: 1,
    monsters: Object.freeze({
      easy: RPG_DIFFICULTIES.easy.monsters,
      normal: RPG_DIFFICULTIES.normal.monsters,
      hard: RPG_DIFFICULTIES.hard.monsters
    })
  }),
  cave: Object.freeze({
    label: '수정 동굴',
    unlockLevel: 2,
    description: '박쥐와 해골이 나오는 중급 지역',
    backgroundAssetId: 'map_crystal_cave',
    coinMultiplier: 1.15,
    xpMultiplier: 1.1,
    monsters: Object.freeze({
      easy: Object.freeze(['슬라임', '동굴 박쥐', '고블린']),
      normal: Object.freeze(['동굴 박쥐', '해골 병사', '오크 전사']),
      hard: Object.freeze(['트롤', '암흑 기사', '미니 드래곤'])
    })
  }),
  marsh: Object.freeze({
    label: '그림자 늪',
    unlockLevel: 3,
    description: '독안개와 매복 몬스터가 많은 습지 지역',
    backgroundAssetId: 'map_shadow_marsh',
    coinMultiplier: 1.25,
    xpMultiplier: 1.18,
    monsters: Object.freeze({
      easy: Object.freeze(['고블린', '숲 늑대', '동굴 박쥐']),
      normal: Object.freeze(['해골 병사', '오크 전사', '트롤']),
      hard: Object.freeze(['암흑 기사', '트롤', '미니 드래곤'])
    })
  }),
  ruins: Object.freeze({
    label: '고대 유적',
    unlockLevel: 4,
    description: '강한 몬스터가 나오는 상급 지역',
    backgroundAssetId: 'map_ancient_ruins',
    coinMultiplier: 1.35,
    xpMultiplier: 1.25,
    monsters: Object.freeze({
      easy: Object.freeze(['해골 병사', '고블린', '동굴 박쥐']),
      normal: Object.freeze(['오크 전사', '암흑 기사', '트롤']),
      hard: RPG_DIFFICULTIES.hard.monsters
    })
  }),
  volcano: Object.freeze({
    label: '화산 협곡',
    unlockLevel: 6,
    description: '용암 지형과 정예 몬스터가 버티는 고난도 지역',
    backgroundAssetId: 'map_volcanic_rift',
    coinMultiplier: 1.6,
    xpMultiplier: 1.45,
    monsters: Object.freeze({
      easy: Object.freeze(['오크 전사', '트롤', '해골 병사']),
      normal: Object.freeze(['트롤', '암흑 기사', '미니 드래곤']),
      hard: Object.freeze(['암흑 기사', '미니 드래곤', '고대 드래곤'])
    })
  }),
  frost: Object.freeze({
    label: '빙결 봉우리',
    unlockLevel: 8,
    description: '혹한과 빙벽이 전투를 방해하는 설산 지역',
    backgroundAssetId: 'map_frozen_peak',
    coinMultiplier: 1.85,
    xpMultiplier: 1.7,
    monsters: Object.freeze({
      easy: Object.freeze(['해골 병사', '트롤', '동굴 박쥐']),
      normal: Object.freeze(['암흑 기사', '트롤', '미니 드래곤']),
      hard: Object.freeze(['미니 드래곤', '고대 드래곤', '암흑 기사'])
    })
  }),
  sky: Object.freeze({
    label: '하늘 성채',
    unlockLevel: 10,
    description: '구름 위 성채에서 최상위 몬스터와 맞서는 엔드게임 지역',
    backgroundAssetId: 'map_sky_citadel',
    coinMultiplier: 2.15,
    xpMultiplier: 2,
    monsters: Object.freeze({
      easy: Object.freeze(['트롤', '암흑 기사', '미니 드래곤']),
      normal: Object.freeze(['암흑 기사', '미니 드래곤', '고대 드래곤']),
      hard: Object.freeze(['고대 드래곤', '미니 드래곤', '암흑 기사'])
    })
  })
});

const MONSTER_ASSET_IDS = Object.freeze({
  슬라임: 'monster_slime_idle',
  고블린: 'monster_goblin_idle',
  '숲 늑대': 'monster_forest_wolf_idle',
  '오크 전사': 'monster_orc_warrior_idle',
  '해골 병사': 'monster_skeleton_soldier_idle',
  '동굴 박쥐': 'monster_cave_bat_idle',
  트롤: 'monster_troll_idle',
  '암흑 기사': 'monster_dark_knight_idle',
  '미니 드래곤': 'monster_mini_dragon_idle',
  '슬라임 킹': 'boss_slime_king_idle',
  '고대 드래곤': 'boss_ancient_dragon_idle'
});

const RPG_ITEMS = Object.freeze({
  potion: Object.freeze({
    label: '회복 포션',
    description: 'HP를 40 회복합니다.',
    type: 'consumable',
    price: 120,
    heal: 40,
    mpHeal: 0,
    assetId: 'item_potion_icon'
  }),
  mana_potion: Object.freeze({
    label: '마나 포션',
    description: 'MP를 25 회복합니다.',
    type: 'consumable',
    price: 140,
    heal: 0,
    mpHeal: 25,
    assetId: 'item_mana_potion_icon'
  }),
  iron_sword: Object.freeze({
    label: '철검',
    description: '공격력 +4',
    type: 'equipment',
    slot: 'weapon',
    price: 500,
    stats: Object.freeze({ attack: 4 }),
    assetId: 'item_iron_sword_icon'
  }),
  leather_armor: Object.freeze({
    label: '가죽 갑옷',
    description: '방어력 +3, 최대 HP +20',
    type: 'equipment',
    slot: 'armor',
    price: 450,
    stats: Object.freeze({ defense: 3, maxHp: 20 }),
    assetId: 'item_leather_armor_icon'
  }),
  mystic_ring: Object.freeze({
    label: '신비한 반지',
    description: '공격력 +2, 최대 HP +10, 최대 MP +10',
    type: 'equipment',
    slot: 'accessory',
    price: 800,
    stats: Object.freeze({ attack: 2, maxHp: 10, maxMp: 10 }),
    assetId: 'item_mystic_ring_icon'
  }),
  dragon_blade: Object.freeze({
    label: '드래곤 블레이드',
    description: 'SSR 장비. 공격력 +9',
    type: 'equipment',
    slot: 'weapon',
    price: 0,
    stats: Object.freeze({ attack: 9 }),
    assetId: 'item_dragon_blade_icon',
    gachaOnly: true
  }),
  archmage_staff: Object.freeze({
    label: '대마도사의 지팡이',
    description: 'SSR 장비. 공격력 +6, 최대 MP +35',
    type: 'equipment',
    slot: 'weapon',
    price: 0,
    stats: Object.freeze({ attack: 6, maxMp: 35 }),
    assetId: 'item_archmage_staff_icon',
    gachaOnly: true
  }),
  guardian_plate: Object.freeze({
    label: '수호자의 판금갑옷',
    description: 'SR 장비. 방어력 +7, 최대 HP +35',
    type: 'equipment',
    slot: 'armor',
    price: 0,
    stats: Object.freeze({ defense: 7, maxHp: 35 }),
    assetId: 'item_guardian_plate_icon',
    gachaOnly: true
  })
});

const RPG_QUESTS = Object.freeze({
  first_blood: Object.freeze({
    label: '첫 승리',
    description: '아무 몬스터나 1회 승리',
    requirement: Object.freeze({ type: 'wins', count: 1 }),
    rewards: Object.freeze({
      xp: 40,
      coins: 120,
      items: Object.freeze({ potion: 1 })
    })
  }),
  slime_slayer: Object.freeze({
    label: '슬라임 사냥꾼',
    description: '슬라임 3마리 처치',
    requirement: Object.freeze({ type: 'monsterKills', monster: '슬라임', count: 3 }),
    rewards: Object.freeze({
      xp: 120,
      coins: 300,
      items: Object.freeze({ potion: 2 })
    })
  }),
  cave_scout: Object.freeze({
    label: '동굴 정찰',
    description: '수정 동굴에서 2회 승리',
    requirement: Object.freeze({ type: 'areaWins', area: 'cave', count: 2 }),
    rewards: Object.freeze({
      xp: 180,
      coins: 450,
      items: Object.freeze({})
    })
  }),
  boss_challenger: Object.freeze({
    label: '보스 도전자',
    description: '보스 1회 처치',
    requirement: Object.freeze({ type: 'bossKills', count: 1 }),
    rewards: Object.freeze({
      xp: 250,
      coins: 800,
      items: Object.freeze({ mana_potion: 2 })
    })
  })
});

const RPG_DAILY_MISSIONS = Object.freeze({
  field_training: Object.freeze({
    label: '전장 훈련',
    description: '오늘 전투를 2회 진행합니다.',
    requirement: Object.freeze({ type: 'battles', count: 2 }),
    rewards: Object.freeze({
      xp: 120,
      coins: 300,
      items: Object.freeze({ potion: 1 })
    })
  }),
  route_scout: Object.freeze({
    label: '정찰 의뢰',
    description: '오늘 아무 지역이나 1회 탐험합니다.',
    requirement: Object.freeze({ type: 'explores', count: 1 }),
    rewards: Object.freeze({
      xp: 80,
      coins: 180,
      items: Object.freeze({})
    })
  }),
  dungeon_delver: Object.freeze({
    label: '던전 조사',
    description: '오늘 던전을 1회 클리어합니다.',
    requirement: Object.freeze({ type: 'dungeons', count: 1 }),
    rewards: Object.freeze({
      xp: 150,
      coins: 350,
      items: Object.freeze({ mana_potion: 1 })
    })
  }),
  victory_contract: Object.freeze({
    label: '승리 계약',
    description: '오늘 전투에서 1회 승리합니다.',
    requirement: Object.freeze({ type: 'wins', count: 1 }),
    rewards: Object.freeze({
      xp: 100,
      coins: 260,
      items: Object.freeze({})
    })
  })
});

const RPG_BOSSES = Object.freeze({
  slime_king: Object.freeze({
    label: '슬라임 킹',
    area: 'forest',
    unlockLevel: 2,
    powerMin: 14,
    powerMax: 26,
    xpReward: 220,
    coinReward: 650,
    monster: '슬라임 킹',
    backgroundAssetId: 'map_forest_glade'
  }),
  ancient_dragon: Object.freeze({
    label: '고대 드래곤',
    area: 'ruins',
    unlockLevel: 5,
    powerMin: 30,
    powerMax: 48,
    xpReward: 700,
    coinReward: 2200,
    monster: '고대 드래곤',
    backgroundAssetId: 'map_ancient_ruins'
  })
});

const RPG_ADVANCED_CLASSES = Object.freeze({
  berserker: Object.freeze({
    label: '광전사',
    baseClass: 'warrior',
    unlockLevel: 3,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '첫 승전보',
      requirement: Object.freeze({ type: 'wins', count: 1 })
    }),
    description: '공격 특화 전직. 공격력 +5, 최대 HP +10',
    stats: Object.freeze({ attack: 5, maxHp: 10 })
  }),
  archmage: Object.freeze({
    label: '대마법사',
    baseClass: 'mage',
    unlockLevel: 3,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '마력 정찰',
      requirement: Object.freeze({ type: 'explores', count: 1 })
    }),
    description: '마력 특화 전직. 공격력 +4, 최대 MP +30',
    stats: Object.freeze({ attack: 4, maxMp: 30 })
  }),
  sniper: Object.freeze({
    label: '저격수',
    baseClass: 'ranger',
    unlockLevel: 3,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '숲길 정찰',
      requirement: Object.freeze({ type: 'areaProgress', area: 'forest', count: 20 })
    }),
    description: '정밀 사격 전직. 공격력 +4, 방어력 +1',
    stats: Object.freeze({ attack: 4, defense: 1 })
  }),
  crusader: Object.freeze({
    label: '크루세이더',
    baseClass: 'paladin',
    unlockLevel: 4,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '보스 수호 맹세',
      requirement: Object.freeze({ type: 'bossKills', count: 1 })
    }),
    description: '성전사 전직. 방어력 +4, 최대 HP +25',
    stats: Object.freeze({ defense: 4, maxHp: 25 })
  }),
  shadow: Object.freeze({
    label: '섀도우',
    baseClass: 'rogue',
    unlockLevel: 4,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '그림자 결투',
      requirement: Object.freeze({ type: 'wins', count: 3 })
    }),
    description: '암살자 전직. 공격력 +6',
    stats: Object.freeze({ attack: 6 })
  }),
  saint: Object.freeze({
    label: '성자',
    baseClass: 'priest',
    unlockLevel: 4,
    masteryLevel: 1,
    classQuest: Object.freeze({
      label: '성소 순례',
      requirement: Object.freeze({ type: 'explores', count: 3 })
    }),
    description: '치유 특화 전직. 방어력 +2, 최대 MP +35',
    stats: Object.freeze({ defense: 2, maxMp: 35 })
  })
});

const RPG_SKILL_TREE = Object.freeze({
  weapon_training: Object.freeze({
    label: '무기 숙련',
    description: '공격력 +2',
    cost: 1,
    stats: Object.freeze({ attack: 2 }),
    classes: Object.freeze(Object.keys(RPG_CLASSES))
  }),
  iron_body: Object.freeze({
    label: '강철 체력',
    description: '최대 HP +20, 방어력 +1',
    cost: 1,
    stats: Object.freeze({ maxHp: 20, defense: 1 }),
    classes: Object.freeze(Object.keys(RPG_CLASSES))
  }),
  mana_flow: Object.freeze({
    label: '마나 순환',
    description: '최대 MP +20',
    cost: 1,
    stats: Object.freeze({ maxMp: 20 }),
    classes: Object.freeze(['novice', 'mage', 'paladin', 'priest'])
  }),
  class_mastery: Object.freeze({
    label: '직업 숙련',
    description: '공격력 +1, 방어력 +1',
    cost: 1,
    stats: Object.freeze({ attack: 1, defense: 1 }),
    classes: Object.freeze(Object.keys(RPG_CLASSES))
  })
});

const RPG_GEAR_RARITIES = Object.freeze({
  common: Object.freeze({
    label: '일반',
    power: 1,
    statBudget: 2,
    dropFloor: 1
  }),
  rare: Object.freeze({
    label: '희귀',
    power: 2,
    statBudget: 4,
    dropFloor: 55
  }),
  epic: Object.freeze({
    label: '영웅',
    power: 3,
    statBudget: 7,
    dropFloor: 82
  }),
  legendary: Object.freeze({
    label: '전설',
    power: 4,
    statBudget: 11,
    dropFloor: 96
  })
});

const RPG_EXPLORATION_EVENTS = Object.freeze({
  battle: Object.freeze({ label: '몬스터 조우', description: '숨어 있던 몬스터와 교전했습니다.' }),
  treasure: Object.freeze({ label: '보물상자', description: '낡은 상자에서 보상을 발견했습니다.' }),
  trap: Object.freeze({ label: '함정', description: '숨겨진 함정에 피해를 입었습니다.' }),
  shrine: Object.freeze({ label: '고대 제단', description: '제단의 축복으로 HP/MP를 회복했습니다.' })
});

const RPG_STORY_CHAPTERS = Object.freeze({
  forest_oath: Object.freeze({
    label: '숲의 맹세',
    description: '초록 숲의 몬스터 소동을 조사합니다.',
    requirement: Object.freeze({ type: 'level', count: 1 }),
    rewards: Object.freeze({ xp: 80, coins: 180, items: Object.freeze({ potion: 1 }) })
  }),
  cave_signal: Object.freeze({
    label: '수정 동굴의 신호',
    description: '동굴에서 이상한 마력 신호를 추적합니다.',
    requirement: Object.freeze({ type: 'areaWins', area: 'cave', count: 1 }),
    rewards: Object.freeze({ xp: 160, coins: 360, items: Object.freeze({ mana_potion: 1 }) })
  }),
  ruins_key: Object.freeze({
    label: '유적의 열쇠',
    description: '보스의 흔적을 따라 고대 유적의 봉인을 풉니다.',
    requirement: Object.freeze({ type: 'bossKills', count: 1 }),
    rewards: Object.freeze({ xp: 280, coins: 700, items: Object.freeze({ mystic_ring: 1 }) })
  }),
  marsh_plague: Object.freeze({
    label: '늪의 독안개',
    description: '그림자 늪의 독안개 원인을 추적합니다.',
    requirement: Object.freeze({ type: 'areaProgress', area: 'marsh', count: 30 }),
    rewards: Object.freeze({ xp: 360, coins: 900, items: Object.freeze({ potion: 2 }) })
  }),
  volcano_core: Object.freeze({
    label: '화산 심장부',
    description: '화산 협곡 깊은 곳의 용암 핵을 조사합니다.',
    requirement: Object.freeze({ type: 'dungeonClears', area: 'volcano', count: 1 }),
    rewards: Object.freeze({ xp: 520, coins: 1400, items: Object.freeze({ mana_potion: 2 }) })
  }),
  frost_beacon: Object.freeze({
    label: '빙결 봉화',
    description: '빙결 봉우리의 고대 봉화를 다시 밝힙니다.',
    requirement: Object.freeze({ type: 'areaProgress', area: 'frost', count: 50 }),
    rewards: Object.freeze({ xp: 680, coins: 1900, items: Object.freeze({ guardian_plate: 1 }) })
  }),
  sky_throne: Object.freeze({
    label: '하늘 왕좌',
    description: '하늘 성채 최상층의 왕좌를 탈환합니다.',
    requirement: Object.freeze({ type: 'raidClears', raid: 'dragon_rift', count: 1 }),
    rewards: Object.freeze({ xp: 1000, coins: 3200, items: Object.freeze({ dragon_blade: 1 }) })
  })
});

const RPG_RAIDS = Object.freeze({
  slime_horde: Object.freeze({
    label: '슬라임 군단',
    area: 'forest',
    unlockLevel: 2,
    powerMin: 24,
    powerMax: 38,
    xpReward: 420,
    coinReward: 1100,
    monster: '슬라임 킹',
    backgroundAssetId: 'map_forest_glade'
  }),
  dragon_rift: Object.freeze({
    label: '드래곤 균열',
    area: 'ruins',
    unlockLevel: 5,
    powerMin: 42,
    powerMax: 62,
    xpReward: 1100,
    coinReward: 3500,
    monster: '고대 드래곤',
    backgroundAssetId: 'map_ancient_ruins'
  })
});

const RPG_GACHA_BANNERS = Object.freeze({
  standard: Object.freeze({
    label: '일반 소환',
    cost: 300,
    description: '장비, 포션, 고급 직업을 획득할 수 있습니다.',
    rarityRates: Object.freeze({ ssr: 300, sr: 1700, r: 8000 }),
    pools: Object.freeze({
      ssr: Object.freeze([
        classReward('paladin'),
        classReward('rogue'),
        classReward('priest'),
        itemReward('dragon_blade'),
        itemReward('archmage_staff')
      ]),
      sr: Object.freeze([
        itemReward('guardian_plate'),
        itemReward('mystic_ring'),
        itemReward('leather_armor'),
        itemReward('iron_sword')
      ]),
      r: Object.freeze([
        itemReward('potion', 2),
        itemReward('mana_potion', 2),
        itemReward('potion', 1),
        itemReward('mana_potion', 1)
      ])
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
  return Object.entries(RPG_CLASSES)
    .filter(([value]) => value !== 'novice')
    .map(([value, config]) => ({
      name: config.starter ? config.label : `${config.label} (가챠)`,
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
    .filter(([, item]) => !item.gachaOnly)
    .map(([value, item]) => ({
      name: `${item.label} (${item.price}원)`,
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
    .filter(([, item]) => item.type === 'equipment')
    .map(([value, item]) => ({
      name: item.label,
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

export function getRpgBossOptions() {
  return Object.entries(RPG_BOSSES).map(([value, boss]) => ({
    name: `${boss.label} (Lv.${boss.unlockLevel}+)`,
    value
  }));
}

export function getRpgGachaBannerOptions() {
  return Object.entries(RPG_GACHA_BANNERS).map(([value, banner]) => ({
    name: `${banner.label} (${banner.cost}원)`,
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
  return Object.entries(RPG_RAIDS).map(([value, raid]) => ({
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

export function getRpgQuestConfig(questId) {
  return RPG_QUESTS[normalizeRpgQuestId(questId)];
}

export function getRpgDailyMissionConfig(missionId) {
  return RPG_DAILY_MISSIONS[normalizeRpgDailyMissionId(missionId)];
}

export function getRpgBossConfig(bossId) {
  return RPG_BOSSES[normalizeRpgBossId(bossId)];
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

export function getAvailableRpgSkillIds(characterClass = 'novice') {
  const normalizedClass = normalizeRpgClass(characterClass);
  return Object.entries(RPG_SKILLS)
    .filter(([, skill]) => skill.classes.includes(normalizedClass))
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

export function getRpgAdventureGuide(profile, {
  now = Date.now(),
  cooldownRemainingMs = 0,
  xpForNextLevel = defaultRpgXpForNextLevel
} = {}) {
  const level = Math.max(1, Number(profile.level) || 1);
  const currentXp = Math.max(0, Number(profile.xp) || 0);
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
    recommendedAction: getRecommendedRpgAction({
      profile,
      cooldownRemainingMs,
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
  const earned = Math.floor(Math.max(1, Number(profile.level) || 1) / 2);
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
  const level = Math.max(1, Number(profile.level) || 1);
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
    const levelReady = (profile.level ?? 1) >= advancedClass.unlockLevel;
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

  if (['초보자', '초보', 'novice', 'adventurer', '모험가'].includes(normalized)) return 'novice';
  if (['전사', 'warrior', 'w'].includes(normalized)) return 'warrior';
  if (['마법사', '메이지', 'mage', 'm'].includes(normalized)) return 'mage';
  if (['궁수', '레인저', 'ranger', 'r'].includes(normalized)) return 'ranger';
  if (['팔라딘', '성기사', 'paladin'].includes(normalized)) return 'paladin';
  if (['도적', '로그', 'rogue', 'assassin', '암살자'].includes(normalized)) return 'rogue';
  if (['사제', '프리스트', 'priest', 'cleric'].includes(normalized)) return 'priest';

  throw new Error('직업은 전사, 마법사, 궁수, 팔라딘, 도적, 사제 중 하나여야 합니다.');
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

  if (['숲', '초록 숲', 'forest', 'f'].includes(normalized)) return 'forest';
  if (['동굴', '수정 동굴', 'cave', 'c'].includes(normalized)) return 'cave';
  if (['늪', '그림자 늪', '그림자늪', 'marsh', 'swamp', 'm'].includes(normalized)) return 'marsh';
  if (['유적', '고대 유적', 'ruins', 'r'].includes(normalized)) return 'ruins';
  if (['화산', '화산 협곡', '화산협곡', 'volcano', 'rift', 'v'].includes(normalized)) return 'volcano';
  if (['빙결', '빙결 봉우리', '빙결봉우리', '설산', 'frost', 'peak', 'ice'].includes(normalized)) return 'frost';
  if (['하늘', '하늘 성채', '하늘성채', 'sky', 'citadel', 's'].includes(normalized)) return 'sky';

  throw new Error('지역은 초록 숲, 수정 동굴, 그림자 늪, 고대 유적, 화산 협곡, 빙결 봉우리, 하늘 성채 중 하나여야 합니다.');
}

export function normalizeRpgSkillId(skillId = 'basic') {
  const normalized = String(skillId || 'basic').trim().toLocaleLowerCase('ko-KR');

  if (['기본', '기본 공격', 'basic', 'attack'].includes(normalized)) return 'basic';
  if (['파워 스트라이크', '파워스트라이크', 'power_strike', 'power strike'].includes(normalized)) return 'power_strike';
  if (['파이어볼', 'fireball'].includes(normalized)) return 'fireball';
  if (['조준 사격', '조준사격', 'aimed_shot', 'aimed shot'].includes(normalized)) return 'aimed_shot';
  if (['백스탭', 'backstab'].includes(normalized)) return 'backstab';
  if (['성스러운 방패', '성스러운방패', 'holy_guard', 'holy guard'].includes(normalized)) return 'holy_guard';

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

  if (['포션', '회복 포션', 'potion'].includes(normalized)) return 'potion';
  if (['마나 포션', '마나포션', 'mana_potion', 'mana potion'].includes(normalized)) return 'mana_potion';
  if (['철검', 'iron_sword', 'iron sword', 'sword'].includes(normalized)) return 'iron_sword';
  if (['가죽 갑옷', '가죽갑옷', 'leather_armor', 'leather armor', 'armor'].includes(normalized)) return 'leather_armor';
  if (['반지', '신비한 반지', 'mystic_ring', 'mystic ring', 'ring'].includes(normalized)) return 'mystic_ring';
  if (['드래곤 블레이드', '드래곤블레이드', 'dragon_blade', 'dragon blade'].includes(normalized)) return 'dragon_blade';
  if (['대마도사의 지팡이', '대마도사지팡이', 'archmage_staff', 'archmage staff'].includes(normalized)) return 'archmage_staff';
  if (['수호자의 판금갑옷', '수호자 판금갑옷', 'guardian_plate', 'guardian plate'].includes(normalized)) return 'guardian_plate';

  throw new Error('알 수 없는 RPG 아이템입니다.');
}

export function normalizeRpgQuestId(questId) {
  const normalized = String(questId || '').trim().toLocaleLowerCase('ko-KR');

  if (['첫 승리', 'first_blood', 'first blood'].includes(normalized)) return 'first_blood';
  if (['슬라임 사냥꾼', 'slime_slayer', 'slime slayer'].includes(normalized)) return 'slime_slayer';
  if (['동굴 정찰', 'cave_scout', 'cave scout'].includes(normalized)) return 'cave_scout';
  if (['보스 도전자', 'boss_challenger', 'boss challenger'].includes(normalized)) return 'boss_challenger';

  throw new Error('알 수 없는 RPG 퀘스트입니다.');
}

export function normalizeRpgDailyMissionId(missionId) {
  const normalized = String(missionId || '').trim().toLocaleLowerCase('ko-KR');

  if (['전장 훈련', '전장훈련', 'field_training', 'field training', '훈련'].includes(normalized)) return 'field_training';
  if (['정찰 의뢰', '정찰의뢰', 'route_scout', 'route scout', '정찰'].includes(normalized)) return 'route_scout';
  if (['던전 조사', '던전조사', 'dungeon_delver', 'dungeon delver', '던전'].includes(normalized)) return 'dungeon_delver';
  if (['승리 계약', '승리계약', 'victory_contract', 'victory contract', '승리'].includes(normalized)) return 'victory_contract';

  throw new Error('알 수 없는 일일 의뢰입니다.');
}

export function normalizeRpgBossId(bossId) {
  const normalized = String(bossId || '').trim().toLocaleLowerCase('ko-KR');

  if (['슬라임 킹', '슬라임킹', 'slime_king', 'slime king'].includes(normalized)) return 'slime_king';
  if (['고대 드래곤', '고대드래곤', 'ancient_dragon', 'ancient dragon'].includes(normalized)) return 'ancient_dragon';

  throw new Error('알 수 없는 RPG 보스입니다.');
}

export function normalizeRpgGachaBannerId(bannerId = 'standard') {
  const normalized = String(bannerId || 'standard').trim().toLocaleLowerCase('ko-KR');

  if (['일반', '일반 소환', 'standard', 'normal'].includes(normalized)) return 'standard';

  throw new Error('알 수 없는 가챠 배너입니다.');
}

export function normalizeRpgAdvancedClass(advancedClass) {
  const normalized = String(advancedClass || '').trim().toLocaleLowerCase('ko-KR');

  if (['광전사', 'berserker'].includes(normalized)) return 'berserker';
  if (['대마법사', '아크메이지', 'archmage'].includes(normalized)) return 'archmage';
  if (['저격수', '스나이퍼', 'sniper'].includes(normalized)) return 'sniper';
  if (['크루세이더', '성전사', 'crusader'].includes(normalized)) return 'crusader';
  if (['섀도우', '쉐도우', 'shadow', 'assassin'].includes(normalized)) return 'shadow';
  if (['성자', '세인트', 'saint'].includes(normalized)) return 'saint';

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
  if (['직업 숙련', '직업숙련', 'class_mastery', 'class mastery'].includes(normalized)) return 'class_mastery';

  throw new Error('알 수 없는 스킬트리 노드입니다.');
}

export function normalizeRpgStoryChapterId(chapterId) {
  const normalized = String(chapterId || '').trim().toLocaleLowerCase('ko-KR');

  if (['숲의 맹세', 'forest_oath', 'forest oath'].includes(normalized)) return 'forest_oath';
  if (['수정 동굴의 신호', '수정동굴의신호', 'cave_signal', 'cave signal'].includes(normalized)) return 'cave_signal';
  if (['유적의 열쇠', '유적의열쇠', 'ruins_key', 'ruins key'].includes(normalized)) return 'ruins_key';
  if (['늪의 독안개', '늪의독안개', 'marsh_plague', 'marsh plague'].includes(normalized)) return 'marsh_plague';
  if (['화산 심장부', '화산심장부', 'volcano_core', 'volcano core'].includes(normalized)) return 'volcano_core';
  if (['빙결 봉화', '빙결봉화', 'frost_beacon', 'frost beacon'].includes(normalized)) return 'frost_beacon';
  if (['하늘 왕좌', '하늘왕좌', 'sky_throne', 'sky throne'].includes(normalized)) return 'sky_throne';

  throw new Error('알 수 없는 스토리 챕터입니다.');
}

export function normalizeRpgRaidId(raidId) {
  const normalized = String(raidId || '').trim().toLocaleLowerCase('ko-KR');

  if (['슬라임 군단', '슬라임군단', 'slime_horde', 'slime horde'].includes(normalized)) return 'slime_horde';
  if (['드래곤 균열', '드래곤균열', 'dragon_rift', 'dragon rift'].includes(normalized)) return 'dragon_rift';

  throw new Error('알 수 없는 레이드입니다.');
}

export function normalizeRpgMonsterName(monsterName) {
  const normalized = String(monsterName || '').trim().toLocaleLowerCase('ko-KR');
  const match = Object.keys(MONSTER_ASSET_IDS)
    .find((monster) => monster.toLocaleLowerCase('ko-KR') === normalized);
  if (match) return match;

  const aliases = {
    slime: '슬라임',
    goblin: '고블린',
    wolf: '숲 늑대',
    forest_wolf: '숲 늑대',
    orc: '오크 전사',
    skeleton: '해골 병사',
    bat: '동굴 박쥐',
    troll: '트롤',
    dark_knight: '암흑 기사',
    mini_dragon: '미니 드래곤',
    slime_king: '슬라임 킹',
    ancient_dragon: '고대 드래곤'
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
      hero: getRpgClassAssetId(normalizedClass, normalizedGender),
      monster: MONSTER_ASSET_IDS[monster] ?? 'monster_unknown_idle',
      background: areaConfig.backgroundAssetId
    }
  };
}

export function resolveRpgPvpTurn({
  attacker = {},
  defender = {},
  skillId = 'basic',
  randomInt = defaultRandomInt
} = {}) {
  const attackerFighter = createRpgPvpTurnFighter(attacker);
  const defenderFighter = createRpgPvpTurnFighter(defender);
  const normalizedSkillId = normalizeRpgSkillId(skillId);
  const skill = RPG_SKILLS[normalizedSkillId];
  const roll = randomInt(1, 20);
  const attackBonus = Math.max(0, Number(skill.attackBonus) || 0);
  const defenderGuardBonus = Math.max(0, Number(defender.guardBonus) || 0);
  const defenderDefensePower = defenderFighter.stats.defense + defenderGuardBonus;
  const attackPower = attackerFighter.stats.attack + attackBonus + roll;
  const mitigatedPower = Math.max(1, attackPower - Math.floor(defenderDefensePower / 2));
  const damage = Math.max(1, Math.floor(mitigatedPower / 3));

  return {
    skillId: normalizedSkillId,
    skillLabel: skill.label,
    skillMpCost: skill.mpCost,
    roll,
    attackBonus,
    guardBonus: Math.max(0, Number(skill.defenseBonus) || 0),
    defenderGuardBonus,
    attackPower,
    defenderDefensePower,
    mitigatedPower,
    damage,
    attacker: attackerFighter,
    defender: defenderFighter
  };
}

export function resolveRpgBossTurn({
  player = {},
  boss = {},
  action = 'basic',
  randomInt = defaultRandomInt
} = {}) {
  const normalizedAction = normalizeRpgBossActionId(action);
  const playerState = createRpgBossTurnPlayer(player);
  const bossState = createRpgBossTurnBoss(boss);
  let roll = 0;
  let attackPower = 0;
  let playerDamage = 0;
  let healed = 0;
  let consumedItemId = null;
  let skillId = null;
  let skillLabel = null;
  let mpCost = 0;
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
    playerMpAfter = Math.max(0, playerState.mp - skill.mpCost);
    roll = randomInt(1, 20);
    attackPower = playerState.stats.attack + skill.attackBonus + playerState.level + roll;
    playerDamage = Math.max(1, Math.floor(attackPower / 2));
  }

  const bossHpAfter = Math.max(0, bossState.hp - playerDamage);
  const bossDefeated = bossHpAfter <= 0;
  const guardMitigation = normalizedAction === 'guard'
    ? Math.ceil(bossState.power / 2)
    : 0;
  const bossDamage = bossDefeated
    ? 0
    : Math.max(1, Math.floor(Math.max(1, bossState.power - playerState.stats.defense - guardMitigation) / 3));
  const playerHpAfterHeal = Math.min(playerState.maxHp, playerState.hp + healed);
  const playerHpAfter = Math.max(1, playerHpAfterHeal - bossDamage);

  return {
    action: normalizedAction,
    skillId,
    skillLabel,
    mpCost,
    roll,
    attackPower,
    playerDamage,
    healed,
    consumedItemId,
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
      hero: getRpgClassAssetId(normalizedClass, normalizedGender),
      monster: MONSTER_ASSET_IDS[boss.monster] ?? 'boss_unknown_idle',
      background: boss.backgroundAssetId
    }
  };
}

function createRpgPvpTurnFighter(fighter) {
  const safeFighter = fighter && typeof fighter === 'object' ? fighter : {};
  const normalizedClass = normalizeRpgClass(safeFighter.characterClass ?? 'novice');
  const normalizedGender = normalizeRpgGender(safeFighter.characterGender ?? 'male');
  const classConfig = RPG_CLASSES[normalizedClass];
  const genderConfig = RPG_GENDERS[normalizedGender];
  const safeLevel = Math.max(1, Number(safeFighter.level) || 1);

  return {
    level: safeLevel,
    characterClass: normalizedClass,
    characterClassLabel: classConfig.label,
    characterGender: normalizedGender,
    characterGenderLabel: genderConfig.label,
    stats: normalizeRpgPvpStats(safeFighter.stats, safeLevel, normalizedClass),
    guardBonus: Math.max(0, Number(safeFighter.guardBonus) || 0),
    assets: {
      hero: getRpgClassAssetId(normalizedClass, normalizedGender)
    }
  };
}

function createRpgBossTurnPlayer(player) {
  const safePlayer = player && typeof player === 'object' ? player : {};
  const normalizedClass = normalizeRpgClass(safePlayer.characterClass ?? 'novice');
  const normalizedGender = normalizeRpgGender(safePlayer.characterGender ?? 'male');
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
      : getAvailableRpgSkillIds(normalizedClass),
    assets: {
      hero: getRpgClassAssetId(normalizedClass, normalizedGender)
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

function normalizeRpgPvpStats(stats, level, characterClass) {
  const fallback = getRpgDerivedStats({ level, characterClass });
  const safeStats = stats && typeof stats === 'object' ? stats : {};

  return {
    attack: normalizeRpgPvpStat(safeStats.attack, fallback.attack),
    defense: normalizeRpgPvpStat(safeStats.defense, fallback.defense)
  };
}

function normalizeRpgPvpStat(value, fallback) {
  const normalized = Number(value);
  return Number.isFinite(normalized)
    ? Math.max(0, normalized)
    : fallback;
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
  const event = eventRoll <= 35
    ? 'battle'
    : eventRoll <= 60
      ? 'treasure'
      : eventRoll <= 80
        ? 'trap'
        : 'shrine';
  const xpReward = event === 'trap' ? 0 : Math.floor(randomInt(20, 70) * areaConfig.xpMultiplier);
  const coinReward = event === 'trap' ? 0 : Math.floor(randomInt(50, 160) * areaConfig.coinMultiplier);
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
      hero: getRpgClassAssetId(normalizedClass, normalizedGender),
      monster: MONSTER_ASSET_IDS[raid.monster] ?? 'boss_unknown_idle',
      background: raid.backgroundAssetId
    }
  };
}

export function rollRpgGearDrop({
  source = 'battle',
  area = 'forest',
  difficulty = 'normal',
  randomInt = defaultRandomInt
} = {}) {
  const roll = randomInt(1, 100);
  const threshold = source === 'raid'
    ? 25
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
  const basePool = ['volcano', 'frost', 'sky'].includes(area)
    ? ['dragon_blade', 'archmage_staff', 'guardian_plate', 'mystic_ring']
    : ['marsh', 'ruins'].includes(area)
      ? ['dragon_blade', 'guardian_plate', 'mystic_ring']
      : area === 'cave'
        ? ['archmage_staff', 'leather_armor', 'mystic_ring']
        : ['iron_sword', 'leather_armor', 'mystic_ring'];
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
    assetId: item.assetId
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

  if (requirement.type === 'explores') {
    return rpg.explores ?? 0;
  }

  if (requirement.type === 'level') {
    return profile.level ?? 1;
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

  return 0;
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
      pvpWins: 0,
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
    pvpWins: Math.max(0, Number(safeDaily.pvpWins) || 0),
    claimedMissions: { ...(safeDaily.claimedMissions ?? {}) }
  };
}

function getDailyMissionProgress(daily, mission) {
  return Math.max(0, Number(daily[mission.requirement.type]) || 0);
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

  if (cooldownRemainingMs > 0) {
    return {
      type: 'explore',
      label: `${currentArea.label} 탐험`,
      command: '/rpg 탐험',
      reason: '전투 대기시간 동안 탐험으로 보상과 전리품을 노릴 수 있습니다.'
    };
  }

  if (progressableStoryChapters.length > 0 && (profile.rpg?.battles ?? 0) > 0) {
    const chapter = progressableStoryChapters[0];
    return {
      type: 'story',
      label: `${chapter.label} 진행`,
      command: `/rpg 스토리 챕터:${chapter.label}`,
      reason: '진행 가능한 스토리 챕터가 열렸습니다.'
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

function defaultRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
