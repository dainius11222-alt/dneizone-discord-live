import express from 'express';
import cors from 'cors';
import { Client, GatewayIntentBits } from 'discord.js';

const API_VERSION = 29;
const PORT = process.env.PORT || 3000;
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1550135145867124837';
const NEWS_CHANNEL_ID = process.env.DISCORD_NEWS_CHANNEL_ID || '1550135146722623605';
const SUPPORTER_ROLE_ID = process.env.DISCORD_SUPPORTER_ROLE_ID || '';
const SUPPORTER_ROLE_NAME = process.env.DISCORD_SUPPORTER_ROLE_NAME || '';
const OWNER_ROLE_ID = process.env.DISCORD_OWNER_ROLE_ID || '';
const OWNER_ROLE_NAME = process.env.DISCORD_OWNER_ROLE_NAME || '';
const TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN is required');

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
]});

let cache = {
  apiVersion: API_VERSION, connected: false, guildName: 'DNEIZONE', online: 0, members: 0,
  ownerOnline: false, ownerName: null, ownerAvatar: null, ownerRole: null,
  ownersOnline: 0, ownersTotal: 0, owners: [], supporterRole: null,
  supportersOnline: 0, supportersTotal: 0, supporters: [], latest: [],
  diagnostics: { ownerMatches: [], supporterMatches: [] }, updatedAt: null
};

const normalize = (s='') => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const online = m => !!m?.presence?.status && m.presence.status !== 'offline';
const memberCard = (m, fallback='Member') => ({
  id:m.id,
  name:m.displayName || m.user?.globalName || m.user?.username || fallback,
  avatar:m.displayAvatarURL?.({size:128}) || m.user?.displayAvatarURL?.({size:128}) || null,
  online:online(m), status:m.presence?.status || 'offline'
});
const cleanMentions=(value='')=>value.replace(/<@&\d+>/g,'').replace(/<@!?\d+>/g,'').replace(/@everyone|@here/g,'').replace(/\n{3,}/g,'\n\n').trim();
const sanitizeMessage=m=>{
  const embed=m.embeds?.[0]||null;
  const fields=(embed?.fields||[]).map(f=>({name:cleanMentions(f.name||''),value:cleanMentions(f.value||'')})).filter(f=>f.name||f.value);
  const content=cleanMentions(embed?.description||m.content||fields.map(f=>`${f.name}: ${f.value}`).join(' · ')||embed?.title||'New update');
  return { id:m.id, author:m.member?.displayName||m.author?.globalName||m.author?.username||'Discord',
    avatar:m.author?.displayAvatarURL?.({size:128})||null, title:cleanMentions(embed?.title||'')||null,
    description:cleanMentions(embed?.description||'')||null, fields, content,
    timestamp:m.createdAt?.toISOString?.()||new Date().toISOString(),
    url:`https://discord.com/channels/${GUILD_ID}/${NEWS_CHANNEL_ID}/${m.id}`,
    image:m.attachments?.find?.(a=>a.contentType?.startsWith('image/'))?.url||embed?.image?.url||embed?.thumbnail?.url||null,
    color:embed?.color||null };
};

function matchingRoles(guild, explicitId, configuredName, hints){
  const roles=[...guild.roles.cache.values()].filter(r=>r.name!=='@everyone');
  const selected=new Map();
  if(explicitId && guild.roles.cache.has(explicitId)) selected.set(explicitId,guild.roles.cache.get(explicitId));
  const configured=normalize(configuredName);
  if(configured){
    for(const r of roles){ const n=normalize(r.name); if(n===configured || n.includes(configured)) selected.set(r.id,r); }
  }
  if(!selected.size){
    for(const r of roles){ const n=normalize(r.name); if(hints.some(h=>n.includes(h))) selected.set(r.id,r); }
  }
  return [...selected.values()];
}

async function refresh(){
  const guild=client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
  await guild.roles.fetch().catch(()=>{});
  await guild.members.fetch({withPresences:true}).catch(err=>console.warn('members fetch:',err?.message||err));
  const members=[...guild.members.cache.values()];
  const guildOwner=guild.members.cache.get(guild.ownerId) || await guild.members.fetch(guild.ownerId).catch(()=>null);

  const ownerRoles=matchingRoles(guild, OWNER_ROLE_ID, OWNER_ROLE_NAME, ['owner','founder','inhaber','leitung','chief','ceo']);
  const supporterRoles=matchingRoles(guild, SUPPORTER_ROLE_ID, SUPPORTER_ROLE_NAME, ['supporter','support','helper','customer support']);

  const ownerMap=new Map();
  for(const role of ownerRoles){ for(const m of members){ if(m.roles.cache.has(role.id) && !m.user?.bot) ownerMap.set(m.id,m); } }
  if(guildOwner && !guildOwner.user?.bot) ownerMap.set(guildOwner.id,guildOwner);
  const supporterMap=new Map();
  for(const role of supporterRoles){ for(const m of members){ if(m.roles.cache.has(role.id) && !m.user?.bot) supporterMap.set(m.id,m); } }

  const owners=[...ownerMap.values()].map(m=>memberCard(m,'Owner')).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));
  const supporters=[...supporterMap.values()].map(m=>memberCard(m,'Support')).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name));

  let latest=[];
  const channel=await client.channels.fetch(NEWS_CHANNEL_ID).catch(()=>null);
  if(channel?.isTextBased?.()){
    const msgs=await channel.messages.fetch({limit:8}).catch(()=>null);
    if(msgs) latest=[...msgs.values()].sort((a,b)=>b.createdTimestamp-a.createdTimestamp).map(sanitizeMessage);
  }

  cache={
    apiVersion:API_VERSION, connected:true, guildName:guild.name,
    online:members.filter(m=>online(m)&&!m.user?.bot).length, members:guild.memberCount,
    ownerOnline:guildOwner?online(guildOwner):false,
    ownerName:guildOwner?.displayName||guildOwner?.user?.globalName||guildOwner?.user?.username||null,
    ownerAvatar:guildOwner?.displayAvatarURL?.({size:128})||null,
    ownerRole:ownerRoles.map(r=>r.name).join(', ') || 'Server Owner',
    ownersOnline:owners.filter(x=>x.online).length, ownersTotal:owners.length, owners,
    supporterRole:supporterRoles.map(r=>r.name).join(', ')||null,
    supportersOnline:supporters.filter(x=>x.online).length, supportersTotal:supporters.length, supporters,
    latest,
    diagnostics:{
      ownerConfigured:OWNER_ROLE_NAME||OWNER_ROLE_ID||null,
      supporterConfigured:SUPPORTER_ROLE_NAME||SUPPORTER_ROLE_ID||null,
      ownerMatches:ownerRoles.map(r=>({id:r.id,name:r.name})),
      supporterMatches:supporterRoles.map(r=>({id:r.id,name:r.name}))
    },
    updatedAt:new Date().toISOString()
  };
  console.log(`[V${API_VERSION}] ${guild.name}: ${cache.online}/${cache.members} online | owners ${cache.ownersOnline}/${cache.ownersTotal} | supporters ${cache.supportersOnline}/${cache.supportersTotal} | news ${cache.latest.length}`);
}

client.once('ready', async()=>{ console.log(`Discord ready as ${client.user?.tag||client.user?.username} | API V${API_VERSION}`); await refresh().catch(console.error); setInterval(()=>refresh().catch(console.error),10000); });
client.on('messageCreate',m=>{ if(m.guildId===GUILD_ID&&m.channelId===NEWS_CHANNEL_ID){ const item=sanitizeMessage(m); cache.latest=[item,...cache.latest.filter(x=>x.id!==item.id)].slice(0,8); cache.updatedAt=new Date().toISOString(); }});
client.on('messageUpdate',async(_o,n)=>{ if(n.guildId===GUILD_ID&&n.channelId===NEWS_CHANNEL_ID){ try{const f=n.partial?await n.fetch():n;const item=sanitizeMessage(f);cache.latest=[item,...cache.latest.filter(x=>x.id!==item.id)].slice(0,8);cache.updatedAt=new Date().toISOString();}catch{}}});
for(const ev of ['presenceUpdate','guildMemberAdd','guildMemberRemove','guildMemberUpdate']) client.on(ev,()=>refresh().catch(()=>{}));

const app=express();
app.use(cors({origin:'*',methods:['GET','OPTIONS'],allowedHeaders:['Content-Type','Accept']}));
app.use((req,res,next)=>{res.set('Access-Control-Allow-Origin','*');res.set('Cache-Control','no-store');next();});
app.get('/',(_req,res)=>res.json({ok:true,service:'DNEIZONE Discord Live API',apiVersion:API_VERSION,discord:client.isReady()}));
app.get('/health',(_req,res)=>res.json({ok:true,discord:client.isReady(),apiVersion:API_VERSION,updatedAt:cache.updatedAt}));
app.get('/api/discord',(_req,res)=>res.json(cache));
app.listen(PORT,()=>console.log(`DNEIZONE Discord API V${API_VERSION} on :${PORT}`));
client.login(TOKEN);
