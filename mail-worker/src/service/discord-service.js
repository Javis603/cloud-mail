import settingService from './setting-service';
import emailUtils from '../utils/email-utils';
import domainUtils from '../utils/domain-uitls';

const DISCORD_TITLE_MAX = 256;
const DISCORD_FIELD_NAME_MAX = 256;
const DISCORD_FIELD_VALUE_MAX = 1024;
const DISCORD_FOOTER_MAX = 2048;
const BODY_PREVIEW_MAX = 800;

const discordService = {
	async sendEmailToWebhook(c, email, attachments = []) {
		const {
			discordWebhookUrls,
			customDomain,
			discordMsgTo,
			discordMsgFrom,
			discordMsgText
		} = await settingService.query(c);

		const webhookUrls = (discordWebhookUrls || '')
			.split(',')
			.map(url => url.trim())
			.filter(url => url.startsWith('https://'));

		if (webhookUrls.length === 0) return;

		const payload = buildPayload(email, attachments, {
			customDomain,
			discordMsgTo,
			discordMsgFrom,
			discordMsgText
		});

		await Promise.all(webhookUrls.map(async (webhookUrl) => {
			try {
				await sendWithRetry(webhookUrl, payload);
			} catch (e) {
				console.error('Send Discord webhook failed:', e.message);
			}
		}));
	}
};

function buildPayload(email, attachments, options) {
	const fields = [
		field('Subject', email.subject || '(no subject)', false),
	];

	if (options.discordMsgFrom === 'only-name') {
		fields.push(field('From', email.name || emailUtils.getName(email.sendEmail || ''), true));
	} else if (options.discordMsgFrom === 'show') {
		fields.push(field('From', codeInline(formatFrom(email)), true));
	}

	if (options.discordMsgTo === 'show') {
		fields.push(field('To', codeInline(email.toEmail || 'unknown'), true));
	}

	fields.push(field('Time (HKT)', formatHktDate(email.createTime || new Date()), false));

	if (options.discordMsgText === 'show') {
		const preview = emailUtils.formatText(email.text) || emailUtils.htmlToText(email.content) || '(no body)';
		fields.push(field('Preview', truncateCodeBlock(truncate(preview, BODY_PREVIEW_MAX), DISCORD_FIELD_VALUE_MAX), false));
	}

	if (attachments.length > 0) {
		fields.push(field(`Attachments (${attachments.length})`, buildAttachmentField(attachments), false));
	}

	const embed = {
		title: truncate(`New email to ${email.toEmail || 'unknown'}`, DISCORD_TITLE_MAX),
		color: 0x5865f2,
		fields,
		footer: {
			text: truncate('Cloud Mail - Discord notification', DISCORD_FOOTER_MAX)
		},
		timestamp: new Date().toISOString()
	};

	const payload = { embeds: [embed] };
	const inboxUrl = options.customDomain ? domainUtils.toOssDomain(options.customDomain) : '';

	if (inboxUrl) {
		payload.components = [
			{
				type: 1,
				components: [
					{
						type: 2,
						style: 5,
						label: 'Open Inbox',
						url: inboxUrl
					}
				]
			}
		];
	}

	return payload;
}

async function sendWithRetry(webhookUrl, payload, retries = 1) {
	const response = await fetch(withComponentsParam(webhookUrl), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (response.status === 429 && retries > 0) {
		const retryAfterMs = await getRetryAfterMs(response);
		await sleep(retryAfterMs);
		return sendWithRetry(webhookUrl, payload, retries - 1);
	}

	if (!response.ok) {
		console.error(`Discord webhook failed status: ${response.status} response: ${await response.text()}`);
	}
}

async function getRetryAfterMs(response) {
	const retryAfterHeader = Number(response.headers.get('Retry-After'));
	if (Number.isFinite(retryAfterHeader) && retryAfterHeader > 0) {
		return Math.ceil(retryAfterHeader * 1000);
	}

	const data = await response.json().catch(() => ({}));
	const retryAfterBody = Number(data.retry_after);
	if (Number.isFinite(retryAfterBody) && retryAfterBody > 0) {
		return Math.ceil(retryAfterBody * 1000);
	}

	return 1000;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function withComponentsParam(webhookUrl) {
	try {
		const url = new URL(webhookUrl);
		url.searchParams.set('with_components', 'true');
		return url.toString();
	} catch {
		const separator = webhookUrl.includes('?') ? '&' : '?';
		return `${webhookUrl}${separator}with_components=true`;
	}
}

function field(name, value, inline) {
	return {
		name: truncate(name, DISCORD_FIELD_NAME_MAX),
		value: truncate(value || '-', DISCORD_FIELD_VALUE_MAX),
		inline
	};
}

function buildAttachmentField(attachments) {
	const totalBytes = attachments.reduce((total, attachment) => {
		return total + (attachment.size || 0);
	}, 0);

	const lines = [
		`${attachments.length} file${attachments.length === 1 ? '' : 's'}, ${formatBytes(totalBytes)} total`
	];

	for (const attachment of attachments) {
		const line = `- ${attachment.filename || 'unnamed'} (${formatBytes(attachment.size || 0)})`;
		const next = [...lines, line].join('\n');

		if (next.length > DISCORD_FIELD_VALUE_MAX) {
			lines.push(`... (${attachments.length - lines.length + 1} more)`);
			break;
		}

		lines.push(line);
	}

	return truncate(lines.join('\n'), DISCORD_FIELD_VALUE_MAX);
}

function formatFrom(email) {
	if (email.name) return `${email.name} <${email.sendEmail || 'unknown'}>`;
	return email.sendEmail || 'unknown';
}

function truncateCodeBlock(value, max) {
	const prefix = '```\n';
	const suffix = '\n```';
	const contentMax = max - prefix.length - suffix.length;
	return `${prefix}${truncate(value, contentMax)}${suffix}`;
}

function codeInline(value) {
	const escaped = String(value || '').replace(/`/g, "'");
	return `\`${truncate(escaped, DISCORD_FIELD_VALUE_MAX - 2)}\``;
}

function truncate(value, max) {
	const text = String(value || '');
	if (text.length <= max) return text;
	if (max <= 3) return text.slice(0, max);
	return `${text.slice(0, max - 3)}...`;
}

function formatHktDate(value) {
	return new Date(value).toLocaleString('en-HK', {
		timeZone: 'Asia/Hong_Kong',
		hour12: false
	});
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default discordService;
