import {
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('block')
	.setDescription(
		'Blocks a role from viewing every channel except the excluded channel.',
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.addRoleOption(option =>
		option
			.setName('role')
			.setDescription('The role to block from viewing channels.')
			.setRequired(true),
	)
	.addChannelOption(option =>
		option
			.setName('exclude')
			.setDescription('The one channel that should remain visible.')
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction) {
	if (!interaction.inCachedGuild()) {
		await interaction.reply({
			content: 'This command can only be used in a server.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const role = interaction.options.getRole('role', true);
	const excludedChannel = interaction.options.getChannel('exclude', true);

	if (role.permissions.has(PermissionFlagsBits.Administrator)) {
		await interaction.reply({
			content:
				'That role has the Administrator permission, so channel view overwrites will not block it.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	const channels = await interaction.guild.channels.fetch();

	await interaction.deferReply({
		flags: MessageFlags.Ephemeral,
	});

	let updatedChannels = 0;
	const failedChannels: string[] = [];

	for (const channel of channels.values()) {
		if (!channel || channel.isThread()) {
			continue;
		}

		try {
			await channel.permissionOverwrites.edit(
				role,
				{
					ViewChannel: channel.id === excludedChannel.id,
				},
				{
					reason: `Applied by ${interaction.user.tag} via /block`,
				},
			);
			updatedChannels += 1;
		} catch (error) {
			console.error(
				`Failed to update channel permissions for ${channel.id}.`,
				error,
			);
			failedChannels.push(channel.name);
		}
	}
	const failureNote =
		failedChannels.length === 0
			? ''
			: ` Failed to update ${failedChannels.length} channel(s): ${failedChannels.join(', ')}.`;

	await interaction.editReply({
		content: `Updated ${updatedChannels} channel overwrite(s) for ${role}. ${role} can still view ${excludedChannel}.${failureNote}`,
	});
}
