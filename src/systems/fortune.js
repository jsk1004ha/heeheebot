import { createHash } from 'node:crypto';

const DAY_MS = 24 * 60 * 60 * 1000;
export const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000;

export const FORTUNE_DATE_CHOICES = Object.freeze({
  today: Object.freeze({ label: '오늘 운세', dayOffset: 0, dayWord: '오늘' }),
  yesterday: Object.freeze({ label: '어제 운세', dayOffset: -1, dayWord: '어제' }),
  tomorrow: Object.freeze({ label: '내일 운세', dayOffset: 1, dayWord: '내일' })
});

export const FORTUNE_MESSAGES = Object.freeze([
  createFortune("大吉(대길)", "기다리던 연락이 반가운 소식으로 돌아옵니다. 오늘은 먼저 웃고 움직이면 좋은 결과가 더 빨리 따라옵니다."),
  createFortune("大吉(대길)", "준비해둔 일이 드디어 성사될 가능성이 큽니다. 망설이지 말고 필요한 말을 꺼내면 좋은 답을 받습니다."),
  createFortune("大吉(대길)", "오늘은 주변의 인정이 분명하게 들어오는 날입니다. 해온 일을 차분히 보여주면 칭찬과 기회가 함께 옵니다."),
  createFortune("大吉(대길)", "막혀 있던 문제가 해결되는 쪽으로 움직입니다. 도움을 요청하면 생각보다 빠르게 손을 내미는 사람이 있습니다."),
  createFortune("大吉(대길)", "새로 시작한 일이 좋은 첫 성과를 냅니다. 작은 성공을 그냥 넘기지 말고 다음 단계까지 이어가세요."),
  createFortune("大吉(대길)", "돈이나 물건과 관련해 기분 좋은 이득이 생길 수 있습니다. 필요한 선택을 정확히 하면 수익도 기대해볼 만합니다."),
  createFortune("大吉(대길)", "오늘은 만남에서 좋은 기회가 열립니다. 예의를 지키며 솔직하게 말하면 관계가 한층 가까워집니다."),
  createFortune("大吉(대길)", "공부나 작업에서 성과가 선명하게 보입니다. 어려웠던 부분이 풀리며 자신감까지 회복됩니다."),
  createFortune("大吉(대길)", "예상하지 못한 선물 같은 일이 생길 수 있습니다. 감사 표현을 바로 하면 좋은 분위기가 더 오래 갑니다."),
  createFortune("大吉(대길)", "부탁이나 제안이 성사되기 좋은 날입니다. 조건을 분명히 말하면 상대도 긍정적으로 움직입니다."),
  createFortune("大吉(대길)", "오늘은 칭찬받을 일이 생깁니다. 눈에 띄려고 애쓰지 않아도 준비한 만큼 인정받습니다."),
  createFortune("大吉(대길)", "작게 시작한 일이 큰 성과로 이어질 수 있습니다. 지금 보이는 기회를 놓치지 말고 한 번 더 밀어보세요."),
  createFortune("大吉(대길)", "관계에서 반가운 화해나 대화가 찾아옵니다. 먼저 부드럽게 다가가면 마음이 빠르게 풀립니다."),
  createFortune("大吉(대길)", "오늘은 운보다 실력이 좋은 결과를 만듭니다. 해온 연습이 드러나고 주변의 인정도 따라옵니다."),
  createFortune("大吉(대길)", "새로운 정보가 좋은 기회로 연결됩니다. 들은 내용을 바로 정리하면 나중에 큰 도움이 됩니다."),
  createFortune("大吉(대길)", "팀으로 하는 일에서 성공 가능성이 높습니다. 역할을 잘 나누면 결과가 기대 이상으로 깔끔합니다."),
  createFortune("大吉(대길)", "오래 미뤄둔 일이 해결될 조짐이 강합니다. 오늘 손을 대면 생각보다 쉽게 마무리됩니다."),
  createFortune("大吉(대길)", "오늘은 좋은 제안을 받을 수 있습니다. 바로 들뜨기보다 핵심 조건을 확인하면 더 크게 얻습니다."),
  createFortune("大吉(대길)", "시험이나 평가에서 준비한 만큼 득점할 수 있습니다. 마지막 확인만 해도 합격에 가까워집니다."),
  createFortune("大吉(대길)", "칭찬 한마디가 더 큰 기회로 이어집니다. 겸손하게 받아들이면 좋은 인상이 오래 남습니다."),
  createFortune("大吉(대길)", "오늘은 회복 속도가 빠릅니다. 지쳤던 마음도 좋은 소식 하나로 가볍게 살아납니다."),
  createFortune("大吉(대길)", "새로운 사람과의 대화에서 좋은 연결이 생깁니다. 너무 꾸미지 않아도 진심이 잘 전달됩니다."),
  createFortune("大吉(대길)", "거래나 약속이 성사되기 좋은 날입니다. 숫자와 시간을 정확히 맞추면 서로 만족할 결과가 납니다."),
  createFortune("大吉(대길)", "오늘은 도움을 받기도 주기도 좋습니다. 서로 필요한 부분이 맞아떨어지며 일이 부드럽게 풀립니다."),
  createFortune("大吉(대길)", "작은 도전이 성공으로 이어질 수 있습니다. 완벽하게 준비하지 못했어도 시작할 만한 날입니다."),
  createFortune("大吉(대길)", "기다리던 답이 반가운 방향으로 옵니다. 너무 재촉하지 않고 내 일을 하고 있으면 좋은 소식이 도착합니다."),
  createFortune("大吉(대길)", "오늘은 좋은 선택을 할 감각이 선명합니다. 여러 갈래 중 실속 있는 기회를 잘 고르게 됩니다."),
  createFortune("大吉(대길)", "창작이나 아이디어에서 성과가 납니다. 떠오른 생각을 바로 적으면 쓸 만한 결과물로 이어집니다."),
  createFortune("大吉(대길)", "가까운 사람에게서 따뜻한 인정이 옵니다. 그동안의 배려가 좋은 말로 돌아오는 날입니다."),
  createFortune("大吉(대길)", "오늘은 이동이나 외출에서 반가운 일이 생깁니다. 시간을 넉넉히 잡으면 좋은 우연을 즐길 수 있습니다."),
  createFortune("大吉(대길)", "돈을 아끼는 선택이 바로 좋은 결과로 보입니다. 불필요한 지출을 막고 만족스러운 수익을 남깁니다."),
  createFortune("大吉(대길)", "어려운 대화가 해결되는 방향으로 갑니다. 차분하게 시작하면 상대도 생각보다 부드럽게 받아들입니다."),
  createFortune("大吉(대길)", "오늘은 노력의 성과가 눈에 보입니다. 작은 기록이라도 남기면 스스로도 확실히 인정하게 됩니다."),
  createFortune("大吉(대길)", "좋은 소식을 나누기 알맞은 날입니다. 혼자만 기뻐하기보다 필요한 사람과 함께 축하하세요."),
  createFortune("大吉(대길)", "새로운 기회가 평범한 말 속에서 나옵니다. 가볍게 넘기지 말고 다시 확인하면 도움이 큽니다."),
  createFortune("大吉(대길)", "오늘은 실수가 있어도 빠르게 해결됩니다. 바로 인정하고 고치면 오히려 좋은 평가를 받습니다."),
  createFortune("大吉(대길)", "미뤄둔 신청이나 문의가 성사될 수 있습니다. 정중하게 보내면 생각보다 긍정적인 답이 옵니다."),
  createFortune("大吉(대길)", "공들인 관계에서 좋은 반응이 돌아옵니다. 짧은 안부만으로도 따뜻한 대화가 이어집니다."),
  createFortune("大吉(대길)", "오늘은 성과를 드러내기 좋은 날입니다. 지나치게 낮추지 말고 해낸 부분을 정확히 말하세요."),
  createFortune("大吉(대길)", "필요했던 도움을 제때 받을 수 있습니다. 혼자 버티기보다 상황을 설명하면 일이 빨리 풀립니다."),
  createFortune("大吉(대길)", "좋은 기분이 하루 전체를 끌고 갑니다. 아침에 잡은 긍정적인 리듬을 저녁까지 이어가세요."),
  createFortune("大吉(대길)", "작은 선의가 큰 인정으로 돌아옵니다. 누군가를 도운 일이 나중에 확실한 힘이 됩니다."),
  createFortune("大吉(대길)", "오늘은 경쟁에서도 좋은 결과를 기대할 만합니다. 무리한 과시보다 집중력이 득점을 만듭니다."),
  createFortune("大吉(대길)", "새 출발에 좋은 기회가 붙습니다. 처음 한 걸음만 제대로 떼면 다음 과정이 훨씬 수월합니다."),
  createFortune("大吉(대길)", "상대가 마음을 열기 좋은 날입니다. 진심을 담아 말하면 해결과 화해가 함께 가까워집니다."),
  createFortune("大吉(대길)", "오늘은 생각보다 큰 성과를 얻을 수 있습니다. 준비한 자료를 꺼내면 좋은 평가가 따라옵니다."),
  createFortune("大吉(대길)", "반가운 제안이 하루 분위기를 바꿉니다. 급하게 답하지 않아도 긍정적인 가능성은 충분합니다."),
  createFortune("大吉(대길)", "건강이나 컨디션이 회복되는 느낌이 뚜렷합니다. 무리하지 않는 선에서 움직이면 활력이 살아납니다."),
  createFortune("大吉(대길)", "오늘은 좋은 사람을 통해 일이 열립니다. 감사 인사를 제대로 전하면 다음 기회까지 이어집니다."),
  createFortune("大吉(대길)", "끝내고 싶던 일이 성공적으로 닫힙니다. 마무리까지 꼼꼼히 챙기면 축하받을 만한 결과가 남습니다."),

  createFortune("吉(길)", "오늘은 무난하게 좋은 방향으로 흘러갑니다. 큰 욕심만 줄이면 작은 소득을 안정적으로 챙깁니다."),
  createFortune("吉(길)", "일정이 순조롭게 맞아떨어집니다. 서두르지 않고 차례대로 움직이면 기분 좋은 마무리가 됩니다."),
  createFortune("吉(길)", "가벼운 부탁은 괜찮은 답을 받을 수 있습니다. 말투를 부드럽게 고르면 도움이 더 쉽게 옵니다."),
  createFortune("吉(길)", "오늘은 정리하는 일이 좋은 효과를 냅니다. 물건 하나만 제자리에 둬도 마음이 안정됩니다."),
  createFortune("吉(길)", "대화에서 편안한 분위기가 생깁니다. 농담은 짧게 하고 고마움은 분명히 말하면 좋습니다."),
  createFortune("吉(길)", "돈을 쓰는 판단이 무난합니다. 비교를 한 번만 더 하면 괜찮은 선택으로 남습니다."),
  createFortune("吉(길)", "컨디션이 안정적으로 이어집니다. 물과 식사를 챙기면 하루 끝까지 기분이 크게 흔들리지 않습니다."),
  createFortune("吉(길)", "오늘은 익숙한 방법이 좋은 결과를 냅니다. 새 방식보다 하던 일을 정확히 하는 편이 편안합니다."),
  createFortune("吉(길)", "작업이나 공부가 무난하게 진행됩니다. 첫 단계만 작게 열면 집중이 조금씩 나아집니다."),
  createFortune("吉(길)", "가까운 사람과의 짧은 대화가 기분을 좋게 합니다. 안부 한마디가 생각보다 오래 남습니다."),
  createFortune("吉(길)", "오늘은 안정적인 선택이 이득입니다. 튀는 길보다 검증된 방법을 고르면 후회가 줄어듭니다."),
  createFortune("吉(길)", "작은 도움을 받을 수 있는 날입니다. 필요한 부분을 정확히 말하면 상대도 부담 없이 움직입니다."),
  createFortune("吉(길)", "기분 전환이 잘 맞습니다. 음악을 바꾸거나 잠깐 걷는 것만으로도 생각이 가볍습니다."),
  createFortune("吉(길)", "오늘은 순조로운 답장이 기대됩니다. 답이 늦어도 분위기는 나쁘지 않으니 편하게 기다리세요."),
  createFortune("吉(길)", "해야 할 일을 하나 끝내면 안정감이 커집니다. 완벽보다 완료를 목표로 잡는 편이 좋습니다."),
  createFortune("吉(길)", "관계에서 무난한 친절이 통합니다. 과하게 챙기지 않아도 기본 예의를 지키면 충분합니다."),
  createFortune("吉(길)", "오늘은 괜찮은 정보를 얻을 수 있습니다. 바로 믿기보다 출처를 확인하면 더 도움이 됩니다."),
  createFortune("吉(길)", "가벼운 약속은 좋은 기억으로 남습니다. 너무 늦게까지 끌지 않으면 편안하게 마무리됩니다."),
  createFortune("吉(길)", "작은 절약이 기분 좋은 소득처럼 느껴집니다. 안 써도 되는 돈을 아끼면 마음이 안정됩니다."),
  createFortune("吉(길)", "오늘은 말투가 결과를 좋게 만듭니다. 같은 내용도 부드럽게 전하면 상대가 편안하게 받아들입니다."),
  createFortune("吉(길)", "익숙한 사람에게 고마움을 전하기 좋습니다. 짧은 표현만으로도 관계가 조금 더 나아집니다."),
  createFortune("吉(길)", "기록해둔 내용이 도움이 됩니다. 메모를 다시 보면 잊었던 할 일이 무난하게 정리됩니다."),
  createFortune("吉(길)", "오늘은 적당한 거리감이 좋습니다. 친절하되 모든 부탁을 다 받아주지 않아도 괜찮습니다."),
  createFortune("吉(길)", "가벼운 운동이 기분을 안정시킵니다. 오래 하지 않아도 몸을 조금 풀면 생각이 편안합니다."),
  createFortune("吉(길)", "오늘은 작은 칭찬을 받을 수 있습니다. 크게 들뜨지 않으면 기분 좋게 받아들일 수 있습니다."),
  createFortune("吉(길)", "선택지가 많다면 단순한 기준이 도움이 됩니다. 고민을 줄이면 괜찮은 결과가 남습니다."),
  createFortune("吉(길)", "일이 빠르지는 않아도 순조롭게 나아갑니다. 중간에 포기하지 않으면 무난한 결과를 얻습니다."),
  createFortune("吉(길)", "오늘은 집안일이나 정리가 잘 맞습니다. 눈에 보이는 공간이 가벼워지면 마음도 편안합니다."),
  createFortune("吉(길)", "대화에서 웃을 일이 생깁니다. 상대의 사정을 먼저 물으면 좋은 분위기가 오래 갑니다."),
  createFortune("吉(길)", "새로운 시도는 작게 하면 괜찮습니다. 시험 삼아 해본 일이 생각보다 좋은 힌트를 줍니다."),
  createFortune("吉(길)", "오늘은 안정적인 루틴이 힘을 냅니다. 평소 하던 순서를 지키면 하루가 덜 피곤합니다."),
  createFortune("吉(길)", "작은 실수는 바로 고치면 무난하게 넘어갑니다. 숨기지 않는 태도가 신뢰에 도움이 됩니다."),
  createFortune("吉(길)", "읽어둔 글이나 공지가 좋은 단서가 됩니다. 저장만 해둔 정보를 다시 보면 쓸모가 있습니다."),
  createFortune("吉(길)", "오늘은 편안한 옷차림이 도움이 됩니다. 괜히 불편한 선택을 피하면 집중도 나아집니다."),
  createFortune("吉(길)", "조언을 들을 일이 있다면 괜찮게 받아보세요. 자존심보다 실속을 보면 결과가 좋습니다."),
  createFortune("吉(길)", "오늘은 약속 시간을 지키는 것만으로도 좋은 인상을 남깁니다. 여유 있게 움직이면 마음도 안정됩니다."),
  createFortune("吉(길)", "기다리는 일이 있어도 너무 붙잡지 마세요. 다른 일을 하는 사이 상황이 조금씩 나아집니다."),
  createFortune("吉(길)", "오늘은 조용히 지나가도 괜찮은 날입니다. 큰 사건이 없어도 편안했다면 충분히 좋은 하루입니다."),
  createFortune("吉(길)", "가벼운 구매는 만족스럽게 남을 수 있습니다. 필요한지 한 번만 확인하면 안정적인 선택이 됩니다."),
  createFortune("吉(길)", "오늘은 협조가 무난하게 이루어집니다. 일을 나누고 시작하면 부담이 가볍게 줄어듭니다."),
  createFortune("吉(길)", "마감이 있는 일은 먼저 건드리면 좋습니다. 조금만 시작해도 마음이 편안해집니다."),
  createFortune("吉(길)", "상대 말을 끝까지 들으면 도움이 되는 단서를 얻습니다. 중간에 끊지 않는 태도가 좋습니다."),
  createFortune("吉(길)", "오늘은 자연스러운 성실함이 좋게 보입니다. 무난하게 평소처럼 하면 인정도 따라옵니다."),
  createFortune("吉(길)", "작은 계획 수정이 하루를 안정시킵니다. 너무 빡빡한 일정은 덜어내는 편이 좋습니다."),
  createFortune("吉(길)", "가벼운 연락을 먼저 해도 괜찮습니다. 답이 늦어도 깊게 해석하지 않으면 마음이 편안합니다."),
  createFortune("吉(길)", "오늘은 쉬운 일부터 처리하면 좋습니다. 작은 완료감이 다음 일을 무난하게 밀어줍니다."),
  createFortune("吉(길)", "식사를 제대로 챙기면 기분이 나아집니다. 대충 넘기지 않는 편이 하루 전체에 좋습니다."),
  createFortune("吉(길)", "새로운 정보는 확인하면 좋은 선택으로 이어집니다. 차분히 비교하면 괜찮은 판단을 합니다."),
  createFortune("吉(길)", "오늘은 가족이나 친구와 편안한 대화가 좋습니다. 짧게 웃고 지나가는 시간이 힘이 됩니다."),
  createFortune("吉(길)", "하루 끝에 무난한 만족이 남습니다. 욕심을 줄이고 기본을 지키면 안정적으로 마무리됩니다."),

  createFortune("中吉(중길)", "오늘은 조건을 잘 맞추면 좋은 결과가 납니다. 급하게 움직이지 말고 필요한 준비부터 확인하세요."),
  createFortune("中吉(중길)", "처음에는 평범해도 천천히 나아집니다. 순서를 정리하면 작은 기회가 분명히 보입니다."),
  createFortune("中吉(중길)", "대화는 차분하게 시작해야 좋습니다. 먼저 듣고 답하면 놓친 조건을 바로 확인할 수 있습니다."),
  createFortune("中吉(중길)", "오늘은 준비한 만큼만 얻는 날입니다. 욕심보다 기준을 세우면 결과가 안정적으로 나아집니다."),
  createFortune("中吉(중길)", "새로운 제안은 한 단계만 살펴보세요. 조건을 확인하면 좋은 부분과 미룰 부분이 나뉩니다."),
  createFortune("中吉(중길)", "돈을 쓰기 전 정리가 필요합니다. 필요한 이유를 적어보면 괜찮은 선택으로 맞출 수 있습니다."),
  createFortune("中吉(중길)", "관계에서는 천천히 다가가면 좋습니다. 서두르지 않으면 상대의 마음을 확인할 기회가 생깁니다."),
  createFortune("中吉(중길)", "공부나 작업은 반복이 도움이 됩니다. 새 자료보다 이미 본 것을 정리하면 이해가 나아집니다."),
  createFortune("中吉(중길)", "오늘은 작은 기준 하나가 중요합니다. 그 기준에 맞추면 흔들리던 선택도 차분히 정리됩니다."),
  createFortune("中吉(중길)", "일정에 변수가 있어도 준비하면 괜찮습니다. 시간을 조금 넉넉히 두면 좋은 흐름으로 돌아옵니다."),
  createFortune("中吉(중길)", "기분이 늦게 올라올 수 있습니다. 오전보다 오후에 판단이 나아지니 중요한 일은 천천히 보세요."),
  createFortune("中吉(중길)", "오늘은 확인 질문이 도움이 됩니다. 알아들은 척하지 않으면 좋은 단서를 놓치지 않습니다."),
  createFortune("中吉(중길)", "작은 기회가 보이면 바로 크게 잡지 마세요. 한 단계만 시험하면 다음 길이 나아집니다."),
  createFortune("中吉(중길)", "협업은 역할을 정리해야 좋아집니다. 누가 무엇을 하는지 확인하면 결과가 차분히 쌓입니다."),
  createFortune("中吉(중길)", "오늘은 몸의 리듬을 맞추는 준비가 필요합니다. 식사와 휴식을 챙기면 집중이 나아집니다."),
  createFortune("中吉(중길)", "답장이 늦어도 차분히 기다리는 편이 좋습니다. 기다리는 동안 할 일을 정리하면 마음이 안정됩니다."),
  createFortune("中吉(중길)", "새로운 시도는 조건을 작게 두면 좋습니다. 실패해도 부담 없는 범위에서 기회를 확인하세요."),
  createFortune("中吉(중길)", "오늘은 목록을 쓰면 도움이 됩니다. 머릿속에만 두지 말고 정리하면 우선순위가 나아집니다."),
  createFortune("中吉(중길)", "남의 말에 바로 반응하지 마세요. 한 번 확인하고 답하면 관계가 좋은 방향으로 유지됩니다."),
  createFortune("中吉(중길)", "작은 인정이 들어올 수 있습니다. 크게 기대하지 말고 차분히 받으면 다음 기회가 보입니다."),
  createFortune("中吉(중길)", "오늘은 이동 전에 시간을 확인하세요. 여유를 만들면 예상 밖의 변수도 무난하게 지나갑니다."),
  createFortune("中吉(중길)", "관계에서는 적당한 농담이 도움이 됩니다. 상대가 피곤해 보이면 바로 멈추는 기준이 필요합니다."),
  createFortune("中吉(중길)", "선택이 어렵다면 덜 후회할 조건을 고르세요. 완벽한 답보다 차분한 판단이 좋습니다."),
  createFortune("中吉(중길)", "오늘은 오래된 일을 정리하면 좋습니다. 새 일보다 밀린 일을 닫는 편이 기회를 만듭니다."),
  createFortune("中吉(중길)", "돈과 시간의 기준을 같이 보세요. 둘 중 하나라도 아끼면 하루가 안정적으로 나아집니다."),
  createFortune("中吉(중길)", "작은 실수는 확인으로 줄일 수 있습니다. 보내기 전 한 번 더 보면 좋은 결과가 남습니다."),
  createFortune("中吉(중길)", "오늘은 조언을 듣고 걸러야 합니다. 필요한 말만 정리하면 판단이 더 나아집니다."),
  createFortune("中吉(중길)", "새로운 만남은 천천히 알아가는 편이 좋습니다. 첫인상보다 다음 대화에서 기회가 생깁니다."),
  createFortune("中吉(중길)", "집중이 들쭉날쭉해도 괜찮습니다. 시간을 짧게 나누면 작업이 조금씩 나아집니다."),
  createFortune("中吉(중길)", "오늘은 말보다 기록이 도움이 됩니다. 중요한 조건을 적어두면 나중에 덜 헷갈립니다."),
  createFortune("中吉(중길)", "기대가 너무 크면 부담이 됩니다. 기준을 현실적으로 맞추면 충분히 좋은 하루가 됩니다."),
  createFortune("中吉(중길)", "상대의 반응이 애매해도 바로 단정하지 마세요. 조금 기다리면 확인할 기회가 옵니다."),
  createFortune("中吉(중길)", "오늘은 정리된 공간이 집중을 돕습니다. 눈앞의 물건 하나만 치워도 생각이 나아집니다."),
  createFortune("中吉(중길)", "해야 할 일이 많다면 순서를 다시 잡으세요. 중요한 단계부터 맞추면 성과가 생깁니다."),
  createFortune("中吉(중길)", "작은 약속을 정확히 지키면 좋습니다. 그 신뢰가 다음 기회로 이어질 수 있습니다."),
  createFortune("中吉(중길)", "오늘은 마음이 쉽게 흔들릴 수 있습니다. 기준을 적어두면 판단이 차분히 나아집니다."),
  createFortune("中吉(중길)", "새 소식은 조건을 확인한 뒤 받아들이세요. 좋은 내용도 세부를 보면 더 정확해집니다."),
  createFortune("中吉(중길)", "공부는 새로운 양보다 정리가 중요합니다. 틀린 부분을 다시 보면 실력이 나아집니다."),
  createFortune("中吉(중길)", "오늘은 도움을 요청하기 전에 필요한 부분을 정리하세요. 말이 분명하면 답도 좋아집니다."),
  createFortune("中吉(중길)", "작은 변화는 괜찮지만 큰 변화는 준비가 필요합니다. 단계별로 맞추면 부담이 줄어듭니다."),
  createFortune("中吉(중길)", "관계의 오해는 확인하면 풀립니다. 감정부터 말하지 말고 사실을 차분히 정리하세요."),
  createFortune("中吉(중길)", "오늘은 오후가 오전보다 낫습니다. 중요한 연락은 조금 기다렸다 보내면 좋은 반응을 얻습니다."),
  createFortune("中吉(중길)", "정해진 규칙을 지키면 기회가 살아납니다. 예외를 만들기보다 기본을 맞추는 편이 좋습니다."),
  createFortune("中吉(중길)", "기분 전환은 짧게 하는 것이 좋습니다. 너무 길어지지 않게 시간을 정하면 하루가 나아집니다."),
  createFortune("中吉(중길)", "오늘은 한 번에 끝내려 하지 마세요. 작게 나눈 단계가 모이면 좋은 결과가 됩니다."),
  createFortune("中吉(중길)", "상대의 부탁은 조건을 확인하고 받아들이세요. 가능한 범위를 말하면 관계가 편안해집니다."),
  createFortune("中吉(중길)", "돈 문제는 차분한 계산이 필요합니다. 숫자를 다시 보면 불필요한 지출을 줄일 기회가 있습니다."),
  createFortune("中吉(중길)", "오늘은 천천히 묻고 확인하면 좋습니다. 모르는 부분을 인정하는 태도가 결과를 나아지게 합니다."),
  createFortune("中吉(중길)", "작은 성과가 늦게 보일 수 있습니다. 기록해두면 오늘의 노력이 분명하게 정리됩니다."),
  createFortune("中吉(중길)", "하루를 정리하며 기준을 다시 세우세요. 내일의 좋은 시작이 오늘의 확인에서 만들어집니다."),

  createFortune("小吉(소길)", "작은 칭찬 하나가 기분을 살립니다. 큰 기대보다 눈앞의 좋은 말 한마디를 챙기세요."),
  createFortune("小吉(소길)", "오늘은 소소한 절약이 힘이 됩니다. 커피 한 잔 값이라도 아끼면 마음이 조금 가볍습니다."),
  createFortune("小吉(소길)", "가벼운 정리가 생각보다 도움이 됩니다. 책상 한쪽만 비워도 집중할 자리가 생깁니다."),
  createFortune("小吉(소길)", "작은 연락 하나가 관계를 부드럽게 합니다. 길게 설명하지 말고 짧게 안부를 전하세요."),
  createFortune("小吉(소길)", "오늘은 하나만 끝내도 충분합니다. 많은 일을 벌이기보다 작은 완료감을 챙기세요."),
  createFortune("小吉(소길)", "소소한 선물이 기분 좋은 기억으로 남습니다. 비싼 것보다 마음을 담은 표현이 좋습니다."),
  createFortune("小吉(소길)", "가벼운 산책이 생각을 정리해줍니다. 오래 움직이지 않아도 작은 전환이 됩니다."),
  createFortune("小吉(소길)", "오늘은 기본을 지키는 일이 이득입니다. 늦지 않고 확인하는 작은 습관이 하루를 지켜줍니다."),
  createFortune("小吉(소길)", "작은 실수는 바로 고치면 됩니다. 크게 걱정하지 말고 빠르게 손보는 편이 좋습니다."),
  createFortune("小吉(소길)", "짧은 휴식이 도움이 됩니다. 무리해서 버티기보다 물 한 잔과 숨 고르기를 챙기세요."),
  createFortune("小吉(소길)", "오늘은 소소한 재미가 있습니다. 큰 이벤트가 없어도 웃을 만한 장면 하나는 남습니다."),
  createFortune("小吉(소길)", "작은 메모가 일을 줄여줍니다. 기억에만 맡기지 않으면 나중에 다시 묻지 않아도 됩니다."),
  createFortune("小吉(소길)", "가벼운 부탁은 받을 만합니다. 다만 감당할 수 있는 하나만 고르는 편이 좋습니다."),
  createFortune("小吉(소길)", "오늘은 주변을 조금만 정리해도 기분이 바뀝니다. 눈에 보이는 변화 하나면 충분합니다."),
  createFortune("小吉(소길)", "작은 절제가 하루를 편하게 만듭니다. 한 번 더 보려던 영상을 멈추면 시간이 남습니다."),
  createFortune("小吉(소길)", "소소한 대화에서 웃음이 생깁니다. 깊은 이야기는 미루고 가벼운 말로 분위기를 챙기세요."),
  createFortune("小吉(소길)", "오늘은 기본 컨디션이 중요합니다. 식사를 챙기고 잠깐 쉬면 작은 일들이 수월해집니다."),
  createFortune("小吉(소길)", "작은 돈을 쓰더라도 만족은 챙길 수 있습니다. 꼭 필요한 하나만 고르면 후회가 적습니다."),
  createFortune("小吉(소길)", "짧은 집중이 잘 맞습니다. 오래 붙잡기보다 20분만 해보면 작은 진전이 보입니다."),
  createFortune("小吉(소길)", "오늘은 소소한 도움을 주기 좋습니다. 문 하나 잡아주거나 알려주는 정도면 충분합니다."),
  createFortune("小吉(소길)", "작은 기다림이 필요합니다. 바로 답이 없어도 다른 일을 하며 마음을 가볍게 두세요."),
  createFortune("小吉(소길)", "가벼운 복습이 도움이 됩니다. 새로 배우기보다 이미 아는 것을 확인하면 안정됩니다."),
  createFortune("小吉(소길)", "오늘은 작은 약속이 중요합니다. 답장하기, 시간 지키기, 확인하기 중 하나를 놓치지 마세요."),
  createFortune("小吉(소길)", "소소한 칭찬을 받으면 잘 받아두세요. 크게 자랑하지 않아도 기분 좋은 힘이 됩니다."),
  createFortune("小吉(소길)", "작은 불편은 바로 조정하세요. 의자나 조명 하나만 바꿔도 하루가 조금 나아집니다."),
  createFortune("小吉(소길)", "오늘은 하나를 덜어내면 편합니다. 해야 할 일을 줄이는 것도 좋은 선택입니다."),
  createFortune("小吉(소길)", "가벼운 인사가 관계를 지켜줍니다. 깊은 대화보다 짧고 따뜻한 말이 어울립니다."),
  createFortune("小吉(소길)", "작은 정보가 쓸모를 찾습니다. 저장해둔 글이나 공지를 한 번 보면 도움이 됩니다."),
  createFortune("小吉(소길)", "오늘은 소소한 성공을 기록하세요. 별것 아닌 일도 적어두면 기분이 안정됩니다."),
  createFortune("小吉(소길)", "짧은 통화나 메시지가 좋습니다. 길게 끌지 않으면 서로 편안하게 끝납니다."),
  createFortune("小吉(소길)", "작은 정산은 오늘 처리하세요. 미루던 금액 하나만 맞춰도 마음이 가볍습니다."),
  createFortune("小吉(소길)", "오늘은 기본 예의가 힘을 냅니다. 인사와 감사 표현만 챙겨도 분위기가 무난합니다."),
  createFortune("小吉(소길)", "소소한 취미가 마음을 풀어줍니다. 오래 하지 않아도 잠깐 즐기면 충분합니다."),
  createFortune("小吉(소길)", "작은 걱정은 종이에 적어보세요. 머릿속에서만 굴리면 더 커 보일 수 있습니다."),
  createFortune("小吉(소길)", "오늘은 하나의 물건을 제자리에 두세요. 작은 정리가 다음 행동을 쉽게 만듭니다."),
  createFortune("小吉(소길)", "가벼운 양보가 피로를 줄입니다. 이겨야 하는 일이 아니라면 조금 물러나도 괜찮습니다."),
  createFortune("小吉(소길)", "작은 기쁨을 일부러 찾아보세요. 맛있는 간식이나 편한 음악이 하루를 살립니다."),
  createFortune("小吉(소길)", "오늘은 유지하는 것만으로도 괜찮습니다. 하던 일을 망치지 않으면 작은 이득이 남습니다."),
  createFortune("小吉(소길)", "짧은 확인 질문이 도움이 됩니다. 애매하게 넘어가지 않으면 나중에 다시 고생하지 않습니다."),
  createFortune("小吉(소길)", "소소한 계획 변경은 괜찮습니다. 힘든 일정 하나를 줄이면 하루가 편안해집니다."),
  createFortune("小吉(소길)", "작은 친절을 받으면 고맙다고 말하세요. 그 한마디가 관계를 부드럽게 만듭니다."),
  createFortune("小吉(소길)", "오늘은 기본 속도를 지키는 편이 좋습니다. 남의 속도에 맞추지 않아도 충분합니다."),
  createFortune("小吉(소길)", "가벼운 청소가 기분 전환이 됩니다. 완벽하게 치우지 않아도 눈앞이 정돈됩니다."),
  createFortune("小吉(소길)", "작은 자료 백업이 도움이 됩니다. 지금 저장해두면 나중에 찾을 때 마음이 편합니다."),
  createFortune("小吉(소길)", "오늘은 한 가지에만 집중하세요. 여러 일을 동시에 잡으면 작은 성과도 놓칠 수 있습니다."),
  createFortune("小吉(소길)", "소소한 안부가 좋은 반응을 부릅니다. 거창한 말보다 짧은 관심이 더 편안합니다."),
  createFortune("小吉(소길)", "작은 비용을 아끼는 선택이 좋습니다. 나중에 필요한 곳에 쓰면 만족이 큽니다."),
  createFortune("小吉(소길)", "오늘은 기본 자세가 중요합니다. 앉은 자리와 화면 밝기만 맞춰도 몸이 조금 편합니다."),
  createFortune("小吉(소길)", "가벼운 웃음이 하루를 덜 무겁게 합니다. 큰 기대 없이 편한 사람과 짧게 이야기하세요."),
  createFortune("小吉(소길)", "작은 마무리를 하나 남기세요. 하루 끝에 닫힌 일이 있으면 마음이 안정됩니다."),

  createFortune("末吉(말길)", "초반에는 답답해도 늦게 풀릴 수 있습니다. 성급하게 포기하지 말고 할 수 있는 일부터 하세요."),
  createFortune("末吉(말길)", "오늘은 기다림이 필요한 날입니다. 바로 결과를 요구하기보다 시간을 두면 나중에 나아집니다."),
  createFortune("末吉(말길)", "오전보다 저녁에 마음이 정리됩니다. 중요한 대화는 조금 늦게 꺼내는 편이 좋습니다."),
  createFortune("末吉(말길)", "처음 반응이 약해도 끝에 기회가 남습니다. 하루를 너무 일찍 판단하지 마세요."),
  createFortune("末吉(말길)", "연락이 늦게 올 수 있습니다. 재촉하지 않고 기다리면 필요한 답은 결국 도착합니다."),
  createFortune("末吉(말길)", "오늘은 천천히 움직여야 합니다. 서두르면 더 꼬이고, 시간을 두면 조금씩 풀립니다."),
  createFortune("末吉(말길)", "작은 지연이 있어도 나중에는 정리됩니다. 끊긴 일을 다시 잇는 데 집중하세요."),
  createFortune("末吉(말길)", "처음 들은 말에 실망하지 마세요. 시간이 지나면 뒤에 숨은 사정을 알게 됩니다."),
  createFortune("末吉(말길)", "큰 결정은 조금 미루는 편이 좋습니다. 나중에 보면 더 안전한 선택지가 보입니다."),
  createFortune("末吉(말길)", "후반으로 갈수록 컨디션이 나아집니다. 아침부터 무리하지 말고 힘을 아껴두세요."),
  createFortune("末吉(말길)", "오늘은 답이 늦게 보이는 날입니다. 억지로 결론내리지 말고 확인할 시간을 남기세요."),
  createFortune("末吉(말길)", "일정이 조금 밀릴 수 있습니다. 여유를 두고 기다리면 큰 문제 없이 지나갑니다."),
  createFortune("末吉(말길)", "말이 늦게 전달될 수 있습니다. 중요한 내용은 나중에 한 번 더 확인하는 편이 안전합니다."),
  createFortune("末吉(말길)", "처음 시작은 느려도 괜찮습니다. 한 번 흐름이 붙으면 저녁에는 생각보다 나아집니다."),
  createFortune("末吉(말길)", "오늘은 천천히 읽고 천천히 보내야 합니다. 서두른 문장보다 늦은 확인이 낫습니다."),
  createFortune("末吉(말길)", "관계에서는 시간이 약이 됩니다. 바로 풀려고 밀어붙이지 않으면 나중에 대화가 편해집니다."),
  createFortune("末吉(말길)", "계획이 한 번 바뀔 수 있습니다. 바뀐 순서를 받아들이면 뒤에 일이 조금씩 정리됩니다."),
  createFortune("末吉(말길)", "작은 실수가 늦게 발견될 수 있습니다. 제출 전, 전송 전 확인 시간을 꼭 남기세요."),
  createFortune("末吉(말길)", "오늘은 결과보다 과정이 늦게 빛납니다. 눈에 띄지 않아도 해둔 일이 나중에 도움이 됩니다."),
  createFortune("末吉(말길)", "돈을 쓰고 싶다면 저녁까지 기다려보세요. 시간이 지나면 필요 없는 지출이 보입니다."),
  createFortune("末吉(말길)", "연락은 짧게 하고 확인은 분명하게 하세요. 애매한 표현은 뒤에 다시 묻게 됩니다."),
  createFortune("末吉(말길)", "늦게 시작해도 괜찮습니다. 대신 시작한 뒤에는 중간마다 확인하며 천천히 가세요."),
  createFortune("末吉(말길)", "주변 분위기는 천천히 풀립니다. 처음 반응만 보고 마음을 접지 않는 편이 좋습니다."),
  createFortune("末吉(말길)", "오래된 일을 정리하면 뒤가 편해집니다. 새 일보다 밀린 일을 닫는 데 시간을 쓰세요."),
  createFortune("末吉(말길)", "작은 불편이 계속 신경 쓰일 수 있습니다. 참기보다 나중에 차분히 조정하는 편이 낫습니다."),
  createFortune("末吉(말길)", "좋은 소식도 조건을 늦게 확인해야 합니다. 바로 들뜨지 않으면 실수를 줄일 수 있습니다."),
  createFortune("末吉(말길)", "마음이 늦게 안정됩니다. 오전에 흔들렸다고 하루를 망쳤다고 생각하지 마세요."),
  createFortune("末吉(말길)", "정리되지 않은 말이 오갈 수 있습니다. 기록을 남기면 뒤에 덜 헷갈립니다."),
  createFortune("末吉(말길)", "약속을 새로 잡는다면 여유 시간을 넣으세요. 빠듯한 일정은 늦게 꼬일 수 있습니다."),
  createFortune("末吉(말길)", "누군가의 반응이 늦을 수 있습니다. 기다림이 더 좋은 답을 만드는 날입니다."),
  createFortune("末吉(말길)", "작은 성공은 늦게 알아차릴 수 있습니다. 담백하게 지나가도 뒤에 힘이 됩니다."),
  createFortune("末吉(말길)", "이동이나 준비에 시간이 더 걸릴 수 있습니다. 평소보다 조금 일찍 움직이세요."),
  createFortune("末吉(말길)", "감정이 늦게 가라앉습니다. 바로 대답하지 말고 시간을 두면 말이 부드러워집니다."),
  createFortune("末吉(말길)", "모르는 척 넘어가기보다 나중에 확인하세요. 작은 의문이 뒤에 커질 수 있습니다."),
  createFortune("末吉(말길)", "새로운 제안은 천천히 검토하세요. 지금 좋아 보여도 조건은 뒤에 다시 보일 수 있습니다."),
  createFortune("末吉(말길)", "집중이 끊겨도 늦게 다시 붙일 수 있습니다. 포기하지 말고 시작점을 작게 다시 잡으세요."),
  createFortune("末吉(말길)", "관계의 서운함은 오늘 바로 결론내리지 마세요. 시간이 지난 뒤에 말하면 더 낫습니다."),
  createFortune("末吉(말길)", "돈과 시간 중 하나는 아끼는 편이 좋습니다. 둘 다 쓰려 하면 뒤에 피곤함이 남습니다."),
  createFortune("末吉(말길)", "작은 정리는 늦게 효과를 냅니다. 당장 티가 안 나도 해두면 내일 편합니다."),
  createFortune("末吉(말길)", "오래 걸리는 일에 조급해질 수 있습니다. 타이머를 정하고 조금씩 나누어 진행하세요."),
  createFortune("末吉(말길)", "다른 사람의 사정을 기다려주는 편이 좋습니다. 이해가 늦게 와도 말은 더 부드러워집니다."),
  createFortune("末吉(말길)", "새 말을 꺼내기보다 기존 약속을 확인하세요. 오늘은 벌리는 것보다 뒤에 할 일을 정리하는 날입니다."),
  createFortune("末吉(말길)", "기분 좋은 일은 늦게 올 수 있습니다. 초반이 심심해도 하루 끝까지 너무 단정하지 마세요."),
  createFortune("末吉(말길)", "실속은 천천히 보입니다. 당장 박수받지 않아도 해야 할 일을 하면 됩니다."),
  createFortune("末吉(말길)", "작은 오해는 뒤에 풀릴 수 있습니다. 말보다 확인 문장 하나가 관계를 지켜줍니다."),
  createFortune("末吉(말길)", "몸이 늦게 풀립니다. 중요한 일은 컨디션이 올라온 뒤에 잡는 편이 좋습니다."),
  createFortune("末吉(말길)", "급한 마음이 가장 큰 방해입니다. 천천히 해도 되는 일은 정말 천천히 하세요."),
  createFortune("末吉(말길)", "후반에 웃을 여지가 있습니다. 초반의 작은 꼬임에 하루 전체를 맡기지 마세요."),
  createFortune("末吉(말길)", "정리되지 않은 감정은 잠깐 덮어두어도 됩니다. 시간이 지나면 말할 문장이 더 부드러워집니다."),
  createFortune("末吉(말길)", "마무리를 서두르지 않는 편이 좋습니다. 한 번 더 보면 빠진 부분이 뒤늦게 보입니다."),

  createFortune("凶(흉)", "오늘은 말보다 침묵이 안전합니다. 억울해도 바로 반박하지 말고 상황을 한 번 더 확인하세요."),
  createFortune("凶(흉)", "새로운 일을 크게 벌리기에는 무리입니다. 이미 시작한 일을 정리하는 데 집중하는 편이 낫습니다."),
  createFortune("凶(흉)", "돈을 쓰기 전에 꼭 멈추세요. 지금 사고 싶은 것과 정말 필요한 것은 다를 수 있습니다."),
  createFortune("凶(흉)", "피곤함이 말투에 묻어날 수 있으니 주의하세요. 중요한 대화는 쉬고 난 뒤 하는 편이 안전합니다."),
  createFortune("凶(흉)", "작은 오해가 커지기 쉬운 날입니다. 농담도 상대가 받을 상태인지 먼저 확인하세요."),
  createFortune("凶(흉)", "서두르면 실수가 따라옵니다. 늦어도 정확하게 하는 편이 더 안전합니다."),
  createFortune("凶(흉)", "남의 싸움에는 끼지 않는 편이 좋습니다. 중재하려다 괜히 피곤해질 수 있으니 조심하세요."),
  createFortune("凶(흉)", "답장이 마음에 안 들어도 바로 해석하지 마세요. 피곤한 상상은 사실보다 빨리 커지니 주의가 필요합니다."),
  createFortune("凶(흉)", "중요한 물건을 놓치기 쉬운 날입니다. 나가기 전 지갑, 휴대폰, 열쇠를 다시 확인하세요."),
  createFortune("凶(흉)", "체력이 먼저 떨어질 수 있습니다. 약속을 줄이고 쉬는 시간을 꼭 남겨두세요."),
  createFortune("凶(흉)", "감정적인 결론은 피하는 편이 좋습니다. 오늘 판단한 일이 내일은 다르게 보일 수 있습니다."),
  createFortune("凶(흉)", "일정이 꼬이면 탓할 사람을 찾지 마세요. 새 순서를 잡는 것이 손해를 줄입니다."),
  createFortune("凶(흉)", "장문의 메시지는 조심해야 합니다. 보내기 전에 한 번 줄이면 오해를 피할 수 있습니다."),
  createFortune("凶(흉)", "작은 실수를 숨기면 일이 커질 수 있습니다. 빨리 말하고 빨리 고치는 편이 안전합니다."),
  createFortune("凶(흉)", "새로운 약속은 주의해서 잡으세요. 오늘 쉽게 대답하면 나중에 부담으로 돌아올 수 있습니다."),
  createFortune("凶(흉)", "게임이나 승부에서는 쉬는 판단이 필요합니다. 지고 있을 때 더 걸지 않는 편이 안전합니다."),
  createFortune("凶(흉)", "소문이나 전달 말은 특히 주의하세요. 확인하지 않은 이야기는 옮기지 않는 편이 좋습니다."),
  createFortune("凶(흉)", "집중이 쉽게 끊기니 무리하지 마세요. 어려운 일보다 단순한 정리부터 처리하는 편이 낫습니다."),
  createFortune("凶(흉)", "상대의 표정 하나에 너무 흔들리지 마세요. 해석보다 확인이 더 안전합니다."),
  createFortune("凶(흉)", "돈과 관련된 부탁은 바로 답하지 마세요. 친한 사람이어도 조건을 확인하는 편이 좋습니다."),
  createFortune("凶(흉)", "말실수의 여지가 있습니다. 농담을 줄이고 필요한 말만 남기면 문제가 줄어듭니다."),
  createFortune("凶(흉)", "피곤한 상태에서 결정하면 후회가 남을 수 있습니다. 중요한 선택은 잠깐 미루세요."),
  createFortune("凶(흉)", "작은 지연에 예민해지지 않도록 조심하세요. 조금 늦어도 큰일은 아니니 숨을 고르세요."),
  createFortune("凶(흉)", "정리되지 않은 공간이 더 피곤하게 느껴집니다. 무리하지 말고 눈앞의 물건 하나만 치우세요."),
  createFortune("凶(흉)", "대화에서 이기려 하지 마세요. 오해를 줄이는 말이 더 중요합니다."),
  createFortune("凶(흉)", "새로운 정보를 바로 믿기 어렵습니다. 캡처, 링크, 날짜를 확인한 뒤 움직이세요."),
  createFortune("凶(흉)", "작은 부탁도 부담스럽게 느껴질 수 있습니다. 무리하면 나중에 더 지치니 줄이세요."),
  createFortune("凶(흉)", "건강 신호를 무시하지 않도록 주의하세요. 괜찮은 척하다가 하루 전체가 무거워질 수 있습니다."),
  createFortune("凶(흉)", "답답한 일이 있어도 바로 폭발하지 않도록 조심하세요. 시간이 지나야 말이 정리됩니다."),
  createFortune("凶(흉)", "약속 시간에 변수가 생길 수 있습니다. 평소보다 일찍 준비해 실수를 줄이세요."),
  createFortune("凶(흉)", "비교는 마음을 다치게 할 수 있으니 피하세요. 남보다 내가 놓친 기본을 먼저 챙기세요."),
  createFortune("凶(흉)", "결제나 송금은 숫자를 다시 확인하세요. 작은 착각이 귀찮은 정정으로 이어질 수 있습니다."),
  createFortune("凶(흉)", "오늘은 무리한 부탁을 거절해도 됩니다. 감당 못 할 친절은 나중에 짜증으로 바뀔 수 있습니다."),
  createFortune("凶(흉)", "말이 꼬이면 멈추는 편이 낫습니다. 더 설명하려다 더 복잡해질 수 있으니 조심하세요."),
  createFortune("凶(흉)", "새 물건보다 있는 물건을 잘 쓰는 쪽이 좋습니다. 괜한 구매는 만족이 짧아 손해입니다."),
  createFortune("凶(흉)", "감정이 올라오면 화면을 잠깐 내려놓으세요. 바로 보내는 메시지는 조심하는 편이 좋습니다."),
  createFortune("凶(흉)", "일을 미루고 싶어질 수 있습니다. 그렇다면 가장 작은 부분만 처리하고 멈추는 편이 낫습니다."),
  createFortune("凶(흉)", "주변 소음에 쉽게 지칠 수 있으니 무리하지 마세요. 조용한 시간을 일부러 만들어야 합니다."),
  createFortune("凶(흉)", "상대의 말투가 거슬려도 바로 받아치지 마세요. 반응을 늦추는 사람이 덜 손해 봅니다."),
  createFortune("凶(흉)", "중요한 파일이나 자료는 확인하고 백업하세요. 잃어버린 뒤 찾는 것보다 지금 저장하는 편이 쉽습니다."),
  createFortune("凶(흉)", "무리한 자신감이 위험합니다. 잘 아는 일도 기본 확인을 빼먹지 마세요."),
  createFortune("凶(흉)", "작은 서운함을 크게 키우지 않도록 주의하세요. 마음속 확대경을 내려놓으세요."),
  createFortune("凶(흉)", "새로운 모임이나 약속은 피로가 클 수 있습니다. 꼭 필요하지 않다면 조용히 쉬는 편이 낫습니다."),
  createFortune("凶(흉)", "오늘은 말보다 기록이 안전합니다. 실수를 피하려면 중요한 내용은 적어두세요."),
  createFortune("凶(흉)", "기분이 급해지면 실수가 가까워집니다. 속도를 줄이고 한 번씩 확인하는 편이 좋습니다."),
  createFortune("凶(흉)", "남의 기대를 다 맞추려 무리하지 마세요. 가능한 만큼만 하는 것이 오래 갑니다."),
  createFortune("凶(흉)", "농담이 오해로 바뀌기 쉬운 날입니다. 애매하면 따뜻한 말로 바꾸세요."),
  createFortune("凶(흉)", "식사와 잠을 대충 넘기면 바로 티가 납니다. 기본을 확인하는 것이 가장 안전합니다."),
  createFortune("凶(흉)", "작은 손해를 인정하면 큰 손해를 막습니다. 괜히 만회하려고 더 들어가지 마세요."),
  createFortune("凶(흉)", "조용히 지나가는 것이 좋습니다. 말실수를 줄이려면 절반만 말해도 충분합니다."),

  createFortune("大凶(대흉)", "오늘은 새 판을 벌이지 마세요. 큰 손해를 막으려면 이미 켜둔 불을 끄는 데 집중하세요."),
  createFortune("大凶(대흉)", "중요한 결정은 가능하면 미루세요. 지금의 확신은 피곤함과 섞여 있어 위험합니다."),
  createFortune("大凶(대흉)", "말이 길어질수록 분쟁이 커질 수 있습니다. 꼭 필요한 말만 하고 나머지는 내일로 넘기세요."),
  createFortune("大凶(대흉)", "큰돈을 쓰는 일은 피하세요. 할인이나 한정이라는 말에 바로 움직이면 손해가 커질 수 있습니다."),
  createFortune("大凶(대흉)", "감정적인 답장은 보내지 마세요. 쓰고 싶으면 메모장에만 쓰고 전송은 보류하는 편이 안전합니다."),
  createFortune("大凶(대흉)", "몸이 보내는 경고를 무시하지 마세요. 무리하면 하루 전체가 무너질 수 있으니 쉬세요."),
  createFortune("大凶(대흉)", "남의 싸움에는 절대 끼지 마세요. 괜히 들어가면 큰 피로와 오해를 함께 떠안을 수 있습니다."),
  createFortune("大凶(대흉)", "확인하지 않은 말은 옮기지 마세요. 작은 전달이 큰 분쟁으로 돌아올 수 있습니다."),
  createFortune("大凶(대흉)", "무리한 약속은 잡지 않는 편이 좋습니다. 거절보다 나중의 손해가 훨씬 클 수 있습니다."),
  createFortune("大凶(대흉)", "실수했을 때 숨기지 마세요. 빨리 인정하는 것이 큰 손해를 막는 가장 안전한 방법입니다."),
  createFortune("大凶(대흉)", "게임이나 투자처럼 승부가 있는 일은 피하세요. 만회하려는 마음이 오늘 가장 위험합니다."),
  createFortune("大凶(대흉)", "늦었다고 급하게 뛰지 마세요. 서두르다 더 큰 문제를 만들 수 있으니 멈추고 확인하세요."),
  createFortune("大凶(대흉)", "관계에서 결론을 내리면 위험합니다. 서운함은 적어두고 대화는 내일로 미루세요."),
  createFortune("大凶(대흉)", "중요한 파일과 메시지는 다시 확인하세요. 저장했다고 믿은 것이 빠져 있으면 큰 손해가 납니다."),
  createFortune("大凶(대흉)", "자존심을 세우는 말은 금물입니다. 이기는 말보다 조용히 물러나는 선택이 안전합니다."),
  createFortune("大凶(대흉)", "피곤하면 판단이 날카로워집니다. 날카로운 판단이 정확한 것은 아니니 큰 결정은 보류하세요."),
  createFortune("大凶(대흉)", "새로운 사람을 평가하지 마세요. 오늘의 첫인상만으로 결론내리면 큰 오해가 생길 수 있습니다."),
  createFortune("大凶(대흉)", "물건을 잃어버리기 쉬운 날입니다. 자리를 옮길 때마다 주변을 확인하고 조심하세요."),
  createFortune("大凶(대흉)", "답답해도 폭발하지 마세요. 오늘의 화는 큰 분쟁으로 번질 수 있으니 시간을 두세요."),
  createFortune("大凶(대흉)", "감당 못 할 부탁은 피하세요. 무리한 친절이 오래가는 손해로 바뀔 수 있습니다."),
  createFortune("大凶(대흉)", "약속을 늘리지 말고 줄이세요. 빈 시간을 만드는 것이 오늘의 가장 큰 방어입니다."),
  createFortune("大凶(대흉)", "큰소리치면 수습이 어려울 수 있습니다. 할 수 있는 만큼만 말하고 위험한 장담은 피하세요."),
  createFortune("大凶(대흉)", "지금 당장 사야 할 것처럼 보여도 미루세요. 내일 보면 손해를 피한 선택이 됩니다."),
  createFortune("大凶(대흉)", "사소한 농담도 날카롭게 들릴 수 있습니다. 조심해서 다정하게 말하는 편이 안전합니다."),
  createFortune("大凶(대흉)", "계획이 틀어져도 억지로 밀지 마세요. 오늘은 우회해야 큰 손해를 줄일 수 있습니다."),
  createFortune("大凶(대흉)", "중요한 대화는 강하게 밀어붙이지 마세요. 단호함이 공격으로 들리면 분쟁이 커집니다."),
  createFortune("大凶(대흉)", "숫자, 시간, 장소는 세 번 확인하세요. 작은 착각이 큰 사고로 번질 수 있습니다."),
  createFortune("大凶(대흉)", "남의 분위기에 휩쓸려 결정하지 마세요. 내 상황을 보지 않으면 손해가 큽니다."),
  createFortune("大凶(대흉)", "감정이 앞설 때는 화면을 끄세요. 보내지 않은 메시지가 오늘의 큰 문제를 막습니다."),
  createFortune("大凶(대흉)", "몸과 마음이 따로 움직일 수 있습니다. 중요한 일은 회복한 뒤 처리하고 오늘은 쉬세요."),
  createFortune("大凶(대흉)", "작은 손해를 인정해야 큰 손해를 막습니다. 아까워서 붙잡는 일이 더 비싸질 수 있습니다."),
  createFortune("大凶(대흉)", "새로운 논쟁은 시작하지 마세요. 맞는 말을 해도 위험한 결과만 남을 수 있습니다."),
  createFortune("大凶(대흉)", "상대의 침묵을 나쁜 뜻으로 단정하지 마세요. 성급한 해석이 큰 오해를 만들 수 있습니다."),
  createFortune("大凶(대흉)", "무리한 일정은 취소하는 편이 좋습니다. 하나를 줄여야 몸과 마음의 손해를 막습니다."),
  createFortune("大凶(대흉)", "급한 결제는 특히 위험합니다. 장바구니에 넣고 닫는 것이 오늘의 안전한 선택입니다."),
  createFortune("大凶(대흉)", "잘못 들은 말이 문제를 만들 수 있습니다. 큰 오해를 피하려면 다시 확인하세요."),
  createFortune("大凶(대흉)", "기분을 증명하려 들지 마세요. 조용히 지나갈 일을 크게 만들 위험이 있습니다."),
  createFortune("大凶(대흉)", "일이 막히면 억지로 뚫지 말고 멈추세요. 멈추는 것이 오늘은 큰 손해를 피하는 능력입니다."),
  createFortune("大凶(대흉)", "사과가 필요하다면 짧고 분명하게 하세요. 길게 설명하면 변명처럼 들려 분쟁이 커집니다."),
  createFortune("大凶(대흉)", "단체 대화에서는 특히 조심하세요. 한 줄 농담이 오래 남는 캡처가 될 수 있습니다."),
  createFortune("大凶(대흉)", "컨디션이 흔들리면 판단도 흔들립니다. 카페인보다 물과 휴식이 필요하니 쉬세요."),
  createFortune("大凶(대흉)", "남을 설득하려고 애쓰지 마세요. 분쟁을 피하려면 대화를 짧게 끝내는 편이 안전합니다."),
  createFortune("大凶(대흉)", "작은 약속을 놓치면 신뢰가 크게 흔들릴 수 있습니다. 큰일이 되기 전에 먼저 말하세요."),
  createFortune("大凶(대흉)", "비교는 피하세요. 남의 결과를 오래 들여다보면 마음의 손해가 커질 수 있습니다."),
  createFortune("大凶(대흉)", "새로운 일을 시작하고 싶어도 보류하세요. 오늘은 시작보다 점검이 훨씬 안전합니다."),
  createFortune("大凶(대흉)", "말을 참는 것이 답답해도 도움이 됩니다. 침묵이 큰 문제를 줄이는 날입니다."),
  createFortune("大凶(대흉)", "오래 앉아 있으면 생각이 더 무거워질 수 있습니다. 큰 무리는 피하고 잠깐 몸부터 풀어주세요."),
  createFortune("大凶(대흉)", "완벽하게 하려다 크게 망칠 수 있습니다. 필요한 만큼만 하고 멈추는 편이 안전합니다."),
  createFortune("大凶(대흉)", "중요한 물건은 한곳에 모아두세요. 큰 손해를 피하려면 흩어놓지 않는 편이 좋습니다."),
  createFortune("大凶(대흉)", "오늘은 하루를 작게 쓰세요. 버티고 정리하고 쉬었다면 큰 문제를 피한 겁니다.")
]);

const DEFAULT_FORTUNE_NARRATIVE = Object.freeze({
  openers: Object.freeze([
    '{dayTopic} 평소보다 마음의 방향을 먼저 정해야 결과가 덜 흔들리는 날입니다.',
    '{dayTopic} 큰 사건보다 작은 선택들이 하루 분위기를 차근차근 만드는 날입니다.',
    '{dayTopic} 서두르기보다 상황을 한 번 더 살피면 필요한 길이 보이는 날입니다.',
    '{dayTopic} 주변의 말과 자신의 판단 사이에서 균형을 잡는 태도가 중요합니다.'
  ]),
  closers: Object.freeze([
    '오늘의 결과만 급하게 판단하지 말고, 필요한 말과 행동을 차분히 남기는 편이 좋습니다.',
    '무엇을 얻을지보다 무엇을 무리하지 않을지 정해두면 하루가 훨씬 안정적으로 지나갑니다.',
    '작은 확인과 부드러운 말투를 챙기면 예상보다 편안한 마무리를 만들 수 있습니다.',
    '마음이 급해질수록 기본을 다시 확인하세요. 그 과정이 뜻밖의 실수를 줄여줍니다.'
  ])
});

const FORTUNE_NARRATIVES = Object.freeze({
  '大吉(대길)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 기대하던 일이 밝은 쪽으로 움직이며 마음에 힘이 붙는 날입니다.',
      '{dayTopic} 노력한 만큼 결과가 선명하게 돌아오고 주변의 반응도 따뜻해지는 날입니다.',
      '{dayTopic} 막혀 있던 길이 조금씩 열리며 좋은 제안까지 기대해볼 수 있습니다.',
      '{dayTopic} 평소보다 선택의 감각이 또렷해지고 작은 기회도 크게 살아나는 날입니다.'
    ]),
    closers: Object.freeze([
      '다만 좋은 기운에만 기대기보다 약속과 마무리를 차분히 챙기면 기쁨이 더 오래 갑니다.',
      '중요한 부탁이나 제안은 예의를 갖춰 꺼내보세요. 생각보다 긍정적인 답이 돌아올 수 있습니다.',
      '기회가 보일 때 바로 기록해두면 다음 단계까지 자연스럽게 이어가기 좋습니다.',
      '들뜬 마음은 잠깐 눌러두고 확실한 조건부터 확인하면 얻는 것이 더 커집니다.'
    ])
  }),
  '吉(길)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 큰 욕심을 내지 않아도 무난한 만족이 따라오는 날입니다.',
      '{dayTopic} 익숙한 방식과 차분한 태도가 좋은 결과를 만들어주는 날입니다.',
      '{dayTopic} 작게 챙긴 성실함이 생각보다 기분 좋은 흐름으로 이어집니다.',
      '{dayTopic} 주변 분위기가 부드럽게 맞아 들어가며 부담이 조금 가벼워집니다.'
    ]),
    closers: Object.freeze([
      '괜히 무리해서 크게 바꾸기보다, 이미 잘 맞는 방법을 안정적으로 이어가는 편이 좋습니다.',
      '말투를 조금만 부드럽게 고르면 관계도 편해지고 해야 할 일도 수월하게 풀립니다.',
      '작은 완료감을 하나라도 남겨두면 하루 끝에 생각보다 괜찮았다는 느낌이 듭니다.',
      '기대치를 너무 높이지 않으면 필요한 만큼 얻고 편안하게 마무리할 수 있습니다.'
    ])
  }),
  '中吉(중길)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 조건을 잘 맞출수록 좋은 쪽으로 기울어지는 날입니다.',
      '{dayTopic} 처음부터 빠르게 풀리지는 않아도 순서를 잡으면 안정감이 생깁니다.',
      '{dayTopic} 기회와 변수가 함께 있으니 확인하는 태도가 가장 큰 힘이 됩니다.',
      '{dayTopic} 마음만 앞세우기보다 준비를 점검할수록 결과가 좋아지는 날입니다.'
    ]),
    closers: Object.freeze([
      '조금 느리더라도 필요한 조건을 하나씩 맞추면 후반으로 갈수록 길이 분명해집니다.',
      '상대의 말도 끝까지 듣고 내 기준도 차분히 세우면 불필요한 흔들림을 줄일 수 있습니다.',
      '지금 당장 결론을 내리기보다 한 단계만 더 확인하면 더 좋은 선택이 가능합니다.',
      '작은 기록과 점검이 도움이 됩니다. 머릿속에만 두지 말고 눈에 보이게 정리해보세요.'
    ])
  }),
  '小吉(소길)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 크지는 않아도 분명히 챙길 만한 작은 이득이 있는 날입니다.',
      '{dayTopic} 소소한 친절과 작은 정리가 하루를 편안하게 만드는 날입니다.',
      '{dayTopic} 큰 기대보다 기본을 지킬 때 안정적인 만족이 따라옵니다.',
      '{dayTopic} 눈에 띄는 변화가 적어도 마음을 가볍게 하는 일이 생길 수 있습니다.'
    ]),
    closers: Object.freeze([
      '작은 성과를 가볍게 넘기지 마세요. 그런 만족이 쌓이면 다음 움직임도 한결 쉬워집니다.',
      '무리해서 더 얻으려 하기보다 지금 손에 잡히는 것을 단정하게 챙기는 편이 좋습니다.',
      '짧은 휴식이나 간단한 정리처럼 부담 없는 행동이 의외로 큰 도움이 됩니다.',
      '기분 좋은 말 한마디를 아끼지 않으면 관계에서도 소소한 행운이 돌아올 수 있습니다.'
    ])
  }),
  '末吉(말길)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 초반에는 답답해도 시간이 지나며 조금씩 풀릴 가능성이 있습니다.',
      '{dayTopic} 바로 결과를 보려 하면 지치기 쉬우니 느린 흐름을 받아들이는 편이 좋습니다.',
      '{dayTopic} 서두른 만큼 꼬일 수 있지만 기다리면 필요한 단서가 뒤늦게 보입니다.',
      '{dayTopic} 당장의 성과보다 늦게 찾아오는 안정감을 믿어야 하는 날입니다.'
    ]),
    closers: Object.freeze([
      '조급한 결론은 잠시 미뤄두세요. 차분히 기다린 만큼 후반의 선택지가 더 나아집니다.',
      '마음이 급할수록 작은 할 일부터 닫아두면 나중에 편해지는 흐름을 만들 수 있습니다.',
      '늦게 풀리는 날이라고 해서 나쁜 날은 아닙니다. 속도를 낮추면 필요한 것은 남습니다.',
      '기대가 바로 채워지지 않아도 너무 실망하지 마세요. 천천히 정리하면 손해를 줄입니다.'
    ])
  }),
  '凶(흉)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 작은 실수도 커질 수 있으니 평소보다 신중함이 필요한 날입니다.',
      '{dayTopic} 마음이 예민해지기 쉬워 말과 선택의 속도를 낮추는 편이 좋습니다.',
      '{dayTopic} 무리하게 밀어붙이면 손해가 생길 수 있으니 한 걸음 물러서야 합니다.',
      '{dayTopic} 중요한 일일수록 바로 결정하지 말고 확인 시간을 따로 두는 편이 안전합니다.'
    ]),
    closers: Object.freeze([
      '겁을 먹을 필요는 없지만, 오늘은 과감함보다 조심스러운 태도가 더 큰 보호막이 됩니다.',
      '대화가 날카로워질 것 같다면 짧게 멈추세요. 시간을 두면 피할 수 있는 오해가 많습니다.',
      '큰 욕심을 내려놓고 기본만 지켜도 충분합니다. 손해를 막는 것이 가장 좋은 선택입니다.',
      '몸과 마음이 피곤하면 판단도 흐려집니다. 중요한 일은 여유가 생긴 뒤 다시 보는 편이 좋습니다.'
    ])
  }),
  '大凶(대흉)': Object.freeze({
    openers: Object.freeze([
      '{dayTopic} 억지로 밀어붙이면 작은 문제가 크게 번질 수 있으니 속도를 낮춰야 합니다.',
      '{dayTopic} 중요한 결정과 감정적인 대화는 가능한 한 미루는 편이 안전한 날입니다.',
      '{dayTopic} 무리한 도전보다 손해를 피하고 상황을 보존하는 태도가 더 필요합니다.',
      '{dayTopic} 평소라면 넘길 일도 크게 느껴질 수 있으니 방어적으로 움직이는 편이 좋습니다.'
    ]),
    closers: Object.freeze([
      '괜히 증명하려 들기보다 쉬어 갈 명분을 만드는 편이 낫습니다. 안전하게 넘기면 충분합니다.',
      '큰 성과를 내려고 하기보다 문제를 키우지 않는 데 집중하세요. 그것만으로도 의미가 있습니다.',
      '말을 줄이고 약속과 물건을 다시 확인하면 피할 수 있는 손해가 확실히 줄어듭니다.',
      '오늘을 작게 쓰는 것이 도망은 아닙니다. 힘을 아껴두면 다음 선택을 더 안전하게 할 수 있습니다.'
    ])
  })
});

export class FortuneService {
  constructor(options = {}) {
    this.fortunes = options.fortunes ?? FORTUNE_MESSAGES;
    this.timezoneOffsetMs = options.timezoneOffsetMs ?? KOREA_TIME_OFFSET_MS;

    if (!Array.isArray(this.fortunes) || this.fortunes.length === 0) {
      throw new Error('운세 글귀 목록이 비어 있습니다.');
    }
  }

  getDailyFortune({ guildId, userId, username = 'Unknown', date = 'today', now = Date.now() }) {
    const dateChoice = FORTUNE_DATE_CHOICES[date];

    if (!dateChoice) {
      throw new Error('오늘운세, 어제운세, 내일운세 중 하나를 선택해주세요.');
    }

    const dayIndex = getDayIndex(now, this.timezoneOffsetMs) + dateChoice.dayOffset;
    const dateKey = formatDateKey(dayIndex);
    const fortuneIndex = getDailyFortuneIndex({
      guildId,
      userId,
      dayIndex,
      fortunes: this.fortunes
    });
    const fortune = this.fortunes[fortuneIndex];

    return {
      guildId,
      userId,
      username,
      date,
      dateKey,
      dayIndex,
      label: dateChoice.label,
      index: fortuneIndex,
      kind: fortune.kind,
      text: renderFortuneText(fortune, dateChoice, fortuneIndex),
      luckyNumber: getLuckyNumber({
        guildId,
        userId,
        dateKey
      })
    };
  }
}

export function getDayIndex(now, timezoneOffsetMs = KOREA_TIME_OFFSET_MS) {
  return Math.floor((now + timezoneOffsetMs) / DAY_MS);
}

export function formatDateKey(dayIndex) {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

function getDailyFortuneIndex({ guildId, userId, dayIndex, fortunes }) {
  const preferredIndex = getBucketedStableIndex({
    guildId,
    userId,
    dayIndex,
    max: fortunes.length
  });

  if (fortunes.length <= 1) return preferredIndex;

  const yesterdayIndex = getBucketedStableIndex({
    guildId,
    userId,
    dayIndex: dayIndex - 1,
    max: fortunes.length
  });
  const yesterdayText = fortunes[yesterdayIndex]?.text;

  if (fortunes[preferredIndex]?.text !== yesterdayText) {
    return preferredIndex;
  }

  return getNextDifferentTextIndex({
    preferredIndex,
    forbiddenText: yesterdayText,
    dayIndex,
    fortunes
  });
}

function renderFortuneText(fortune, dateChoice, fortuneIndex) {
  if (String(fortune.text).includes('{day')) {
    return normalizeRenderedText(renderFortuneTokens(fortune.text, dateChoice));
  }

  return renderNarrativeFortune(fortune, dateChoice, fortuneIndex);
}

function renderNarrativeFortune(fortune, dateChoice, fortuneIndex) {
  const narrative = FORTUNE_NARRATIVES[fortune.kind] ?? DEFAULT_FORTUNE_NARRATIVE;
  const seed = `${fortune.kind}:${fortune.text}:${fortuneIndex}`;
  const opener = renderFortuneTokens(pickNarrativeLine(narrative.openers, `${seed}:opener`), dateChoice);
  const core = normalizeFortuneBaseText(fortune.text);
  const closer = renderFortuneTokens(pickNarrativeLine(narrative.closers, `${seed}:closer`), dateChoice);

  return normalizeRenderedText(`${opener} ${core} ${closer}`);
}

function renderFortuneTokens(text, dateChoice) {
  const dayWord = dateChoice.dayWord;

  return String(text)
    .replaceAll('{dayTopic}', `${dayWord}${getTopicParticle(dayWord)}`)
    .replaceAll('{daySubject}', `${dayWord}${getSubjectParticle(dayWord)}`)
    .replaceAll('{dayObject}', `${dayWord}${getObjectParticle(dayWord)}`)
    .replaceAll('{day}', dayWord);
}

function normalizeFortuneBaseText(text) {
  const normalized = String(text)
    .replaceAll('오늘은 쉬세요.', '무리하지 말고 쉬는 편이 좋습니다.')
    .replaceAll('내일 보면', '시간을 두고 보면')
    .replaceAll('내일 편합니다', '나중에 편합니다')
    .replaceAll('내일은', '시간이 지나면')
    .replaceAll('내일이', '다음 흐름이')
    .replaceAll('내일을', '다음 흐름을')
    .replaceAll('내일의', '다음의')
    .replaceAll('내일로', '나중으로')
    .replaceAll('내일', '나중')
    .replaceAll('오늘은', '이 흐름에서는')
    .replaceAll('오늘이', '이 흐름이')
    .replaceAll('오늘을', '이 흐름을')
    .replaceAll('오늘의', '지금의')
    .replaceAll('오늘도', '이번에도')
    .replaceAll('오늘', '지금');

  return ensureSentenceEnding(normalizeRenderedText(normalized));
}

function pickNarrativeLine(lines, seed) {
  return lines[getStableIndex(seed, lines.length)];
}

function normalizeRenderedText(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

function ensureSentenceEnding(text) {
  if (/[.!?。]$/.test(text)) return text;
  return `${text}.`;
}

function getLuckyNumber({ guildId, userId, dateKey }) {
  return getStableIndex(`${guildId}:${userId}:${dateKey}:lucky-number`, 99) + 1;
}

function getTopicParticle(word) {
  return hasFinalConsonant(word) ? '은' : '는';
}

function getSubjectParticle(word) {
  return hasFinalConsonant(word) ? '이' : '가';
}

function getObjectParticle(word) {
  return hasFinalConsonant(word) ? '을' : '를';
}

function hasFinalConsonant(word) {
  const lastCharCode = String(word).charCodeAt(String(word).length - 1);
  if (lastCharCode < 0xac00 || lastCharCode > 0xd7a3) return false;
  return (lastCharCode - 0xac00) % 28 !== 0;
}

function getBucketedStableIndex({ guildId, userId, dayIndex, max }) {
  if (max <= 1) return 0;

  const bucket = Math.abs(dayIndex % 2);
  const bucketSize = Math.ceil((max - bucket) / 2);
  const ordinal = getStableIndex(
    `${guildId}:${userId}:${formatDateKey(dayIndex)}:${bucket}`,
    bucketSize
  );

  return bucket + ordinal * 2;
}

function getNextDifferentTextIndex({ preferredIndex, forbiddenText, dayIndex, fortunes }) {
  const bucket = Math.abs(dayIndex % 2);
  const bucketSize = Math.ceil((fortunes.length - bucket) / 2);
  const preferredOrdinal = Math.floor((preferredIndex - bucket) / 2);

  for (let offset = 1; offset < bucketSize; offset += 1) {
    const candidateOrdinal = (preferredOrdinal + offset) % bucketSize;
    const candidateIndex = bucket + candidateOrdinal * 2;

    if (fortunes[candidateIndex]?.text !== forbiddenText) {
      return candidateIndex;
    }
  }

  for (let offset = 1; offset < fortunes.length; offset += 1) {
    const candidateIndex = (preferredIndex + offset) % fortunes.length;

    if (fortunes[candidateIndex]?.text !== forbiddenText) {
      return candidateIndex;
    }
  }

  return preferredIndex;
}

function getStableIndex(seed, max) {
  const digest = createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) % max;
}

function createFortune(kind, text) {
  return Object.freeze({ kind, text });
}
