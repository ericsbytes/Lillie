import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageFlags,
	type ButtonInteraction,
	type Message,
} from 'discord.js';
import { model, Schema } from 'mongoose';
import { config } from '../config';

const CLAIM_BUTTON_PREFIX = 'role-ping-claim:';
const CANCEL_BUTTON_PREFIX = 'role-ping-cancel:';
const allowedMentions = { parse: [], repliedUser: false } as const;

const DoormanClaimTotal = model('DoormanClaimTotal', new Schema(
	{
		_id: { type: String, required: true },
		claims: { type: Number, required: true },
	},
	{ collection: 'doorman_claim_totals', versionKey: false },
));

export function getDoormanLeaderboard() {
	return DoormanClaimTotal.find()
		.sort({ claims: -1, _id: 1 })
		.limit(10)
		.lean()
		.exec();
}

function requestButtons(requesterId: string) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`${CLAIM_BUTTON_PREFIX}${requesterId}`)
			.setLabel('💨 On my way!')
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`${CANCEL_BUTTON_PREFIX}${requesterId}`)
			.setLabel('Cancel')
			.setStyle(ButtonStyle.Secondary),
	);
}

export function createDoorman(roleId: string) {
	if (!/^\d{17,20}$/.test(roleId)) {
		throw new Error('DOORMAN_ROLE_ID must be a Discord role ID.');
	}
	const requestsInProgress = new Set<string>();

	return {
		async handleRolePing(message: Message) {
			if (
				!message.inGuild() ||
				message.author.bot ||
				!message.mentions.roles.has(roleId)
			) {
				return;
			}

			await message.channel.send({
				content:
					`**<@${message.author.id}> is requesting to be let in!** ` +
					"Help them out by opening the door. You'll get **+1** **gamer point 👾** for doing so.",
				components: [requestButtons(message.author.id)],
				allowedMentions,
				nonce: message.id,
				enforceNonce: true,
			});
		},

		async handleRequestButton(interaction: ButtonInteraction) {
			const isCancel = interaction.customId.startsWith(CANCEL_BUTTON_PREFIX);
			if (!isCancel && !interaction.customId.startsWith(CLAIM_BUTTON_PREFIX)) {
				return false;
			}

			const { message, user } = interaction;
			const claimMessageId = message.reference?.messageId ?? message.id;
			const prefix = isCancel ? CANCEL_BUTTON_PREFIX : CLAIM_BUTTON_PREFIX;
			const requesterId = interaction.customId.slice(prefix.length);
			if (
				!interaction.inGuild() ||
				user.bot ||
				message.author.id !== interaction.client.user.id
			) {
				return false;
			}

			const isRequester = user.id === requesterId;
			if (isCancel ? !isRequester : isRequester) {
				await interaction.reply({
					content: isCancel
						? 'Only the requester can cancel this request.'
						: 'Someone else has to claim your request.',
					flags: MessageFlags.Ephemeral,
				});
				return true;
			}

			if (!isCancel) {
				const { roles } = interaction.member;
				const needsVerification = Array.isArray(roles)
					? roles.includes(config.roleToRemove)
					: roles.cache.has(config.roleToRemove);
				if (needsVerification) {
					await interaction.reply({
						content:
							'🪼 Only Brown/RISD students can help out! Please verify yourself in <#1490480367013069010>.',
						flags: MessageFlags.Ephemeral,
					});
					return true;
				}
			}

			if (requestsInProgress.has(claimMessageId)) {
				await interaction.reply({
					content: 'Someone is already handling this request.',
					flags: MessageFlags.Ephemeral,
				});
				return true;
			}

			requestsInProgress.add(claimMessageId);
			try {
				await interaction.deferUpdate();
				// The click may have arrived before Discord showed the button removal.
				const currentMessage = await message.fetch();
				const button = currentMessage.resolveComponent(interaction.customId);
				if (button?.type !== ComponentType.Button || button.disabled) {
					await interaction.followUp({
						content: 'This ping is already closed.',
						flags: MessageFlags.Ephemeral,
					});
					return true;
				}

				await interaction.editReply({
					content: isCancel
						? `🪄 Nevermind, <@${requesterId}> has cancelled their request!`
						: `✨ <@${requesterId}> was let in by <@${user.id}>! ` +
						'They got **+1 gamer point** 👾 for helping out a fellow game dev!',
					components: [],
					allowedMentions,
				});
				if (isCancel) {
					return true;
				}

				try {
					await DoormanClaimTotal.updateOne(
						{ _id: user.id },
						{ $inc: { claims: 1 } },
						{ upsert: true },
					);
				} catch (error) {
					console.error(`Could not confirm claim count for ${user.id} on message ${claimMessageId}.`, error);
					await interaction.followUp({
						content: 'I couldn’t confirm that your point was saved.',
						flags: MessageFlags.Ephemeral,
					});
				}
			} finally {
				requestsInProgress.delete(claimMessageId);
			}
			return true;
		},
	};
}
