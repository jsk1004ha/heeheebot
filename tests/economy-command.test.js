import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEconomyCommandPayloads,
  handleEconomyCommand
} from '../src/commands/economy.js';

test('경제 명령 payload는 경험치를 단일 표현으로 설명한다', () => {
  const payloads = getEconomyCommandPayloads();
  const profileCommand = payloads.find((command) => command.name === '프로필');
  const leaderboardCommand = payloads.find((command) => command.name === '랭킹');

  assert.ok(profileCommand);
  assert.ok(leaderboardCommand);
  assert.match(profileCommand.description, /레벨, 경험치, 보유금/);
  assert.match(leaderboardCommand.description, /레벨\/경험치 랭킹/);
  assert.doesNotMatch(profileCommand.description, /누적|현재/);
  assert.doesNotMatch(leaderboardCommand.description, /누적|현재/);
});

test('프로필과 랭킹 출력은 전체 경험치를 경험치로 표시한다', async () => {
  const economy = {
    async getProfile() {
      return {
        userId: 'user-1',
        username: '테스터',
        level: 2,
        xp: 20,
        totalXp: 120,
        balance: 300,
        dailyStreak: 1
      };
    },
    async getLeaderboard() {
      return [
        {
          userId: 'user-1',
          username: '테스터',
          level: 2,
          totalXp: 120,
          balance: 300
        }
      ];
    }
  };

  const profileInteraction = createInteraction('프로필');
  const leaderboardInteraction = createInteraction('랭킹');

  await handleEconomyCommand(profileInteraction, economy);
  await handleEconomyCommand(leaderboardInteraction, economy);

  assert.match(profileInteraction.replies[0], /경험치: \*\*120 XP\*\*/);
  assert.doesNotMatch(profileInteraction.replies[0], /현재 레벨 경험치|누적 경험치|20 \/ 282/);
  assert.match(leaderboardInteraction.replies[0], /경험치 120 XP/);
  assert.doesNotMatch(leaderboardInteraction.replies[0], /누적 경험치 기준|누적 120 XP/);
});

function createInteraction(commandName) {
  return {
    commandName,
    guildId: 'guild-1',
    user: {
      id: 'user-1',
      username: '테스터'
    },
    replies: [],
    isChatInputCommand() {
      return true;
    },
    inGuild() {
      return true;
    },
    options: {
      getInteger() {
        return null;
      }
    },
    async reply(message) {
      this.replies.push(message);
    }
  };
}
