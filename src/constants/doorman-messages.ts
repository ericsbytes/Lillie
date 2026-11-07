export const doormanMessages = {
	claimButton: '💨 On my way!',
	cancelButton: 'Cancel',
	request: (requesterId: string) =>
		`**<@${requesterId}> needs to be let in!** ` +
		"Help them out by opening the door. You'll get **+1 skill point 👾** for doing so.",
	claimed: (requesterId: string, helperId: string) =>
		`✨ <@${requesterId}> was let in by <@${helperId}>! ` +
		'They got **+1 skill point** 👾 for helping out a fellow game dev!',
	cancelled: (requesterId: string) =>
		`🪄 Nevermind, <@${requesterId}> has cancelled their request!`,
	expired: (requesterId: string) =>
		`🍡 Nevermind, <@${requesterId}>'s request has expired.`,
	cancelDenied: 'Only the requester or a moderator can cancel this request.',
	selfClaimDenied: 'Someone else has to claim your request.',
	verificationRequired:
		'🪼 Only Brown/RISD students can help out! Please verify yourself in <#1490480367013069010>.',
	busy: 'Someone is already handling this request.',
	closed: 'This ping is already closed.',
	pointUnconfirmed: 'I couldn’t confirm that your point was saved.',
	leaderboard: {
		description: 'See the top 10 Doorman skill point totals.',
		title: '🏆 Doorman Leaderboard',
		unavailable: '🗝️ The Doorman leaderboard is currently unavailable.',
		empty: 'No skill points have been earned yet.',
		row: (rank: number, userId: string, claims: number) => {
			const points = claims === 1 ? 'point' : 'points';
			return `${rank}. <@${userId}> — **${claims}** ${points}`;
		},
	},
};
