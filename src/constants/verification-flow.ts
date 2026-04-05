import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	type InteractionEditReplyOptions,
	type MessageCreateOptions,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';

export const OTP_LENGTH = 6;
export const EMAIL_INPUT_ID = 'email';
export const OTP_INPUT_ID = 'otp';

export const VERIFY_BUTTON_ID = 'verify:start';
export const EMAIL_MODAL_ID = 'verify:email';
export const OTP_BUTTON_ID = 'verify:enter-otp';
export const OTP_MODAL_ID = 'verify:otp';

export function buildVerificationMessage(): MessageCreateOptions {
	const embed = new EmbedBuilder()
		.setColor(0xafa6ff)
		.setDescription(
			'### 🌿 You must verify your email to access the server. \n For the safety of our members, **we require users to verify their account** using a `@brown.edu` or `@risd.edu` email address.\n\nPlease click the Verify button below to get started.\n\nIf you have difficulty with the verification process, contact someone with the <@&809972090790084619> role or email us at [brgd@brown.edu](mailto:brgd@brown.edu).',
		)
		.setFooter({
			text: '🔒 We take privacy seriously! All information is deleted after 10 minutes. Nothing is permanently stored.',
		});

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(VERIFY_BUTTON_ID)
					.setLabel('Verify')
					.setStyle(ButtonStyle.Primary),
			),
		],
	};
}

export function buildEmailModal() {
	return new ModalBuilder()
		.setCustomId(EMAIL_MODAL_ID)
		.setTitle('Verify your email')
		.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder()
					.setCustomId(EMAIL_INPUT_ID)
					.setLabel('📥 Brown or RISD email')
					.setPlaceholder('you@brown.edu / you@risd.edu')
					.setStyle(TextInputStyle.Short)
					.setRequired(true),
			),
		);
}

export function buildOtpModal() {
	return new ModalBuilder()
		.setCustomId(OTP_MODAL_ID)
		.setTitle('Enter one-time code')
		.addComponents(
			new ActionRowBuilder<TextInputBuilder>().addComponents(
				new TextInputBuilder()
					.setCustomId(OTP_INPUT_ID)
					.setLabel('🔐 One-time code')
					.setPlaceholder('123456')
					.setStyle(TextInputStyle.Short)
					.setMinLength(OTP_LENGTH)
					.setMaxLength(OTP_LENGTH)
					.setRequired(true),
			),
		);
}

export function buildOtpPrompt(email: string): InteractionEditReplyOptions {
	return {
		content: `A verification email has been sent to **${email}**. When it arrives, click below to enter the code. Make sure to check your spam folder!`,
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(OTP_BUTTON_ID)
					.setLabel('Enter One-Time Code')
					.setStyle(ButtonStyle.Secondary),
			),
		],
	};
}
