import { dailyIndex, hardDayMilestoneKey, hardDayPlan, hardDayWins, HARD_DAY_REASONS, weeksInARow } from '../../src/domain/motivation';
import { decideSession } from '../../src/domain/coach';
import { coachInput, session } from './fixtures';

const programme = coachInput().programme; // Mon/Wed/Fri, 3 per week, started 2026-10-01

describe('hard-day mode', () => {
  it('always shrinks the session and never adds volume', () => {
    for (const r of HARD_DAY_REASONS) {
      const plan = hardDayPlan(r);
      const d = decideSession(coachInput({ availableMinutes: plan.minutes }));
      const standard = decideSession(coachInput());
      expect(d.kind).toBe('train');
      if (d.kind !== 'train' || standard.kind !== 'train') continue;
      const sets = (x: typeof d) => x.exercises.reduce((n, e) => n + e.prescription.sets, 0);
      expect(sets(d)).toBeLessThan(sets(standard));
      expect(d.variant).toBe('short');
    }
  });

  it('a safety concern still overrides hard-day mode', () => {
    const d = decideSession(coachInput({ availableMinutes: hardDayPlan('sore').minutes, safety: 'concern' }));
    expect(d.kind).toBe('safety_stop');
  });

  it('counts hard-day wins only for sessions that were attended', () => {
    const h = [
      session('2026-11-02', { hardDay: true, outcome: 'partial' }),
      session('2026-11-04', { hardDay: true, outcome: 'safety_stop' }),
      session('2026-11-06', { hardDay: false }),
    ];
    expect(hardDayWins(h)).toBe(1);
  });

  it('awards badges at fixed thresholds only', () => {
    expect(hardDayMilestoneKey(1)).toBe('hard_day_1');
    expect(hardDayMilestoneKey(5)).toBe('hard_day_5');
    expect(hardDayMilestoneKey(6)).toBeNull();
  });
});

describe('weeks in a row', () => {
  const week = (mon: string, days = [0, 2, 4]) =>
    days.map((d) => {
      const [y, m, dd] = mon.split('-').map(Number);
      return session(new Date(Date.UTC(y, m - 1, dd + d)).toISOString().slice(0, 10));
    });

  it('counts consecutive weeks that hit the target, including this week once met', () => {
    const h = [...week('2026-10-19'), ...week('2026-10-26'), ...week('2026-11-02')];
    expect(weeksInARow(programme, h, '2026-11-06')).toBe(3);
  });

  it('does not break the run for the current week until it is over', () => {
    const h = [...week('2026-10-19'), ...week('2026-10-26'), ...week('2026-11-02', [0])];
    expect(weeksInARow(programme, h, '2026-11-03')).toBe(2);
  });

  it('a missed week ends the run; a paused week does not', () => {
    const h = [...week('2026-10-05'), ...week('2026-10-19'), ...week('2026-10-26')];
    expect(weeksInARow(programme, h, '2026-11-02')).toBe(2);
    const paused = { ...programme, pause: { from: '2026-10-12', until: '2026-10-18' } };
    expect(weeksInARow(paused, h, '2026-11-02')).toBe(3);
  });

  it('daily line is stable for a date', () => {
    expect(dailyIndex('2026-11-02', 15)).toBe(dailyIndex('2026-11-02', 15));
    expect(dailyIndex('2026-11-02', 15)).toBeLessThan(15);
  });
});
