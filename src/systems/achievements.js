const ACHIEVEMENT_PROGRESS_BAR_LENGTH = 8;

export const ACHIEVEMENT_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'growth', label: '성장' }),
  Object.freeze({ id: 'attendance', label: '출석' }),
  Object.freeze({ id: 'economy', label: '경제' }),
  Object.freeze({ id: 'games', label: '게임' }),
  Object.freeze({ id: 'community', label: '커뮤니티' }),
  Object.freeze({ id: 'activity', label: '활동' }),
  Object.freeze({ id: 'collection', label: '수집' }),
  Object.freeze({ id: 'rpg', label: 'RPG' }),
  Object.freeze({ id: 'fishing', label: '낚시' }),
  Object.freeze({ id: 'sword', label: '검강화' }),
  Object.freeze({ id: 'stocks', label: '주식' }),
  Object.freeze({ id: 'tamagotchi', label: '다마고치' })
]);

const ACHIEVEMENT_CATEGORY_BY_ID = new Map(ACHIEVEMENT_CATEGORIES.map((category) => [category.id, category]));

export const TITLE_RARITIES = Object.freeze({
  common: Object.freeze({ id: 'common', label: '일반', icon: '⚪' }),
  rare: Object.freeze({ id: 'rare', label: '희귀', icon: '🔵' }),
  epic: Object.freeze({ id: 'epic', label: '영웅', icon: '🟣' }),
  legendary: Object.freeze({ id: 'legendary', label: '전설', icon: '🟠' }),
  mythic: Object.freeze({ id: 'mythic', label: '신화', icon: '🔴' })
});

export const COMMUNITY_TITLES = Object.freeze([
  title('steady', '🌅 성실한 출석러', '연속 출석 7일 업적으로 획득', { rarity: 'rare', category: 'attendance', source: '업적' }),
  title('dawn_keeper', '🌄 새벽 수호자', '연속 출석 30일 업적으로 획득', { rarity: 'epic', category: 'attendance', source: '업적' }),
  title('rich', '💰 동네 부자', '골드 10,000 보유 업적으로 획득', { rarity: 'rare', category: 'economy', source: '업적' }),
  title('tycoon', '🏦 희희 재벌', '골드 100,000 보유 업적으로 획득', { rarity: 'legendary', category: 'economy', source: '업적' }),
  title('gambler', '🎲 도박꾼', '카지노 10회 참여 업적으로 획득', { rarity: 'rare', category: 'games', source: '업적' }),
  title('highroller', '🃏 하이롤러', '카지노 100회 참여 업적으로 획득', { rarity: 'epic', category: 'games', source: '업적' }),
  title('lucky', '🍀 행운아', '복권 5장 구매 업적으로 획득', { rarity: 'rare', category: 'games', source: '업적' }),
  title('jackpot_backer', '🎟️ 잭팟 후원자', '복권 50장 구매 업적으로 획득', { rarity: 'epic', category: 'games', source: '업적' }),
  title('missioner', '📋 미션러', '미션 보상 5개 수령 업적으로 획득', { rarity: 'rare', category: 'community', source: '업적' }),
  title('quest_captain', '🧭 체크리스트 대장', '미션 보상 25개 수령 업적으로 획득', { rarity: 'epic', category: 'community', source: '업적' }),
  title('host', '📣 이벤트 주최자', '서버 이벤트 1회 시작 업적으로 획득', { rarity: 'rare', category: 'community', source: '업적' }),
  title('festival_director', '🎪 축제 감독', '서버 이벤트 5회 시작 업적으로 획득', { rarity: 'legendary', category: 'community', source: '업적' }),
  title('chatter', '💬 수다쟁이', '채팅 100회 업적으로 획득', { rarity: 'common', category: 'activity', source: '업적' }),
  title('commander', '⌨️ 명령어 장인', '명령어 50회 사용 업적으로 획득', { rarity: 'rare', category: 'activity', source: '업적' }),
  title('wordsmith', '🔤 끝말잇기 장인', '끝말잇기 승리 업적으로 획득', { rarity: 'rare', category: 'games', source: '업적' }),
  title('stylist', '🎨 꾸미기 입문자', '상점 구매 업적으로 획득', { rarity: 'common', category: 'collection', source: '업적' }),
  title('vip', '👑 VIP', '상점에서 구매', { rarity: 'epic', category: 'collection', source: '상점' }),
  title('collector', '💎 수집가', '상점에서 구매', { rarity: 'legendary', category: 'collection', source: '상점' }),
  title('rpg_adventurer', '🧭 모험가', 'RPG 캐릭터를 시작한 기록으로 획득', { rarity: 'common', category: 'rpg', source: 'RPG 업적' }),
  title('dungeon_breaker', '🏰 던전 돌파자', 'RPG 던전 클리어 업적으로 획득', { rarity: 'epic', category: 'rpg', source: 'RPG 업적' }),
  title('season_dungeon_title', '🏰 던전 개척자', '희희봇 시즌 1 보상으로 획득', { rarity: 'legendary', category: 'rpg', source: '시즌 1' }),
  title('angler', '🎣 강태공', '낚시 업적으로 획득', { rarity: 'rare', category: 'fishing', source: '낚시 업적' }),
  title('blade_master', '⚔️ 검의 주인', '검강화 업적으로 획득', { rarity: 'epic', category: 'sword', source: '검강화 업적' }),
  title('market_maker', '📈 시장 감시자', '주식 거래 업적으로 획득', { rarity: 'rare', category: 'stocks', source: '주식 업적' }),
  title('pet_guardian', '🐣 희진 수호자', '다마고치 돌봄 업적으로 획득', { rarity: 'rare', category: 'tamagotchi', source: '다마고치 업적' }),
  title('blacksmith_nightmare', '💥 대장장이의 악몽', '숨겨진 검강화 업적으로 획득', { rarity: 'legendary', category: 'sword', source: '히든 업적', hidden: true }),
  title('abyss_angler', '🌫️ 심연의 낚시꾼', '숨겨진 낚시 업적으로 획득', { rarity: 'legendary', category: 'fishing', source: '히든 업적', hidden: true }),
  title('reborn_guardian', '🕯️ 다시 만난 보호자', '숨겨진 다마고치 업적으로 획득', { rarity: 'epic', category: 'tamagotchi', source: '히든 업적', hidden: true })
]);

const TITLE_BY_ID = new Map(COMMUNITY_TITLES.map((item) => [item.id, item]));

const ACHIEVEMENTS = Object.freeze([
  achievement('level_2', '첫 성장', '레벨 2 달성', ({ profile }) => profile.level >= 2, ({ profile }) => `Lv.${Math.min(profile.level, 2)} / Lv.2`, { coins: 300, xp: 0 }, { category: 'growth', tier: 'bronze', target: 2, current: ({ profile }) => profile.level }),
  achievement('level_10', '성장 루프 입문', '레벨 10 달성', ({ profile }) => profile.level >= 10, ({ profile }) => `Lv.${Math.min(profile.level, 10)} / Lv.10`, { coins: 1_000, xp: 120 }, { category: 'growth', tier: 'silver', target: 10, current: ({ profile }) => profile.level }),
  achievement('level_25', '서버의 주역', '레벨 25 달성', ({ profile }) => profile.level >= 25, ({ profile }) => `Lv.${Math.min(profile.level, 25)} / Lv.25`, { coins: 4_000, xp: 400 }, { category: 'growth', tier: 'gold', target: 25, current: ({ profile }) => profile.level }),
  achievement('daily_7', '일주일 출석', '연속 출석 7일 달성', ({ profile }) => profile.dailyStreak >= 7, ({ profile }) => `${Math.min(profile.dailyStreak, 7)} / 7일`, { coins: 1_000, xp: 50, titleId: 'steady' }, { category: 'attendance', tier: 'silver', target: 7, current: ({ profile }) => profile.dailyStreak }),
  achievement('daily_30', '한 달 루틴', '연속 출석 30일 달성', ({ profile }) => profile.dailyStreak >= 30, ({ profile }) => `${Math.min(profile.dailyStreak, 30)} / 30일`, { coins: 5_000, xp: 300, titleId: 'dawn_keeper' }, { category: 'attendance', tier: 'gold', target: 30, current: ({ profile }) => profile.dailyStreak }),
  achievement('balance_10000', '돈 냄새', '골드 10,000 보유', ({ profile }) => profile.balance >= 10_000, ({ profile }) => `${Math.min(profile.balance, 10_000).toLocaleString()} / 10,000골드`, { coins: 500, xp: 50, titleId: 'rich' }, { category: 'economy', tier: 'silver', target: 10_000, current: ({ profile }) => profile.balance }),
  achievement('balance_100000', '금고가 무겁다', '골드 100,000 보유', ({ profile }) => profile.balance >= 100_000, ({ profile }) => `${Math.min(profile.balance, 100_000).toLocaleString()} / 100,000골드`, { coins: 5_000, xp: 500, titleId: 'tycoon' }, { category: 'economy', tier: 'gold', target: 100_000, current: ({ profile }) => profile.balance }),
  achievement('transfers_10', '송금왕', '송금 10회 기록', ({ community }) => community.stats.transfers >= 10, ({ community }) => `${Math.min(community.stats.transfers, 10)} / 10회`, { coins: 1_500, xp: 150 }, { category: 'economy', tier: 'silver', target: 10, current: ({ community }) => community.stats.transfers }),
  achievement('casino_10', '판돈은 작게', '카지노 게임 10회 참여', ({ community }) => community.stats.casinoPlays >= 10, ({ community }) => `${Math.min(community.stats.casinoPlays, 10)} / 10회`, { coins: 700, xp: 60, titleId: 'gambler' }, { category: 'games', tier: 'silver', target: 10, current: ({ community }) => community.stats.casinoPlays }),
  achievement('casino_100', '판 위의 고수', '카지노 게임 100회 참여', ({ community }) => community.stats.casinoPlays >= 100, ({ community }) => `${Math.min(community.stats.casinoPlays, 100)} / 100회`, { coins: 4_000, xp: 400, titleId: 'highroller' }, { category: 'games', tier: 'gold', target: 100, current: ({ community }) => community.stats.casinoPlays }),
  achievement('lottery_5', '한 장만 더', '복권 5장 구매', ({ community }) => community.stats.lotteryTickets >= 5, ({ community }) => `${Math.min(community.stats.lotteryTickets, 5)} / 5장`, { coins: 500, xp: 40, titleId: 'lucky' }, { category: 'games', tier: 'bronze', target: 5, current: ({ community }) => community.stats.lotteryTickets }),
  achievement('lottery_50', '잭팟 후원자', '복권 50장 누적 구매', ({ community }) => community.stats.lotteryTickets >= 50, ({ community }) => `${Math.min(community.stats.lotteryTickets, 50)} / 50장`, { coins: 2_500, xp: 250, titleId: 'jackpot_backer' }, { category: 'games', tier: 'silver', target: 50, current: ({ community }) => community.stats.lotteryTickets }),
  achievement('wordchain_win_1', '말문 트임', '끝말잇기 1회 승리', ({ community }) => community.stats.wordChainWins >= 1, ({ community }) => `${Math.min(community.stats.wordChainWins, 1)} / 1승`, { coins: 700, xp: 70, titleId: 'wordsmith' }, { category: 'games', tier: 'bronze', target: 1, current: ({ community }) => community.stats.wordChainWins }),
  achievement('wordchain_win_10', '어휘 사냥꾼', '끝말잇기 10회 승리', ({ community }) => community.stats.wordChainWins >= 10, ({ community }) => `${Math.min(community.stats.wordChainWins, 10)} / 10승`, { coins: 3_000, xp: 320 }, { category: 'games', tier: 'gold', target: 10, current: ({ community }) => community.stats.wordChainWins }),
  achievement('missions_5', '체크리스트 중독', '미션 보상 5개 수령', ({ community }) => community.stats.missionsCompleted >= 5, ({ community }) => `${Math.min(community.stats.missionsCompleted, 5)} / 5개`, { coins: 1_000, xp: 100, titleId: 'missioner' }, { category: 'community', tier: 'silver', target: 5, current: ({ community }) => community.stats.missionsCompleted }),
  achievement('missions_25', '일정표 지배자', '미션 보상 25개 수령', ({ community }) => community.stats.missionsCompleted >= 25, ({ community }) => `${Math.min(community.stats.missionsCompleted, 25)} / 25개`, { coins: 3_000, xp: 350, titleId: 'quest_captain' }, { category: 'community', tier: 'gold', target: 25, current: ({ community }) => community.stats.missionsCompleted }),
  achievement('event_host_1', '분위기 메이커', '서버 이벤트 1회 시작', ({ community }) => community.stats.eventsHosted >= 1, ({ community }) => `${Math.min(community.stats.eventsHosted, 1)} / 1회`, { coins: 300, xp: 30, titleId: 'host' }, { category: 'community', tier: 'bronze', target: 1, current: ({ community }) => community.stats.eventsHosted }),
  achievement('event_host_5', '서버 축제 감독', '서버 이벤트 5회 시작', ({ community }) => community.stats.eventsHosted >= 5, ({ community }) => `${Math.min(community.stats.eventsHosted, 5)} / 5회`, { coins: 3_500, xp: 360, titleId: 'festival_director' }, { category: 'community', tier: 'gold', target: 5, current: ({ community }) => community.stats.eventsHosted }),
  achievement('chat_100', '대화 시작', '채팅 보상 기록 100회', ({ community }) => community.stats.chatMessages >= 100, ({ community }) => `${Math.min(community.stats.chatMessages, 100)} / 100회`, { coins: 1_000, xp: 120, titleId: 'chatter' }, { category: 'activity', tier: 'silver', target: 100, current: ({ community }) => community.stats.chatMessages }),
  achievement('chat_1000', '서버 상주민', '채팅 보상 기록 1,000회', ({ community }) => community.stats.chatMessages >= 1_000, ({ community }) => `${Math.min(community.stats.chatMessages, 1_000).toLocaleString()} / 1,000회`, { coins: 6_000, xp: 650 }, { category: 'activity', tier: 'legendary', target: 1_000, current: ({ community }) => community.stats.chatMessages }),
  achievement('commands_50', '봇 조작 입문', '명령어 50회 사용', ({ community }) => community.stats.commandsUsed >= 50, ({ community }) => `${Math.min(community.stats.commandsUsed, 50)} / 50회`, { coins: 1_000, xp: 120, titleId: 'commander' }, { category: 'activity', tier: 'silver', target: 50, current: ({ community }) => community.stats.commandsUsed }),
  achievement('commands_300', '단축키 인간', '명령어 300회 사용', ({ community }) => community.stats.commandsUsed >= 300, ({ community }) => `${Math.min(community.stats.commandsUsed, 300)} / 300회`, { coins: 4_000, xp: 430 }, { category: 'activity', tier: 'gold', target: 300, current: ({ community }) => community.stats.commandsUsed }),
  achievement('shop_purchase_1', '꾸미기 시작', '상점 아이템 1개 구매', ({ community }) => community.stats.shopPurchases >= 1, ({ community }) => `${Math.min(community.stats.shopPurchases, 1)} / 1개`, { coins: 500, xp: 60, titleId: 'stylist' }, { category: 'collection', tier: 'bronze', target: 1, current: ({ community }) => community.stats.shopPurchases }),
  achievement('shop_purchase_5', '꾸미기 컬렉터', '상점 아이템 5개 구매', ({ community }) => community.stats.shopPurchases >= 5, ({ community }) => `${Math.min(community.stats.shopPurchases, 5)} / 5개`, { coins: 2_000, xp: 220 }, { category: 'collection', tier: 'silver', target: 5, current: ({ community }) => community.stats.shopPurchases }),

  achievement('rpg_started', '모험의 첫 장', 'RPG 캐릭터 생성', ({ sources }) => getRpg(sources).startedAt > 0, ({ sources }) => getRpg(sources).startedAt > 0 ? '시작 완료' : '미시작', { coins: 0, xp: 40, titleId: 'rpg_adventurer' }, { category: 'rpg', tier: 'bronze', target: 1, current: ({ sources }) => getRpg(sources).startedAt > 0 ? 1 : 0 }),
  achievement('rpg_level_10', '전투 루프 적응', 'RPG 레벨 10 달성', ({ sources }) => getRpg(sources).level >= 10, ({ sources }) => `Lv.${Math.min(getRpg(sources).level, 10)} / Lv.10`, { coins: 500, xp: 160 }, { category: 'rpg', tier: 'silver', target: 10, current: ({ sources }) => getRpg(sources).level }),
  achievement('rpg_boss_1', '첫 보스 토벌', 'RPG 보스 1회 처치', ({ sources }) => sumCounts(getRpg(sources).bossKills) >= 1, ({ sources }) => `${Math.min(sumCounts(getRpg(sources).bossKills), 1)} / 1회`, { coins: 300, xp: 120 }, { category: 'rpg', tier: 'bronze', target: 1, current: ({ sources }) => sumCounts(getRpg(sources).bossKills) }),
  achievement('rpg_dungeon_5', '돌파하는 모험가', 'RPG 던전 5회 클리어', ({ sources }) => sumCounts(getRpg(sources).dungeonClears) >= 5, ({ sources }) => `${Math.min(sumCounts(getRpg(sources).dungeonClears), 5)} / 5회`, { coins: 600, xp: 240, titleId: 'dungeon_breaker' }, { category: 'rpg', tier: 'gold', target: 5, current: ({ sources }) => sumCounts(getRpg(sources).dungeonClears) }),
  achievement('rpg_craft_5', '제작대 앞 단골', 'RPG 장비/아이템 제작 5회', ({ sources }) => getRpg(sources).craftedItems >= 5, ({ sources }) => `${Math.min(getRpg(sources).craftedItems, 5)} / 5회`, { coins: 300, xp: 160 }, { category: 'rpg', tier: 'silver', target: 5, current: ({ sources }) => getRpg(sources).craftedItems }),

  achievement('fishing_catch_10', '물비린내 입문', '낚시 10회 성공', ({ sources }) => getFishing(sources).stats.totalCatches >= 10, ({ sources }) => `${Math.min(getFishing(sources).stats.totalCatches, 10)} / 10마리`, { coins: 300, xp: 110, titleId: 'angler' }, { category: 'fishing', tier: 'bronze', target: 10, current: ({ sources }) => getFishing(sources).stats.totalCatches }),
  achievement('fishing_collection_20', '작은 수족관', '물고기 도감 20종 발견', ({ sources }) => countKeys(getFishing(sources).collection) >= 20, ({ sources }) => `${Math.min(countKeys(getFishing(sources).collection), 20)} / 20종`, { coins: 500, xp: 200 }, { category: 'fishing', tier: 'silver', target: 20, current: ({ sources }) => countKeys(getFishing(sources).collection) }),
  achievement('fishing_rod_10', '손에 익은 낚싯대', '낚싯대 +10 달성', ({ sources }) => getFishing(sources).rod.level >= 10, ({ sources }) => `+${Math.min(getFishing(sources).rod.level, 10)} / +10`, { coins: 400, xp: 160 }, { category: 'fishing', tier: 'silver', target: 10, current: ({ sources }) => getFishing(sources).rod.level }),
  achievement('fishing_battle_win_5', '어항 결투가', '물고기배틀 5승', ({ sources }) => getFishing(sources).battle.wins >= 5, ({ sources }) => `${Math.min(getFishing(sources).battle.wins, 5)} / 5승`, { coins: 500, xp: 200 }, { category: 'fishing', tier: 'gold', target: 5, current: ({ sources }) => getFishing(sources).battle.wins }),

  achievement('sword_level_10', '날이 선 검', '검 +10 달성', ({ sources }) => getSword(sources).highestLevel >= 10, ({ sources }) => `+${Math.min(getSword(sources).highestLevel, 10)} / +10`, { coins: 300, xp: 130, titleId: 'blade_master' }, { category: 'sword', tier: 'silver', target: 10, current: ({ sources }) => getSword(sources).highestLevel }),
  achievement('sword_level_50_global', '반짝이는 전설의 시작', '검 +50 달성', ({ sources }) => getSword(sources).highestLevel >= 50, ({ sources }) => `+${Math.min(getSword(sources).highestLevel, 50)} / +50`, { coins: 700, xp: 400 }, { category: 'sword', tier: 'gold', target: 50, current: ({ sources }) => getSword(sources).highestLevel }),
  achievement('sword_destroy_1', '터져도 다시 잡는 손', '검 파괴 1회 기록', ({ sources }) => getSword(sources).destructions >= 1, ({ sources }) => `${Math.min(getSword(sources).destructions, 1)} / 1회`, { coins: 0, xp: 80 }, { category: 'sword', tier: 'bronze', target: 1, current: ({ sources }) => getSword(sources).destructions }),
  achievement('sword_battle_win_10', '검투장 단골', '검배틀 10승', ({ sources }) => getSword(sources).battleWins >= 10, ({ sources }) => `${Math.min(getSword(sources).battleWins, 10)} / 10승`, { coins: 500, xp: 280 }, { category: 'sword', tier: 'gold', target: 10, current: ({ sources }) => getSword(sources).battleWins }),

  achievement('stock_trade_10', '시장 구경꾼 탈출', '주식 거래 10회', ({ sources }) => getStocks(sources).tradeCount >= 10, ({ sources }) => `${Math.min(getStocks(sources).tradeCount, 10)} / 10회`, { coins: 300, xp: 110, titleId: 'market_maker' }, { category: 'stocks', tier: 'bronze', target: 10, current: ({ sources }) => getStocks(sources).tradeCount }),
  achievement('stock_profit_10000', '빨간불보다 초록불', '주식 실현손익 10,000골드 달성', ({ sources }) => getStocks(sources).realizedProfit >= 10_000, ({ sources }) => `${Math.min(getStocks(sources).realizedProfit, 10_000).toLocaleString()} / 10,000골드`, { coins: 500, xp: 180 }, { category: 'stocks', tier: 'silver', target: 10_000, current: ({ sources }) => Math.max(0, getStocks(sources).realizedProfit) }),
  achievement('stock_leverage_5', '레버리지 입문자', '레버리지 포지션 5회 진입', ({ sources }) => getStocks(sources).leveragedTradeCount >= 5, ({ sources }) => `${Math.min(getStocks(sources).leveragedTradeCount, 5)} / 5회`, { coins: 0, xp: 140 }, { category: 'stocks', tier: 'silver', target: 5, current: ({ sources }) => getStocks(sources).leveragedTradeCount }),

  achievement('tamagotchi_care_30', '돌봄 루틴', '희진 돌봄 행동 30회', ({ sources }) => getTamagotchi(sources).counters.totalCareActions >= 30, ({ sources }) => `${Math.min(getTamagotchi(sources).counters.totalCareActions, 30)} / 30회`, { coins: 200, xp: 120, titleId: 'pet_guardian' }, { category: 'tamagotchi', tier: 'bronze', target: 30, current: ({ sources }) => getTamagotchi(sources).counters.totalCareActions }),
  achievement('tamagotchi_daily_7', '매일 보는 얼굴', '희진 오늘의 돌봄 미션 7회 완료', ({ sources }) => getTamagotchi(sources).codex.dailyCompletions >= 7, ({ sources }) => `${Math.min(getTamagotchi(sources).codex.dailyCompletions, 7)} / 7회`, { coins: 300, xp: 160 }, { category: 'tamagotchi', tier: 'silver', target: 7, current: ({ sources }) => getTamagotchi(sources).codex.dailyCompletions }),
  achievement('tamagotchi_room_3', '방 꾸미기 시작', '희진 방 아이템 3개 해금', ({ sources }) => getTamagotchi(sources).room.unlockedItemIds.length >= 3, ({ sources }) => `${Math.min(getTamagotchi(sources).room.unlockedItemIds.length, 3)} / 3개`, { coins: 200, xp: 110 }, { category: 'tamagotchi', tier: 'bronze', target: 3, current: ({ sources }) => getTamagotchi(sources).room.unlockedItemIds.length }),
  achievement('tamagotchi_adult', '어른 희진과 함께', '희진 성년기 분기 발견', ({ sources }) => Boolean(getTamagotchi(sources).growth.adultBranchId), ({ sources }) => getTamagotchi(sources).growth.adultBranchId ? '성년기 발견' : '미발견', { coins: 500, xp: 260 }, { category: 'tamagotchi', tier: 'gold', target: 1, current: ({ sources }) => getTamagotchi(sources).growth.adultBranchId ? 1 : 0 }),
  achievement('hidden_sword_destroy_3', '대장장이의 악몽', '검 파괴 3회 기록', ({ sources }) => getSword(sources).destructions >= 3, ({ sources }) => `${Math.min(getSword(sources).destructions, 3)} / 3회`, { coins: 0, xp: 220, titleId: 'blacksmith_nightmare' }, { category: 'sword', tier: 'legendary', target: 3, current: ({ sources }) => getSword(sources).destructions, hidden: true }),
  achievement('hidden_fishing_shadow', '심연에서 건져 올린 것', '히든 물고기 1종 발견', ({ sources }) => getFishing(sources).hiddenCollectionCount >= 1, ({ sources }) => `${Math.min(getFishing(sources).hiddenCollectionCount, 1)} / 1종`, { coins: 0, xp: 220, titleId: 'abyss_angler' }, { category: 'fishing', tier: 'legendary', target: 1, current: ({ sources }) => getFishing(sources).hiddenCollectionCount, hidden: true }),
  achievement('hidden_tamagotchi_revival', '다시 만난 희진', '희진을 부활시킨 기록', ({ sources }) => getTamagotchi(sources).counters.revivals >= 1, ({ sources }) => `${Math.min(getTamagotchi(sources).counters.revivals, 1)} / 1회`, { coins: 0, xp: 180, titleId: 'reborn_guardian' }, { category: 'tamagotchi', tier: 'epic', target: 1, current: ({ sources }) => getTamagotchi(sources).counters.revivals, hidden: true })
]);

export function getAchievementCategories() {
  return ACHIEVEMENT_CATEGORIES.map((item) => ({ ...item }));
}

export function getCommunityTitle(titleId) {
  return TITLE_BY_ID.get(String(titleId)) ?? null;
}

export function getCommunityTitles() {
  return COMMUNITY_TITLES.map((item) => ({ ...item }));
}

export function isCommunityTitleId(titleId) {
  return TITLE_BY_ID.has(String(titleId));
}

export function addOwnedTitle(community, titleId) {
  if (!isCommunityTitleId(titleId)) return false;
  community.ownedTitles ??= [];
  if (!community.ownedTitles.includes(titleId)) community.ownedTitles.push(titleId);
  return true;
}

export function getAchievementStatuses(profile, community, sources = {}) {
  const context = { profile, community, sources };
  return ACHIEVEMENTS.map((achievementConfig) => {
    const completed = Boolean(achievementConfig.isComplete(context));
    const claimed = Boolean(community.claimedAchievements[achievementConfig.id]);
    const revealed = !achievementConfig.hidden || completed || claimed;
    const current = achievementConfig.getCurrentValue
      ? normalizeStoredNonNegativeInteger(achievementConfig.getCurrentValue(context))
      : null;
    const target = achievementConfig.target;
    const percent = target > 0 && current !== null
      ? Math.min(100, Math.floor((Math.min(current, target) / target) * 100))
      : completed
      ? 100
      : 0;
    const displayPercent = revealed ? percent : 0;
    const rewardTitle = revealed && achievementConfig.reward.titleId
      ? TITLE_BY_ID.get(achievementConfig.reward.titleId)
      : null;

    return {
      id: achievementConfig.id,
      title: revealed ? achievementConfig.title : '???',
      description: revealed ? achievementConfig.description : '조건이 숨겨진 업적입니다.',
      category: achievementConfig.category,
      categoryLabel: achievementConfig.categoryLabel,
      tier: achievementConfig.tier,
      hidden: achievementConfig.hidden,
      revealed,
      completed,
      claimed,
      progress: revealed ? achievementConfig.getProgressText(context) : '???',
      current: revealed ? current : null,
      target: revealed ? target : null,
      percent: displayPercent,
      progressBar: formatAchievementProgressBar(displayPercent),
      reward: {
        coins: revealed ? achievementConfig.reward.coins : 0,
        xp: revealed ? achievementConfig.reward.xp : 0,
        titleId: revealed ? achievementConfig.reward.titleId : null,
        title: rewardTitle
      }
    };
  });
}

export function getTitleStatuses(community) {
  return COMMUNITY_TITLES.map((titleConfig) => ({
    ...titleConfig,
    owned: community.ownedTitles.includes(titleConfig.id),
    equipped: community.equippedTitle === titleConfig.id
  }));
}

export function getAchievementRewardSummary() {
  const byCategory = {};
  let totalCoins = 0;
  let totalXp = 0;
  let maxCoins = 0;
  let hiddenCount = 0;
  let hiddenCoins = 0;
  let titleRewardCount = 0;

  for (const achievementConfig of ACHIEVEMENTS) {
    totalCoins += achievementConfig.reward.coins;
    totalXp += achievementConfig.reward.xp;
    maxCoins = Math.max(maxCoins, achievementConfig.reward.coins);
    if (achievementConfig.reward.titleId) titleRewardCount += 1;
    if (achievementConfig.hidden) {
      hiddenCount += 1;
      hiddenCoins += achievementConfig.reward.coins;
    }

    byCategory[achievementConfig.category] ??= {
      category: achievementConfig.category,
      count: 0,
      coins: 0,
      xp: 0
    };
    byCategory[achievementConfig.category].count += 1;
    byCategory[achievementConfig.category].coins += achievementConfig.reward.coins;
    byCategory[achievementConfig.category].xp += achievementConfig.reward.xp;
  }

  return {
    count: ACHIEVEMENTS.length,
    totalCoins,
    totalXp,
    maxCoins,
    hiddenCount,
    hiddenCoins,
    titleRewardCount,
    byCategory
  };
}

function title(id, label, description, meta = {}) {
  const rarity = TITLE_RARITIES[meta.rarity] ? meta.rarity : 'common';
  const rarityInfo = TITLE_RARITIES[rarity];
  const category = ACHIEVEMENT_CATEGORY_BY_ID.has(meta.category) ? meta.category : 'community';
  const categoryInfo = ACHIEVEMENT_CATEGORY_BY_ID.get(category);

  return Object.freeze({
    id,
    label,
    description,
    rarity,
    rarityLabel: rarityInfo.label,
    rarityIcon: rarityInfo.icon,
    category,
    categoryLabel: categoryInfo?.label ?? '커뮤니티',
    source: meta.source ?? '업적',
    hidden: Boolean(meta.hidden)
  });
}

function achievement(id, titleText, description, isComplete, getProgressText, reward, meta = {}) {
  const category = ACHIEVEMENT_CATEGORY_BY_ID.has(meta.category) ? meta.category : 'community';
  const categoryInfo = ACHIEVEMENT_CATEGORY_BY_ID.get(category);

  return Object.freeze({
    id,
    title: titleText,
    description,
    isComplete,
    getProgressText,
    category,
    categoryLabel: categoryInfo?.label ?? '커뮤니티',
    tier: meta.tier ?? 'bronze',
    hidden: Boolean(meta.hidden),
    target: normalizeStoredNonNegativeInteger(meta.target),
    getCurrentValue: typeof meta.current === 'function' ? meta.current : null,
    reward: Object.freeze({
      coins: reward.coins ?? 0,
      xp: reward.xp ?? 0,
      titleId: reward.titleId ?? null
    })
  });
}

function formatAchievementProgressBar(percent) {
  const safePercent = Math.max(0, Math.min(100, normalizeStoredNonNegativeInteger(percent)));
  const filled = Math.round((safePercent / 100) * ACHIEVEMENT_PROGRESS_BAR_LENGTH);
  const empty = ACHIEVEMENT_PROGRESS_BAR_LENGTH - filled;
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
}

function getRpg(sources = {}) {
  const rpg = sources.rpg && typeof sources.rpg === 'object' ? sources.rpg : {};
  return {
    startedAt: normalizeStoredNonNegativeInteger(rpg.startedAt),
    level: normalizeStoredNonNegativeInteger(rpg.level, 1),
    bossKills: safeObject(rpg.bossKills),
    dungeonClears: safeObject(rpg.dungeonClears),
    craftedItems: normalizeStoredNonNegativeInteger(rpg.craftedItems)
  };
}

function getFishing(sources = {}) {
  const fishing = sources.fishing && typeof sources.fishing === 'object' ? sources.fishing : {};
  const collection = safeObject(fishing.collection);
  return {
    rod: {
      level: normalizeStoredNonNegativeInteger(fishing.rod?.level, 1)
    },
    stats: {
      totalCatches: normalizeStoredNonNegativeInteger(fishing.stats?.totalCatches)
    },
    collection,
    hiddenCollectionCount: Object.keys(collection)
      .filter((fishId) => String(fishId).startsWith('hidden_'))
      .length,
    battle: {
      wins: normalizeStoredNonNegativeInteger(fishing.battle?.wins)
    }
  };
}

function getSword(sources = {}) {
  const sword = sources.sword && typeof sources.sword === 'object' ? sources.sword : {};
  return {
    highestLevel: normalizeStoredNonNegativeInteger(sword.highestLevel),
    destructions: normalizeStoredNonNegativeInteger(sword.destructions),
    battleWins: normalizeStoredNonNegativeInteger(sword.battleWins)
  };
}

function getStocks(sources = {}) {
  const stocks = sources.stocks && typeof sources.stocks === 'object' ? sources.stocks : {};
  return {
    tradeCount: normalizeStoredNonNegativeInteger(stocks.tradeCount),
    leveragedTradeCount: normalizeStoredNonNegativeInteger(stocks.leveragedTradeCount),
    realizedProfit: normalizeStoredInteger(stocks.realizedProfit)
  };
}

function getTamagotchi(sources = {}) {
  const pet = sources.tamagotchi && typeof sources.tamagotchi === 'object' ? sources.tamagotchi : {};
  return {
    counters: {
      totalCareActions: normalizeStoredNonNegativeInteger(pet.counters?.totalCareActions),
      revivals: normalizeStoredNonNegativeInteger(pet.counters?.revivals)
    },
    codex: {
      dailyCompletions: normalizeStoredNonNegativeInteger(pet.codex?.dailyCompletions)
    },
    room: {
      unlockedItemIds: Array.isArray(pet.room?.unlockedItemIds) ? pet.room.unlockedItemIds : []
    },
    growth: {
      adultBranchId: typeof pet.growth?.adultBranchId === 'string' ? pet.growth.adultBranchId : null
    }
  };
}

function sumCounts(map) {
  return Object.values(safeObject(map)).reduce((sum, value) => sum + normalizeStoredNonNegativeInteger(value), 0);
}

function countKeys(map) {
  return Object.keys(safeObject(map)).length;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeStoredNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.max(0, number);
}

function normalizeStoredInteger(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return number;
}
