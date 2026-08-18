'use strict';
const fetch = require('node-fetch');
const Camera = require('../models/Camera');

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// Shared with routes/chat.js (public site widget) so both surfaces give the
// same answers about services, pricing and contact details.
const BASE_SYSTEM_PROMPT = `You are the friendly virtual assistant for Mashtronics Business Enterprise, a professional security and IT solutions company based in Roodepoort, South Africa, operating since 2015.

SERVICES:
- CCTV Installation (residential & corporate)
- Access Control Systems
- Electric Fencing
- Network Cabling
- Fibre Connectivity
- Fire Detection Systems
- Intrusion Alarm Systems
- Control Rooms
- Intercom Systems

EQUIPMENT:
- Residential CCTV installations use Dahua cameras and recorders.

RESIDENTIAL CCTV PACKAGES (fully installed, VAT inclusive):
- 4-camera package: R12,000
- 6-camera package: R14,000
- 8-camera package: R16,000
All packages include NVR, HDD, cameras, cabling, and accessories.

PRICING MODEL:
- Residential (custom): supplier cost + 20% markup + 30% installation fee, minimum install charge R3,000
- Corporate: supplier cost + 35% markup + 30% installation fee, minimum install charge R5,000
- VAT: 15% (VAT number: 4320284435)
- All pricing is an estimate — final quotes are confirmed on-site by a technician.

CONTACT:
- Office: 011 765 4148
- Mobile/WhatsApp: 060 428 4818
- Email: walter@mashtronicsbe.co.za
- Address: Meadgate Unit 18B, Meadgate Centre, Kingfisher Street, Helderkruin, Roodepoort, 1724
- Website: mashtronicsbe.co.za

BEHAVIOUR:
- Be professional, warm, and concise (under 150 words unless detailed explanation is clearly needed)
- Never invent prices outside the packages listed above
- For custom or site-specific quotes, recommend calling 011 765 4148 or emailing walter@mashtronicsbe.co.za
- If asked about something unrelated to Mashtronics services, politely redirect to what you can help with
- Do not discuss competitors`;

function buildCameraSummary(cameras) {
  if (!cameras.length) return 'This client has no cameras registered yet.';
  return cameras
    .map(c => `- ${c.name} (${c.location || 'location not set'}): ${c.status}, signal ${c.signal}${c.model ? `, ${c.model}` : ''}`)
    .join('\n');
}

const TOPIC_LABELS = {
  billing: 'billing/account',
  general: 'a general question',
  other: 'something else',
};

// System prompt for the in-app support chat: base business info plus, only
// when the client picked "camera/technical" as their topic, the client's
// real, live camera data so the assistant can give specific troubleshooting
// steps. For every other topic the camera-diagnostic behaviour must NOT be
// injected — the client explicitly said this conversation isn't about that.
function buildAppSystemPrompt(client, cameras, topic) {
  if (topic === 'camera') {
    return `${BASE_SYSTEM_PROMPT}

You are now chatting inside the SecureWatch client app with an existing Mashtronics client, ${client.name}, who picked "Camera / technical issue" as their topic. You can see their real camera status below — use it to give specific, practical self-help before a technician visit is needed. For an offline camera or weak signal, suggest checking in this order: power at the camera, the cable/connection into the NVR, the router/Wi-Fi signal strength, then a restart of the NVR. The goal is to help the client fix simple issues themselves so a technician isn't dispatched for something they could resolve in a minute.

CLIENT'S CAMERAS:
${buildCameraSummary(cameras)}

BEHAVIOUR FOR THIS CHAT:
- Ask one clarifying question at a time if you need more information before suggesting a fix.
- Give concrete, numbered self-fix steps before suggesting a technician callout.
- Never claim you will dispatch a technician yourself, or that you can see live video — you cannot do either.
- If the client seems frustrated, unsatisfied, or explicitly asks for a person, tell them they can tap "Talk to a real person" to reach a Mashtronics representative.
- Keep replies under 120 words.`;
  }

  const topicLabel = TOPIC_LABELS[topic] || 'a general question';
  return `${BASE_SYSTEM_PROMPT}

You are now chatting inside the SecureWatch client app with an existing Mashtronics client, ${client.name}, who picked "${topicLabel}" as their topic for this conversation.

BEHAVIOUR FOR THIS CHAT:
- Answer helpfully and concisely about what was actually asked. You do NOT have this client's live camera status in this conversation, so do not guess at or diagnose a camera/technical issue.
- If the client brings up a camera or technical problem, tell them to tap "Change topic" and pick "Camera / technical issue" so the assistant can see their live camera status and help properly — don't attempt to troubleshoot it here.
- Never claim you will dispatch a technician yourself.
- If the client seems frustrated, unsatisfied, or explicitly asks for a person, tell them they can tap "Talk to a real person" to reach a Mashtronics representative.
- Keep replies under 120 words.`;
}

// In-memory sliding-window cooldown so a single client can't run up
// unbounded DeepSeek cost. Fine for a single-instance server; would need a
// shared store (Redis/Mongo) behind a load balancer.
const CALL_LOG = new Map(); // clientId -> timestamps (ms)
const MAX_CALLS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

function isOverCooldown(clientId) {
  const now = Date.now();
  const recent = (CALL_LOG.get(clientId) || []).filter(t => now - t < HOUR_MS);
  CALL_LOG.set(clientId, recent);
  return recent.length >= MAX_CALLS_PER_HOUR;
}

function recordCall(clientId) {
  const recent = CALL_LOG.get(clientId) || [];
  recent.push(Date.now());
  CALL_LOG.set(clientId, recent);
}

// conversation: [{ role: 'user'|'assistant', content }], oldest first.
// topic: '' | 'camera' | 'billing' | 'general' | 'other' — the client's
// self-picked conversation subject. Camera data is only ever fetched/injected
// when topic === 'camera'.
async function getAiReply(client, conversation, topic) {
  const clientId = String(client._id);
  if (isOverCooldown(clientId)) {
    const err = new Error('AI reply cooldown exceeded for this client');
    err.code = 'COOLDOWN';
    throw err;
  }

  const cameras = topic === 'camera'
    ? await Camera.find({ clientRef: client._id, archived: false }).sort({ name: 1 })
    : [];
  const messages = [
    { role: 'system', content: buildAppSystemPrompt(client, cameras, topic) },
    ...conversation,
  ];

  recordCall(clientId);

  const dsRes = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      stream: false,
      max_tokens: 300,
      temperature: 0.7,
    }),
  });

  if (!dsRes.ok) {
    const errText = await dsRes.text().catch(() => '');
    throw new Error(`DeepSeek request failed (${dsRes.status}): ${errText}`);
  }

  const data = await dsRes.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('DeepSeek returned an empty reply');
  return reply;
}

module.exports = { BASE_SYSTEM_PROMPT, buildAppSystemPrompt, getAiReply };
