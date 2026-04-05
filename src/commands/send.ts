import {
	ChannelType,
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';
import { buildVerificationMessage } from '../constants/verification-flow';

export const data = new SlashCommandBuilder()
	.setName('send')
	.setDescription('Sends the verification message.')
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.addChannelOption(option =>
		option
			.setName('channel')
			.setDescription('The channel to send the message in.')
			.addChannelTypes(
				ChannelType.GuildAnnouncement,
				ChannelType.GuildText,
			)
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction) {
	const channel = interaction.options.getChannel('channel', true);

	if (!('send' in channel)) {
		await interaction.reply({
			content: 'Please select a text-based channel.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await channel.send(buildVerificationMessage());

	await interaction.reply({
		content: `Verification message sent in ${channel}.`,
		// flags: MessageFlags.Ephemeral,
	});
}
