export const VERIFICATION_EMAIL_SUBJECT = 'Your verification code';

type VerificationEmailFormatProps = {
	otp: string;
};

export function buildVerificationEmailText({
	otp,
}: VerificationEmailFormatProps) {
	return `Your one-time verification code is ${otp}. It expires in 10 minutes.`;
}

export function buildVerificationEmailHtml({
	otp,
}: VerificationEmailFormatProps) {
	return [
		'<div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;">',
		'<h2 style="margin-bottom:8px;">Email verification</h2>',
		'<p style="margin-top:0;">Use this one-time code to finish verifying your email:</p>',
		`<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0;">${otp}</p>`,
		'<p style="margin-bottom:0;">This code expires in 10 minutes.</p>',
		'</div>',
	].join('');
}
