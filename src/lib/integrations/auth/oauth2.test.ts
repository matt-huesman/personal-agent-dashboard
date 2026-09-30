import { describe, expect, it } from 'vitest';
import { missingScopes } from './oauth2.server';

describe('granted scopes', () => {
	const required = ['a/calendarlist.readonly', 'a/events.readonly'];

	it('reports permissions the user unticked on the consent screen', () => {
		expect(missingScopes('a/calendarlist.readonly openid', required)).toEqual([
			'a/events.readonly'
		]);
	});

	it('is satisfied when everything was granted, in any order', () => {
		expect(missingScopes('a/events.readonly  a/calendarlist.readonly', required)).toEqual([]);
	});
});
