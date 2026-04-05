import { randomInt } from 'node:crypto';
import { CreateEmailOptions, Resend } from 'resend';
import {
	buildVerificationEmailHtml,
	buildVerificationEmailText,
	VERIFICATION_EMAIL_SUBJECT,
} from '../constants/email-format';
import { OTP_LENGTH } from '../constants/verification-flow';

const OTP_TTL_MS = 10 * 60 * 1000;
const ALLOWED_EMAIL_DOMAINS = new Set(['brown.edu', 'risd.edu']);

type PendingVerification = {
	email: string;
	otp: string;
	expiresAt: number;
};

type VerificationResult =
	| { status: 'verified'; email: string }
	| { status: 'invalid' | 'expired' | 'missing' };

const pendingVerifications = new Map<string, PendingVerification>();

let resendClient: Resend | null = null;

function getResendClient() {
	if (!process.env.RESEND_API_TOKEN) {
		throw new Error('RESEND_API_TOKEN is not configured.');
	}

	if (!resendClient) {
		resendClient = new Resend(process.env.RESEND_API_TOKEN);
	}

	return resendClient;
}

export function getSubmittedEmail(rawEmail: string) {
	return rawEmail.trim().toLowerCase();
}

export function getSubmittedOtp(rawOtp: string) {
	return rawOtp.trim();
}

export function isAllowedSchoolEmail(email: string) {
	const [, domain] = email.split('@');

	return Boolean(domain && ALLOWED_EMAIL_DOMAINS.has(domain));
}

export function getPendingVerification(userId: string) {
	const pendingVerification = pendingVerifications.get(userId);

	if (!pendingVerification) {
		return null;
	}

	if (pendingVerification.expiresAt < Date.now()) {
		pendingVerifications.delete(userId);
		return null;
	}

	return pendingVerification;
}

export function createPendingVerification(userId: string, email: string) {
	const otp = randomInt(0, 10 ** OTP_LENGTH)
		.toString()
		.padStart(OTP_LENGTH, '0');
	const pendingVerification = {
		email,
		otp,
		expiresAt: Date.now() + OTP_TTL_MS,
	};

	pendingVerifications.set(userId, pendingVerification);

	return pendingVerification;
}

export function clearPendingVerification(userId: string) {
	pendingVerifications.delete(userId);
}

export function verifySubmittedOtp(
	userId: string,
	submittedOtp: string,
): VerificationResult {
	const pendingVerification = pendingVerifications.get(userId);

	if (!pendingVerification) {
		return { status: 'missing' };
	}

	if (pendingVerification.expiresAt < Date.now()) {
		pendingVerifications.delete(userId);
		return { status: 'expired' };
	}

	if (pendingVerification.otp !== submittedOtp) {
		return { status: 'invalid' };
	}

	pendingVerifications.delete(userId);

	return {
		status: 'verified',
		email: pendingVerification.email,
	};
}

export async function sendVerificationEmail(email: string, otp: string) {
	if (!process.env.RESEND_FROM_EMAIL) {
		throw new Error('RESEND_FROM_EMAIL is not configured.');
	}

	const mailConfig: CreateEmailOptions = {
		from: process.env.RESEND_FROM_EMAIL,
		to: email,
		subject: VERIFICATION_EMAIL_SUBJECT,
		text: buildVerificationEmailText({ otp }),
		html: buildVerificationEmailHtml({ otp }),
	};

	if (process.env.RESEND_REPLY_TO_EMAIL) {
		mailConfig.replyTo = process.env.RESEND_REPLY_TO_EMAIL;
	}

	const response = await getResendClient().emails.send(mailConfig);

	if (response.error) {
		throw new Error(response.error.message);
	}

	return response.data;
}
