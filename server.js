import express from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits } from 'discord.js';

const PORT = process.env.PORT || 3000;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1550135145867124837';
const NEWS_CHANNEL_ID = process.env.DISCORD_NEWS_CHANNEL_ID || '1550135146722623605';
const SUPPORTER_ROLE_ID = process.env.DISCORD_SUPPORTER_ROLE_ID || '';
const SUPPORTER_ROLE_NAME = (process.env.DISCORD_SUPPORTER_ROLE_NAME || 'supporter').toLowerCase();
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN is required');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let cache = {
  connected: false,
  guildName: 'DNEIZONE',
  online: 0,
  members: 0,
  ownerOnline: false,
  supportersOnline: 0,
  supportersTotal: 0,
  latest: [],
  updatedAt: null
};

const sanitizeMessage = (m) => ({
  id: m.id,
  author: m.member?.displayName || m.author?.globalName || m.author?.username || 'Discord',
  avatar: m.author?.displayAvatarURL?.({ size: 128 }) || null,
  content: m.content || m.embeds?.[0]?.description || m.embeds?.[0]?.title || 'New update',
  timestamp: m.createdAt?.toISOString?.() || new Date().toISOString(),
  url: `https://discord.com/channels/${GUILD_ID}/${NEWS_CHANNEL_ID}/${m.id}`,
  image: m.attachments?.find?.(a => a.contentType?.startsWith('image/'))?.url || m.embeds?.[0]?.image?.url || null
});

async function refresh() {
  const guild = await client.guilds.fetch(GUILD_ID);
  try { await guild.members.fetch({ withPresences: true }); } catch {}
  const ownerId = guild.ownerId;
  const owner = guild.members.cache.get(ownerId);
  const supporterRole = SUPPORTER_ROLE_ID
    ? guild.roles.cache.get(SUPPORTER_ROLE_ID)
    : guild.roles.cache.find(r => r.name.toLowerCase().includes(SUPPORTER_ROLE_NAME));

  const members = [...guild.members.cache.values()];
  const isOnline = (m) => !!m.presence && m.presence.status && m.presence.status !== 'offline';
  const supporters = supporterRole ? members.filter(m => m.roles.cache.has(supporterRole.id)) : [];

  const channel = await client.channels.fetch(NEWS_CHANNEL_ID);
  let latest = [];
  if (channel?.isTextBased?.()) {
    const messages = await channel.messages.fetch({ limit: 6 });
    latest = [...messages.values()].sort((a,b) => b.createdTimestamp - a.createdTimestamp).map(sanitizeMessage);
  }

  cache = {
    connected: true,
    guildName: guild.name,
    online: members.filter(isOnline).length,
    members: guild.memberCount,
    ownerOnline: owner ? isOnline(owner) : false,
    supportersOnline: supporters.filter(isOnline).length,
    supportersTotal: supporters.length,
    supporterRole: supporterRole?.name || null,
    latest,
    updatedAt: new Date().toISOString()
  };
}

client.once('ready', async () => {
  await refresh().catch(console.error);
  setInterval(() => refresh().catch(console.error), 15000);
});

client.on('messageCreate', async (message) => {
  if (message.guildId !== GUILD_ID || message.channelId !== NEWS_CHANNEL_ID) return;
  const item = sanitizeMessage(message);
  cache.latest = [item, ...cache.latest.filter(x => x.id !== item.id)].slice(0, 6);
  cache.updatedAt = new Date().toISOString();
});

client.on('presenceUpdate', () => refresh().catch(() => {}));
client.on('guildMemberAdd', () => refresh().catch(() => {}));
client.on('guildMemberRemove', () => refresh().catch(() => {}));

const app = express();
const allowed = (process.env.SITE_ORIGIN || 'https://dneizones.com').split(',').map(v => v.trim());
app.use(cors({ origin(origin, cb){ if (!origin || allowed.includes('*') || allowed.includes(origin)) cb(null, true); else cb(null, false); } }));
app.get('/health', (req,res) => res.json({ ok: true, discord: client.isReady() }));
app.get('/api/discord', (req,res) => res.json(cache));
app.listen(PORT, () => console.log(`DNEIZONE Discord API on :${PORT}`));
client.login(TOKEN);
