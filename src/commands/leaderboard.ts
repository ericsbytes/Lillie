import {
	EmbedBuilder,
	MessageFlags,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { connection, ConnectionStates } from 'mongoose';
import { getDoormanLeaderboard } from '../utils/doorman';

export const data = new SlashCommandBuilder()
	.setName('leaderboard')
	.setDescription('See the top 10 Doorman gamer point totals.');

export async function execute(interaction: ChatInputCommandInteraction) {
	if (connection.readyState !== ConnectionStates.connected) {
		await interaction.reply({
			content: '🗝️ The Doorman leaderboard is currently unavailable.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply();
	const leaders = await getDoormanLeaderboard();
	const rows = leaders.map(({ _id, claims }, index) => {
		const points = claims === 1 ? 'point' : 'points';
		return `${index + 1}. <@${_id}> — **${claims}** ${points}`;
	});

	const embed = new EmbedBuilder()
		.setColor(0xffe0a6)
		.setTitle('🏆 Doorman Leaderboard')
		.setDescription(rows.length ? rows.join('\n') : 'No gamer points have been earned yet.');

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { parse: [] },
	});
}
