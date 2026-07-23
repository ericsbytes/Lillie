import {
	ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('block')
	.setDescription(
		'Blocks a role from viewing every channel except whitelisted channels.',
	)
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.addRoleOption(option =>
		option
			.setName('role')
			.setDescription('The role to block from viewing channels.')
			.setRequired(true),
	)
	.addStringOption(option =>
		option
			.setName('whitelist')
			.setDescription('Channel mentions to keep visible, such as #verify #rules.')
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
	const whitelistInput = interaction.options.getString('whitelist', true);
	const excludedChannelIds = new Set(
		Array.from(whitelistInput.matchAll(/<#(\d+)>/g), match => match[1]),
	);

	if (excludedChannelIds.size === 0) {
		await interaction.reply({
			content:
				'Please include at least one channel mention in the whitelist, such as #verify.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	if (role.permissions.has(PermissionFlagsBits.Administrator)) {
		await interaction.reply({
			content:
				'That role has the Administrator permission, so channel view overwrites will not block it.',
			flags: MessageFlags.Ephemeral,
		});
		return;
	}

	await interaction.deferReply({
		flags: MessageFlags.Ephemeral,
	});

	const channels = await interaction.guild.channels.fetch();
	const invalidChannelIds = [...excludedChannelIds].filter(
		channelId => !channels.has(channelId) || channels.get(channelId)?.isThread(),
	);

	if (invalidChannelIds.length > 0) {
		await interaction.editReply({
			content: `These mentions are not channels in this server or refer to threads: ${invalidChannelIds.map(channelId => `<#${channelId}>`).join(', ')}.`,
		});
		return;
	}

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
					ViewChannel: excludedChannelIds.has(channel.id),
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
		content: `Updated ${updatedChannels} channel overwrite(s) for ${role}. ${role} can still view ${[...excludedChannelIds].map(channelId => `<#${channelId}>`).join(', ')}.${failureNote}`,
	});
}
