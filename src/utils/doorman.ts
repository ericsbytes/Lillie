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
import { doormanMessages } from '../constants/doorman-messages';

const CLAIM_BUTTON_PREFIX = 'role-ping-claim:';
const CANCEL_BUTTON_PREFIX = 'role-ping-cancel:';
const REQUEST_TTL_MS = 10 * 60 * 1000;
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
			.setLabel(doormanMessages.claimButton)
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`${CANCEL_BUTTON_PREFIX}${requesterId}`)
			.setLabel(doormanMessages.cancelButton)
			.setStyle(ButtonStyle.Secondary),
	);
}

function closedRequest(content: string) {
	return { content, components: [], allowedMentions };
}

export function createDoorman(roleId: string) {
	if (!/^\d{17,20}$/.test(roleId)) {
		throw new Error('DOORMAN_ROLE_ID must be a Discord role ID.');
	}
	const requestsInProgress = new Set<string>();
	const expiryTimers = new Map<string, NodeJS.Timeout>();

	function scheduleExpiry(request: Message, requesterId: string, delayMs: number) {
		const timer = setTimeout(() => {
			void expireRequest(request, requesterId).catch(error => {
				console.error(`Doorman failed to expire request ${request.id}.`, error);
			});
		}, delayMs);
		expiryTimers.set(request.id, timer);
	}

	async function expireRequest(request: Message, requesterId: string) {
		expiryTimers.delete(request.id);
		if (requestsInProgress.has(request.id)) {
			scheduleExpiry(request, requesterId, 1000);
			return;
		}

		requestsInProgress.add(request.id);
		try {
			const currentMessage = await request.fetch();
			const button = currentMessage.resolveComponent(`${CLAIM_BUTTON_PREFIX}${requesterId}`);
			if (button?.type === ComponentType.Button && !button.disabled) {
				await currentMessage.edit(closedRequest(doormanMessages.expired(requesterId)));
			}
		} finally {
			requestsInProgress.delete(request.id);
		}
	}

	return {
		async handleRolePing(message: Message) {
			if (
				!message.inGuild() ||
				message.author.bot ||
				!message.mentions.roles.has(roleId)
			) {
				return;
			}

			const request = await message.channel.send({
				content: doormanMessages.request(message.author.id),
				components: [requestButtons(message.author.id)],
				allowedMentions,
				nonce: message.id,
				enforceNonce: true,
			});
			if (!expiryTimers.has(request.id)) {
				scheduleExpiry(request, message.author.id, request.createdTimestamp + REQUEST_TTL_MS - Date.now());
			}
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

			const { roles } = interaction.member;
			const hasRole = (id: string) => Array.isArray(roles)
				? roles.includes(id)
				: roles.cache.has(id);
			const isRequester = user.id === requesterId;
			const canCancel = isRequester || hasRole(config.doormanCancelRoleId);
			if (isCancel ? !canCancel : isRequester) {
				await interaction.reply({
					content: isCancel
						? doormanMessages.cancelDenied
						: doormanMessages.selfClaimDenied,
					flags: MessageFlags.Ephemeral,
				});
				return true;
			}

			if (!isCancel && hasRole(config.roleToRemove)) {
				await interaction.reply({
					content: doormanMessages.verificationRequired,
					flags: MessageFlags.Ephemeral,
				});
				return true;
			}

			if (requestsInProgress.has(claimMessageId)) {
				await interaction.reply({
					content: doormanMessages.busy,
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
						content: doormanMessages.closed,
						flags: MessageFlags.Ephemeral,
					});
					return true;
				}

				const expired = Date.now() >= currentMessage.createdTimestamp + REQUEST_TTL_MS;
				const content = expired
					? doormanMessages.expired(requesterId)
					: isCancel
						? doormanMessages.cancelled(requesterId)
						: doormanMessages.claimed(requesterId, user.id);
				await interaction.editReply(closedRequest(content));
				clearTimeout(expiryTimers.get(message.id));
				expiryTimers.delete(message.id);
				if (expired || isCancel) {
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
						content: doormanMessages.pointUnconfirmed,
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
