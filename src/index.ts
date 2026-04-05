import '@dotenvx/dotenvx/config';
import {
	ActivityType,
	PresenceUpdateStatus,
	Client,
	Events,
	GatewayIntentBits,
	type InteractionReplyOptions,
	MessageFlags,
} from 'discord.js';
import { commands } from './commands';
import { config } from './config';
import {
	buildEmailModal,
	buildOtpModal,
	buildOtpPrompt,
	EMAIL_INPUT_ID,
	EMAIL_MODAL_ID,
	OTP_BUTTON_ID,
	OTP_INPUT_ID,
	OTP_MODAL_ID,
	VERIFY_BUTTON_ID,
} from './constants/verification-flow';
import { registerCommands } from './utils/deploy-cmds';
import {
	clearPendingVerification,
	createPendingVerification,
	getPendingVerification,
	getSubmittedEmail,
	getSubmittedOtp,
	isAllowedSchoolEmail,
	sendVerificationEmail,
	verifySubmittedOtp,
} from './utils/verification';

const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async readyClient => {
	console.log(`Logged in as ${readyClient.user.tag}!`);

	readyClient.user.setPresence({
		activities: [{ name: 'Playing BRGD games!' }],
		status: PresenceUpdateStatus.Idle,
	});
	await registerCommands(readyClient);
});

client.on(Events.InteractionCreate, async interaction => {
	try {
		if (interaction.isChatInputCommand()) {
			const command = commands.get(interaction.commandName);

			if (!command) {
				await interaction.reply({
					content: 'That command is not registered.',
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			await command.execute(interaction);
			return;
		}

		if (interaction.isButton()) {
			if (interaction.customId === VERIFY_BUTTON_ID) {
				await interaction.showModal(buildEmailModal());
				return;
			}

			if (interaction.customId === OTP_BUTTON_ID) {
				const pendingVerification = getPendingVerification(
					interaction.user.id,
				);

				if (!pendingVerification) {
					await interaction.reply({
						content:
							'No verification is in progress. Click Verify to start again.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await interaction.showModal(buildOtpModal());
			}

			return;
		}

		if (interaction.isModalSubmit()) {
			if (interaction.customId === EMAIL_MODAL_ID) {
				const email = getSubmittedEmail(
					interaction.fields.getTextInputValue(EMAIL_INPUT_ID),
				);

				if (!isAllowedSchoolEmail(email)) {
					await interaction.reply({
						content:
							'Please enter a valid `@brown.edu` or `@risd.edu` email address.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await interaction.deferReply({
					flags: MessageFlags.Ephemeral,
				});

				const pendingVerification = createPendingVerification(
					interaction.user.id,
					email,
				);

				try {
					await sendVerificationEmail(email, pendingVerification.otp);

					await interaction.editReply(buildOtpPrompt(email));
				} catch (error) {
					clearPendingVerification(interaction.user.id);
					console.error('Failed to send verification email.', error);
					await interaction.editReply({
						content:
							'I could not send the verification email. Please try again later!',
					});
				}

				return;
			}

			if (interaction.customId === OTP_MODAL_ID) {
				const otp = getSubmittedOtp(
					interaction.fields.getTextInputValue(OTP_INPUT_ID),
				);
				const result = verifySubmittedOtp(interaction.user.id, otp);

				if (result.status === 'verified') {
					if (!interaction.inCachedGuild()) {
						await interaction.reply({
							content:
								'Your email was verified, but I could not update your server roles here.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					try {
						await interaction.member.roles.remove(
							config.roleToRemove,
							'User completed email verification',
						);
					} catch (error) {
						console.error(
							`Failed to remove role ${config.roleToRemove} from ${interaction.user.id}.`,
							error,
						);
						await interaction.reply({
							content:
								'Your email was verified, but I could not remove the verification role. Please contact a server administrator.',
							flags: MessageFlags.Ephemeral,
						});
						return;
					}

					await interaction.reply({
						content:
							'Successfully verified your email! You now have access to the server.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				if (result.status === 'expired') {
					await interaction.reply({
						content:
							'That code expired. Click Verify to request a new one.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				if (result.status === 'missing') {
					await interaction.reply({
						content:
							'No verification is in progress. Click Verify to start again.',
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await interaction.reply({
					content:
						'That code does not match. Click Enter One-Time Code and try again.',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	} catch (error) {
		console.error('Failed to handle interaction.', error);

		if (!interaction.isRepliable()) {
			return;
		}

		const errorReply: InteractionReplyOptions = {
			content: 'Something went wrong! Try again later.',
			flags: MessageFlags.Ephemeral,
		};

		if (interaction.deferred || interaction.replied) {
			await interaction.followUp(errorReply);
			return;
		}

		await interaction.reply(errorReply);
	}
});

void client.login(process.env.DISCORD_BOT_TOKEN);
