import { describe, expect, it } from 'vitest';
import { can, completed, moved, reopened } from './transitions';

describe('action-item transitions', () => {
	it('allows exactly the documented commands per status', () => {
		expect(can('move', 'pool')).toBe(true);
		expect(can('move', 'scheduled')).toBe(true);
		expect(can('move', 'done')).toBe(false);
		expect(can('complete', 'done')).toBe(false);
		expect(can('reopen', 'done')).toBe(true);
		expect(can('reopen', 'pool')).toBe(false);
	});

	it('derives status from the target container', () => {
		expect(moved(null)).toEqual({ status: 'pool', scheduled_date: null, completed_at: null });
		expect(moved('2026-09-25').status).toBe('scheduled');
	});

	it('keeps the day through complete and reopen', () => {
		const done = completed(moved('2026-09-25'), '2026-09-25T12:00:00.000Z');
		expect(done).toEqual({
			status: 'done',
			scheduled_date: '2026-09-25',
			completed_at: '2026-09-25T12:00:00.000Z'
		});
		expect(reopened(done)).toEqual(moved('2026-09-25'));
		expect(reopened(completed(moved(null), 'x')).status).toBe('pool');
	});
});
