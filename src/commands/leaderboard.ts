import {
	EmbedBuilder,
	MessageFlags,
	SlashCommandBuilder,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { connection, ConnectionStates } from 'mongoose';
import { doormanMessages } from '../constants/doorman-messages';
import { getDoormanLeaderboard } from '../utils/doorman';

export const data = new SlashCommandBuilder()
	.setName('leaderboard')
	.setDescription(doormanMessages.leaderboard.description);

export async function execute(interaction: ChatInputCommandInteraction) {
	if (connection.readyState !== ConnectionStates.connected) {
		await interaction.reply({
			content: doormanMessages.leaderboard.unavailable,
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply();
	const leaders = await getDoormanLeaderboard();
	const rows = leaders.map(({ _id, claims }, index) =>
		doormanMessages.leaderboard.row(index + 1, _id, claims),
	);

	const embed = new EmbedBuilder()
		.setColor(0xffe0a6)
		.setTitle(doormanMessages.leaderboard.title)
		.setDescription(rows.length ? rows.join('\n') : doormanMessages.leaderboard.empty);

	await interaction.editReply({
		embeds: [embed],
		allowedMentions: { parse: [] },
	});
}
