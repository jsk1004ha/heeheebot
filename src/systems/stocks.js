import {
  CURRENCY_STOCK,
  addStockBankruptcyDebt,
  cloneWallets,
  convertLegacyCurrencyAmountToGold,
  creditCurrency,
  creditCurrencyWithReceipt,
  debitCurrency,
  getCurrencyBalance,
  getStockBankruptcySummary,
  hasStockBankruptcyDebt,
  migrateLegacyWalletsToGold,
  normalizeWallets,
  repayStockBankruptcyDebt
} from './currencies.js';
import {
  getAccountUserIdsForGuild,
  getLinkedAccountUsername,
  getOrCreateLinkedAccountProfile,
  getOrCreateLinkedFeatureUserProfile,
  isAccountSelectionRequiredError
} from './accounts.js';
import {
  addMoney,
  compareMoney,
  formatMoney,
  normalizeStoredMoney,
  toCompatibleMoneyValue,
  toMoney
} from './money.js';

const DEFAULT_TICK_MS = 3 * 60 * 1000;
const DEFAULT_STOCK_ALERT_INTERVAL_MS = 60 * 1000;
const DEFAULT_FEE_BPS = 100;
const DEFAULT_LEVERAGE_FEE_BPS = 200;
const DEFAULT_LEVERAGE_EARLY_CLOSE_FEE_BPS = 200;
const DEFAULT_LEVERAGE_EARLY_CLOSE_PENALTY_BPS = 500;
const DEFAULT_LEVERAGE_EARLY_PROFIT_PENALTY_BPS = 9_000;
const MIN_LEVERAGE_DURATION_TURNS = 2;
const DEFAULT_LEVERAGE_DURATION_TURNS = 30;
const LONG_LEVERAGE_MIN_DURATION_TURNS = 30;
const MAX_LEVERAGE_DURATION_TURNS = 100;
const SHORT_DURATION_MAX_LEVERAGE = 10;
const MAX_LEVERAGE = 100;
const MAX_CATCH_UP_TICKS = 24;
const MIN_STOCK_PRICE = 10;
const RECENT_ORDER_LIMIT = 10;
const RECENT_ALERT_LIMIT = 10;
const RECENT_TRADE_LIMIT = 20;
const RECENT_NEWS_LIMIT = 20;
const RECENT_DIVIDEND_LIMIT = 10;
const PRICE_HISTORY_LIMIT = 48;
const AUTO_IPO_CHECK_TICKS = 5;
const UNIFIED_GOLD_STOCK_MIGRATION_VERSION = 1;
const DEFAULT_AUTO_IPO_CHANCE_BPS = 1_500;
const DEFAULT_MAX_DYNAMIC_STOCKS = 50;
const DEFAULT_DIVIDEND_INTERVAL_TICKS = 10;
const DEFAULT_DIVIDEND_REVIEW_INTERVAL_TICKS = 6;
const DEFAULT_DIVIDEND_CHANGE_CHANCE_BPS = 2_000;
const MARKET_DELISTED_STOCKS = Symbol('marketDelistedStocks');

const DIVIDEND_BPS_BY_RISK = Object.freeze({
  stable: 25,
  cyclical: 18,
  growth: 12,
  volatile: 10,
  meme: 6
});

const DIVIDEND_BPS_LIMITS_BY_RISK = Object.freeze({
  stable: Object.freeze({ min: 15, max: 45 }),
  cyclical: Object.freeze({ min: 8, max: 35 }),
  growth: Object.freeze({ min: 4, max: 28 }),
  volatile: Object.freeze({ min: 0, max: 30 }),
  meme: Object.freeze({ min: 0, max: 20 })
});

function getInitialDividendBps(definition) {
  const baseBps = getBaseDividendBps(definition);
  const spread = Math.max(1, Math.ceil(baseBps * 0.4));
  const offset = getStableStockNumber(`${definition.id}:initial-dividend`, -spread, spread);
  return clampDividendBps(baseBps + offset, definition);
}

function getBaseDividendBps(definition) {
  return DIVIDEND_BPS_BY_RISK[normalizeStockRisk(definition?.risk)] ?? DIVIDEND_BPS_BY_RISK.meme;
}

function clampDividendBps(value, definition) {
  const limits = DIVIDEND_BPS_LIMITS_BY_RISK[normalizeStockRisk(definition?.risk)] ?? DIVIDEND_BPS_LIMITS_BY_RISK.meme;
  return clampInteger(normalizeNonNegativeInteger(value), limits.min, limits.max);
}

const STOCK_DEFINITIONS = Object.freeze([
  stock('heejin_electronics', '희진전자', '전자', 'stable', 800, 800, 12),
  stock('heejin_bio', '희진바이오', '바이오', 'volatile', 520, 1300, 18),
  stock('heejin_mobility', '희진모빌리티', '모빌리티', 'growth', 610, 1000, 14),
  stock('jaesung_electronics', '재성전자', '전자', 'stable', 760, 850, 12),
  stock('jaesung_heavy', '재성중공업', '중공업', 'cyclical', 430, 950, 13),
  stock('jaesung_energy', '재성에너지', '에너지', 'cyclical', 690, 1100, 15),
  stock('junseo_kakao', '준서카카오', '플랫폼', 'meme', 1_050, 1500, 20),
  stock('junseo_construction', '준서건설', '건설', 'cyclical', 370, 900, 12),
  stock('junseo_games', '준서게임즈', '게임', 'growth', 580, 1400, 18),
  stock('jio_motors', '지오모터스', '자동차', 'growth', 720, 1200, 16),
  stock('jio_software', '지오소프트', 'IT', 'growth', 980, 1150, 14),
  stock('jio_pay', '지오페이', '핀테크', 'growth', 640, 1250, 16),
  stock('hyeongyeom_heavy', '현겸중공업', '중공업', 'cyclical', 460, 950, 12),
  stock('hyeongyeom_pharma', '현겸제약', '제약', 'volatile', 540, 1300, 17),
  stock('hyeongyeom_oilbank', '현겸오일뱅크', '에너지', 'cyclical', 830, 1000, 13),
  stock('jimin_pharma', '지민제약', '제약', 'volatile', 490, 1250, 17),
  stock('jimin_biologics', '지민바이오로직스', '바이오', 'volatile', 1_120, 1500, 20),
  stock('jimin_chemical', '지민화학', '화학', 'cyclical', 400, 900, 12),
  stock('yongha_energy', '용하에너지', '에너지', 'cyclical', 740, 1050, 14),
  stock('yongha_shipping', '용하해운', '해운', 'cyclical', 360, 1100, 15),
  stock('yongha_semiconductor', '용하반도체', '반도체', 'growth', 890, 1250, 17),
  stock('mingeon_financial', '민건금융지주', '금융', 'stable', 700, 700, 10),
  stock('mingeon_securities', '민건증권', '증권', 'meme', 530, 1350, 19),
  stock('mingeon_capital', '민건캐피탈', '금융', 'stable', 450, 850, 11),
  stock('dohye_games', '도혜게임즈', '게임', 'meme', 620, 1600, 22),
  stock('dohye_entertainment', '도혜엔터', '엔터', 'meme', 550, 1450, 20),
  stock('dohye_commerce', '도혜커머스', '커머스', 'growth', 680, 1100, 14, [], 'DHCO'),
  stock('seojeong_securities', '서정증권', '증권', 'stable', 640, 750, 10),
  stock('seojeong_trading', '서정물산', '물산', 'stable', 390, 800, 11),
  stock('seojeong_cloud', '서정클라우드', '클라우드', 'growth', 930, 1200, 15),
  stock('monkeynix', '원숭이닉스', '반도체', 'meme', 660, 1800, 25, ['원숭이하이닉스']),
  stock('monkey_electronics', '원숭이전자', '전자', 'meme', 590, 1700, 24),
  stock('monkey_bio', '원숭이바이오', '바이오', 'meme', 420, 1900, 26),
  stock('dohun_construction', '도훈건설', '건설', 'meme', 330, 1500, 22),
  stock('dohun_heavy', '도훈중공업', '중공업', 'cyclical', 410, 1050, 14),
  stock('dohun_steel', '도훈철강', '철강', 'meme', 290, 1650, 23),
  stock('heejin_ai', '희진AI', 'AI', 'growth', 1_240, 1450, 18, ['희진인공지능'], 'HEAI', { listedFromTick: 2 }),
  stock('jaesung_robotics', '재성로보틱스', '로봇', 'growth', 880, 1350, 17, [], 'JARO', { listedFromTick: 3 }),
  stock('junseo_streaming', '준서스트리밍', '플랫폼', 'meme', 760, 1650, 22, [], 'JUST', { listedFromTick: 4 }),
  stock('jio_quant', '지오퀀트', '핀테크', 'volatile', 1_180, 1500, 19, [], 'JIQU', { listedFromTick: 5 }),
  stock('hyeongyeom_defense', '현겸방산', '방산', 'cyclical', 930, 1000, 13, [], 'HYDE', { listedFromTick: 6 }),
  stock('jimin_foods', '지민푸드', '식품', 'stable', 540, 750, 10, [], 'JIFO', { listedFromTick: 7 }),
  stock('yongha_entertainment', '용하엔터', '엔터', 'meme', 690, 1550, 21, [], 'YHEN', { listedFromTick: 8 }),
  stock('mingeon_motors', '민건모터스', '자동차', 'growth', 810, 1200, 16, [], 'MIMO', { listedFromTick: 9 }),
  stock('dohye_cosmetics', '도혜화장품', '화장품', 'growth', 620, 1100, 14, [], 'DHBE', { listedFromTick: 10 }),
  stock('seojeong_medical', '서정메디컬', '의료기기', 'volatile', 730, 1450, 18, [], 'SEME', { listedFromTick: 11 }),
  stock('monkey_airlines', '원숭이항공', '항공', 'meme', 450, 1750, 25, ['원숭이항공사'], 'MOAI', { listedFromTick: 12 }),
  stock('dohun_reits', '도훈리츠', '부동산', 'stable', 510, 800, 11, [], 'DORE', { listedFromTick: 13 })
]);

const STOCKS_BY_ID = Object.freeze(Object.fromEntries(
  STOCK_DEFINITIONS.map((definition) => [definition.id, definition])
));

const STOCK_LOOKUP = Object.freeze(new Map(
  STOCK_DEFINITIONS.flatMap((definition) => [
    [normalizeLookupKey(definition.id), definition.id],
    [normalizeLookupKey(definition.name), definition.id],
    [normalizeLookupKey(definition.symbol), definition.id],
    ...definition.aliases.map((alias) => [normalizeLookupKey(alias), definition.id])
  ])
));

const PRE_MARKET_NEWS_TEMPLATES = Object.freeze({
  positive: Object.freeze({
    stable: Object.freeze([
      '{name}, 배당 검토 소식에 관심이 늘었습니다',
      '{name}, 실적 발표 일정이 나오며 거래량이 늘었습니다',
      '{name}, 장기 공급 계약 소식에 매수세가 들어왔습니다',
      '{name}, 자사주 매입 검토 소식에 투자심리가 좋아졌습니다',
      '{name}, 주요 거래처와 계약 논의가 이어지며 강세를 보였습니다',
      '{name}, 비용 절감 계획이 알려지며 수익 개선 기대가 커졌습니다',
      '{name}, 새 유통 채널 검토 소식에 관심 주문이 늘었습니다',
      '{name}, 현금흐름 개선 계획이 알려지며 저가 매수세가 들어왔습니다'
    ]),
    growth: Object.freeze([
      '{name}, 신제품 공개 예고에 성장 기대가 커졌습니다',
      '{name}, 새 서비스 안내 후 장중 강세를 보였습니다',
      '{name}, AI 협업 일정 공개에 기대감이 들어왔습니다',
      '{name}, 베타 테스트 확대 소식에 투자심리가 좋아졌습니다',
      '{name}, 해외 파트너 실증 일정에 새 매출 기대가 생겼습니다',
      '{name}, 구독 지표 발표를 앞두고 재평가 기대가 나왔습니다',
      '{name}, 새 기능 계획 공개에 성장 흐름이 주목받았습니다',
      '{name}, 클라우드 전환 성과 예고 후 매수 주문이 늘었습니다'
    ]),
    cyclical: Object.freeze([
      '{name}, 새 수주 논의 소식에 매수세가 들어왔습니다',
      '{name}, 원가 점검 자료 공개 뒤 이익 개선 기대가 나왔습니다',
      '{name}, 대형 프로젝트 일정 안내에 수주 기대가 살아났습니다',
      '{name}, 설비 가동률 발표 예고에 관심이 커졌습니다',
      '{name}, 공급망 정상화 소식에 투자심리가 좋아졌습니다',
      '{name}, 수주 잔고 발표를 앞두고 업종 매수세가 붙었습니다',
      '{name}, 원자재 비용 관리 계획에 비용 안정 기대가 커졌습니다',
      '{name}, 해외 프로젝트 점검 일정에 새 수익 기대가 나왔습니다'
    ]),
    volatile: Object.freeze([
      '{name}, 임상 데이터 공개 일정에 관심이 몰렸습니다',
      '{name}, 연구 성과 발표 예고에 기술 기대가 커졌습니다',
      '{name}, 기술 이전 논의 소식에 거래량이 늘었습니다',
      '{name}, 공동 연구 계약 검토 소식에 매수세가 들어왔습니다',
      '{name}, 특허 심사 일정 안내에 성장 기대가 커졌습니다',
      '{name}, 후속 실험 설명회 예고에 개발 일정이 주목받았습니다',
      '{name}, 데이터 검증 회의 일정에 투자심리가 좋아졌습니다',
      '{name}, 해외 학회 발표 소식에 연구 성과가 다시 주목받았습니다'
    ]),
    meme: Object.freeze([
      '{name}, 커뮤니티 이벤트 예고에 단기 매수세가 들어왔습니다',
      '{name}, 새 굿즈 공개 일정에 거래량이 늘었습니다',
      '{name}, 유명 스트리머 협업 소식에 개인 관심이 늘었습니다',
      '{name}, 팝업스토어 일정 공개에 브랜드 기대가 커졌습니다',
      '{name}, SNS 티저 공개 후 주가 움직임이 커졌습니다',
      '{name}, 팬 투표 상품 소식에 테마 매수세가 붙었습니다',
      '{name}, 라이브 커머스 일정 공개 뒤 단기 수급이 좋아졌습니다',
      '{name}, 커뮤니티 AMA 일정에 관심 종목으로 보는 투자자가 늘었습니다'
    ])
  }),
  negative: Object.freeze({
    stable: Object.freeze([
      '{name}, 비용 점검 소식에 관망세가 늘었습니다',
      '{name}, 배당 재검토 가능성에 차익실현 매물이 나왔습니다',
      '{name}, 고객사 발주 일정 조율 소식에 실적 걱정이 나왔습니다',
      '{name}, 판매관리비 증가 소식에 이익 부담이 거론됐습니다',
      '{name}, 주요 거래처 단가 협상 조정에 매수세가 약해졌습니다',
      '{name}, 재고 점검 보고서 공개 후 보수적 주문이 늘었습니다',
      '{name}, 실적 전망 보완 자료에 시장 기대가 낮아졌습니다',
      '{name}, 투자 계획 축소 안내 뒤 주가가 약세를 보였습니다'
    ]),
    growth: Object.freeze([
      '{name}, 신사업 출시 지연 가능성에 성장 기대가 줄었습니다',
      '{name}, 개발비 계획 변경 소식에 이익 부담이 커졌습니다',
      '{name}, 경쟁 심화 소식에 가격 부담이 거론됐습니다',
      '{name}, 이용자 성장 점검 자료에 매수세가 약해졌습니다',
      '{name}, 파트너 계약 재협의 안내 후 관망 주문이 늘었습니다',
      '{name}, 서버 증설 비용 이슈에 비용 걱정이 커졌습니다',
      '{name}, 새 서비스 안정화 계획에 성장 속도 확인이 필요하다는 말이 나왔습니다',
      '{name}, 마케팅 일정 조정 소식에 거래대금이 줄었습니다'
    ]),
    cyclical: Object.freeze([
      '{name}, 원자재 비용 점검 소식에 매도세가 늘었습니다',
      '{name}, 수주 일정 조정 가능성에 실적 걱정이 커졌습니다',
      '{name}, 경기 둔화 점검 보고서에 업종 경계 매물이 나왔습니다',
      '{name}, 물류비 변동 소식에 원가 부담이 다시 나왔습니다',
      '{name}, 현장 납기 일정 재안내 후 단기 수급이 약해졌습니다',
      '{name}, 설비 보수 기간 연장 가능성에 생산 차질 우려가 나왔습니다',
      '{name}, 해외 검수 일정 조정에 매출 시점이 변수로 떠올랐습니다',
      '{name}, 재고 손실 기준 안내 뒤 실적 기대가 낮아졌습니다'
    ]),
    volatile: Object.freeze([
      '{name}, 허가 심사 보완 가능성에 변동성이 커졌습니다',
      '{name}, 연구비 조달 보완 소식에 자금 걱정이 나왔습니다',
      '{name}, 핵심 데이터 공개 지연 가능성에 매수세가 약해졌습니다',
      '{name}, 후속 실험 일정 조정 뒤 일정 확인 심리가 커졌습니다',
      '{name}, 공동 연구 범위 변경에 기술 평가가 엇갈렸습니다',
      '{name}, 특허 의견서 일정 보완에 관망 주문이 늘었습니다',
      '{name}, 임상 등록 속도 점검 뒤 실적 기여가 늦어질 수 있다는 말이 나왔습니다',
      '{name}, 외부 검증 보고서 일정 조정에 거래대금이 줄었습니다'
    ]),
    meme: Object.freeze([
      '{name}, 커뮤니티 추가 공지 예고에 차익실현 매물이 나왔습니다',
      '{name}, 운영진 해명 공지 예고 뒤 주가 움직임이 커졌습니다',
      '{name}, 밈 캠페인 연기 가능성에 매수세가 약해졌습니다',
      '{name}, 굿즈 배송 재공지 예고에 테마 매매가 줄었습니다',
      '{name}, 라이브 방송 편성 변경 후 단기 수급이 흔들렸습니다',
      '{name}, 팬 이벤트 기준 보완 예고에 관망세가 늘었습니다',
      '{name}, SNS 운영 정책 변경 안내에 개인 주문이 줄었습니다',
      '{name}, 콜라보 상품 검수 일정 조정에 차익실현 물량이 나왔습니다'
    ])
  }),
  risk: Object.freeze({
    volatile: Object.freeze([
      '{name}, 거래소 자료 제출 일정 공지 뒤 변동성이 커졌습니다',
      '{name}, 핵심 파이프라인 추가 설명에 시장 의견이 갈렸습니다',
      '{name}, 자금 조달 보완 자료 접수 후 유동성 점검이 이어졌습니다',
      '{name}, 공시 정정 일정 안내에 투자자 문의가 늘었습니다',
      '{name}, 감사 관련 추가 설명 뒤 거래가 조심스럽게 이뤄졌습니다',
      '{name}, 유통 주식 수 확인 자료에 수급 점검이 이어졌습니다',
      '{name}, 보호예수 해제 일정에 단기 물량 부담이 거론됐습니다',
      '{name}, 외부 평가 답변서 접수에 공식 판단을 기다리는 분위기입니다'
    ]),
    meme: Object.freeze([
      '{name}, 거래소 자료 제출 일정 공지 뒤 호가가 흔들렸습니다',
      '{name}, 운영 관련 소명 가능성에 시장 의견이 갈렸습니다',
      '{name}, 커뮤니티 집계 방식 설명에 거래량이 불규칙하게 늘었습니다',
      '{name}, 유통 물량 확인 자료에 단기 수급 점검이 이어졌습니다',
      '{name}, 프로모션 정산 기준 설명 뒤 투자자 문의가 늘었습니다',
      '{name}, 제휴 채널 자료 제출 일정에 관망세가 늘었습니다',
      '{name}, 이벤트 집계 검증 자료 공개에 단기 매매가 빨라졌습니다',
      '{name}, 운영 지표 설명회 예고에 공식 판단을 기다리는 분위기입니다'
    ])
  })
});

const PRE_MARKET_NEWS_DETAIL_TEMPLATES = Object.freeze({
  positive: Object.freeze([
    '시장은 좋은 신호로 보고 있습니다',
    '실제 매출로 이어질지가 다음 관심사입니다',
    '큰손 매수는 제한적이지만 개인 매수세가 먼저 움직인 것으로 보입니다',
    '단기 상승보다 앞으로 이익이 좋아질지가 중요하다는 평가도 나옵니다'
  ]),
  negative: Object.freeze([
    '시장은 단기 비용 부담을 걱정하고 있습니다',
    '회사 측은 영향을 확인한 뒤 추가 안내를 낼 예정입니다',
    '최근 기대감이 가격에 먼저 담긴 만큼 차익실현 물량이 나온 것으로 보입니다',
    '투자자들은 다음 실적 발표를 기다리는 분위기입니다'
  ]),
  risk: Object.freeze([
    '공식 확인 전까지는 조심해야 한다는 의견도 나옵니다',
    '거래소와 회사 측은 필요한 자료를 확인하고 있습니다',
    '단기 주가보다 다음 공시 내용이 더 중요하다는 평가입니다',
    '투자자 문의는 자료 제출 범위와 유통 물량에 모였습니다'
  ])
});

const PRE_MARKET_NEWS_CONTEXT_TEMPLATES = Object.freeze({
  positive: Object.freeze([
    '원/달러 환율과 해외 기술주 흐름도 함께 참고됐습니다',
    '미국 금리와 AI 투자 흐름도 비교 변수로 언급됐습니다',
    '나스닥 선물과 국내 성장주 수급을 함께 보는 투자자가 늘었습니다',
    '실제 반도체·클라우드 업황과 VX마켓 수급이 함께 언급됐습니다',
    '가상거래소 VX마켓에서는 관련 업종 거래도 평소보다 늘었습니다'
  ]),
  negative: Object.freeze([
    '유가·운임·환율 같은 실제 지표도 함께 언급됐습니다',
    '미국 금리 발언과 원자재 가격 흐름이 비교 변수로 나왔습니다',
    '실제 업종 뉴스와 가상 종목 공시 일정이 함께 거론됐습니다',
    '시장 참가자들은 다음 가격과 거래량을 보며 관망했습니다',
    '가상거래소 VX마켓에서는 방어 주문보다 관망 주문이 많았습니다'
  ]),
  risk: Object.freeze([
    '거래소 공시 절차와 실제 감사 시즌 일정이 함께 비교됐습니다',
    '유통 물량과 보호예수 해제 같은 실제 시장 변수도 언급됐습니다',
    '가상거래소 VX마켓에서는 공식 확인 전까지 호가 간격이 넓었습니다',
    '시장 참가자들은 후속 자료와 거래 조건을 함께 확인하는 모습입니다',
    '외부 평가 일정과 내부 소명 절차가 가격 변수로 거론됐습니다'
  ])
});

const MARKET_SUMMARY_TEMPLATES = Object.freeze({
  surge: Object.freeze([
    '시황: {name}, 매수세가 몰리며 상승 폭을 키웠습니다',
    '시황: {name}, 거래량이 크게 늘며 강세를 보였습니다',
    '시황: {name}, 성장 기대가 커지며 매수세가 우세했습니다',
    '시황: {name}, 큰 주문이 들어오며 호가가 빠르게 움직였습니다',
    '시황: {name}, 장 마감까지 매수 주문이 유지됐습니다',
    '시황: {name}, {sector} 업종 안에서 거래대금이 크게 늘었습니다'
  ]),
  crash: Object.freeze([
    '시황: {name}, 차익실현 매물이 나오며 약세를 보였습니다',
    '시황: {name}, 실적 확인 심리가 커지며 매도세가 늘었습니다',
    '시황: {name}, 장중 반등이 오래가지 못했습니다',
    '시황: {name}, 거래량 증가 속에 매도 우위가 나타났습니다',
    '시황: {name}, {sector} 업종 경계감에 하락 마감했습니다',
    '시황: {name}, 마감 전 방어 매수가 부족했습니다'
  ]),
  positive: Object.freeze([
    '시황: {name}, 투자심리가 좋아지며 완만히 올랐습니다',
    '시황: {name}, 저가 매수세가 들어오며 흐름이 회복됐습니다',
    '시황: {name}, {sector} 업종 선호로 거래대금이 늘었습니다',
    '시황: {name}, 장 후반 매수 주문이 늘며 상승 전환했습니다',
    '시황: {name}, 최근 하락분 일부를 되돌렸습니다',
    '시황: {name}, 새 소식을 기다리는 매수 주문이 조금 늘었습니다'
  ]),
  negative: Object.freeze([
    '시황: {name}, 경계 매물이 늘며 약세를 보였습니다',
    '시황: {name}, 장중 반등분을 대부분 반납했습니다',
    '시황: {name}, {sector} 업종 관망세로 거래대금이 줄었습니다',
    '시황: {name}, 단기 매수세가 약해졌습니다',
    '시황: {name}, 마감 전 매도 주문이 두꺼워졌습니다',
    '시황: {name}, 이익 확인 심리에 투자자 주문이 둔화됐습니다'
  ]),
  quiet: Object.freeze([
    '시황: {name}, 시장은 발표 효과를 지켜보는 분위기입니다',
    '시황: {name}, 보합권에서 거래되며 다음 공시를 기다렸습니다',
    '시황: {name}, 좁은 가격 범위에서 안정적으로 움직였습니다',
    '시황: {name}, {sector} 업종 평균과 비슷한 흐름을 보였습니다',
    '시황: {name}, 관망세 속에 조용히 마감했습니다',
    '시황: {name}, 기대와 부담이 함께 있어 방향성이 제한됐습니다'
  ])
});

const MARKET_SUMMARY_DETAIL_TEMPLATES = Object.freeze({
  surge: Object.freeze([
    '장 후반까지 주문 변화가 잦았습니다',
    '체결 흐름이 평소보다 빨랐습니다',
    '같은 업종 종목보다 호가 이동이 빨랐습니다',
    '단기 힘은 강하지만 실적 확인이 필요하다는 평가가 나옵니다'
  ]),
  crash: Object.freeze([
    '마감 직전 호가 간격이 넓어졌습니다',
    '짧은 반등 뒤 대기 주문이 빠르게 줄었습니다',
    '같은 업종보다 관망 주문이 많았습니다',
    '이미 오른 가격에 대한 부담도 나왔습니다'
  ]),
  positive: Object.freeze([
    '매수 주문이 여러 가격대에 쌓였습니다',
    '장중 흐름은 완만한 회복세를 보였습니다',
    '같은 업종보다 체결 속도가 조금 빨랐습니다',
    '앞으로 이익이 좋아질지가 핵심 변수로 꼽힙니다'
  ]),
  negative: Object.freeze([
    '반등 구간마다 관망 주문이 늘었습니다',
    '장중 거래대금은 좁은 범위에서 움직였습니다',
    '같은 업종보다 체결 강도가 약했습니다',
    '실제 매출로 이어지기까지 시간이 필요하다는 분석도 나옵니다'
  ]),
  quiet: Object.freeze([
    '주문 흐름은 크게 쏠리지 않았습니다',
    '체결 가격대는 좁은 범위에 머물렀습니다',
    '투자자들은 다음 자료를 기다리는 모습입니다',
    '단기 주가보다 다음 공시 내용이 중요하다는 평가입니다'
  ])
});

const MARKET_SUMMARY_CONTEXT_TEMPLATES = Object.freeze({
  surge: Object.freeze([
    '원/달러 환율과 해외 성장주 흐름도 함께 참고됐습니다',
    '관심 종목 목록에 새로 담는 투자자가 늘었습니다',
    '단기 매매가 빨라졌습니다',
    '업종 안에서 비교 매수세가 함께 보였습니다',
    '가상거래소 VX마켓에서는 마감까지 호가가 촘촘했습니다'
  ]),
  crash: Object.freeze([
    '장 후반까지 방어 주문이 얇게 남았습니다',
    '단기 투자자들은 다음 기준가를 기다렸습니다',
    '업종 안에서 비교 매도세가 함께 보였습니다',
    '실제 유가·운임·금리 흐름도 투자심리에 영향을 준 것으로 보입니다',
    '체결 대기열은 낮은 가격대에 다시 쌓였습니다'
  ]),
  positive: Object.freeze([
    '관심 주문은 여러 가격대에 나뉘었습니다',
    '업종 내 순환매 흐름이 천천히 이어졌습니다',
    '나스닥 선물과 국내 기술주 흐름을 참고한 주문도 보였습니다',
    '단기 수급은 무리 없이 다음 장을 기다렸습니다',
    '체결 속도는 평균보다 조금 빨랐습니다'
  ]),
  negative: Object.freeze([
    '투자자들은 다음 가격대를 확인하며 관망했습니다',
    '업종 내 순환매가 다른 종목으로 이동했습니다',
    '체결 속도는 평균보다 조금 느렸습니다',
    '실제 원자재 가격과 환율 흐름이 비교 변수로 나왔습니다',
    '단기 수급은 낮은 가격대에서 다시 대기했습니다'
  ]),
  quiet: Object.freeze([
    '관심 주문은 평소 수준을 유지했습니다',
    '장중 체결은 좁은 가격대에서 반복됐습니다',
    '투자자들은 다음 자료 공개를 기다렸습니다',
    '업종 내 움직임과 큰 차이는 없었습니다',
    '현실 시장 지표와 가상 종목 공시가 함께 참고됐지만 방향성은 제한됐습니다'
  ])
});

const AUTO_IPO_PREFIXES = Object.freeze([
  '희진',
  '재성',
  '준서',
  '지오',
  '현겸',
  '지민',
  '용하',
  '민건',
  '도혜',
  '서정',
  '원숭이',
  '도훈'
]);

const AUTO_IPO_NAME_MODIFIERS = Object.freeze([
  '',
  '네오',
  '루나',
  '픽셀'
]);

const AUTO_IPO_THEMES = Object.freeze([
  Object.freeze({ suffix: 'AI랩스', sector: 'AI', risk: 'growth', basePriceMin: 650, basePriceMax: 1_600, volatilityBps: 1450, eventChance: 18 }),
  Object.freeze({ suffix: '로켓모빌리티', sector: '모빌리티', risk: 'meme', basePriceMin: 420, basePriceMax: 1_250, volatilityBps: 1700, eventChance: 24 }),
  Object.freeze({ suffix: '바이오텍', sector: '바이오', risk: 'volatile', basePriceMin: 380, basePriceMax: 1_450, volatilityBps: 1800, eventChance: 25 }),
  Object.freeze({ suffix: '클라우드', sector: '클라우드', risk: 'growth', basePriceMin: 700, basePriceMax: 1_500, volatilityBps: 1250, eventChance: 16 }),
  Object.freeze({ suffix: '푸드', sector: '식품', risk: 'stable', basePriceMin: 320, basePriceMax: 800, volatilityBps: 750, eventChance: 10 }),
  Object.freeze({ suffix: '엔터', sector: '엔터', risk: 'meme', basePriceMin: 450, basePriceMax: 1_200, volatilityBps: 1600, eventChance: 22 }),
  Object.freeze({ suffix: '리츠', sector: '부동산', risk: 'stable', basePriceMin: 350, basePriceMax: 900, volatilityBps: 800, eventChance: 11 }),
  Object.freeze({ suffix: '퀀트', sector: '핀테크', risk: 'volatile', basePriceMin: 500, basePriceMax: 1_700, volatilityBps: 1500, eventChance: 20 }),
  Object.freeze({ suffix: '반도체', sector: '반도체', risk: 'growth', basePriceMin: 780, basePriceMax: 1_800, volatilityBps: 1500, eventChance: 18 }),
  Object.freeze({ suffix: '로보틱스', sector: '로봇', risk: 'growth', basePriceMin: 620, basePriceMax: 1_550, volatilityBps: 1500, eventChance: 18 }),
  Object.freeze({ suffix: '게임즈', sector: '게임', risk: 'meme', basePriceMin: 360, basePriceMax: 1_300, volatilityBps: 1750, eventChance: 24 }),
  Object.freeze({ suffix: '커머스', sector: '커머스', risk: 'growth', basePriceMin: 420, basePriceMax: 1_250, volatilityBps: 1200, eventChance: 15 }),
  Object.freeze({ suffix: '페이', sector: '핀테크', risk: 'growth', basePriceMin: 520, basePriceMax: 1_500, volatilityBps: 1350, eventChance: 17 }),
  Object.freeze({ suffix: '오일뱅크', sector: '에너지', risk: 'cyclical', basePriceMin: 560, basePriceMax: 1_350, volatilityBps: 1100, eventChance: 14 }),
  Object.freeze({ suffix: '스틸', sector: '철강', risk: 'cyclical', basePriceMin: 300, basePriceMax: 950, volatilityBps: 1200, eventChance: 15 }),
  Object.freeze({ suffix: '해운', sector: '해운', risk: 'cyclical', basePriceMin: 280, basePriceMax: 1_050, volatilityBps: 1300, eventChance: 16 }),
  Object.freeze({ suffix: '건설', sector: '건설', risk: 'cyclical', basePriceMin: 300, basePriceMax: 1_000, volatilityBps: 1150, eventChance: 14 }),
  Object.freeze({ suffix: '디펜스', sector: '방산', risk: 'cyclical', basePriceMin: 700, basePriceMax: 1_600, volatilityBps: 1000, eventChance: 13 }),
  Object.freeze({ suffix: '메디컬', sector: '의료기기', risk: 'volatile', basePriceMin: 420, basePriceMax: 1_450, volatilityBps: 1600, eventChance: 20 }),
  Object.freeze({ suffix: '제약', sector: '제약', risk: 'volatile', basePriceMin: 380, basePriceMax: 1_500, volatilityBps: 1700, eventChance: 22 }),
  Object.freeze({ suffix: '케미칼', sector: '화학', risk: 'cyclical', basePriceMin: 320, basePriceMax: 1_050, volatilityBps: 1100, eventChance: 13 }),
  Object.freeze({ suffix: '화장품', sector: '화장품', risk: 'growth', basePriceMin: 360, basePriceMax: 1_150, volatilityBps: 1150, eventChance: 15 }),
  Object.freeze({ suffix: '항공', sector: '항공', risk: 'meme', basePriceMin: 300, basePriceMax: 1_100, volatilityBps: 1600, eventChance: 22 }),
  Object.freeze({ suffix: '스트리밍', sector: '플랫폼', risk: 'meme', basePriceMin: 460, basePriceMax: 1_400, volatilityBps: 1650, eventChance: 23 }),
  Object.freeze({ suffix: '소프트', sector: 'IT', risk: 'growth', basePriceMin: 650, basePriceMax: 1_600, volatilityBps: 1250, eventChance: 16 }),
  Object.freeze({ suffix: '일렉트릭', sector: '전자', risk: 'stable', basePriceMin: 520, basePriceMax: 1_250, volatilityBps: 850, eventChance: 11 }),
  Object.freeze({ suffix: '중공업', sector: '중공업', risk: 'cyclical', basePriceMin: 330, basePriceMax: 1_050, volatilityBps: 1200, eventChance: 14 }),
  Object.freeze({ suffix: '증권', sector: '증권', risk: 'meme', basePriceMin: 350, basePriceMax: 1_300, volatilityBps: 1650, eventChance: 22 }),
  Object.freeze({ suffix: '캐피탈', sector: '금융', risk: 'stable', basePriceMin: 420, basePriceMax: 1_000, volatilityBps: 800, eventChance: 10 }),
  Object.freeze({ suffix: '물산', sector: '물산', risk: 'stable', basePriceMin: 300, basePriceMax: 850, volatilityBps: 900, eventChance: 11 }),
  Object.freeze({ suffix: '모터스', sector: '자동차', risk: 'growth', basePriceMin: 560, basePriceMax: 1_450, volatilityBps: 1300, eventChance: 17 }),
  Object.freeze({ suffix: '밈팩토리', sector: '밈', risk: 'meme', basePriceMin: 250, basePriceMax: 1_000, volatilityBps: 1900, eventChance: 26 }),
  Object.freeze({ suffix: 'AI스튜디오', sector: 'AI', risk: 'growth', basePriceMin: 620, basePriceMax: 1_700, volatilityBps: 1500, eventChance: 19 }),
  Object.freeze({ suffix: '스마트모빌리티', sector: '모빌리티', risk: 'growth', basePriceMin: 480, basePriceMax: 1_350, volatilityBps: 1450, eventChance: 18 }),
  Object.freeze({ suffix: '바이오팜', sector: '바이오', risk: 'volatile', basePriceMin: 360, basePriceMax: 1_550, volatilityBps: 1850, eventChance: 25 }),
  Object.freeze({ suffix: '데이터클라우드', sector: '클라우드', risk: 'growth', basePriceMin: 720, basePriceMax: 1_650, volatilityBps: 1300, eventChance: 17 }),
  Object.freeze({ suffix: '푸드테크', sector: '식품', risk: 'growth', basePriceMin: 340, basePriceMax: 950, volatilityBps: 950, eventChance: 12 }),
  Object.freeze({ suffix: '미디어엔터', sector: '엔터', risk: 'meme', basePriceMin: 420, basePriceMax: 1_300, volatilityBps: 1650, eventChance: 23 }),
  Object.freeze({ suffix: '타워리츠', sector: '부동산', risk: 'stable', basePriceMin: 360, basePriceMax: 980, volatilityBps: 850, eventChance: 11 }),
  Object.freeze({ suffix: '알파퀀트', sector: '핀테크', risk: 'volatile', basePriceMin: 540, basePriceMax: 1_800, volatilityBps: 1550, eventChance: 21 }),
  Object.freeze({ suffix: '칩스', sector: '반도체', risk: 'growth', basePriceMin: 760, basePriceMax: 1_900, volatilityBps: 1550, eventChance: 19 }),
  Object.freeze({ suffix: '오토메이션', sector: '로봇', risk: 'growth', basePriceMin: 600, basePriceMax: 1_650, volatilityBps: 1500, eventChance: 18 }),
  Object.freeze({ suffix: '이스포츠', sector: '게임', risk: 'meme', basePriceMin: 320, basePriceMax: 1_250, volatilityBps: 1800, eventChance: 25 }),
  Object.freeze({ suffix: '마켓플레이스', sector: '커머스', risk: 'growth', basePriceMin: 400, basePriceMax: 1_350, volatilityBps: 1250, eventChance: 16 }),
  Object.freeze({ suffix: '월렛', sector: '핀테크', risk: 'growth', basePriceMin: 500, basePriceMax: 1_550, volatilityBps: 1400, eventChance: 18 }),
  Object.freeze({ suffix: '그린에너지', sector: '에너지', risk: 'cyclical', basePriceMin: 520, basePriceMax: 1_450, volatilityBps: 1150, eventChance: 15 }),
  Object.freeze({ suffix: '메탈', sector: '철강', risk: 'cyclical', basePriceMin: 280, basePriceMax: 1_000, volatilityBps: 1250, eventChance: 15 }),
  Object.freeze({ suffix: '로지스해운', sector: '해운', risk: 'cyclical', basePriceMin: 300, basePriceMax: 1_120, volatilityBps: 1350, eventChance: 16 }),
  Object.freeze({ suffix: '인프라건설', sector: '건설', risk: 'cyclical', basePriceMin: 320, basePriceMax: 1_080, volatilityBps: 1150, eventChance: 14 }),
  Object.freeze({ suffix: '에어로디펜스', sector: '방산', risk: 'cyclical', basePriceMin: 740, basePriceMax: 1_700, volatilityBps: 1050, eventChance: 14 }),
  Object.freeze({ suffix: '헬스케어', sector: '의료기기', risk: 'volatile', basePriceMin: 430, basePriceMax: 1_520, volatilityBps: 1600, eventChance: 20 }),
  Object.freeze({ suffix: '신약연구소', sector: '제약', risk: 'volatile', basePriceMin: 400, basePriceMax: 1_650, volatilityBps: 1750, eventChance: 23 }),
  Object.freeze({ suffix: '소재화학', sector: '화학', risk: 'cyclical', basePriceMin: 330, basePriceMax: 1_120, volatilityBps: 1150, eventChance: 14 }),
  Object.freeze({ suffix: '뷰티랩', sector: '화장품', risk: 'growth', basePriceMin: 340, basePriceMax: 1_200, volatilityBps: 1200, eventChance: 16 }),
  Object.freeze({ suffix: '에어라인', sector: '항공', risk: 'meme', basePriceMin: 280, basePriceMax: 1_150, volatilityBps: 1650, eventChance: 23 }),
  Object.freeze({ suffix: '숏폼플랫폼', sector: '플랫폼', risk: 'meme', basePriceMin: 440, basePriceMax: 1_500, volatilityBps: 1700, eventChance: 24 }),
  Object.freeze({ suffix: '시스템즈', sector: 'IT', risk: 'growth', basePriceMin: 620, basePriceMax: 1_650, volatilityBps: 1300, eventChance: 17 }),
  Object.freeze({ suffix: '가전일렉트릭', sector: '전자', risk: 'stable', basePriceMin: 500, basePriceMax: 1_300, volatilityBps: 900, eventChance: 12 }),
  Object.freeze({ suffix: '플랜트중공업', sector: '중공업', risk: 'cyclical', basePriceMin: 340, basePriceMax: 1_120, volatilityBps: 1250, eventChance: 15 }),
  Object.freeze({ suffix: '트레이딩증권', sector: '증권', risk: 'meme', basePriceMin: 330, basePriceMax: 1_350, volatilityBps: 1700, eventChance: 23 }),
  Object.freeze({ suffix: '파이낸셜', sector: '금융', risk: 'stable', basePriceMin: 430, basePriceMax: 1_050, volatilityBps: 820, eventChance: 10 }),
  Object.freeze({ suffix: '글로벌물산', sector: '물산', risk: 'stable', basePriceMin: 310, basePriceMax: 900, volatilityBps: 920, eventChance: 11 }),
  Object.freeze({ suffix: '이모션모터스', sector: '자동차', risk: 'growth', basePriceMin: 540, basePriceMax: 1_500, volatilityBps: 1350, eventChance: 18 }),
  Object.freeze({ suffix: '밈스튜디오', sector: '밈', risk: 'meme', basePriceMin: 240, basePriceMax: 1_050, volatilityBps: 1950, eventChance: 27 })
]);

const AUTO_IPO_PREFIX_SYMBOLS = Object.freeze({
  희진: 'HJ',
  재성: 'JS',
  준서: 'JN',
  지오: 'JI',
  현겸: 'HY',
  지민: 'JM',
  용하: 'YH',
  민건: 'MG',
  도혜: 'DH',
  서정: 'SJ',
  원숭이: 'MO',
  도훈: 'DO'
});

const AUTO_IPO_SECTOR_SYMBOLS = Object.freeze({
  AI: 'AI',
  IT: 'IT',
  모빌리티: 'MB',
  바이오: 'BI',
  클라우드: 'CL',
  식품: 'FD',
  엔터: 'EN',
  부동산: 'RE',
  핀테크: 'FT',
  전자: 'EL',
  중공업: 'HI',
  에너지: 'EG',
  플랫폼: 'PF',
  건설: 'CN',
  게임: 'GM',
  자동차: 'AU',
  제약: 'PH',
  화학: 'CH',
  해운: 'SH',
  반도체: 'SC',
  금융: 'FN',
  증권: 'SE',
  커머스: 'CM',
  물산: 'TR',
  로봇: 'RB',
  방산: 'DF',
  화장품: 'BE',
  의료기기: 'MD',
  항공: 'AR',
  철강: 'ST',
  밈: 'MM'
});

export class StockService {
  constructor(store, options = {}) {
    const hasCustomRandomInt = options.randomInt !== undefined;
    this.store = store;
    this.randomInt = options.randomInt ?? randomInt;
    this.ipoRandomInt = options.ipoRandomInt ?? (hasCustomRandomInt ? null : randomInt);
    this.tickMs = options.tickMs ?? DEFAULT_TICK_MS;
    this.feeBps = options.feeBps ?? DEFAULT_FEE_BPS;
    this.leverageFeeBps = options.leverageFeeBps ?? DEFAULT_LEVERAGE_FEE_BPS;
    this.leverageEarlyCloseFeeBps = options.leverageEarlyCloseFeeBps ?? DEFAULT_LEVERAGE_EARLY_CLOSE_FEE_BPS;
    this.leverageEarlyClosePenaltyBps = options.leverageEarlyClosePenaltyBps ?? DEFAULT_LEVERAGE_EARLY_CLOSE_PENALTY_BPS;
    this.leverageEarlyProfitPenaltyBps = options.leverageEarlyProfitPenaltyBps ?? DEFAULT_LEVERAGE_EARLY_PROFIT_PENALTY_BPS;
    this.autoIpoChanceBps = options.autoIpoChanceBps ?? (hasCustomRandomInt ? 0 : DEFAULT_AUTO_IPO_CHANCE_BPS);
    this.maxDynamicStocks = options.maxDynamicStocks ?? DEFAULT_MAX_DYNAMIC_STOCKS;
    this.dividendIntervalTicks = normalizePositiveStoredInteger(
      options.dividendIntervalTicks,
      DEFAULT_DIVIDEND_INTERVAL_TICKS
    );
    this.dividendReviewIntervalTicks = normalizePositiveStoredInteger(
      options.dividendReviewIntervalTicks,
      DEFAULT_DIVIDEND_REVIEW_INTERVAL_TICKS
    );
    this.dividendChangeChanceBps = clampInteger(
      normalizeNonNegativeInteger(options.dividendChangeChanceBps ?? DEFAULT_DIVIDEND_CHANGE_CHANCE_BPS),
      0,
      10_000
    );
  }

  async getMarket({ guildId, now = Date.now(), limit = null } = {}) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      return cloneMarket(market, limit);
    });
  }

  async getQuote({ guildId, stockId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      return getListedQuote(normalizedStockId, market);
    });
  }

  async getListings({ guildId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      return buildListingSummary(market, guild);
    });
  }

  async buyStock({ guildId, userId, username, stockId, quantity, now = Date.now() }) {
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const quote = getTradableQuote(normalizedStockId, market);
      const subtotal = quote.price * normalizedQuantity;
      const fee = calculateFee(subtotal, this.feeBps);
      const totalCost = subtotal + fee;

      if (compareMoney(getCurrencyBalance(profile, CURRENCY_STOCK), totalCost) < 0) {
        throw new Error(`골드가 부족합니다. 필요 금액: ${totalCost.toLocaleString()}골드`);
      }

      const holding = stockUser.holdings[normalizedStockId] ?? createEmptyHolding();
      const beforeQuantity = holding.quantity;
      const afterQuantity = beforeQuantity + normalizedQuantity;
      const beforeCost = holding.averageCost * beforeQuantity;
      const afterCost = beforeCost + subtotal;

      debitCurrency(profile, CURRENCY_STOCK, totalCost);
      stockUser.tradeCount += 1;
      stockUser.lastTradeAt = now;
      stockUser.holdings[normalizedStockId] = {
        quantity: afterQuantity,
        averageCost: Math.round(afterCost / afterQuantity)
      };
      recordTrade(stockUser, {
        type: 'buy',
        stockId: normalizedStockId,
        stock: quote,
        quantity: normalizedQuantity,
        price: quote.price,
        fee,
        total: totalCost,
        realizedProfit: 0,
        at: now
      });

      return {
        type: 'buy',
        stock: quote,
        stockId: normalizedStockId,
        quantity: normalizedQuantity,
        price: quote.price,
        subtotal,
        fee,
        totalCost,
        profile: cloneMoneyProfile(profile),
        holding: cloneHolding(stockUser.holdings[normalizedStockId])
      };
    });
  }

  async sellStock({ guildId, userId, username, stockId, quantity, now = Date.now() }) {
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const holding = stockUser.holdings[normalizedStockId];

      if (!holding || holding.quantity < normalizedQuantity) {
        throw new Error('보유 주식 수량이 부족합니다.');
      }

      const quote = cloneQuote(normalizedStockId, market.symbols[normalizedStockId]);
      const subtotal = quote.price * normalizedQuantity;
      const fee = calculateFee(subtotal, this.feeBps);
      const proceeds = subtotal - fee;
      const realizedProfit = proceeds - holding.averageCost * normalizedQuantity;
      const remainingQuantity = holding.quantity - normalizedQuantity;

      const credit = creditCurrencyWithReceipt(profile, CURRENCY_STOCK, proceeds);
      stockUser.realizedProfit += realizedProfit;
      stockUser.tradeCount += 1;
      stockUser.lastTradeAt = now;

      if (remainingQuantity <= 0) {
        delete stockUser.holdings[normalizedStockId];
      } else {
        stockUser.holdings[normalizedStockId] = {
          quantity: remainingQuantity,
          averageCost: holding.averageCost
        };
      }
      recordTrade(stockUser, {
        type: 'sell',
        stockId: normalizedStockId,
        stock: quote,
        quantity: normalizedQuantity,
        price: quote.price,
        fee,
        total: proceeds,
        realizedProfit,
        at: now
      });

      return {
        type: 'sell',
        stock: quote,
        stockId: normalizedStockId,
        quantity: normalizedQuantity,
        price: quote.price,
        subtotal,
        fee,
        proceeds,
        repayment: credit.repayment,
        netProceeds: credit.net,
        bankruptcy: credit.bankruptcy,
        realizedProfit,
        profile: cloneMoneyProfile(profile),
        holding: cloneHolding(stockUser.holdings[normalizedStockId] ?? createEmptyHolding()),
        stockUser: cloneStockUser(stockUser)
      };
    });
  }

  async placeLimitOrder({
    guildId,
    userId,
    username,
    stockId,
    side = 'buy',
    quantity,
    limitPrice,
    now = Date.now()
  }) {
    const normalizedSide = normalizeLimitOrderSide(side);
    const normalizedQuantity = normalizePositiveInteger(quantity, '수량');
    const normalizedLimitPrice = normalizePositiveInteger(limitPrice, '지정가');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const quote = getTradableQuote(normalizedStockId, market);
      const order = {
        id: createStockOrderId(now, stockUser.nextOrderSeq + 1),
        userId,
        username: username || stockUser.username,
        stockId: normalizedStockId,
        side: normalizedSide,
        quantity: normalizedQuantity,
        limitPrice: normalizedLimitPrice,
        status: 'open',
        createdAt: normalizeNonNegativeInteger(now),
        filledAt: 0,
        cancelledAt: 0,
        fillPrice: 0,
        fee: 0,
        reservedCash: 0,
        reservedQuantity: 0,
        averageCost: 0,
        realizedProfit: 0,
        cancelReason: null
      };

      if (normalizedSide === 'buy') {
        const subtotal = normalizedLimitPrice * normalizedQuantity;
        const fee = calculateFee(subtotal, this.feeBps);
        const reservedCash = subtotal + fee;
        if (compareMoney(getCurrencyBalance(profile, CURRENCY_STOCK), reservedCash) < 0) {
          throw new Error(`골드가 부족합니다. 필요 예약금: ${reservedCash.toLocaleString()}골드`);
        }
        debitCurrency(profile, CURRENCY_STOCK, reservedCash);
        order.reservedCash = reservedCash;
      } else {
        const holding = stockUser.holdings[normalizedStockId];
        if (!holding || holding.quantity < normalizedQuantity) {
          throw new Error('보유 주식 수량이 부족합니다.');
        }
        order.reservedQuantity = normalizedQuantity;
        order.averageCost = holding.averageCost;
        removeHolding(stockUser, normalizedStockId, normalizedQuantity);
      }

      stockUser.nextOrderSeq += 1;
      stockUser.limitOrders[order.id] = order;

      return cloneLimitOrder(order, market, quote);
    });
  }

  async getLimitOrders({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      return buildLimitOrderSummary(stockUser, market);
    });
  }

  async cancelLimitOrder({ guildId, userId, username, orderId, now = Date.now() }) {
    const normalizedOrderId = String(orderId ?? '').trim();
    if (!normalizedOrderId) throw new Error('주문 id를 입력하세요.');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const order = stockUser.limitOrders[normalizedOrderId];

      if (!order) throw new Error('해당 지정가 주문을 찾을 수 없습니다.');
      if (order.status !== 'open') throw new Error('이미 체결되었거나 취소된 주문입니다.');

      cancelOpenLimitOrder(profile, stockUser, order, now, '사용자 취소');
      return cloneLimitOrder(order, market);
    });
  }

  async setPriceAlert({
    guildId,
    userId,
    username,
    stockId,
    condition = 'above',
    targetPrice,
    channelId = null,
    now = Date.now()
  }) {
    const normalizedCondition = normalizeAlertCondition(condition);
    const normalizedTargetPrice = normalizePositiveInteger(targetPrice, '알림 가격');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const quote = getTradableQuote(normalizedStockId, market);
      const alert = {
        id: createStockAlertId(now, stockUser.nextAlertSeq + 1),
        guildId,
        userId,
        username: username || stockUser.username,
        guildId,
        stockId: normalizedStockId,
        condition: normalizedCondition,
        targetPrice: normalizedTargetPrice,
        channelId: normalizeOptionalStringId(channelId),
        status: 'active',
        createdAt: normalizeNonNegativeInteger(now),
        triggeredAt: 0,
        triggeredPrice: 0,
        notifiedAt: 0,
        deletedAt: 0
      };

      stockUser.nextAlertSeq += 1;
      stockUser.priceAlerts[alert.id] = alert;
      return clonePriceAlert(alert, market, quote);
    });
  }

  async getPriceAlerts({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      return buildPriceAlertSummary(stockUser, market);
    });
  }

  async deletePriceAlert({ guildId, userId, username, alertId, now = Date.now() }) {
    const normalizedAlertId = String(alertId ?? '').trim();
    if (!normalizedAlertId) throw new Error('알림 id를 입력하세요.');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const alert = stockUser.priceAlerts[normalizedAlertId];

      if (!alert) throw new Error('해당 가격 알림을 찾을 수 없습니다.');
      alert.status = 'deleted';
      alert.deletedAt = normalizeNonNegativeInteger(now);
      return clonePriceAlert(alert, market);
    });
  }

  async getPendingTriggeredPriceAlerts({ guildId, now = Date.now(), limit = RECENT_ALERT_LIMIT } = {}) {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || RECENT_ALERT_LIMIT));

    return this.store.update((data) => {
      const guild = getExistingGuild(data, guildId);
      if (!guild?.stocks) return [];

      const market = syncMarket(data, guildId, guild, now, this);
      const pending = [];

      for (const [userId, rawStockUser] of Object.entries(guild.stocks.users ?? {})) {
        const username = rawStockUser?.username ?? getLinkedAccountUsername(data, userId);
        const profile = getOptionalMoneyProfile(data, guildId, userId, username, now);
        if (!profile) continue;
        const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);

        for (const alert of Object.values(stockUser.priceAlerts)) {
          if (alert.guildId && alert.guildId !== guildId) continue;
          if (alert.status !== 'triggered' || alert.notifiedAt > 0 || !alert.channelId) continue;
          if (alert.guildId && alert.guildId !== guildId) continue;
          pending.push(clonePriceAlert(alert, market));
        }
      }

      return pending
        .sort((a, b) => (a.triggeredAt - b.triggeredAt) || a.id.localeCompare(b.id))
        .slice(0, safeLimit);
    });
  }

  async getPendingTriggeredPriceAlertsByGuild({ guildIds = [], now = Date.now(), limitPerGuild = RECENT_ALERT_LIMIT } = {}) {
    const normalizedGuildIds = [...new Set(
      (Array.isArray(guildIds) ? guildIds : [])
        .map((guildId) => String(guildId ?? '').trim())
        .filter(Boolean)
    )];
    const safeLimit = Math.min(50, Math.max(1, Number(limitPerGuild) || RECENT_ALERT_LIMIT));

    if (normalizedGuildIds.length === 0) return {};

    return this.store.update((data) => {
      const primaryGuildId = normalizedGuildIds[0];
      const guild = getExistingGuild(data, primaryGuildId);
      if (!guild?.stocks) return Object.fromEntries(normalizedGuildIds.map((guildId) => [guildId, []]));

      const market = syncMarket(data, primaryGuildId, guild, now, this);
      const guildIdSet = new Set(normalizedGuildIds);
      const pendingByGuild = Object.fromEntries(normalizedGuildIds.map((guildId) => [guildId, []]));

      for (const rawStockUser of Object.values(guild.stocks.users ?? {})) {
        const stockUser = normalizeStockUserForAlertScan(rawStockUser, guild);

        for (const alert of Object.values(stockUser.priceAlerts)) {
          if (!alert.guildId || !guildIdSet.has(alert.guildId)) continue;
          if (alert.status !== 'triggered' || alert.notifiedAt > 0 || !alert.channelId) continue;
          pendingByGuild[alert.guildId].push(clonePriceAlert(alert, market));
        }
      }

      for (const guildId of normalizedGuildIds) {
        pendingByGuild[guildId] = pendingByGuild[guildId]
          .sort((a, b) => (a.triggeredAt - b.triggeredAt) || a.id.localeCompare(b.id))
          .slice(0, safeLimit);
      }

      return pendingByGuild;
    });
  }

  async markPriceAlertNotified({ guildId, userId, alertId, now = Date.now() }) {
    const normalizedAlertId = String(alertId ?? '').trim();
    if (!normalizedAlertId) throw new Error('알림 id를 입력하세요.');

    return this.store.update((data) => {
      const guild = getExistingGuild(data, guildId);
      if (!guild?.stocks?.users?.[userId]) {
        throw new Error('해당 가격 알림을 찾을 수 없습니다.');
      }

      const market = syncMarket(data, guildId, guild, now, this);
      const username = getLinkedAccountUsername(data, userId);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const alert = stockUser.priceAlerts[normalizedAlertId];

      if (!alert || alert.status !== 'triggered' || (alert.guildId && alert.guildId !== guildId)) {
        throw new Error('해당 가격 알림을 찾을 수 없습니다.');
      }

      alert.notifiedAt = normalizeNonNegativeInteger(now);
      return clonePriceAlert(alert, market);
    });
  }

  async markPriceAlertsNotifiedBatch({ alerts = [], now = Date.now() } = {}) {
    const normalizedAlerts = normalizePriceAlertNotificationBatch(alerts);
    if (normalizedAlerts.length === 0) return [];
    const safeNow = normalizeNonNegativeInteger(now);

    return this.store.update((data) => {
      const guildCache = new Map();
      const marketCache = new Map();
      const notified = [];
      const seen = new Set();

      for (const item of normalizedAlerts) {
        const key = `${item.guildId}:${item.userId}:${item.alertId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let guild = guildCache.get(item.guildId);
        if (!guildCache.has(item.guildId)) {
          guild = getExistingGuild(data, item.guildId);
          guildCache.set(item.guildId, guild);
        }
        if (!guild?.stocks) continue;

        let market = marketCache.get(item.guildId);
        if (!marketCache.has(item.guildId)) {
          market = syncMarket(data, item.guildId, guild, safeNow, this);
          marketCache.set(item.guildId, market);
        }

        const username = getLinkedAccountUsername(data, item.userId);
        const profile = getOrCreateMoneyProfile(data, item.guildId, item.userId, username, safeNow);
        const stockUser = getOrCreateStockUser(data, item.guildId, guild, item.userId, username, profile, safeNow);
        const alert = stockUser.priceAlerts[item.alertId];

        if (!alert || alert.status !== 'triggered' || (alert.guildId && alert.guildId !== item.guildId)) {
          continue;
        }

        alert.notifiedAt = safeNow;
        notified.push(clonePriceAlert(alert, market));
      }

      return notified;
    });
  }

  async getTradeHistory({ guildId, userId, username, limit = RECENT_TRADE_LIMIT, now = Date.now() }) {
    const safeLimit = Math.min(RECENT_TRADE_LIMIT, Math.max(1, Number(limit) || RECENT_TRADE_LIMIT));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      settleMaturedLeveragedPositions(profile, stockUser, market);

      return {
        userId: stockUser.userId,
        username: stockUser.username,
        entries: stockUser.tradeHistory
          .map((entry) => cloneTradeHistoryEntry(entry, market))
          .sort(compareTimelineEntries)
          .slice(0, safeLimit)
      };
    });
  }

  async getNews({ guildId, limit = RECENT_NEWS_LIMIT, now = Date.now() }) {
    const safeLimit = Math.min(RECENT_NEWS_LIMIT, Math.max(1, Number(limit) || RECENT_NEWS_LIMIT));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);

      return {
        tickIndex: market.tickIndex,
        entries: normalizeMarketNews(guild.stocks.marketNews, guild)
          .map((entry) => cloneMarketNewsEntry(entry, market))
          .sort(compareMarketNewsEntries)
          .slice(0, safeLimit)
      };
    });
  }

  async getDividendSummary({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      settleMaturedLeveragedPositions(profile, stockUser, market);
      return buildDividendSummary(profile, stockUser, market, this);
    });
  }

  async claimDividends({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      settleMaturedLeveragedPositions(profile, stockUser, market);

      const claimedAmount = normalizeNonNegativeInteger(stockUser.pendingDividends);
      if (claimedAmount > 0) {
        creditCurrency(profile, CURRENCY_STOCK, claimedAmount);
        stockUser.pendingDividends = 0;
        stockUser.claimedDividends += claimedAmount;
      }

      return buildDividendSummary(profile, stockUser, market, this, claimedAmount);
    });
  }

  async getChart({ guildId, stockId, points = 12, now = Date.now() }) {
    const safePoints = Math.min(PRICE_HISTORY_LIMIT, Math.max(2, Number(points) || 12));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const stock = getListedQuote(normalizedStockId, market);
      const history = normalizePriceHistory(market.symbols[normalizedStockId]?.history, market.symbols[normalizedStockId], market.tickIndex, market.lastTickAt)
        .slice(-safePoints);

      return {
        stock,
        history
      };
    });
  }

  async openLeveragedPosition({
    guildId,
    userId,
    username,
    stockId,
    side = 'long',
    leverage,
    margin,
    durationTurns = DEFAULT_LEVERAGE_DURATION_TURNS,
    now = Date.now()
  }) {
    const normalizedSide = normalizeLeverageSide(side);
    const normalizedLeverage = normalizeLeverage(leverage);
    const normalizedDurationTurns = normalizeLeverageDurationTurns(durationTurns);
    assertLeverageAllowedForDuration(normalizedLeverage, normalizedDurationTurns);
    const normalizedMargin = normalizePositiveInteger(margin, '증거금');

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const settled = settleMaturedLeveragedPositions(profile, stockUser, market);
      const quote = getTradableQuote(normalizedStockId, market);
      const fee = calculateFee(normalizedMargin, this.leverageFeeBps);
      const totalCost = normalizedMargin + fee;
      const exposure = calculateLeveragedExposure(normalizedMargin, normalizedLeverage);

      assertNoOpposingLeveragedPosition(stockUser, normalizedStockId, normalizedSide, quote);
      assertNoStockBankruptcyDebt(profile);

      if (compareMoney(getCurrencyBalance(profile, CURRENCY_STOCK), totalCost) < 0) {
        throw new Error(`골드가 부족합니다. 필요 금액: ${totalCost.toLocaleString()}골드`);
      }

      debitCurrency(profile, CURRENCY_STOCK, totalCost);
      stockUser.nextPositionSeq += 1;
      stockUser.leveragedTradeCount += 1;
      stockUser.lastTradeAt = now;

      const position = {
        id: createLeveragedPositionId(now, stockUser.nextPositionSeq),
        stockId: normalizedStockId,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin,
        notional: exposure.notional,
        debt: exposure.debt,
        entryPrice: quote.price,
        openedAtTick: market.tickIndex,
        durationTurns: normalizedDurationTurns,
        expiresAtTick: market.tickIndex + normalizedDurationTurns,
        openedAt: now
      };
      stockUser.leveragedPositions[position.id] = position;
      recordTrade(stockUser, {
        type: 'leverage_open',
        stockId: normalizedStockId,
        stock: quote,
        quantity: 0,
        price: quote.price,
        fee,
        total: totalCost,
        realizedProfit: 0,
        at: now,
        positionId: position.id,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin,
        durationTurns: normalizedDurationTurns
      });

      return {
        type: 'open_leverage',
        stock: quote,
        stockId: normalizedStockId,
        side: normalizedSide,
        leverage: normalizedLeverage,
        margin: normalizedMargin,
        durationTurns: normalizedDurationTurns,
        fee,
        totalCost,
        settled,
        liquidated: settled.filter((entry) => entry.liquidated),
        position: evaluateLeveragedPosition(position, quote, { currentTick: market.tickIndex }),
        profile: cloneMoneyProfile(profile)
      };
    });
  }

  async closeLeveragedPosition({ guildId, userId, username, positionId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const position = stockUser.leveragedPositions[positionId];

      if (!position) {
        throw new Error('해당 레버리지 포지션을 찾을 수 없습니다.');
      }

      const quote = safeCloneQuote(position.stockId, market);
      if (!quote) throw new Error('해당 레버리지 종목을 찾을 수 없습니다.');
      const evaluated = evaluateLeveragedPosition(position, quote, {
        currentTick: market.tickIndex,
        forceSettlement: true
      });
      const closed = settleLeveragedPosition(profile, stockUser, position, evaluated, {
        at: now,
        tradeType: 'leverage_close',
        autoSettled: false,
        settlementCosts: calculateEarlyCloseCosts(position, evaluated, this)
      });

      return {
        type: 'close_leverage',
        liquidated: closed.liquidated,
        expired: closed.expired,
        earlyClosed: closed.earlyClosed,
        grossPayout: closed.grossPayout,
        closingFee: closed.closingFee,
        penalty: closed.penalty,
        settlementCostTotal: closed.settlementCostTotal,
        autoSettled: closed.autoSettled,
        position: closed,
        payout: closed.payout,
        repayment: closed.repayment,
        netPayout: closed.netPayout,
        bankruptcy: closed.bankruptcy,
        bankruptcyDebtAdded: closed.bankruptcyDebtAdded,
        realizedProfit: closed.realizedProfit,
        profile: cloneMoneyProfile(profile),
        stockUser: cloneStockUser(stockUser)
      };
    });
  }

  async repayBankruptcyDebt({ guildId, userId, username, amount = null, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      const settled = settleMaturedLeveragedPositions(profile, stockUser, market);
      const before = getStockBankruptcySummary(profile);
      const repayment = repayStockBankruptcyDebt(profile, amount);

      return {
        userId: profile.userId,
        username: profile.username,
        requested: repayment.requested,
        repaid: repayment.repaid,
        debtBefore: before.debt,
        balanceBefore: repayment.balanceBefore,
        bankruptcy: repayment.bankruptcy,
        settled,
        liquidated: settled.filter((entry) => entry.liquidated),
        profile: cloneMoneyProfile(profile)
      };
    });
  }

  async getLeveragePortfolio({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const previousTradeIds = getStockTradeHistoryIdSet(guild.stocks?.users?.[userId]);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      settleMaturedLeveragedPositions(profile, stockUser, market);
      const settled = getNewLeverageSettlementEntries(stockUser, market, previousTradeIds);
      const positions = getEvaluatedLeveragedPositions(stockUser, market);
      const marginTotal = toCompatibleMoneyValue(addMoney(...positions.map((position) => position.margin)));
      const notionalTotal = toCompatibleMoneyValue(addMoney(...positions.map((position) => position.notional)));
      const debtTotal = toCompatibleMoneyValue(addMoney(...positions.map((position) => position.debt)));
      const equityTotal = positions.reduce((sum, position) => sum + position.equity, 0);
      const unrealizedProfit = positions.reduce((sum, position) => sum + position.unrealizedProfit, 0);

      return {
        userId: profile.userId,
        username: profile.username,
        cash: getCurrencyBalance(profile, CURRENCY_STOCK),
        bankruptcy: getStockBankruptcySummary(profile),
        positions,
        settled,
        liquidated: settled.filter((entry) => entry.type === 'leverage_liquidation'),
        marginTotal,
        notionalTotal,
        debtTotal,
        equityTotal,
        unrealizedProfit,
        realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
        leveragedTradeCount: stockUser.leveragedTradeCount
      };
    });
  }

  async getPortfolio({ guildId, userId, username, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const profile = getOrCreateMoneyProfile(data, guildId, userId, username, now);
      const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, now);
      settleMaturedLeveragedPositions(profile, stockUser, market);
      return buildPortfolio(profile, stockUser, market);
    });
  }

  async getLeaderboard({ guildId, limit = 10, now = Date.now() }) {
    const safeLimit = Math.min(20, Math.max(1, Number(limit) || 10));

    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const userIds = new Set([
        ...getAccountUserIdsForGuild(data, guildId),
        ...Object.keys(guild.stocks?.users ?? {})
      ]);

      return [...userIds]
        .map((userId) => {
          const profile = getOptionalMoneyProfile(
            data,
            guildId,
            userId,
            getLinkedAccountUsername(data, userId, guild.stocks?.users?.[userId]?.username ?? 'Unknown'),
            now
          );
          if (!profile) return null;
          const stockUser = getOrCreateStockUser(data, guildId, guild, userId, profile.username, profile, now);
          settleMaturedLeveragedPositions(profile, stockUser, market);
          return buildPortfolio(profile, stockUser, market);
        })
        .filter(Boolean)
        .filter((portfolio) =>
          compareMoney(portfolio.cash, 0) > 0 ||
          portfolio.positions.length > 0 ||
          portfolio.leveragedPositions.length > 0 ||
          portfolio.pendingDividends > 0
        )
        .sort((a, b) => {
          const totalAssetsOrder = compareMoney(b.totalAssets, a.totalAssets);
          if (totalAssetsOrder !== 0) return totalAssetsOrder;
          if (b.stockValue !== a.stockValue) return b.stockValue - a.stockValue;
          return a.username.localeCompare(b.username, 'ko-KR');
        })
        .slice(0, safeLimit);
    });
  }

  async listAdminStock({
    guildId,
    name,
    symbol = '',
    sector = '관리자',
    risk = 'stable',
    basePrice,
    volatilityBps = 1_000,
    eventChance = 10,
    now = Date.now()
  }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const definition = createAdminStockDefinition(guild, market, {
        name,
        symbol,
        sector,
        risk,
        basePrice,
        volatilityBps,
        eventChance
      });

      guild.stocks.dynamicDefinitions[definition.id] = definition;
      market.symbols[definition.id] = createInitialSymbolState(definition, now, 'ipo', market.tickIndex);
      recordMarketNews(
        guild,
        definition,
        `관리자 신규상장: ${definition.name}이(가) 시장에 등록되었습니다`,
        market.tickIndex,
        now,
        market.tickIndex
      );
      mirrorGlobalStockStateToGuild(data, guildId);

      return cloneQuote(definition.id, market.symbols[definition.id]);
    });
  }

  async delistAdminStock({ guildId, stockId, now = Date.now() }) {
    return this.store.update((data) => {
      const guild = getOrCreateGuild(data, guildId);
      const market = syncMarket(data, guildId, guild, now, this);
      const normalizedStockId = normalizeStockIdForGuild(stockId, guild);
      const quote = getListedQuote(normalizedStockId, market);
      const state = market.symbols[normalizedStockId];

      state.previousPrice = normalizeNonNegativeInteger(state.price || quote.price);
      state.price = 0;
      state.changeBps = -10_000;
      state.news = `관리자 상장폐지: ${quote.name}, 거래소 조치로 매매가 정지되었습니다`;
      state.status = 'delisted';
      state.eventType = 'delisted';
      state.delistedAtTick = market.tickIndex;
      state.dividendBps = 0;
      state.dividendUpdatedAtTick = market.tickIndex;
      state.updatedAt = normalizeNonNegativeInteger(now);
      state.history = appendPriceHistory(state.history, {
        tickIndex: market.tickIndex,
        price: 0,
        at: now
      });

      cleanupDelistedStockUsers(data, guildId, guild, market);
      purgeDelistedMarketSymbols(data, guildId, guild, market);
      mirrorGlobalStockStateToGuild(data, guildId);

      return {
        ...quote,
        status: 'delisted',
        eventType: 'delisted',
        price: 0,
        previousPrice: state.previousPrice,
        news: state.news
      };
    });
  }
}

export function getStockCatalog() {
  return STOCK_DEFINITIONS.map((definition) => ({ ...definition, aliases: [...definition.aliases] }));
}

export function normalizeStockId(stockId) {
  const normalized = normalizeLookupKey(stockId);
  const matched = STOCK_LOOKUP.get(normalized);
  if (!matched) throw new Error('알 수 없는 가상주식 종목입니다. `/주식 전체시세`에서 종목명을 확인하세요.');
  return matched;
}

function normalizeStockIdForGuild(stockId, guild) {
  const normalized = normalizeLookupKey(stockId);
  const staticMatched = STOCK_LOOKUP.get(normalized);
  if (staticMatched) return staticMatched;

  for (const definition of getDynamicStockDefinitions(guild)) {
    const keys = [
      definition.id,
      definition.name,
      definition.symbol,
      ...(definition.aliases ?? [])
    ].map(normalizeLookupKey);
    if (keys.includes(normalized)) return definition.id;
  }

  for (const record of Object.values(guild?.stocks?.delistedStocks ?? {})) {
    const keys = [
      record.id,
      record.name,
      record.symbol,
      ...(record.aliases ?? [])
    ].map(normalizeLookupKey);
    if (keys.includes(normalized)) return record.id;
  }

  throw new Error('알 수 없는 가상주식 종목입니다. `/주식 전체시세`에서 종목명을 확인하세요.');
}

export function getStockConfig(stockId) {
  return STOCKS_BY_ID[normalizeStockId(stockId)];
}

export function scheduleStockAlertAnnouncements({
  sendAnnouncements,
  intervalMs = DEFAULT_STOCK_ALERT_INTERVAL_MS,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  logger = console
}) {
  let timer = null;
  let stopped = false;
  const safeIntervalMs = Math.max(10_000, Number(intervalMs) || DEFAULT_STOCK_ALERT_INTERVAL_MS);

  const scheduleNext = () => {
    timer = setTimeoutFn(async () => {
      if (stopped) return;

      try {
        await sendAnnouncements();
      } catch (error) {
        logger.error('Failed to send stock price alert announcements:', error);
      }

      if (!stopped) {
        scheduleNext();
      }
    }, safeIntervalMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  };

  scheduleNext();

  return () => {
    stopped = true;
    if (timer) {
      clearTimeoutFn(timer);
    }
  };
}

function stock(id, name, sector, risk, basePrice, volatilityBps, eventChance, aliases = [], symbol = null, options = {}) {
  const safeOptions = options && typeof options === 'object' ? options : {};
  return Object.freeze({
    id,
    name,
    symbol: symbol ?? createSymbol(id),
    sector,
    risk,
    basePrice,
    volatilityBps,
    eventChance,
    listedFromTick: normalizeNonNegativeInteger(safeOptions.listedFromTick),
    dynamic: Boolean(safeOptions.dynamic),
    aliases: Object.freeze(aliases)
  });
}

function normalizeDynamicStockDefinitions(definitions = {}) {
  const safeDefinitions = definitions && typeof definitions === 'object' ? definitions : {};
  const entries = [];

  for (const [stockId, definition] of Object.entries(safeDefinitions)) {
    try {
      const normalized = normalizeDynamicStockDefinition(definition, stockId);
      entries.push([normalized.id, normalized]);
    } catch {
      // Ignore invalid generated IPO definitions.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeDynamicStockDefinition(definition = {}, fallbackId = null) {
  const safeDefinition = definition && typeof definition === 'object' ? definition : {};
  const id = String(safeDefinition.id ?? fallbackId ?? '').trim();
  const name = String(safeDefinition.name ?? '').trim();
  const rawSymbol = String(safeDefinition.symbol ?? '').trim();
  const sector = String(safeDefinition.sector ?? '밈').trim() || '밈';
  const risk = normalizeStockRisk(safeDefinition.risk);

  if (!id || !name) throw new Error('동적 상장 종목 정의가 불완전합니다.');

  return {
    id,
    name,
    symbol: normalizeDynamicStockSymbol(rawSymbol, { id, name, sector }),
    sector,
    risk,
    basePrice: normalizePositiveStoredInteger(safeDefinition.basePrice, 500),
    volatilityBps: normalizePositiveStoredInteger(safeDefinition.volatilityBps, 1_200),
    eventChance: clampInteger(normalizePositiveStoredInteger(safeDefinition.eventChance, 15), 1, 50),
    listedFromTick: normalizeNonNegativeInteger(safeDefinition.listedFromTick),
    dynamic: true,
    aliases: Array.isArray(safeDefinition.aliases)
      ? safeDefinition.aliases.map((alias) => String(alias).trim()).filter(Boolean)
      : []
  };
}

function getDynamicStockDefinitions(guild) {
  return Object.values(guild?.stocks?.dynamicDefinitions ?? {})
    .filter((definition) => !isDelistedStockId(guild, definition.id));
}

function getOrCreateGuild(data, guildId) {
  if (!guildId) throw new Error('서버에서만 사용할 수 있는 기능입니다.');
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  return {
    ...data.guilds[guildId],
    stocks: getOrCreateGlobalStockState(data, guildId)
  };
}

function getExistingGuild(data, guildId) {
  if (!guildId) throw new Error('서버에서만 사용할 수 있는 기능입니다.');
  if (!data.stocks && !data.guilds?.[guildId]?.stocks) return null;
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  return {
    ...data.guilds[guildId],
    stocks: getOrCreateGlobalStockState(data, guildId)
  };
}

function getOrCreateGlobalStockState(data, preferredGuildId = null) {
  data.stocks ??= {};
  data.stocks.users ??= {};
  migrateLegacyStockState(data, data.stocks, preferredGuildId);
  mirrorGlobalStockStateToGuild(data, preferredGuildId);
  return data.stocks;
}

function migrateLegacyStockState(data, stockState, preferredGuildId = null) {
  const entries = Object.entries(data?.guilds ?? {})
    .filter(([, guild]) => guild?.stocks && guild.stocks !== stockState)
    .sort(([leftGuildId], [rightGuildId]) => {
      if (leftGuildId === preferredGuildId) return -1;
      if (rightGuildId === preferredGuildId) return 1;
      return 0;
    });

  for (const [sourceGuildId, guild] of entries) {
    if (isMirroredGlobalStockState(stockState, guild.stocks)) {
      delete guild.stocks;
      continue;
    }

    mergeStockState(stockState, guild.stocks, sourceGuildId);
    delete guild.stocks;
  }
}

function isMirroredGlobalStockState(stockState, guildStocks) {
  if (!stockState || !guildStocks || guildStocks === stockState) return true;

  const mirroredFields = [
    'market',
    'dynamicDefinitions',
    'delistedStocks',
    'nextDynamicStockSeq',
    'marketNews',
    'marketSourceGuildId'
  ].every((key) => guildStocks[key] === undefined || areJsonEquivalent(guildStocks[key], stockState[key]));
  const users = guildStocks.users ?? {};
  const linkedUsers = guildStocks.linkedUsers ?? {};
  const onlyLinkedUsers = Object.entries(users)
    .every(([userId, user]) => linkedUsers[userId] === true && areJsonEquivalent(stockState.users?.[userId], user));

  return mirroredFields && onlyLinkedUsers;
}

function mergeStockState(target, source, sourceKey = 'legacy') {
  if (!source || typeof source !== 'object') return target;

  target.users ??= {};
  for (const [userId, sourceUser] of Object.entries(source.users ?? {})) {
    if (source.linkedUsers?.[userId] === true && areJsonEquivalent(target.users[userId], sourceUser)) continue;
    target.users[userId] = mergeStockUserState(target.users[userId], sourceUser, `${sourceKey}_${userId}`, sourceKey);
  }

  target.dynamicDefinitions ??= {};
  for (const [stockId, definition] of Object.entries(source.dynamicDefinitions ?? {})) {
    target.dynamicDefinitions[stockId] ??= structuredClone(definition);
  }

  target.delistedStocks ??= {};
  for (const [stockId, record] of Object.entries(source.delistedStocks ?? {})) {
    target.delistedStocks[stockId] ??= structuredClone(record);
  }

  target.nextDynamicStockSeq = Math.max(
    normalizeNonNegativeInteger(target.nextDynamicStockSeq),
    normalizeNonNegativeInteger(source.nextDynamicStockSeq)
  );
  target.marketNews = mergeStockRecordArray(target.marketNews, source.marketNews, `${sourceKey}_news`);

  if (
    source.market
    && (!target.market || normalizeNonNegativeInteger(source.market.tickIndex) > normalizeNonNegativeInteger(target.market.tickIndex))
  ) {
    target.market = structuredClone(source.market);
    target.marketSourceGuildId ??= sourceKey;
  }

  return target;
}

function mergeStockUserState(targetUser, sourceUser, sourceKey = 'legacy_user', sourceGuildId = null) {
  if (!sourceUser || typeof sourceUser !== 'object') return targetUser;

  const merged = targetUser ?? createDefaultStockUser(sourceUser.userId, sourceUser.username);
  merged.username = sourceUser.username || merged.username || 'Unknown';
  merged.holdings = mergeStockHoldings(merged.holdings, sourceUser.holdings);
  merged.limitOrders = mergeStockRecordMap(merged.limitOrders, sourceUser.limitOrders, `${sourceKey}_order`);
  merged.priceAlerts = mergeStockRecordMap(
    merged.priceAlerts,
    withLegacyStockAlertGuildIds(sourceUser.priceAlerts, sourceGuildId),
    `${sourceKey}_alert`
  );
  merged.leveragedPositions = mergeStockRecordMap(merged.leveragedPositions, sourceUser.leveragedPositions, `${sourceKey}_position`);
  merged.tradeHistory = mergeStockRecordArray(merged.tradeHistory, sourceUser.tradeHistory, `${sourceKey}_trade`);
  merged.dividendHistory = mergeStockRecordArray(merged.dividendHistory, sourceUser.dividendHistory, `${sourceKey}_dividend`);
  merged.realizedProfit = normalizeInteger(merged.realizedProfit) + normalizeInteger(sourceUser.realizedProfit);
  merged.realizedLeveragedProfit = normalizeInteger(merged.realizedLeveragedProfit) + normalizeInteger(sourceUser.realizedLeveragedProfit);
  merged.pendingDividends = normalizeNonNegativeInteger(merged.pendingDividends) + normalizeNonNegativeInteger(sourceUser.pendingDividends);
  merged.totalDividends = normalizeNonNegativeInteger(merged.totalDividends) + normalizeNonNegativeInteger(sourceUser.totalDividends);
  merged.claimedDividends = normalizeNonNegativeInteger(merged.claimedDividends) + normalizeNonNegativeInteger(sourceUser.claimedDividends);
  merged.tradeCount = normalizeNonNegativeInteger(merged.tradeCount) + normalizeNonNegativeInteger(sourceUser.tradeCount);
  merged.leveragedTradeCount = normalizeNonNegativeInteger(merged.leveragedTradeCount) + normalizeNonNegativeInteger(sourceUser.leveragedTradeCount);
  merged.nextOrderSeq = Math.max(normalizeNonNegativeInteger(merged.nextOrderSeq), normalizeNonNegativeInteger(sourceUser.nextOrderSeq));
  merged.nextAlertSeq = Math.max(normalizeNonNegativeInteger(merged.nextAlertSeq), normalizeNonNegativeInteger(sourceUser.nextAlertSeq));
  merged.nextPositionSeq = Math.max(normalizeNonNegativeInteger(merged.nextPositionSeq), normalizeNonNegativeInteger(sourceUser.nextPositionSeq));
  merged.nextTradeSeq = Math.max(normalizeNonNegativeInteger(merged.nextTradeSeq), normalizeNonNegativeInteger(sourceUser.nextTradeSeq));
  merged.nextDividendSeq = Math.max(normalizeNonNegativeInteger(merged.nextDividendSeq), normalizeNonNegativeInteger(sourceUser.nextDividendSeq));
  merged.lastDividendTick = Math.max(normalizeNonNegativeInteger(merged.lastDividendTick), normalizeNonNegativeInteger(sourceUser.lastDividendTick));
  merged.lastTradeAt = Math.max(normalizeNonNegativeInteger(merged.lastTradeAt), normalizeNonNegativeInteger(sourceUser.lastTradeAt));

  return merged;
}

function withLegacyStockAlertGuildIds(priceAlerts = {}, guildId = null) {
  const source = priceAlerts && typeof priceAlerts === 'object' ? priceAlerts : {};
  if (!guildId) return source;

  return Object.fromEntries(Object.entries(source).map(([alertId, alert]) => {
    if (!alert || typeof alert !== 'object' || alert.guildId) return [alertId, alert];
    return [alertId, { ...alert, guildId }];
  }));
}

function mergeStockHoldings(targetHoldings = {}, sourceHoldings = {}) {
  const merged = { ...(targetHoldings && typeof targetHoldings === 'object' ? targetHoldings : {}) };
  const source = sourceHoldings && typeof sourceHoldings === 'object' ? sourceHoldings : {};

  for (const [stockId, rawHolding] of Object.entries(source)) {
    const holding = normalizeHolding(rawHolding);
    if (holding.quantity <= 0) continue;
    const existing = normalizeHolding(merged[stockId]);
    const quantity = existing.quantity + holding.quantity;
    merged[stockId] = {
      quantity,
      averageCost: quantity > 0
        ? Math.round((existing.averageCost * existing.quantity + holding.averageCost * holding.quantity) / quantity)
        : 0
    };
  }

  return merged;
}

function mergeStockRecordMap(targetMap = {}, sourceMap = {}, sourceKey = 'legacy') {
  const merged = { ...(targetMap && typeof targetMap === 'object' ? targetMap : {}) };
  const source = sourceMap && typeof sourceMap === 'object' ? sourceMap : {};

  for (const [recordId, record] of Object.entries(source)) {
    const id = getMergedStockRecordId(merged, recordId, sourceKey);
    const cloned = structuredClone(record);
    if (cloned && typeof cloned === 'object') cloned.id = id;
    merged[id] = cloned;
  }

  return merged;
}

function mergeStockRecordArray(targetArray = [], sourceArray = [], sourceKey = 'legacy') {
  const merged = Array.isArray(targetArray) ? [...targetArray] : [];
  const usedIds = new Set(merged.map((entry) => String(entry?.id ?? '')).filter(Boolean));
  const source = Array.isArray(sourceArray) ? sourceArray : [];

  for (const [index, record] of source.entries()) {
    const fallbackId = `${sourceKey}_${index + 1}`;
    const id = getMergedStockRecordId(Object.fromEntries([...usedIds].map((usedId) => [usedId, true])), record?.id ?? fallbackId, sourceKey);
    usedIds.add(id);
    const cloned = structuredClone(record);
    if (cloned && typeof cloned === 'object') cloned.id = id;
    merged.push(cloned);
  }

  return merged;
}

function getMergedStockRecordId(existingRecords, recordId, sourceKey) {
  const baseId = String(recordId ?? sourceKey).trim() || sourceKey;
  if (!Object.hasOwn(existingRecords, baseId)) return baseId;

  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `${sourceKey}_${baseId}_${index}`;
    if (!Object.hasOwn(existingRecords, candidate)) return candidate;
  }

  return `${sourceKey}_${baseId}_${Date.now()}`;
}

function mirrorGlobalStockStateToGuild(data, guildId, userId = null) {
  if (!guildId || !data?.stocks) return;
  data.guilds ??= {};
  data.guilds[guildId] ??= {};
  const guild = data.guilds[guildId];
  const legacyUsers = guild.stocks?.users ?? {};
  guild.stocks ??= {};
  mirrorOptionalStockField(guild.stocks, data.stocks, 'market');
  mirrorOptionalStockField(guild.stocks, data.stocks, 'dynamicDefinitions');
  mirrorOptionalStockField(guild.stocks, data.stocks, 'delistedStocks');
  mirrorOptionalStockField(guild.stocks, data.stocks, 'nextDynamicStockSeq');
  mirrorOptionalStockField(guild.stocks, data.stocks, 'marketNews');
  mirrorOptionalStockField(guild.stocks, data.stocks, 'marketSourceGuildId');
  guild.stocks.users = legacyUsers;
  if (userId && data.stocks.users?.[userId]) {
    guild.stocks.linkedUsers ??= {};
    guild.stocks.users[userId] = data.stocks.users[userId];
    guild.stocks.linkedUsers[userId] = true;
  }
}

function mirrorOptionalStockField(target, source, key) {
  if (source[key] === undefined) {
    delete target[key];
    return;
  }
  target[key] = source[key];
}

function getOrCreateMarket(guild, now) {
  guild.stocks ??= {};
  guild.stocks.users ??= {};
  guild.stocks.dynamicDefinitions = normalizeDynamicStockDefinitions(guild.stocks.dynamicDefinitions);
  guild.stocks.delistedStocks = normalizeDelistedStockRecords(guild.stocks.delistedStocks);
  guild.stocks.nextDynamicStockSeq = normalizeNonNegativeInteger(guild.stocks.nextDynamicStockSeq);
  guild.stocks.marketNews = normalizeMarketNews(guild.stocks.marketNews, guild);

  if (!guild.stocks.market) {
    guild.stocks.market = createInitialMarket(now, guild);
  }

  guild.stocks.market.symbols ??= {};
  guild.stocks.market.lastTickAt = normalizeNonNegativeInteger(guild.stocks.market.lastTickAt);
  guild.stocks.market.tickIndex = normalizeNonNegativeInteger(guild.stocks.market.tickIndex);
  for (const definition of STOCK_DEFINITIONS) {
    if (isDelistedStockId(guild, definition.id)) {
      delete guild.stocks.market.symbols[definition.id];
      continue;
    }
    const existingState = guild.stocks.market.symbols[definition.id];
    if (!existingState && definition.listedFromTick > guild.stocks.market.tickIndex) continue;
    guild.stocks.market.symbols[definition.id] = normalizeSymbolState(existingState, definition, now);
  }
  for (const definition of getDynamicStockDefinitions(guild)) {
    if (isDelistedStockId(guild, definition.id)) {
      delete guild.stocks.market.symbols[definition.id];
      delete guild.stocks.dynamicDefinitions[definition.id];
      continue;
    }
    guild.stocks.market.symbols[definition.id] = normalizeSymbolState(
      guild.stocks.market.symbols[definition.id],
      definition,
      now
    );
  }
  for (const stockId of Object.keys(guild.stocks.delistedStocks)) {
    delete guild.stocks.market.symbols[stockId];
    delete guild.stocks.dynamicDefinitions?.[stockId];
  }
  return attachDelistedStockRecords(guild.stocks.market, guild.stocks.delistedStocks);
}

function createInitialMarket(now, guild = null) {
  return {
    lastTickAt: normalizeNonNegativeInteger(now),
    tickIndex: 0,
    symbols: Object.fromEntries(
      STOCK_DEFINITIONS
        .filter((definition) => definition.listedFromTick <= 0 && !isDelistedStockId(guild, definition.id))
        .map((definition) => [
          definition.id,
          createInitialSymbolState(definition, now)
        ])
    )
  };
}

function createInitialSymbolState(definition, now, eventType = null, listedAtTick = definition.listedFromTick) {
  const safeNow = normalizeNonNegativeInteger(now);
  return {
    price: definition.basePrice,
    previousPrice: definition.basePrice,
    changeBps: 0,
    news: definition.dynamic && eventType === 'ipo'
      ? `자동 신규상장: ${definition.name}, VX마켓 심사 통과 후 첫 거래를 시작했습니다. 유통 물량과 기준가 형성 과정이 관전 포인트로 꼽힙니다`
      : eventType === 'ipo'
      ? `신규상장: ${definition.name}, 상장 첫날 기준가 형성 과정에서 투자자 관망세가 이어지고 있습니다`
      : `${definition.name}, 상장 첫날 보합권에서 거래되며 다음 공시를 기다리고 있습니다`,
    status: 'listed',
    eventType,
    listedAtTick,
    dividendBps: getInitialDividendBps(definition),
    dividendUpdatedAtTick: normalizeNonNegativeInteger(listedAtTick),
    definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
    updatedAt: safeNow,
    history: [
      {
        tickIndex: normalizeNonNegativeInteger(listedAtTick),
        price: definition.basePrice,
        at: safeNow
      }
    ]
  };
}

function normalizeSymbolState(state, definition, now) {
  const safeState = state && typeof state === 'object' ? state : {};
  const status = safeState.status === 'delisted' ? 'delisted' : 'listed';
  const price = status === 'delisted'
    ? 0
    : Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.price, definition.basePrice));
  const previousPrice = Math.max(MIN_STOCK_PRICE, normalizePositiveStoredInteger(safeState.previousPrice, price));
  const dividendBps = status === 'delisted'
    ? 0
    : normalizeDividendBps(safeState.dividendBps, definition);

  return {
    price,
    previousPrice,
    changeBps: Number.isSafeInteger(Number(safeState.changeBps)) ? Number(safeState.changeBps) : calculateChangeBps(price, previousPrice),
    news: typeof safeState.news === 'string' && safeState.news.trim()
      ? safeState.news
      : `시황: ${definition.name}, 보합권에서 거래되며 추가 공시를 기다리는 분위기입니다`,
    status,
    eventType: typeof safeState.eventType === 'string' ? safeState.eventType : null,
    listedAtTick: normalizeNonNegativeInteger(safeState.listedAtTick ?? definition.listedFromTick),
    delistedAtTick: normalizeNonNegativeInteger(safeState.delistedAtTick),
    dividendBps,
    dividendUpdatedAtTick: normalizeNonNegativeInteger(
      safeState.dividendUpdatedAtTick ?? safeState.listedAtTick ?? definition.listedFromTick
    ),
    definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
    updatedAt: normalizeNonNegativeInteger(safeState.updatedAt) || normalizeNonNegativeInteger(now),
    history: normalizePriceHistory(safeState.history, {
      price,
      updatedAt: normalizeNonNegativeInteger(safeState.updatedAt) || normalizeNonNegativeInteger(now)
    }, normalizeNonNegativeInteger(safeState.listedAtTick ?? definition.listedFromTick), now)
  };
}

function attachDelistedStockRecords(market, records) {
  market[MARKET_DELISTED_STOCKS] = records ?? {};
  return market;
}

function getMarketDelistedStockRecord(market, stockId) {
  return market?.[MARKET_DELISTED_STOCKS]?.[stockId] ?? null;
}

function isDelistedStockId(guild, stockId) {
  const normalizedStockId = normalizeStoredDelistedStockId(stockId);
  return Boolean(normalizedStockId && guild?.stocks?.delistedStocks?.[normalizedStockId]);
}

function purgeDelistedMarketSymbols(data, guildId, guild, market) {
  guild.stocks ??= {};
  guild.stocks.delistedStocks = normalizeDelistedStockRecords(guild.stocks.delistedStocks);
  attachDelistedStockRecords(market, guild.stocks.delistedStocks);

  const delistedEntries = Object.entries(market.symbols ?? {})
    .filter(([, state]) => state?.status === 'delisted');
  if (delistedEntries.length === 0) return;

  cleanupDelistedStockUsers(data, guildId, guild, market);

  for (const [stockId, state] of delistedEntries) {
    if (state?.status !== 'delisted') continue;

    const record = createDelistedStockRecord(stockId, state, market);
    guild.stocks.delistedStocks[record.id] = record;
    delete market.symbols[stockId];

    if (record.dynamic) {
      delete guild.stocks.dynamicDefinitions?.[stockId];
    }
  }

  attachDelistedStockRecords(market, guild.stocks.delistedStocks);
}

function createDelistedStockRecord(stockId, state, market) {
  let quote = null;
  try {
    quote = cloneQuote(stockId, state);
  } catch {
    quote = null;
  }

  const fallbackDefinition = STOCKS_BY_ID[stockId] ??
    (state?.definition ? normalizeDynamicStockDefinition(state.definition, stockId) : null);
  const name = quote?.name ?? fallbackDefinition?.name ?? stockId;

  return normalizeDelistedStockRecord({
    id: stockId,
    name,
    symbol: quote?.symbol ?? fallbackDefinition?.symbol ?? createSymbol(stockId),
    sector: quote?.sector ?? fallbackDefinition?.sector ?? '알 수 없음',
    risk: quote?.risk ?? fallbackDefinition?.risk ?? 'meme',
    aliases: quote?.aliases ?? fallbackDefinition?.aliases ?? [],
    dynamic: Boolean(quote?.dynamic ?? fallbackDefinition?.dynamic),
    listedAtTick: quote?.listedAtTick ?? state?.listedAtTick,
    delistedAtTick: quote?.delistedAtTick ?? market.tickIndex,
    deletedAt: state?.updatedAt ?? market.lastTickAt,
    previousPrice: quote?.previousPrice ?? state?.previousPrice,
    news: quote?.news ?? `시황: ${name}, 상장폐지 처리로 매매가 정지되고 보유 평가는 0골드로 조정됐습니다`
  }, stockId);
}

function normalizeDelistedStockRecords(records = {}) {
  const safeRecords = records && typeof records === 'object' ? records : {};
  const entries = [];

  for (const [stockId, record] of Object.entries(safeRecords)) {
    try {
      const normalized = normalizeDelistedStockRecord(record, stockId);
      entries.push([normalized.id, normalized]);
    } catch {
      // Ignore invalid legacy delisting records.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeDelistedStockRecord(record = {}, fallbackId = null) {
  const safeRecord = record && typeof record === 'object' ? record : {};
  const id = normalizeStoredDelistedStockId(safeRecord.id ?? safeRecord.stockId ?? fallbackId);
  if (!id) throw new Error('상장폐지 종목 id가 없습니다.');

  const staticDefinition = STOCKS_BY_ID[id];
  const name = String(safeRecord.name ?? staticDefinition?.name ?? id).trim() || id;
  const symbol = normalizeAsciiStockSymbol(safeRecord.symbol ?? staticDefinition?.symbol ?? createSymbol(id)) || createSymbol(id);
  const aliases = Array.isArray(safeRecord.aliases)
    ? safeRecord.aliases.map((alias) => String(alias).trim()).filter(Boolean)
    : [...(staticDefinition?.aliases ?? [])];

  return {
    id,
    name,
    symbol,
    sector: String(safeRecord.sector ?? staticDefinition?.sector ?? '알 수 없음').trim() || '알 수 없음',
    risk: normalizeStockRisk(safeRecord.risk ?? staticDefinition?.risk ?? 'meme'),
    aliases,
    dynamic: Boolean(safeRecord.dynamic ?? staticDefinition?.dynamic),
    listedAtTick: normalizeNonNegativeInteger(safeRecord.listedAtTick ?? staticDefinition?.listedFromTick),
    delistedAtTick: normalizeNonNegativeInteger(safeRecord.delistedAtTick),
    deletedAt: normalizeNonNegativeInteger(safeRecord.deletedAt),
    previousPrice: normalizeNonNegativeInteger(safeRecord.previousPrice),
    news: String(safeRecord.news ?? `시황: ${name}, 상장폐지 처리로 매매가 정지되고 보유 평가는 0골드로 조정됐습니다`).trim()
  };
}

function normalizeStoredDelistedStockId(stockId) {
  const rawStockId = String(stockId ?? '').trim();
  if (!rawStockId) return null;
  return STOCK_LOOKUP.get(normalizeLookupKey(rawStockId)) ?? rawStockId;
}

function cloneDelistedStockRecord(record) {
  const normalized = normalizeDelistedStockRecord(record, record?.id ?? record?.stockId);
  return {
    ...normalized,
    price: 0,
    previousPrice: normalized.previousPrice,
    changeBps: -10_000,
    changePercent: -100,
    news: normalized.news,
    status: 'delisted',
    eventType: 'delisted',
    dividendBps: 0,
    dividendPercent: 0,
    dividendUpdatedAtTick: normalized.delistedAtTick,
    updatedAt: normalized.deletedAt
  };
}

function getListedQuote(stockId, market) {
  const quote = safeCloneQuote(stockId, market);
  if (quote?.status === 'delisted') {
    throw new Error(`${quote.name}은(는) 상장폐지되어 DB에서 삭제되었습니다.`);
  }
  if (quote) return quote;
  return cloneQuote(stockId, market.symbols[stockId]);
}

function syncMarket(data, guildId, guild, now, service) {
  const market = getOrCreateMarket(guild, now);
  advanceMarket(data, guildId, guild, market, now, service);
  cleanupDelistedStockUsers(data, guildId, guild, market);
  purgeDelistedMarketSymbols(data, guildId, guild, market);
  mirrorGlobalStockStateToGuild(data, guildId);
  return market;
}

function advanceMarket(data, guildId, guild, market, now, service) {
  const safeNow = normalizeNonNegativeInteger(now);
  const elapsed = safeNow - market.lastTickAt;
  if (elapsed < service.tickMs) return;

  const ticks = Math.min(MAX_CATCH_UP_TICKS, Math.floor(elapsed / service.tickMs));
  for (let index = 0; index < ticks; index += 1) {
    market.tickIndex += 1;
    market.lastTickAt += service.tickMs;
    for (const definition of getActiveStockDefinitions(guild, market)) {
      const state = market.symbols[definition.id];
      if (!state || state.status === 'delisted') continue;
      const advanced = advanceSymbol(definition, state, market.tickIndex, service, market.lastTickAt);
      const nextState = advanced.state;
      market.symbols[definition.id] = nextState;
      if (advanced.marketNews) {
        recordMarketNews(guild, definition, advanced.marketNews, market.tickIndex, market.lastTickAt);
      }
    }
    listScheduledStocks(guild, market);
    maybeAutoListStock(guild, market, service);
    processMarketSideEffects(data, guildId, guild, market, service);
    purgeDelistedMarketSymbols(data, guildId, guild, market);
  }
}

function advanceSymbol(definition, state, tickIndex, service, updatedAt) {
  if (state.status === 'delisted') return { state, marketNews: null };

  const randomIntFn = service.randomInt;
  const previousPrice = state.price;
  const baseMoveBps = randomIntFn(-definition.volatilityBps, definition.volatilityBps);
  const eventRoll = randomIntFn(1, 100);
  const headlineImpactBps = eventRoll <= definition.eventChance
    ? randomIntFn(-Math.floor(definition.volatilityBps * 1.4), Math.floor(definition.volatilityBps * 1.4))
    : 0;
  const newsEffect = resolveMarketNewsEffect(headlineImpactBps, randomIntFn);
  const totalMoveBps = clampInteger(baseMoveBps + newsEffect.actualImpactBps, -3000, 3000);
  const eventType = getMarketEventType(definition, totalMoveBps);
  const marketNews = createPreMarketNews(definition, newsEffect, tickIndex);

  if (eventType === 'delisted') {
    return {
      state: {
        price: 0,
        previousPrice,
        changeBps: -10_000,
        news: `시황: ${definition.name} 상장폐지 처리로 거래가 정지되고 보유 평가는 0골드가 됐습니다`,
        status: 'delisted',
        eventType,
        listedAtTick: normalizeNonNegativeInteger(state.listedAtTick ?? definition.listedFromTick),
        delistedAtTick: tickIndex,
        dividendBps: 0,
        dividendUpdatedAtTick: tickIndex,
        definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
        updatedAt,
        history: appendPriceHistory(state.history, {
          tickIndex,
          price: 0,
          at: updatedAt
        })
      },
      marketNews
    };
  }

  const price = Math.max(MIN_STOCK_PRICE, Math.round(previousPrice * (10_000 + totalMoveBps) / 10_000));
  const dividendState = advanceDividendBps(definition, state, tickIndex, service);

  return {
    state: {
      price,
      previousPrice,
      changeBps: calculateChangeBps(price, previousPrice),
      news: createMarketSummary(definition, totalMoveBps, tickIndex, eventType),
      status: 'listed',
      eventType,
      listedAtTick: normalizeNonNegativeInteger(state.listedAtTick ?? definition.listedFromTick),
      delistedAtTick: 0,
      ...dividendState,
      definition: definition.dynamic ? cloneStoredStockDefinition(definition) : null,
      updatedAt,
      history: appendPriceHistory(state.history, {
        tickIndex,
        price,
        at: updatedAt
      })
    },
    marketNews
  };
}

function advanceDividendBps(definition, state, tickIndex, service) {
  const currentBps = normalizeDividendBps(state.dividendBps, definition);
  const currentUpdatedAtTick = normalizeNonNegativeInteger(
    state.dividendUpdatedAtTick ?? state.listedAtTick ?? definition.listedFromTick
  );
  const reviewIntervalTicks = Math.max(2, normalizeNonNegativeInteger(service.dividendReviewIntervalTicks));

  if (tickIndex <= 0 || tickIndex % reviewIntervalTicks !== 0) {
    return {
      dividendBps: currentBps,
      dividendUpdatedAtTick: currentUpdatedAtTick
    };
  }

  const changeChanceBps = clampInteger(
    normalizeNonNegativeInteger(service.dividendChangeChanceBps),
    0,
    10_000
  );
  if (changeChanceBps <= 0) {
    return {
      dividendBps: currentBps,
      dividendUpdatedAtTick: currentUpdatedAtTick
    };
  }

  const roll = getStableStockNumber(`${definition.id}:dividend-roll:${tickIndex}`, 1, 10_000);
  if (roll > changeChanceBps) {
    return {
      dividendBps: currentBps,
      dividendUpdatedAtTick: currentUpdatedAtTick
    };
  }

  const nextBps = calculateNextDividendBps(definition, currentBps, tickIndex);
  return {
    dividendBps: nextBps,
    dividendUpdatedAtTick: nextBps === currentBps ? currentUpdatedAtTick : tickIndex
  };
}

function calculateNextDividendBps(definition, currentBps, tickIndex) {
  const baseBps = getBaseDividendBps(definition);
  const maxDelta = Math.max(1, Math.ceil(baseBps * 0.25));
  let delta = getStableStockNumber(`${definition.id}:dividend-delta:${tickIndex}`, -maxDelta, maxDelta);
  if (delta === 0) {
    delta = getStableStockNumber(`${definition.id}:dividend-sign:${tickIndex}`, 0, 1) === 0 ? -1 : 1;
  }

  let nextBps = clampDividendBps(currentBps + delta, definition);
  if (nextBps === currentBps) {
    nextBps = clampDividendBps(currentBps - Math.sign(delta) * Math.max(1, Math.abs(delta)), definition);
  }
  return nextBps;
}

function listScheduledStocks(guild, market) {
  for (const definition of STOCK_DEFINITIONS) {
    if (isDelistedStockId(guild, definition.id)) continue;
    if (market.symbols[definition.id]) continue;
    if (definition.listedFromTick > market.tickIndex) continue;
    market.symbols[definition.id] = createInitialSymbolState(
      definition,
      market.lastTickAt,
      definition.listedFromTick > 0 ? 'ipo' : null,
      market.tickIndex
    );
    if (definition.listedFromTick > 0) {
      recordMarketNews(guild, definition, createIpoMarketNews(definition, market.symbols[definition.id]), market.tickIndex, market.lastTickAt, market.tickIndex);
    }
  }
}

function maybeAutoListStock(guild, market, service) {
  if (!service.ipoRandomInt) return;
  if (market.tickIndex < AUTO_IPO_CHECK_TICKS || market.tickIndex % AUTO_IPO_CHECK_TICKS !== 0) return;
  if (getDynamicStockDefinitions(guild).length >= service.maxDynamicStocks) return;

  const chance = clampInteger(Number(service.autoIpoChanceBps) || 0, 0, 10_000);
  if (chance <= 0) return;

  const shouldGuaranteeFirstAutoIpo = getDynamicStockDefinitions(guild).length === 0;
  if (!shouldGuaranteeFirstAutoIpo) {
    const roll = service.ipoRandomInt(1, 10_000);
    if (roll > chance) return;
  }

  const definition = createAutomaticIpoDefinition(guild, market, service.ipoRandomInt);
  guild.stocks.dynamicDefinitions[definition.id] = definition;
  market.symbols[definition.id] = createInitialSymbolState(definition, market.lastTickAt, 'ipo', market.tickIndex);
  recordMarketNews(guild, definition, createIpoMarketNews(definition, market.symbols[definition.id]), market.tickIndex, market.lastTickAt, market.tickIndex);
}

function createAutomaticIpoDefinition(guild, market, randomIntFn) {
  const nextSequence = normalizeNonNegativeInteger(guild.stocks.nextDynamicStockSeq) + 1;
  guild.stocks.nextDynamicStockSeq = nextSequence;

  const prefix = AUTO_IPO_PREFIXES[randomIntFn(0, AUTO_IPO_PREFIXES.length - 1)];
  const theme = AUTO_IPO_THEMES[randomIntFn(0, AUTO_IPO_THEMES.length - 1)];
  const nameModifier = AUTO_IPO_NAME_MODIFIERS[randomIntFn(0, AUTO_IPO_NAME_MODIFIERS.length - 1)];
  const baseName = `${prefix}${nameModifier}${theme.suffix}`;
  const existingNames = new Set([
    ...STOCK_DEFINITIONS.map((definition) => definition.name),
    ...getDynamicStockDefinitions(guild).map((definition) => definition.name),
    ...Object.values(guild.stocks.delistedStocks ?? {}).map((record) => record.name)
  ]);
  const name = existingNames.has(baseName) ? `${baseName}${nextSequence}호` : baseName;
  const id = `auto_ipo_${market.tickIndex}_${nextSequence}`;
  const symbol = createAutomaticIpoSymbol(prefix, theme, nextSequence);

  return stock(
    id,
    name,
    theme.sector,
    theme.risk,
    randomIntFn(theme.basePriceMin, theme.basePriceMax),
    theme.volatilityBps,
    theme.eventChance,
    [`${prefix}${theme.sector}`, `${prefix}${theme.suffix}`, `${name}상장`],
    symbol,
    {
      listedFromTick: market.tickIndex,
      dynamic: true
    }
  );
}

function createAutomaticIpoSymbol(prefix, theme, sequence) {
  const prefixPart = AUTO_IPO_PREFIX_SYMBOLS[prefix] ?? createAsciiSymbolPart(prefix, 'IP', 2);
  const sectorPart = AUTO_IPO_SECTOR_SYMBOLS[theme.sector] ?? createAsciiSymbolPart(theme.sector, 'ST', 2);
  return `${prefixPart}${sectorPart}${formatSequenceSymbolPart(sequence)}`.slice(0, 6);
}

function createAdminStockDefinition(guild, market, {
  name,
  symbol,
  sector,
  risk,
  basePrice,
  volatilityBps,
  eventChance
}) {
  const normalizedName = String(name ?? '').trim();
  if (!normalizedName) throw new Error('상장할 종목 이름을 입력하세요.');

  const normalizedSector = String(sector ?? '관리자').trim() || '관리자';
  const normalizedRisk = normalizeStockRisk(risk);
  const normalizedSymbol = normalizeAsciiStockSymbol(symbol) || createAsciiSymbolPart(normalizedName, 'AD', 4);
  const normalizedBasePrice = normalizePositiveStoredInteger(basePrice, 500);
  const normalizedVolatilityBps = clampInteger(normalizePositiveStoredInteger(volatilityBps, 1_000), 100, 3_000);
  const normalizedEventChance = clampInteger(normalizePositiveStoredInteger(eventChance, 10), 1, 50);

  const existingDefinitions = [
    ...STOCK_DEFINITIONS,
    ...getDynamicStockDefinitions(guild),
    ...Object.values(guild.stocks?.delistedStocks ?? {})
  ];
  const existingNames = new Set(existingDefinitions.map((definition) => normalizeLookupKey(definition.name)));
  const existingSymbols = new Set(existingDefinitions.map((definition) => normalizeAsciiStockSymbol(definition.symbol)));
  if (existingNames.has(normalizeLookupKey(normalizedName))) {
    throw new Error('이미 같은 이름의 종목이 있습니다.');
  }
  if (existingSymbols.has(normalizedSymbol)) {
    throw new Error('이미 같은 심볼의 종목이 있습니다.');
  }

  const baseId = `admin_${normalizedSymbol.toLocaleLowerCase('en-US')}`;
  let id = baseId;
  let suffix = 1;
  while (STOCKS_BY_ID[id]
    || guild.stocks?.dynamicDefinitions?.[id]
    || guild.stocks?.delistedStocks?.[id]
    || market.symbols?.[id]) {
    suffix += 1;
    id = `${baseId}_${suffix}`;
  }

  return stock(
    id,
    normalizedName,
    normalizedSector,
    normalizedRisk,
    normalizedBasePrice,
    normalizedVolatilityBps,
    normalizedEventChance,
    [normalizedName, normalizedSymbol, `${normalizedName}상장`],
    normalizedSymbol,
    {
      listedFromTick: normalizeNonNegativeInteger(market.tickIndex),
      dynamic: true
    }
  );
}

function normalizeDynamicStockSymbol(rawSymbol, definition) {
  const asciiSymbol = normalizeAsciiStockSymbol(rawSymbol);
  if (asciiSymbol && asciiSymbol === rawSymbol.toUpperCase()) return asciiSymbol;
  return createDynamicStockSymbol(definition);
}

function createDynamicStockSymbol({ id, name, sector }) {
  const prefix = AUTO_IPO_PREFIXES.find((candidate) => name.startsWith(candidate));
  const prefixPart = prefix
    ? AUTO_IPO_PREFIX_SYMBOLS[prefix]
    : createAsciiSymbolPart(name, 'IP', 2);
  const sectorPart = AUTO_IPO_SECTOR_SYMBOLS[sector] ?? createAsciiSymbolPart(sector, 'ST', 2);
  return `${prefixPart}${sectorPart}${formatSequenceSymbolPart(extractDynamicStockSequence(id, name))}`.slice(0, 6);
}

function normalizeAsciiStockSymbol(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function createAsciiSymbolPart(value, fallback, length) {
  const ascii = normalizeAsciiStockSymbol(value).replace(/^[0-9]+/, '');
  if (ascii.length >= length) return ascii.slice(0, length);
  return `${fallback}${createStableSymbolHash(value)}`.slice(0, length);
}

function createStableSymbolHash(value) {
  return getStableHashNumber(value).toString(36).toUpperCase();
}

function getStableStockNumber(value, min, max) {
  const safeMin = Number(min);
  const safeMax = Number(max);
  if (!Number.isSafeInteger(safeMin) || !Number.isSafeInteger(safeMax) || safeMax < safeMin) {
    return 0;
  }
  const range = safeMax - safeMin + 1;
  return safeMin + (getStableHashNumber(value) % range);
}

function getStableHashNumber(value) {
  const source = String(value ?? '');
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  }
  return hash;
}

function extractDynamicStockSequence(id, name) {
  const idMatch = String(id ?? '').match(/_(\d+)$/);
  if (idMatch) return Number(idMatch[1]);
  const nameMatch = String(name ?? '').match(/(\d+)호?$/);
  if (nameMatch) return Number(nameMatch[1]);
  return 0;
}

function formatSequenceSymbolPart(sequence) {
  const safeSequence = normalizeNonNegativeInteger(sequence);
  return safeSequence > 0 ? safeSequence.toString(36).toUpperCase() : '';
}

function getActiveStockDefinitions(guild, market) {
  return [
    ...STOCK_DEFINITIONS.filter((definition) => market.symbols[definition.id]),
    ...getDynamicStockDefinitions(guild).filter((definition) => market.symbols[definition.id])
  ];
}

function cloneStoredStockDefinition(definition) {
  return {
    id: definition.id,
    name: definition.name,
    symbol: definition.symbol,
    sector: definition.sector,
    risk: definition.risk,
    basePrice: definition.basePrice,
    volatilityBps: definition.volatilityBps,
    eventChance: definition.eventChance,
    listedFromTick: definition.listedFromTick,
    dynamic: Boolean(definition.dynamic),
    aliases: [...(definition.aliases ?? [])]
  };
}

function getMarketEventType(definition, moveBps) {
  if (moveBps <= -2800 && ['meme', 'volatile'].includes(definition.risk)) return 'delisted';
  if (moveBps >= 1500) return 'surge';
  if (moveBps <= -1500) return 'crash';
  return null;
}

function resolveMarketNewsEffect(headlineImpactBps, randomIntFn) {
  if (headlineImpactBps === 0) {
    return {
      headlineImpactBps: 0,
      actualImpactBps: 0,
      outcome: 'none'
    };
  }

  const outcomeRoll = randomIntFn(1, 100);
  if (outcomeRoll <= 50 || outcomeRoll > 90) {
    return {
      headlineImpactBps,
      actualImpactBps: headlineImpactBps,
      outcome: 'confirmed'
    };
  }

  if (outcomeRoll <= 70) {
    return {
      headlineImpactBps,
      actualImpactBps: scaleMarketNewsImpact(headlineImpactBps, 30),
      outcome: 'muted'
    };
  }

  if (outcomeRoll <= 80) {
    return {
      headlineImpactBps,
      actualImpactBps: 0,
      outcome: 'ignored'
    };
  }

  return {
    headlineImpactBps,
    actualImpactBps: -headlineImpactBps,
    outcome: 'reversed'
  };
}

function scaleMarketNewsImpact(impactBps, percent) {
  const scaled = Math.round(Math.abs(impactBps) * percent / 100);
  return Math.sign(impactBps) * scaled;
}

function createPreMarketNews(definition, newsEffect, tickIndex) {
  const headlineImpactBps = newsEffect?.headlineImpactBps ?? 0;
  if (headlineImpactBps === 0) return null;

  const riskThreshold = -Math.floor(definition.volatilityBps * 1.2);
  const type = headlineImpactBps <= riskThreshold && ['meme', 'volatile'].includes(definition.risk)
    ? 'risk'
    : headlineImpactBps > 0
      ? 'positive'
      : 'negative';
  const message = createPreMarketNewsMessage(definition, type, tickIndex);

  return {
    type,
    title: formatMarketNewsTitle(type),
    message,
    impactBps: headlineImpactBps,
    headlineImpactBps,
    actualImpactBps: newsEffect.actualImpactBps,
    outcome: newsEffect.outcome
  };
}

function createPreMarketNewsMessage(definition, type, tickIndex) {
  const typedTemplates = PRE_MARKET_NEWS_TEMPLATES[type] ?? PRE_MARKET_NEWS_TEMPLATES.negative;
  const templates = typedTemplates[definition.risk] ?? typedTemplates.stable ?? typedTemplates.meme ?? typedTemplates.volatile;
  const detailTemplates = PRE_MARKET_NEWS_DETAIL_TEMPLATES[type];
  const baseTemplate = pickStockNewsTemplate(templates, definition, tickIndex);
  const detailTemplate = pickStockNewsDetailTemplate(
    detailTemplates,
    definition,
    tickIndex,
    templates.length
  );
  const contextTemplate = pickStockNewsContextTemplate(
    PRE_MARKET_NEWS_CONTEXT_TEMPLATES[type],
    definition,
    tickIndex,
    templates.length,
    detailTemplates?.length ?? 1
  );
  return renderStockNewsTemplate(joinStockNewsTemplates(baseTemplate, detailTemplate, contextTemplate), definition);
}

function createIpoMarketNews(definition, state) {
  return {
    type: 'ipo',
    title: formatMarketNewsTitle('ipo'),
    message: state.news,
    impactBps: 0
  };
}

function createMarketSummary(definition, moveBps, tickIndex, eventType = null) {
  if (eventType === 'surge') {
    return createMarketSummaryMessage(definition, 'surge', tickIndex);
  }
  if (eventType === 'crash') {
    return createMarketSummaryMessage(definition, 'crash', tickIndex);
  }
  if (moveBps >= 900) {
    return createMarketSummaryMessage(definition, 'positive', tickIndex);
  }
  if (moveBps <= -900) {
    return createMarketSummaryMessage(definition, 'negative', tickIndex);
  }

  return createMarketSummaryMessage(definition, 'quiet', tickIndex);
}

function createMarketSummaryMessage(definition, type, tickIndex) {
  const templates = MARKET_SUMMARY_TEMPLATES[type] ?? MARKET_SUMMARY_TEMPLATES.quiet;
  const detailTemplates = MARKET_SUMMARY_DETAIL_TEMPLATES[type];
  const baseTemplate = pickStockNewsTemplate(templates, definition, tickIndex);
  const detailTemplate = pickStockNewsDetailTemplate(
    detailTemplates,
    definition,
    tickIndex,
    templates.length
  );
  const contextTemplate = pickStockNewsContextTemplate(
    MARKET_SUMMARY_CONTEXT_TEMPLATES[type],
    definition,
    tickIndex,
    templates.length,
    detailTemplates?.length ?? 1
  );
  return renderStockNewsTemplate(joinStockNewsTemplates(baseTemplate, detailTemplate, contextTemplate), definition);
}

function pickStockNewsTemplate(templates, definition, tickIndex) {
  const source = Array.isArray(templates) && templates.length > 0
    ? templates
    : ['{name} 시장 상황 안내가 게시됐습니다'];
  const offset = getStockNewsTemplateOffset(definition);
  return source[(normalizeNonNegativeInteger(tickIndex) + offset) % source.length];
}

function pickStockNewsDetailTemplate(templates, definition, tickIndex, baseTemplateCount = 1) {
  const source = Array.isArray(templates) && templates.length > 0 ? templates : [];
  if (source.length === 0) return '';

  const offset = getStockNewsTemplateOffset(definition);
  const baseCount = Math.max(1, normalizePositiveStoredInteger(baseTemplateCount, 1));
  const detailIndex = Math.floor((normalizeNonNegativeInteger(tickIndex) + offset) / baseCount) % source.length;
  return source[detailIndex];
}

function pickStockNewsContextTemplate(templates, definition, tickIndex, baseTemplateCount = 1, detailTemplateCount = 1) {
  const source = Array.isArray(templates) && templates.length > 0 ? templates : [];
  if (source.length === 0) return '';

  const offset = getStockNewsTemplateOffset(definition);
  const baseCount = Math.max(1, normalizePositiveStoredInteger(baseTemplateCount, 1));
  const detailCount = Math.max(1, normalizePositiveStoredInteger(detailTemplateCount, 1));
  const contextIndex = Math.floor((normalizeNonNegativeInteger(tickIndex) + offset) / (baseCount * detailCount)) % source.length;
  return source[contextIndex];
}

function joinStockNewsTemplates(...templates) {
  const parts = templates
    .map((template) => String(template ?? '').trim())
    .filter(Boolean);
  if (parts.length === 0) return '{name} 시장 상황 안내가 게시됐습니다';
  return parts.join('. ');
}

function renderStockNewsTemplate(template, definition) {
  return String(template)
    .replaceAll('{name}', definition.name)
    .replaceAll('{sector}', definition.sector);
}

function getStockNewsTemplateOffset(definition) {
  return [...String(definition.id ?? definition.name ?? '')]
    .reduce((sum, character) => sum + character.codePointAt(0), 0);
}

function getOrCreateMoneyProfile(data, guildId, userId, username, now) {
  const profile = getOrCreateLinkedAccountProfile(data, {
    guildId,
    userId,
    username,
    now,
    createDefaultProfile: createDefaultStockMoneyProfile
  });
  profile.userId = String(userId ?? '').trim();
  profile.username = username || profile.username || 'Unknown';
  profile.balance = normalizeStockMoney(profile.balance);
  migrateLegacyWalletsToGold(profile, { now });
  profile.wallets = normalizeWallets(profile.wallets);
  profile.level = normalizePositiveStoredInteger(profile.level, 1);
  profile.xp = normalizeNonNegativeInteger(profile.xp);
  profile.totalXp = normalizeNonNegativeInteger(profile.totalXp);
  profile.createdAt = normalizeNonNegativeInteger(profile.createdAt) || now;
  return profile;
}

function getOptionalMoneyProfile(data, guildId, userId, username, now) {
  try {
    return getOrCreateMoneyProfile(data, guildId, userId, username, now);
  } catch (error) {
    if (isAccountSelectionRequiredError(error)) return null;
    throw error;
  }
}

function createDefaultStockMoneyProfile(userId, username, now = Date.now()) {
  return {
    userId,
    username,
    level: 1,
    xp: 0,
    totalXp: 0,
    balance: 0,
    wallets: normalizeWallets(),
    lastMessageRewardAt: 0,
    lastDailyAt: 0,
    lastDailyDay: null,
    dailyStreak: 0,
    lastFirstMessageBonusDay: null,
    createdAt: now
  };
}

function getOrCreateStockUser(data, guildId, guild, userId, username, moneyProfile = null, now = Date.now()) {
  guild.stocks ??= getOrCreateGlobalStockState(data, guildId);
  const stockUser = getOrCreateLinkedFeatureUserProfile(data, {
    featureKey: 'stocks',
    guildId,
    userId,
    username,
    now,
    createDefaultProfile: createDefaultStockUser
  });
  stockUser.userId = userId;
  stockUser.username = username || stockUser.username || 'Unknown';
  stockUser.holdings = normalizeHoldings(stockUser.holdings, guild);
  stockUser.limitOrders = normalizeLimitOrders(stockUser.limitOrders, guild);
  stockUser.priceAlerts = normalizePriceAlerts(stockUser.priceAlerts, guild);
  stockUser.leveragedPositions = normalizeLeveragedPositions(stockUser.leveragedPositions, guild);
  stockUser.tradeHistory = normalizeTradeHistory(stockUser.tradeHistory, guild);
  stockUser.dividendHistory = normalizeDividendHistory(stockUser.dividendHistory, guild);
  stockUser.realizedProfit = normalizeInteger(stockUser.realizedProfit);
  stockUser.realizedLeveragedProfit = normalizeInteger(stockUser.realizedLeveragedProfit);
  stockUser.pendingDividends = normalizeNonNegativeInteger(stockUser.pendingDividends);
  stockUser.totalDividends = normalizeNonNegativeInteger(stockUser.totalDividends);
  stockUser.claimedDividends = normalizeNonNegativeInteger(stockUser.claimedDividends);
  stockUser.tradeCount = normalizeNonNegativeInteger(stockUser.tradeCount);
  stockUser.leveragedTradeCount = normalizeNonNegativeInteger(stockUser.leveragedTradeCount);
  stockUser.nextOrderSeq = normalizeNonNegativeInteger(stockUser.nextOrderSeq);
  stockUser.nextAlertSeq = normalizeNonNegativeInteger(stockUser.nextAlertSeq);
  stockUser.nextPositionSeq = normalizeNonNegativeInteger(stockUser.nextPositionSeq);
  stockUser.nextTradeSeq = Math.max(
    normalizeNonNegativeInteger(stockUser.nextTradeSeq),
    stockUser.tradeHistory.reduce((max, entry) => Math.max(max, normalizeNonNegativeInteger(entry.sequence)), 0)
  );
  stockUser.nextDividendSeq = Math.max(
    normalizeNonNegativeInteger(stockUser.nextDividendSeq),
    stockUser.dividendHistory.reduce((max, entry) => Math.max(max, normalizeNonNegativeInteger(entry.sequence)), 0)
  );
  stockUser.lastDividendTick = normalizeNonNegativeInteger(stockUser.lastDividendTick);
  stockUser.lastTradeAt = normalizeNonNegativeInteger(stockUser.lastTradeAt);
  migrateLegacyStockLiabilitiesToGold(moneyProfile, stockUser, now);
  mirrorGlobalStockStateToGuild(data, guildId, userId);
  return stockUser;
}

function normalizeStockUserForAlertScan(rawStockUser, guild) {
  const stockUser = rawStockUser && typeof rawStockUser === 'object'
    ? rawStockUser
    : createDefaultStockUser('', 'Unknown');

  stockUser.priceAlerts = normalizePriceAlerts(stockUser.priceAlerts, guild);
  return stockUser;
}

function normalizePriceAlertNotificationBatch(alerts) {
  if (!Array.isArray(alerts)) return [];

  return alerts
    .map((alert) => ({
      guildId: String(alert?.guildId ?? '').trim(),
      userId: String(alert?.userId ?? '').trim(),
      alertId: String(alert?.alertId ?? alert?.id ?? '').trim()
    }))
    .filter((alert) => alert.guildId && alert.userId && alert.alertId);
}

function createDefaultStockUser(userId, username = 'Unknown') {
  return {
    userId,
    username,
    holdings: {},
    limitOrders: {},
    priceAlerts: {},
    leveragedPositions: {},
    tradeHistory: [],
    dividendHistory: [],
    realizedProfit: 0,
    realizedLeveragedProfit: 0,
    pendingDividends: 0,
    totalDividends: 0,
    claimedDividends: 0,
    tradeCount: 0,
    leveragedTradeCount: 0,
    nextOrderSeq: 0,
    nextAlertSeq: 0,
    nextPositionSeq: 0,
    nextTradeSeq: 0,
    nextDividendSeq: 0,
    lastDividendTick: 0,
    lastTradeAt: 0
  };
}

function migrateLegacyStockLiabilitiesToGold(profile, stockUser, now = Date.now()) {
  stockUser.currencyMigration = normalizeStockCurrencyMigration(stockUser.currencyMigration);
  if (stockUser.currencyMigration.unifiedGoldVersion >= UNIFIED_GOLD_STOCK_MIGRATION_VERSION) {
    return stockUser.currencyMigration;
  }
  if (!profile) return stockUser.currencyMigration;

  let convertedReservedCash = 0;
  let cancelledBuyOrders = 0;

  for (const order of Object.values(stockUser.limitOrders)) {
    if (order.status !== 'open' || order.side !== 'buy' || order.reservedCash <= 0) continue;

    const convertedGold = convertLegacyCurrencyAmountToGold(CURRENCY_STOCK, order.reservedCash);
    if (profile && convertedGold > 0) {
      creditCurrency(profile, CURRENCY_STOCK, convertedGold);
    }
    convertedReservedCash += convertedGold;
    cancelledBuyOrders += 1;
    order.reservedCash = 0;
    order.status = 'cancelled';
    order.cancelledAt = normalizeNonNegativeInteger(now);
    order.cancelReason = '통합 골드 정산';
  }

  let convertedLeveragedMargin = 0;
  let convertedLeveragedPositions = 0;

  for (const [positionId, position] of Object.entries(stockUser.leveragedPositions)) {
    const convertedMargin = convertLegacyCurrencyAmountToGold(CURRENCY_STOCK, position.margin);
    convertedLeveragedPositions += 1;
    convertedLeveragedMargin += convertedMargin;

    if (convertedMargin <= 0) {
      delete stockUser.leveragedPositions[positionId];
    } else {
      position.margin = convertedMargin;
      const exposure = calculateLeveragedExposure(position.margin, position.leverage);
      position.notional = exposure.notional;
      position.debt = exposure.debt;
    }
  }

  stockUser.currencyMigration = {
    ...stockUser.currencyMigration,
    unifiedGoldVersion: UNIFIED_GOLD_STOCK_MIGRATION_VERSION,
    unifiedGoldAt: stockUser.currencyMigration.unifiedGoldAt ?? now,
    convertedReservedCash,
    cancelledBuyOrders,
    convertedLeveragedMargin,
    convertedLeveragedPositions
  };

  return stockUser.currencyMigration;
}

function normalizeStockCurrencyMigration(value = {}) {
  const migration = value && typeof value === 'object' ? value : {};
  return {
    ...migration,
    unifiedGoldVersion: normalizeNonNegativeInteger(migration.unifiedGoldVersion),
    unifiedGoldAt: migration.unifiedGoldAt ?? null
  };
}

function normalizeHoldings(holdings = {}, guild = null) {
  const safeHoldings = holdings && typeof holdings === 'object' ? holdings : {};
  const entries = [];

  for (const [stockId, holding] of Object.entries(safeHoldings)) {
    try {
      const normalizedStockId = guild ? normalizeStockIdForGuild(stockId, guild) : normalizeStockId(stockId);
      const normalizedHolding = normalizeHolding(holding);
      if (normalizedHolding.quantity > 0) entries.push([normalizedStockId, normalizedHolding]);
    } catch {
      // Ignore invalid legacy stock ids.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeHolding(holding = {}) {
  const safeHolding = holding && typeof holding === 'object' ? holding : {};
  return {
    quantity: normalizeNonNegativeInteger(safeHolding.quantity),
    averageCost: normalizeNonNegativeInteger(safeHolding.averageCost)
  };
}

function normalizeLimitOrders(orders = {}, guild = null) {
  const safeOrders = orders && typeof orders === 'object' ? orders : {};
  const entries = [];

  for (const [orderId, order] of Object.entries(safeOrders)) {
    try {
      const normalizedOrder = normalizeLimitOrder(order, orderId, guild);
      entries.push([normalizedOrder.id, normalizedOrder]);
    } catch {
      // Ignore invalid legacy orders.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeLimitOrder(order = {}, fallbackId = null, guild = null) {
  const safeOrder = order && typeof order === 'object' ? order : {};
  const id = String(safeOrder.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('지정가 주문 id가 없습니다.');

  return {
    id,
    userId: String(safeOrder.userId ?? '').trim(),
    username: String(safeOrder.username ?? 'Unknown').trim() || 'Unknown',
    stockId: guild ? normalizeStockIdForGuild(safeOrder.stockId, guild) : normalizeStockId(safeOrder.stockId),
    side: normalizeLimitOrderSide(safeOrder.side),
    quantity: normalizePositiveStoredInteger(safeOrder.quantity, 1),
    limitPrice: normalizePositiveStoredInteger(safeOrder.limitPrice, 1),
    status: normalizeOrderStatus(safeOrder.status),
    createdAt: normalizeNonNegativeInteger(safeOrder.createdAt),
    filledAt: normalizeNonNegativeInteger(safeOrder.filledAt),
    cancelledAt: normalizeNonNegativeInteger(safeOrder.cancelledAt),
    fillPrice: normalizeNonNegativeInteger(safeOrder.fillPrice),
    fee: normalizeNonNegativeInteger(safeOrder.fee),
    reservedCash: normalizeNonNegativeInteger(safeOrder.reservedCash),
    reservedQuantity: normalizeNonNegativeInteger(safeOrder.reservedQuantity),
    averageCost: normalizeNonNegativeInteger(safeOrder.averageCost),
    realizedProfit: normalizeInteger(safeOrder.realizedProfit),
    cancelReason: typeof safeOrder.cancelReason === 'string' ? safeOrder.cancelReason : null
  };
}

function normalizePriceAlerts(alerts = {}, guild = null) {
  const safeAlerts = alerts && typeof alerts === 'object' ? alerts : {};
  const entries = [];

  for (const [alertId, alert] of Object.entries(safeAlerts)) {
    try {
      const normalizedAlert = normalizePriceAlert(alert, alertId, guild);
      entries.push([normalizedAlert.id, normalizedAlert]);
    } catch {
      // Ignore invalid legacy alerts.
    }
  }

  return Object.fromEntries(entries);
}

function normalizePriceAlert(alert = {}, fallbackId = null, guild = null) {
  const safeAlert = alert && typeof alert === 'object' ? alert : {};
  const id = String(safeAlert.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('가격 알림 id가 없습니다.');

  return {
    id,
    guildId: normalizeOptionalStringId(safeAlert.guildId),
    userId: String(safeAlert.userId ?? '').trim(),
    username: String(safeAlert.username ?? 'Unknown').trim() || 'Unknown',
    guildId: normalizeOptionalStringId(safeAlert.guildId),
    stockId: guild ? normalizeStockIdForGuild(safeAlert.stockId, guild) : normalizeStockId(safeAlert.stockId),
    condition: normalizeAlertCondition(safeAlert.condition),
    targetPrice: normalizePositiveStoredInteger(safeAlert.targetPrice, 1),
    channelId: normalizeOptionalStringId(safeAlert.channelId),
    status: normalizeAlertStatus(safeAlert.status),
    createdAt: normalizeNonNegativeInteger(safeAlert.createdAt),
    triggeredAt: normalizeNonNegativeInteger(safeAlert.triggeredAt),
    triggeredPrice: normalizeNonNegativeInteger(safeAlert.triggeredPrice),
    notifiedAt: normalizeNonNegativeInteger(safeAlert.notifiedAt),
    deletedAt: normalizeNonNegativeInteger(safeAlert.deletedAt)
  };
}

function normalizeLeveragedPositions(positions = {}, guild = null) {
  const safePositions = positions && typeof positions === 'object' ? positions : {};
  const entries = [];

  for (const [positionId, position] of Object.entries(safePositions)) {
    try {
      const normalizedPosition = normalizeLeveragedPosition(position, positionId, guild);
      entries.push([normalizedPosition.id, normalizedPosition]);
    } catch {
      // Ignore invalid legacy leveraged positions.
    }
  }

  return Object.fromEntries(entries);
}

function normalizeLeveragedPosition(position = {}, fallbackId, guild = null) {
  const safePosition = position && typeof position === 'object' ? position : {};
  const id = String(safePosition.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('레버리지 포지션 id가 없습니다.');
  const leverage = normalizeLeverage(safePosition.leverage);
  const margin = normalizePositiveInteger(safePosition.margin, '증거금');
  const exposure = calculateLeveragedExposure(margin, leverage);
  const durationTurns = normalizeOptionalLeverageDurationTurns(safePosition.durationTurns);
  const openedAtTick = normalizeOptionalNonNegativeInteger(safePosition.openedAtTick);
  const storedExpiresAtTick = normalizeOptionalNonNegativeInteger(safePosition.expiresAtTick);
  const expiresAtTick = storedExpiresAtTick ?? (
    durationTurns !== null && openedAtTick !== null
      ? openedAtTick + durationTurns
      : null
  );
  const inferredOpenedAtTick = openedAtTick ?? (
    durationTurns !== null && expiresAtTick !== null
      ? Math.max(0, expiresAtTick - durationTurns)
      : null
  );

  return {
    id,
    stockId: guild ? normalizeStockIdForGuild(safePosition.stockId, guild) : normalizeStockId(safePosition.stockId),
    side: normalizeLeverageSide(safePosition.side),
    leverage,
    margin,
    notional: normalizePositiveStoredInteger(safePosition.notional, exposure.notional),
    debt: normalizeStoredDebt(safePosition.debt, exposure.debt),
    entryPrice: normalizePositiveStoredInteger(safePosition.entryPrice, 1),
    openedAtTick: inferredOpenedAtTick,
    durationTurns,
    expiresAtTick,
    openedAt: normalizeNonNegativeInteger(safePosition.openedAt)
  };
}

function normalizeTradeHistory(history = [], guild = null) {
  const source = Array.isArray(history) ? history : [];
  return source
    .map((entry, index) => {
      try {
        return normalizeTradeHistoryEntry(entry, `tr_legacy_${index + 1}`, guild);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(compareTimelineEntries)
    .slice(0, RECENT_TRADE_LIMIT);
}

function normalizeTradeHistoryEntry(entry = {}, fallbackId = null, guild = null) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const id = String(safeEntry.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('거래내역 id가 없습니다.');

  return {
    id,
    sequence: normalizeNonNegativeInteger(safeEntry.sequence),
    type: normalizeTradeType(safeEntry.type),
    stockId: normalizeStoredStockId(safeEntry.stockId, guild),
    quantity: normalizeNonNegativeInteger(safeEntry.quantity),
    price: normalizeNonNegativeInteger(safeEntry.price),
    fee: normalizeNonNegativeInteger(safeEntry.fee),
    penalty: normalizeNonNegativeInteger(safeEntry.penalty),
    total: normalizeStockMoney(safeEntry.total),
    realizedProfit: normalizeInteger(safeEntry.realizedProfit),
    at: normalizeNonNegativeInteger(safeEntry.at),
    positionId: typeof safeEntry.positionId === 'string' ? safeEntry.positionId : null,
    side: typeof safeEntry.side === 'string' ? safeEntry.side : null,
    leverage: normalizeNonNegativeInteger(safeEntry.leverage),
    margin: normalizeStockMoney(safeEntry.margin),
    bankruptcyDebtAdded: normalizeStockMoney(safeEntry.bankruptcyDebtAdded)
  };
}

function normalizeDividendHistory(history = [], guild = null) {
  const source = Array.isArray(history) ? history : [];
  return source
    .map((entry, index) => {
      try {
        return normalizeDividendHistoryEntry(entry, `div_legacy_${index + 1}`, guild);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(compareTimelineEntries)
    .slice(0, RECENT_DIVIDEND_LIMIT);
}

function normalizeDividendHistoryEntry(entry = {}, fallbackId = null, guild = null) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const id = String(safeEntry.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('배당 내역 id가 없습니다.');

  const positions = Array.isArray(safeEntry.positions)
    ? safeEntry.positions
      .map((position) => normalizeDividendPosition(position, guild))
      .filter(Boolean)
    : [];
  const amount = normalizeNonNegativeInteger(safeEntry.amount);
  if (amount <= 0 && positions.length === 0) throw new Error('배당 내역 금액이 없습니다.');

  return {
    id,
    sequence: normalizeNonNegativeInteger(safeEntry.sequence),
    tickIndex: normalizeNonNegativeInteger(safeEntry.tickIndex),
    amount,
    at: normalizeNonNegativeInteger(safeEntry.at),
    positions
  };
}

function normalizeDividendPosition(position = {}, guild = null) {
  const safePosition = position && typeof position === 'object' ? position : {};
  try {
    const stockId = normalizeStoredStockId(safePosition.stockId, guild);
    const quantity = normalizeNonNegativeInteger(safePosition.quantity);
    const price = normalizeNonNegativeInteger(safePosition.price);
    const dividendBps = normalizeNonNegativeInteger(safePosition.dividendBps);
    const amount = normalizeNonNegativeInteger(safePosition.amount);
    if (quantity <= 0 || amount <= 0) return null;
    return {
      stockId,
      quantity,
      price,
      dividendBps,
      amount
    };
  } catch {
    return null;
  }
}

function normalizeTradeType(type) {
  const normalized = String(type ?? '').trim();
  return [
    'buy',
    'sell',
    'limit_buy_fill',
    'limit_sell_fill',
    'delisting_cleanup',
    'leverage_open',
    'leverage_close',
    'leverage_settlement',
    'leverage_liquidation'
  ].includes(normalized)
    ? normalized
    : 'buy';
}

function normalizeMarketNews(news = [], guild = null) {
  const source = Array.isArray(news) ? news : [];
  return source
    .map((entry, index) => {
      try {
        return normalizeMarketNewsEntry(entry, `news_legacy_${index + 1}`, guild);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort(compareMarketNewsEntries)
    .slice(0, RECENT_NEWS_LIMIT);
}

function normalizeMarketNewsEntry(entry = {}, fallbackId = null, guild = null) {
  const safeEntry = entry && typeof entry === 'object' ? entry : {};
  const id = String(safeEntry.id ?? fallbackId ?? '').trim();
  if (!id) throw new Error('뉴스 id가 없습니다.');

  return {
    id,
    sequence: normalizeNonNegativeInteger(safeEntry.sequence),
    type: normalizeMarketNewsType(safeEntry.type),
    stockId: normalizeStoredStockId(safeEntry.stockId, guild),
    title: String(safeEntry.title ?? '').trim() || '시장 뉴스',
    message: stripMarketNewsTitlePrefix(safeEntry.message) || '시장 뉴스가 없습니다.',
    tickIndex: normalizeNonNegativeInteger(safeEntry.tickIndex),
    publishedTickIndex: normalizeNonNegativeInteger(safeEntry.publishedTickIndex ?? safeEntry.tickIndex),
    effectiveTickIndex: normalizeNonNegativeInteger(safeEntry.effectiveTickIndex ?? safeEntry.tickIndex),
    impactBps: normalizeInteger(safeEntry.impactBps),
    headlineImpactBps: normalizeInteger(safeEntry.headlineImpactBps ?? safeEntry.impactBps),
    actualImpactBps: normalizeInteger(safeEntry.actualImpactBps ?? safeEntry.impactBps),
    outcome: normalizeMarketNewsOutcome(safeEntry.outcome),
    at: normalizeNonNegativeInteger(safeEntry.at)
  };
}

function normalizeMarketNewsType(type) {
  const normalized = String(type ?? '').trim();
  return ['ipo', 'positive', 'negative', 'risk', 'news'].includes(normalized) ? normalized : 'news';
}

function normalizeMarketNewsOutcome(outcome) {
  const normalized = String(outcome ?? '').trim();
  return ['confirmed', 'muted', 'ignored', 'reversed', 'none'].includes(normalized) ? normalized : 'confirmed';
}

function normalizePriceHistory(history = [], fallbackState = null, fallbackTickIndex = 0, fallbackAt = 0) {
  const source = Array.isArray(history) ? history : [];
  const points = source
    .map(normalizePriceHistoryPoint)
    .filter(Boolean)
    .sort(comparePriceHistoryPoints);

  if (points.length === 0 && fallbackState) {
    const fallbackPoint = normalizePriceHistoryPoint({
      tickIndex: fallbackTickIndex,
      price: fallbackState.price,
      at: fallbackState.updatedAt ?? fallbackAt
    });
    if (fallbackPoint) points.push(fallbackPoint);
  }

  return dedupePriceHistory(points).slice(-PRICE_HISTORY_LIMIT);
}

function appendPriceHistory(history = [], point) {
  const normalizedPoint = normalizePriceHistoryPoint(point);
  const points = normalizePriceHistory(history);
  if (!normalizedPoint) return points;
  return dedupePriceHistory([...points, normalizedPoint]).slice(-PRICE_HISTORY_LIMIT);
}

function normalizePriceHistoryPoint(point = {}) {
  const safePoint = point && typeof point === 'object' ? point : {};
  const price = normalizeNonNegativeInteger(safePoint.price);
  if (price <= 0 && safePoint.price !== 0) return null;
  return {
    tickIndex: normalizeNonNegativeInteger(safePoint.tickIndex),
    price,
    at: normalizeNonNegativeInteger(safePoint.at)
  };
}

function dedupePriceHistory(points) {
  const byTick = new Map();
  for (const point of points.sort(comparePriceHistoryPoints)) {
    byTick.set(point.tickIndex, point);
  }
  return [...byTick.values()].sort(comparePriceHistoryPoints);
}

function comparePriceHistoryPoints(a, b) {
  if (a.tickIndex !== b.tickIndex) return a.tickIndex - b.tickIndex;
  return a.at - b.at;
}

function normalizeStoredStockId(stockId, guild = null) {
  const rawStockId = String(stockId ?? '').trim();
  if (!rawStockId) throw new Error('주식 종목 id가 없습니다.');
  if (guild) return normalizeStockIdForGuild(rawStockId, guild);
  const staticMatched = STOCK_LOOKUP.get(normalizeLookupKey(rawStockId));
  return staticMatched ?? rawStockId;
}

function compareTimelineEntries(a, b) {
  if (b.at !== a.at) return b.at - a.at;
  if ((b.tickIndex ?? 0) !== (a.tickIndex ?? 0)) return (b.tickIndex ?? 0) - (a.tickIndex ?? 0);
  return (b.sequence ?? 0) - (a.sequence ?? 0);
}

function compareMarketNewsEntries(a, b) {
  if ((b.at ?? 0) !== (a.at ?? 0)) return (b.at ?? 0) - (a.at ?? 0);
  if ((b.tickIndex ?? 0) !== (a.tickIndex ?? 0)) return (b.tickIndex ?? 0) - (a.tickIndex ?? 0);
  return (a.sequence ?? 0) - (b.sequence ?? 0);
}

function getStockTradeHistoryIdSet(stockUser) {
  const history = Array.isArray(stockUser?.tradeHistory) ? stockUser.tradeHistory : [];
  return new Set(history
    .map((entry) => String(entry?.id ?? '').trim())
    .filter(Boolean));
}

function getNewLeverageSettlementEntries(stockUser, market, previousTradeIds) {
  return normalizeTradeHistory(stockUser.tradeHistory)
    .filter((entry) =>
      !previousTradeIds.has(entry.id) &&
      (entry.type === 'leverage_settlement' || entry.type === 'leverage_liquidation')
    )
    .map((entry) => cloneTradeHistoryEntry(entry, market));
}

function recordTrade(stockUser, entry) {
  stockUser.tradeHistory = normalizeTradeHistory(stockUser.tradeHistory);
  const maxSequence = stockUser.tradeHistory.reduce((max, item) => Math.max(max, item.sequence), 0);
  const sequence = Math.max(normalizeNonNegativeInteger(stockUser.nextTradeSeq), maxSequence) + 1;
  stockUser.nextTradeSeq = sequence;
  const at = normalizeNonNegativeInteger(entry.at);
  const normalized = normalizeTradeHistoryEntry({
    id: createStockTradeId(at, sequence),
    sequence,
    ...entry,
    at
  });
  stockUser.tradeHistory = [normalized, ...stockUser.tradeHistory]
    .sort(compareTimelineEntries)
    .slice(0, RECENT_TRADE_LIMIT);
}

function recordDividend(stockUser, entry) {
  stockUser.dividendHistory = normalizeDividendHistory(stockUser.dividendHistory);
  const maxSequence = stockUser.dividendHistory.reduce((max, item) => Math.max(max, item.sequence), 0);
  const sequence = Math.max(normalizeNonNegativeInteger(stockUser.nextDividendSeq), maxSequence) + 1;
  stockUser.nextDividendSeq = sequence;
  const at = normalizeNonNegativeInteger(entry.at);
  const normalized = normalizeDividendHistoryEntry({
    id: createStockDividendId(entry.tickIndex, sequence),
    sequence,
    ...entry,
    at
  });
  stockUser.dividendHistory = [normalized, ...stockUser.dividendHistory]
    .sort(compareTimelineEntries)
    .slice(0, RECENT_DIVIDEND_LIMIT);
}

function recordMarketNews(guild, definition, news, effectiveTickIndex, at, publishedTickIndex = Math.max(0, effectiveTickIndex - 1)) {
  if (!news) return;
  const type = normalizeMarketNewsType(news.type);
  guild.stocks.marketNews = normalizeMarketNews(guild.stocks.marketNews, guild);
  const sequence = guild.stocks.marketNews.reduce((max, item) => Math.max(max, item.sequence), 0) + 1;
  const normalized = normalizeMarketNewsEntry({
    id: createMarketNewsId(effectiveTickIndex, definition.id),
    sequence,
    type,
    stockId: definition.id,
    title: news.title ?? formatMarketNewsTitle(type),
    message: stripMarketNewsTitlePrefix(news.message),
    tickIndex: effectiveTickIndex,
    publishedTickIndex,
    effectiveTickIndex,
    impactBps: news.impactBps,
    headlineImpactBps: news.headlineImpactBps ?? news.impactBps,
    actualImpactBps: news.actualImpactBps ?? news.impactBps,
    outcome: news.outcome,
    at
  }, null, guild);
  guild.stocks.marketNews = [
    normalized,
    ...guild.stocks.marketNews.filter((entry) => entry.id !== normalized.id)
  ]
    .sort(compareMarketNewsEntries)
    .slice(0, RECENT_NEWS_LIMIT);
}

function cloneTradeHistoryEntry(entry, market) {
  const stock = safeCloneQuote(entry.stockId, market) ?? stockSnapshot(entry.stockId);
  return {
    ...entry,
    stock
  };
}

function cloneDividendHistoryEntry(entry, market) {
  return {
    ...entry,
    positions: entry.positions.map((position) => ({
      ...position,
      stock: safeCloneQuote(position.stockId, market) ?? stockSnapshot(position.stockId)
    }))
  };
}

function cloneMarketNewsEntry(entry, market) {
  const stock = safeCloneQuote(entry.stockId, market) ?? stockSnapshot(entry.stockId);
  const {
    headlineImpactBps: _headlineImpactBps,
    actualImpactBps: _actualImpactBps,
    outcome: _outcome,
    ...publicEntry
  } = entry;
  return {
    ...publicEntry,
    stock
  };
}

function formatMarketNewsTitle(type) {
  return {
    ipo: '신규상장 공시',
    positive: '시장 공시',
    negative: '시장 공시',
    risk: '시장 공시'
  }[type] ?? '시장 뉴스';
}

function stripMarketNewsTitlePrefix(message) {
  let text = String(message ?? '').trim();
  if (!text) return '';

  let previous;
  do {
    previous = text;
    text = text.replace(/^(시장 공시|신규상장 공시|시장 뉴스)\s*[:：]\s*/u, '').trim();
  } while (text !== previous);

  return text;
}

function buildPortfolio(profile, stockUser, market) {
  const positions = Object.entries(stockUser.holdings)
    .filter(([stockId]) => market.symbols[stockId])
    .map(([stockId, holding]) => {
      const quote = cloneQuote(stockId, market.symbols[stockId]);
      const marketValue = quote.price * holding.quantity;
      const costBasis = holding.averageCost * holding.quantity;
      return {
        stock: quote,
        stockId,
        quantity: holding.quantity,
        averageCost: holding.averageCost,
        marketValue,
        costBasis,
        unrealizedProfit: marketValue - costBasis
      };
    })
    .filter((position) => position.quantity > 0)
    .sort((a, b) => b.marketValue - a.marketValue);
  const stockValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const costBasis = positions.reduce((sum, position) => sum + position.costBasis, 0);
  const leveragedPositions = getEvaluatedLeveragedPositions(stockUser, market);
  const leveragedEquity = leveragedPositions.reduce((sum, position) => sum + position.equity, 0);
  const leveragedDebt = toCompatibleMoneyValue(addMoney(...leveragedPositions.map((position) => position.debt)));
  const leveragedUnrealizedProfit = leveragedPositions.reduce((sum, position) => sum + position.unrealizedProfit, 0);
  const pendingDividends = normalizeNonNegativeInteger(stockUser.pendingDividends);

  return {
    userId: profile.userId,
    username: profile.username,
    cash: getCurrencyBalance(profile, CURRENCY_STOCK),
    bankruptcy: getStockBankruptcySummary(profile),
    stockValue,
    leveragedEquity,
    leveragedDebt,
    pendingDividends,
    totalAssets: toCompatibleMoneyValue(addMoney(
      getCurrencyBalance(profile, CURRENCY_STOCK),
      stockValue,
      leveragedEquity,
      pendingDividends
    )),
    costBasis,
    unrealizedProfit: stockValue - costBasis,
    leveragedUnrealizedProfit,
    realizedProfit: stockUser.realizedProfit,
    realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
    totalDividends: stockUser.totalDividends,
    claimedDividends: stockUser.claimedDividends,
    tradeCount: stockUser.tradeCount,
    positions,
    leveragedPositions
  };
}

function buildDividendSummary(profile, stockUser, market, service, claimedAmount = 0) {
  const intervalTicks = Math.max(1, normalizeNonNegativeInteger(service.dividendIntervalTicks));
  return {
    userId: stockUser.userId,
    username: stockUser.username,
    cash: getCurrencyBalance(profile, CURRENCY_STOCK),
    claimedAmount: normalizeNonNegativeInteger(claimedAmount),
    pendingAmount: normalizeNonNegativeInteger(stockUser.pendingDividends),
    totalDividends: normalizeNonNegativeInteger(stockUser.totalDividends),
    claimedDividends: normalizeNonNegativeInteger(stockUser.claimedDividends),
    currentTick: market.tickIndex,
    intervalTicks,
    nextDividendTick: getNextDividendTick(market.tickIndex, intervalTicks),
    recent: stockUser.dividendHistory
      .map((entry) => cloneDividendHistoryEntry(entry, market))
      .sort(compareTimelineEntries)
      .slice(0, RECENT_DIVIDEND_LIMIT)
  };
}

function getNextDividendTick(currentTick, intervalTicks) {
  const safeCurrentTick = normalizeNonNegativeInteger(currentTick);
  const safeIntervalTicks = Math.max(1, normalizeNonNegativeInteger(intervalTicks));
  const remainder = safeCurrentTick % safeIntervalTicks;
  return remainder === 0
    ? safeCurrentTick + safeIntervalTicks
    : safeCurrentTick + safeIntervalTicks - remainder;
}

function cloneMarket(market, limit = null) {
  const safeLimit = limit === null || limit === undefined
    ? null
    : Math.min(Object.keys(market.symbols).length, Math.max(1, Number(limit) || 12));
  const stocks = Object.keys(market.symbols)
    .map((stockId) => cloneQuote(stockId, market.symbols[stockId]))
    .sort((a, b) => Math.abs(b.changeBps) - Math.abs(a.changeBps));

  return {
    tickIndex: market.tickIndex,
    lastTickAt: market.lastTickAt,
    stocks: safeLimit ? stocks.slice(0, safeLimit) : stocks
  };
}

function cloneQuote(stockId, state) {
  const definition = STOCKS_BY_ID[stockId] ?? (state?.definition ? normalizeDynamicStockDefinition(state.definition, stockId) : null);
  if (!definition || !state) {
    const name = definition?.name ?? stockId;
    throw new Error(`${name}은(는) 아직 상장되지 않았습니다.`);
  }
  return {
    ...definition,
    aliases: [...definition.aliases],
    price: state.price,
    previousPrice: state.previousPrice,
    changeBps: state.changeBps,
    changePercent: Math.round((state.changeBps / 100) * 100) / 100,
    news: state.news,
    status: state.status,
    eventType: state.eventType,
    listedAtTick: state.listedAtTick,
    delistedAtTick: state.delistedAtTick,
    dividendBps: normalizeNonNegativeInteger(state.dividendBps),
    dividendPercent: Math.round((normalizeNonNegativeInteger(state.dividendBps) / 100) * 100) / 100,
    dividendUpdatedAtTick: normalizeNonNegativeInteger(state.dividendUpdatedAtTick),
    updatedAt: state.updatedAt
  };
}

function cloneMoneyProfile(profile) {
  return {
    userId: profile.userId,
    username: profile.username,
    balance: getCurrencyBalance(profile, CURRENCY_STOCK),
    bankruptcy: getStockBankruptcySummary(profile),
    wallets: cloneWallets(profile.wallets)
  };
}

function cloneStockUser(stockUser) {
  return {
    userId: stockUser.userId,
    username: stockUser.username,
    holdings: Object.fromEntries(Object.entries(stockUser.holdings).map(([stockId, holding]) => [stockId, cloneHolding(holding)])),
    limitOrders: structuredClone(stockUser.limitOrders),
    priceAlerts: structuredClone(stockUser.priceAlerts),
    leveragedPositions: structuredClone(stockUser.leveragedPositions),
    tradeHistory: structuredClone(stockUser.tradeHistory),
    dividendHistory: structuredClone(stockUser.dividendHistory),
    realizedProfit: stockUser.realizedProfit,
    realizedLeveragedProfit: stockUser.realizedLeveragedProfit,
    pendingDividends: stockUser.pendingDividends,
    totalDividends: stockUser.totalDividends,
    claimedDividends: stockUser.claimedDividends,
    tradeCount: stockUser.tradeCount,
    leveragedTradeCount: stockUser.leveragedTradeCount,
    nextOrderSeq: stockUser.nextOrderSeq,
    nextAlertSeq: stockUser.nextAlertSeq,
    nextPositionSeq: stockUser.nextPositionSeq,
    nextTradeSeq: stockUser.nextTradeSeq,
    nextDividendSeq: stockUser.nextDividendSeq,
    lastDividendTick: stockUser.lastDividendTick,
    lastTradeAt: stockUser.lastTradeAt,
    currencyMigration: structuredClone(stockUser.currencyMigration ?? null)
  };
}

function buildListingSummary(market, guild = null) {
  const recent = Object.entries(market.symbols)
    .map(([stockId, state]) => cloneQuote(stockId, state))
    .filter((stock) => stock.eventType === 'ipo' && stock.status === 'listed')
    .sort((a, b) => b.listedAtTick - a.listedAtTick)
    .slice(0, 10);
  const upcoming = STOCK_DEFINITIONS
    .filter((definition) => !market.symbols[definition.id] && !isDelistedStockId(guild, definition.id))
    .sort((a, b) => a.listedFromTick - b.listedFromTick)
    .slice(0, 10)
    .map((definition) => ({
      ...definition,
      aliases: [...definition.aliases],
      status: 'upcoming'
    }));

  return {
    tickIndex: market.tickIndex,
    recent,
    upcoming
  };
}

function buildLimitOrderSummary(stockUser, market) {
  const orders = Object.values(stockUser.limitOrders)
    .map((order) => cloneLimitOrder(order, market))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    open: orders.filter((order) => order.status === 'open'),
    recent: orders
      .filter((order) => order.status !== 'open')
      .slice(0, RECENT_ORDER_LIMIT)
  };
}

function buildPriceAlertSummary(stockUser, market) {
  const alerts = Object.values(stockUser.priceAlerts)
    .filter((alert) => alert.status !== 'deleted')
    .map((alert) => clonePriceAlert(alert, market))
    .sort((a, b) => b.createdAt - a.createdAt);

  return {
    active: alerts.filter((alert) => alert.status === 'active'),
    triggered: alerts
      .filter((alert) => alert.status === 'triggered')
      .slice(0, RECENT_ALERT_LIMIT)
  };
}

function getTradableQuote(stockId, market) {
  return getListedQuote(stockId, market);
}

function processMarketSideEffects(data, guildId, guild, market, service) {
  const users = guild.stocks?.users ?? {};
  for (const [userId, rawStockUser] of Object.entries(users)) {
    const username = rawStockUser?.username ?? getLinkedAccountUsername(data, userId);
    const profile = getOptionalMoneyProfile(data, guildId, userId, username, market.lastTickAt);
    if (!profile) continue;
    const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, market.lastTickAt);
    processLimitOrders(profile, stockUser, market, service);
    cleanupDelistedStockUserState(stockUser, market);
    accrueDividends(stockUser, market, service);
    triggerPriceAlerts(stockUser, market);
    settleMaturedLeveragedPositions(profile, stockUser, market);
  }
}

function cleanupDelistedStockUsers(data, guildId, guild, market) {
  const users = guild.stocks?.users ?? {};
  for (const [userId, rawStockUser] of Object.entries(users)) {
    const username = rawStockUser?.username ?? getLinkedAccountUsername(data, userId);
    const profile = getOptionalMoneyProfile(data, guildId, userId, username, market.lastTickAt);
    const stockUser = getOrCreateStockUser(data, guildId, guild, userId, username, profile, market.lastTickAt);
    cleanupDelistedLimitOrders(profile, stockUser, market);
    cleanupDelistedStockUserState(stockUser, market);
    if (profile) {
      settleDelistedLeveragedPositions(profile, stockUser, market);
    }
  }
}

function cleanupDelistedStockUserState(stockUser, market) {
  cleanupDelistedHoldings(stockUser, market);
  cleanupDelistedPriceAlerts(stockUser, market);
}

function cleanupDelistedLimitOrders(profile, stockUser, market) {
  for (const order of Object.values(stockUser.limitOrders)) {
    if (order.status !== 'open') continue;
    const quote = safeCloneQuote(order.stockId, market);
    if (!quote || quote.status !== 'delisted') continue;
    if (!profile && order.side === 'buy' && order.reservedCash > 0) continue;
    cancelOpenLimitOrder(profile, stockUser, order, market.lastTickAt, '상장폐지');
  }
}

function cleanupDelistedHoldings(stockUser, market) {
  for (const [stockId, holding] of Object.entries(stockUser.holdings)) {
    const quote = safeCloneQuote(stockId, market);
    if (!quote || quote.status !== 'delisted') continue;

    const quantity = normalizeNonNegativeInteger(holding.quantity);
    const averageCost = normalizeNonNegativeInteger(holding.averageCost);
    delete stockUser.holdings[stockId];
    if (quantity <= 0) continue;

    const realizedProfit = -(averageCost * quantity);
    stockUser.realizedProfit += realizedProfit;
    stockUser.lastTradeAt = normalizeNonNegativeInteger(market.lastTickAt);
    recordTrade(stockUser, {
      type: 'delisting_cleanup',
      stockId,
      stock: quote,
      quantity,
      price: 0,
      fee: 0,
      total: 0,
      realizedProfit,
      at: market.lastTickAt
    });
  }
}

function cleanupDelistedPriceAlerts(stockUser, market) {
  for (const alert of Object.values(stockUser.priceAlerts)) {
    const shouldDelete = alert.status === 'active' ||
      (alert.status === 'triggered' && normalizeNonNegativeInteger(alert.notifiedAt) <= 0);
    if (!shouldDelete) continue;
    const quote = safeCloneQuote(alert.stockId, market);
    if (!quote || quote.status !== 'delisted') continue;

    alert.status = 'deleted';
    alert.deletedAt = normalizeNonNegativeInteger(market.lastTickAt);
  }
}

function accrueDividends(stockUser, market, service) {
  const intervalTicks = Math.max(1, normalizeNonNegativeInteger(service.dividendIntervalTicks));
  if (market.tickIndex <= 0 || market.tickIndex % intervalTicks !== 0) return null;
  if (stockUser.lastDividendTick >= market.tickIndex) return null;

  stockUser.lastDividendTick = market.tickIndex;
  const positions = calculateDividendPositions(stockUser, market);
  const amount = positions.reduce((sum, position) => sum + position.amount, 0);
  if (amount <= 0) return null;

  stockUser.pendingDividends += amount;
  stockUser.totalDividends += amount;
  recordDividend(stockUser, {
    tickIndex: market.tickIndex,
    at: market.lastTickAt,
    amount,
    positions
  });

  return {
    tickIndex: market.tickIndex,
    amount,
    positions
  };
}

function calculateDividendPositions(stockUser, market) {
  return Object.entries(stockUser.holdings)
    .map(([stockId, holding]) => {
      const quote = safeCloneQuote(stockId, market);
      if (!quote || quote.status !== 'listed') return null;

      const quantity = normalizeNonNegativeInteger(holding.quantity);
      const dividendBps = getDividendBps(quote);
      const amount = Math.floor(quote.price * quantity * dividendBps / 10_000);
      if (quantity <= 0 || amount <= 0) return null;

      return {
        stockId,
        quantity,
        price: quote.price,
        dividendBps,
        amount
      };
    })
    .filter(Boolean);
}

function normalizeDividendBps(value, definition) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    return getInitialDividendBps(definition);
  }
  return clampDividendBps(normalized, definition);
}

function getDividendBps(stock) {
  const normalized = Number(stock?.dividendBps);
  if (Number.isSafeInteger(normalized) && normalized >= 0) return normalized;
  return getInitialDividendBps(stock);
}

function processLimitOrders(profile, stockUser, market, service) {
  for (const order of Object.values(stockUser.limitOrders)) {
    if (order.status !== 'open') continue;
    const quote = safeCloneQuote(order.stockId, market);
    if (!quote) continue;

    if (quote.status === 'delisted') {
      cancelOpenLimitOrder(profile, stockUser, order, market.lastTickAt, '상장폐지');
      continue;
    }

    const shouldFill = order.side === 'buy'
      ? quote.price <= order.limitPrice
      : quote.price >= order.limitPrice;

    if (!shouldFill) continue;
    fillLimitOrder(profile, stockUser, order, quote, service, market.lastTickAt);
  }
}

function fillLimitOrder(profile, stockUser, order, quote, service, now) {
  const subtotal = quote.price * order.quantity;
  const fee = calculateFee(subtotal, service.feeBps);

  order.status = 'filled';
  order.filledAt = normalizeNonNegativeInteger(now);
  order.fillPrice = quote.price;
  order.fee = fee;

  if (order.side === 'buy') {
    const totalCost = subtotal + fee;
    const refund = Math.max(0, order.reservedCash - totalCost);
    if (refund > 0) creditCurrency(profile, CURRENCY_STOCK, refund);
    addHolding(stockUser, order.stockId, order.quantity, quote.price);
    order.reservedCash = 0;
    recordTrade(stockUser, {
      type: 'limit_buy_fill',
      stockId: order.stockId,
      stock: quote,
      quantity: order.quantity,
      price: quote.price,
      fee,
      total: totalCost,
      realizedProfit: 0,
      at: now
    });
  } else {
    const proceeds = subtotal - fee;
    const realizedProfit = proceeds - order.averageCost * order.quantity;
    const credit = creditCurrencyWithReceipt(profile, CURRENCY_STOCK, proceeds);
    stockUser.realizedProfit += realizedProfit;
    order.realizedProfit = realizedProfit;
    order.repayment = credit.repayment;
    order.netProceeds = credit.net;
    order.reservedQuantity = 0;
    recordTrade(stockUser, {
      type: 'limit_sell_fill',
      stockId: order.stockId,
      stock: quote,
      quantity: order.quantity,
      price: quote.price,
      fee,
      total: proceeds,
      realizedProfit,
      at: now
    });
  }

  stockUser.tradeCount += 1;
  stockUser.lastTradeAt = normalizeNonNegativeInteger(now);
}

function cancelOpenLimitOrder(profile, stockUser, order, now, reason = '취소') {
  if (order.side === 'buy' && order.reservedCash > 0) {
    creditCurrency(profile, CURRENCY_STOCK, order.reservedCash);
    order.reservedCash = 0;
  }

  if (order.side === 'sell' && order.reservedQuantity > 0) {
    addHolding(stockUser, order.stockId, order.reservedQuantity, order.averageCost);
    order.reservedQuantity = 0;
  }

  order.status = 'cancelled';
  order.cancelledAt = normalizeNonNegativeInteger(now);
  order.cancelReason = reason;
}

function triggerPriceAlerts(stockUser, market) {
  for (const alert of Object.values(stockUser.priceAlerts)) {
    if (alert.status !== 'active') continue;
    const quote = safeCloneQuote(alert.stockId, market);
    if (!quote) continue;
    const triggered = alert.condition === 'above'
      ? quote.price >= alert.targetPrice
      : quote.price <= alert.targetPrice;
    if (!triggered) continue;

    alert.status = 'triggered';
    alert.triggeredAt = market.lastTickAt;
    alert.triggeredPrice = quote.price;
  }
}

function safeCloneQuote(stockId, market) {
  try {
    if (!market?.symbols?.[stockId]) {
      const delistedRecord = getMarketDelistedStockRecord(market, stockId);
      return delistedRecord ? cloneDelistedStockRecord(delistedRecord) : null;
    }
    return cloneQuote(stockId, market.symbols[stockId]);
  } catch {
    return null;
  }
}

function cloneLimitOrder(order, market, fallbackQuote = null) {
  const quote = fallbackQuote ?? safeCloneQuote(order.stockId, market);
  const stock = quote ?? stockSnapshot(order.stockId);
  return {
    ...order,
    stock
  };
}

function clonePriceAlert(alert, market, fallbackQuote = null) {
  const quote = fallbackQuote ?? safeCloneQuote(alert.stockId, market);
  const stock = quote ?? stockSnapshot(alert.stockId);
  return {
    ...alert,
    stock
  };
}

function stockSnapshot(stockId) {
  const definition = STOCKS_BY_ID[stockId];
  if (!definition) return { id: stockId, name: stockId, symbol: stockId, sector: '알 수 없음', risk: 'stable', aliases: [] };
  return {
    ...definition,
    aliases: [...definition.aliases],
    dividendBps: getInitialDividendBps(definition),
    dividendPercent: Math.round((getInitialDividendBps(definition) / 100) * 100) / 100,
    status: 'upcoming'
  };
}

function addHolding(stockUser, stockId, quantity, price) {
  const holding = stockUser.holdings[stockId] ?? createEmptyHolding();
  const beforeQuantity = holding.quantity;
  const afterQuantity = beforeQuantity + quantity;
  const beforeCost = holding.averageCost * beforeQuantity;
  const afterCost = beforeCost + price * quantity;
  stockUser.holdings[stockId] = {
    quantity: afterQuantity,
    averageCost: Math.round(afterCost / afterQuantity)
  };
}

function removeHolding(stockUser, stockId, quantity) {
  const holding = stockUser.holdings[stockId];
  if (!holding || holding.quantity < quantity) {
    throw new Error('보유 주식 수량이 부족합니다.');
  }
  const remainingQuantity = holding.quantity - quantity;
  if (remainingQuantity <= 0) {
    delete stockUser.holdings[stockId];
    return;
  }
  stockUser.holdings[stockId] = {
    quantity: remainingQuantity,
    averageCost: holding.averageCost
  };
}

function getEvaluatedLeveragedPositions(stockUser, market) {
  return Object.values(stockUser.leveragedPositions)
    .map((position) => {
      const quote = safeCloneQuote(position.stockId, market);
      if (!quote || quote.status === 'delisted') return null;
      return evaluateLeveragedPosition(position, quote, { currentTick: market.tickIndex });
    })
    .filter(Boolean)
    .filter((position) => !position.liquidated)
    .sort((a, b) => b.equity - a.equity);
}

function assertNoOpposingLeveragedPosition(stockUser, stockId, side, quote = null) {
  const oppositeSide = side === 'long' ? 'short' : 'long';
  const existing = Object.values(stockUser.leveragedPositions ?? {})
    .find((position) => position.stockId === stockId && position.side === oppositeSide);

  if (!existing) return;

  const stockName = quote?.name ?? stockId;
  throw new Error(`같은 종목(${stockName})의 반대 방향 레버리지 포지션이 이미 열려 있습니다. 롱/숏 양방향 돈복사를 막기 위해 먼저 기존 포지션을 청산하세요.`);
}

function assertNoStockBankruptcyDebt(profile) {
  const bankruptcy = getStockBankruptcySummary(profile);
  if (compareMoney(bankruptcy.debt, 0) <= 0 && !hasStockBankruptcyDebt(profile)) return;

  throw new Error(`파산채무 ${formatMoney(bankruptcy.debt)}골드가 남아 있어 새 레버리지 진입이 막혔습니다. 골드 수익을 받으면 25%가 자동 상환됩니다.`);
}

function settleMaturedLeveragedPositions(profile, stockUser, market) {
  const settled = [];

  for (const position of Object.values(stockUser.leveragedPositions)) {
    const quote = safeCloneQuote(position.stockId, market);
    if (!quote) continue;
    const delisted = quote.status === 'delisted';
    const evaluated = evaluateLeveragedPosition(position, quote, {
      currentTick: market.tickIndex,
      forceSettlement: delisted
    });
    if (!delisted && !shouldAutoSettleLeveragedPosition(position, evaluated)) continue;

    settled.push(settleLeveragedPosition(profile, stockUser, position, evaluated, {
      at: market.lastTickAt,
      tradeType: getAutoLeverageSettlementTradeType(position, evaluated, delisted),
      autoSettled: true
    }));
  }

  return settled;
}

function settleDelistedLeveragedPositions(profile, stockUser, market) {
  const settled = [];

  for (const position of Object.values(stockUser.leveragedPositions)) {
    const quote = safeCloneQuote(position.stockId, market);
    if (!quote || quote.status !== 'delisted') continue;

    const evaluated = evaluateLeveragedPosition(position, quote, {
      currentTick: market.tickIndex,
      forceSettlement: true
    });
    settled.push(settleLeveragedPosition(profile, stockUser, position, evaluated, {
      at: market.lastTickAt,
      tradeType: getAutoLeverageSettlementTradeType(position, evaluated, true),
      autoSettled: true
    }));
  }

  return settled;
}

function shouldAutoSettleLeveragedPosition(position, evaluated) {
  if (hasLeveragedPositionExpiry(position)) return evaluated.expired;
  return evaluated.liquidated;
}

function getAutoLeverageSettlementTradeType(position, evaluated, delisted = false) {
  if (delisted) {
    return evaluated.liquidated ? 'leverage_liquidation' : 'leverage_settlement';
  }
  return hasLeveragedPositionExpiry(position) ? 'leverage_settlement' : 'leverage_liquidation';
}

function settleLeveragedPosition(profile, stockUser, position, evaluated, {
  at,
  tradeType,
  autoSettled = false,
  settlementCosts = {}
} = {}) {
  delete stockUser.leveragedPositions[position.id];
  const grossPayout = evaluated.equity;
  const costs = applySettlementCosts(grossPayout, settlementCosts);
  const payout = costs.payout;
  const realizedProfit = payout - position.margin;
  const bankruptcyDebtAdded = evaluated.liquidated ? calculateLeverageBankruptcyDebt(position, evaluated) : 0;
  const bankruptcyAfterDebt = compareMoney(bankruptcyDebtAdded, 0) > 0
    ? addStockBankruptcyDebt(profile, bankruptcyDebtAdded, at)
    : getStockBankruptcySummary(profile);
  const credit = payout > 0
    ? creditCurrencyWithReceipt(profile, CURRENCY_STOCK, payout)
    : { repayment: 0, net: 0, bankruptcy: bankruptcyAfterDebt };

  stockUser.realizedLeveragedProfit += realizedProfit;
  stockUser.leveragedTradeCount += 1;
  stockUser.lastTradeAt = normalizeNonNegativeInteger(at);
  recordTrade(stockUser, {
    type: tradeType ?? 'leverage_close',
    stockId: position.stockId,
    stock: evaluated.stock,
    quantity: 0,
    price: evaluated.currentPrice,
    fee: costs.closingFee,
    penalty: costs.penalty,
    total: payout,
    realizedProfit,
    at,
    positionId: position.id,
    side: position.side,
    leverage: position.leverage,
    margin: position.margin,
    bankruptcyDebtAdded
  });

  return {
    positionId: position.id,
    ...evaluated,
    grossPayout,
    payout,
    repayment: credit.repayment,
    netPayout: credit.net,
    bankruptcy: credit.bankruptcy,
    bankruptcyDebtAdded,
    closingFee: costs.closingFee,
    penalty: costs.penalty,
    settlementCostTotal: costs.total,
    earlyClosed: costs.earlyClosed,
    realizedProfit,
    autoSettled,
    profile: cloneMoneyProfile(profile)
  };
}

function calculateEarlyCloseCosts(position, evaluated, service) {
  if (!isEarlyClose(position, evaluated)) {
    return { closingFee: 0, penalty: 0, earlyClosed: false };
  }
  const grossProfit = Math.max(0, evaluated.equity - position.margin);
  return {
    closingFee: calculateFee(position.margin, service.leverageEarlyCloseFeeBps),
    penalty: calculateFee(position.margin, service.leverageEarlyClosePenaltyBps) +
      calculateFee(grossProfit, service.leverageEarlyProfitPenaltyBps),
    earlyClosed: true
  };
}

function applySettlementCosts(grossPayout, settlementCosts = {}) {
  const rawClosingFee = normalizeNonNegativeInteger(settlementCosts.closingFee);
  const rawPenalty = normalizeNonNegativeInteger(settlementCosts.penalty);
  const closingFee = Math.min(grossPayout, rawClosingFee);
  const penalty = Math.min(Math.max(0, grossPayout - closingFee), rawPenalty);
  const total = closingFee + penalty;
  return {
    closingFee,
    penalty,
    total,
    payout: Math.max(0, grossPayout - total),
    earlyClosed: Boolean(settlementCosts.earlyClosed)
  };
}

function isEarlyClose(position, evaluated) {
  return hasLeveragedPositionExpiry(position) && !evaluated.expired;
}

function calculateLeverageBankruptcyDebt(position, evaluated = {}) {
  const margin = normalizeNonNegativeInteger(position?.margin);
  if (margin <= 0) return 0;
  const exposure = calculateLeveragedExposure(margin, position?.leverage);
  const debt = normalizeStoredDebt(evaluated.debt ?? position?.debt, exposure.debt);
  const leveragedLoss = addMoney(margin, normalizeNonNegativeInteger(evaluated.bankruptcyShortfall));
  return toCompatibleMoneyValue(addMoney(debt, leveragedLoss));
}

function evaluateLeveragedPosition(position, quote, options = {}) {
  const currentTick = normalizeOptionalNonNegativeInteger(options.currentTick);
  const forceSettlement = Boolean(options.forceSettlement);
  const expired = hasLeveragedPositionExpiry(position)
    ? currentTick !== null && currentTick >= position.expiresAtTick
    : false;
  const shouldSettleByPrice = forceSettlement || expired || !hasLeveragedPositionExpiry(position);
  const priceChangeBps = calculateChangeBps(quote.price, position.entryPrice);
  const directionalChangeBps = position.side === 'short' ? -priceChangeBps : priceChangeBps;
  const leveragedChangeBps = shouldSettleByPrice ? directionalChangeBps * position.leverage : 0;
  const rawProfit = Math.trunc(position.margin * leveragedChangeBps / 10_000);
  const uncappedEquity = shouldSettleByPrice ? position.margin + rawProfit : position.margin;
  const bankruptcyShortfall = Math.max(0, -uncappedEquity);
  const unrealizedProfit = shouldSettleByPrice ? Math.max(-position.margin, rawProfit) : 0;
  const equity = Math.max(0, position.margin + unrealizedProfit);
  const liquidated = shouldSettleByPrice && equity <= 0;
  const exposure = calculateLeveragedExposure(position.margin, position.leverage);
  const notional = normalizePositiveStoredInteger(position.notional, exposure.notional);
  const debt = normalizeStoredDebt(position.debt, exposure.debt);

  return {
    ...position,
    stock: quote,
    currentPrice: quote.price,
    notional,
    debt,
    priceChangeBps,
    leveragedChangeBps,
    returnPercent: Math.round((leveragedChangeBps / 100) * 100) / 100,
    unrealizedProfit,
    bankruptcyShortfall,
    equity,
    expired,
    remainingTurns: getLeveragedPositionRemainingTurns(position, currentTick),
    liquidated
  };
}

function hasLeveragedPositionExpiry(position) {
  return Number.isSafeInteger(position.expiresAtTick) && position.expiresAtTick > 0;
}

function getLeveragedPositionRemainingTurns(position, currentTick) {
  if (!hasLeveragedPositionExpiry(position) || currentTick === null) return null;
  return Math.max(0, position.expiresAtTick - currentTick);
}

function calculateLeveragedExposure(margin, leverage) {
  const safeMargin = toMoney(normalizePositiveInteger(margin, '증거금'));
  const safeLeverage = Math.max(1, Number(leverage) || 1);
  const notional = safeMargin * BigInt(safeLeverage);
  return {
    notional: toCompatibleMoneyValue(notional),
    debt: toCompatibleMoneyValue(notional > safeMargin ? notional - safeMargin : 0n)
  };
}

function createEmptyHolding() {
  return { quantity: 0, averageCost: 0 };
}

function cloneHolding(holding) {
  return {
    quantity: holding.quantity,
    averageCost: holding.averageCost
  };
}

function calculateFee(amount, feeBps) {
  if (amount <= 0 || feeBps <= 0) return 0;
  return Math.ceil(amount * feeBps / 10_000);
}

function normalizeStockMoney(value) {
  return toCompatibleMoneyValue(normalizeStoredMoney(value));
}

function calculateChangeBps(price, previousPrice) {
  if (previousPrice <= 0) return 0;
  return Math.round((price - previousPrice) * 10_000 / previousPrice);
}

function normalizePositiveInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label}은 1 이상의 정수여야 합니다.`);
  }
  return normalized;
}

function normalizeOptionalNonNegativeInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : null;
}

function normalizeLeverage(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 1 || normalized > MAX_LEVERAGE) {
    throw new Error(`레버리지 배율은 1~${MAX_LEVERAGE} 사이의 정수여야 합니다.`);
  }
  return normalized;
}

function normalizeLeverageDurationTurns(value) {
  const normalized = Number(value ?? DEFAULT_LEVERAGE_DURATION_TURNS);
  if (
    !Number.isSafeInteger(normalized) ||
    normalized < MIN_LEVERAGE_DURATION_TURNS ||
    normalized > MAX_LEVERAGE_DURATION_TURNS
  ) {
    throw new Error(`레버리지 기간은 ${MIN_LEVERAGE_DURATION_TURNS}~${MAX_LEVERAGE_DURATION_TURNS}턴 사이의 정수여야 합니다.`);
  }
  return normalized;
}

function normalizeOptionalLeverageDurationTurns(value) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeLeverageDurationTurns(value);
}

function assertLeverageAllowedForDuration(leverage, durationTurns) {
  const maxLeverage = getMaxLeverageForDuration(durationTurns);
  if (leverage <= maxLeverage) return;
  const longRule = durationTurns < LONG_LEVERAGE_MIN_DURATION_TURNS
    ? ` ${LONG_LEVERAGE_MIN_DURATION_TURNS}턴 이상 기간을 선택하면 1~${MAX_LEVERAGE}배까지 사용할 수 있습니다.`
    : '';
  throw new Error(`레버리지 기간 ${durationTurns}턴에서는 1~${maxLeverage}배까지만 가능합니다.${longRule}`);
}

function getMaxLeverageForDuration(durationTurns) {
  if (durationTurns === null || durationTurns === undefined) return MAX_LEVERAGE;
  return durationTurns >= LONG_LEVERAGE_MIN_DURATION_TURNS
    ? MAX_LEVERAGE
    : SHORT_DURATION_MAX_LEVERAGE;
}

function normalizeLeverageSide(side) {
  const normalized = String(side ?? 'long').trim().toLocaleLowerCase('ko-KR');
  if (['long', '롱', '매수', '상승'].includes(normalized)) return 'long';
  if (['short', '숏', '공매도', '하락'].includes(normalized)) return 'short';
  throw new Error('레버리지 방향은 롱 또는 숏이어야 합니다.');
}

function normalizeStockRisk(risk) {
  const normalized = String(risk ?? 'meme').trim().toLocaleLowerCase('ko-KR');
  if (['stable', 'growth', 'cyclical', 'volatile', 'meme'].includes(normalized)) return normalized;
  return 'meme';
}

function normalizeLimitOrderSide(side) {
  const normalized = String(side ?? 'buy').trim().toLocaleLowerCase('ko-KR');
  if (['buy', 'bid', '매수', '지정가매수'].includes(normalized)) return 'buy';
  if (['sell', 'ask', '매도', '지정가매도'].includes(normalized)) return 'sell';
  throw new Error('지정가 주문 방향은 매수 또는 매도여야 합니다.');
}

function normalizeOrderStatus(status) {
  const normalized = String(status ?? 'open').trim().toLocaleLowerCase('ko-KR');
  if (['open', 'filled', 'cancelled'].includes(normalized)) return normalized;
  return 'open';
}

function normalizeAlertCondition(condition) {
  const normalized = String(condition ?? 'above').trim().toLocaleLowerCase('ko-KR');
  if (['above', 'gte', 'up', '이상', '돌파', '상승'].includes(normalized)) return 'above';
  if (['below', 'lte', 'down', '이하', '하락'].includes(normalized)) return 'below';
  throw new Error('알림 조건은 이상 또는 이하로 선택하세요.');
}

function normalizeAlertStatus(status) {
  const normalized = String(status ?? 'active').trim().toLocaleLowerCase('ko-KR');
  if (['active', 'triggered', 'deleted'].includes(normalized)) return normalized;
  return 'active';
}

function normalizePositiveStoredInteger(value, fallback) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function normalizeStoredDebt(value, fallback) {
  try {
    return toCompatibleMoneyValue(toMoney(value));
  } catch {
    return fallback;
  }
}

function normalizeOptionalStringId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeInteger(value) {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) ? normalized : 0;
}

function areJsonEquivalent(left, right) {
  if (!left || !right) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

function clampInteger(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeLookupKey(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s_\-()]/g, '');
}

function createSymbol(id) {
  return id
    .split('_')
    .map((part) => part.slice(0, 2).toUpperCase())
    .join('')
    .slice(0, 6);
}

function createLeveragedPositionId(now, sequence) {
  return `${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockOrderId(now, sequence) {
  return `ord-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockAlertId(now, sequence) {
  return `al-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockTradeId(now, sequence) {
  return `tr-${normalizeNonNegativeInteger(now).toString(36)}-${sequence.toString(36)}`;
}

function createStockDividendId(tickIndex, sequence) {
  return `div-${normalizeNonNegativeInteger(tickIndex).toString(36)}-${sequence.toString(36)}`;
}

function createMarketNewsId(tickIndex, stockId) {
  return `news-${normalizeNonNegativeInteger(tickIndex).toString(36)}-${normalizeLookupKey(stockId)}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
