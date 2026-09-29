import { describe, expect, it } from 'vitest';
import { formatMinutes, parseMinutes } from './durations';

describe('durations', () => {
	it('formats minutes compactly', () => {
		expect([15, 60, 90, 240, 135].map(formatMinutes)).toEqual([
			'15m',
			'1h',
			'1h 30m',
			'4h',
			'2h 15m'
		]);
	});

	it('parses the ways people type a duration', () => {
		expect(parseMinutes('80')).toBe(80);
		expect(parseMinutes('80m')).toBe(80);
		expect(parseMinutes('1.5h')).toBe(90);
		expect(parseMinutes('1h 20m')).toBe(80);
		expect(parseMinutes('2 hrs')).toBe(120);
		expect(parseMinutes('1:20')).toBe(80);
		expect(parseMinutes('')).toBeNull();
		expect(parseMinutes('soon')).toBeNull();
		expect(parseMinutes('0')).toBeNull();
	});
});
