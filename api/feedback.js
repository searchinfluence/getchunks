// Feedback API — posts user feedback to a Slack Incoming Webhook.
// Env: SLACK_FEEDBACK_WEBHOOK_URL (required to deliver), FEEDBACK_PROJECT_NAME (optional, defaults to "getchunks")
import fetch from 'node-fetch';

const TYPE_EMOJI = {
  bug: ':bug:',
  feature: ':sparkles:',
  improvement: ':bulb:',
  other: ':speech_balloon:',
};

const TYPE_LABEL = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  improvement: 'Improvement',
  other: 'Other Feedback',
};

const VALID_TYPES = ['bug', 'feature', 'improvement', 'other'];

async function sendSlackNotification({ type, message, userEmail, pageUrl, userAgent }) {
  const webhook = process.env.SLACK_FEEDBACK_WEBHOOK_URL;
  if (!webhook) {
    console.warn('[feedback] SLACK_FEEDBACK_WEBHOOK_URL not set — submission dropped silently.');
    return { delivered: false, reason: 'webhook_not_configured' };
  }

  const projectName = process.env.FEEDBACK_PROJECT_NAME || 'getchunks';
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${TYPE_EMOJI[type] || ':memo:'} New ${projectName} feedback: ${TYPE_LABEL[type] || type}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*From:*\n${userEmail}` },
        { type: 'mrkdwn', text: `*Type:*\n${TYPE_LABEL[type] || type}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Message:*\n${message}` },
    },
  ];

  if (pageUrl) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Page:*\n<${pageUrl}|${pageUrl}>` },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Submitted ${new Date().toISOString()}${userAgent ? ` · ${userAgent}` : ''}`,
        },
      ],
    },
  );

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[feedback] Slack webhook non-OK:', res.status, body);
      return { delivered: false, reason: `slack_${res.status}` };
    }
    return { delivered: true };
  } catch (err) {
    console.error('[feedback] Slack webhook failed:', err);
    return { delivered: false, reason: 'fetch_error' };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type = 'other', message, email, pageUrl } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: 'Feedback message is too long (4000 char max).' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid feedback type.' });
    }

    const userEmail = typeof email === 'string' && email.trim() ? email.trim() : 'Anonymous';
    const userAgent = req.headers['user-agent'] || undefined;

    const result = await sendSlackNotification({
      type,
      message: message.trim(),
      userEmail,
      pageUrl: typeof pageUrl === 'string' && pageUrl ? pageUrl : undefined,
      userAgent,
    });

    return res.status(200).json({ success: true, delivered: result.delivered });
  } catch (err) {
    console.error('[feedback] handler error:', err);
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
