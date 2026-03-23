const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function defaultGuild(prefix = '!') {
  return {
    config: {
      prefix,
      timezone: 'Africa/Cairo',
      sheetId: '',
      logChannelId: '',
      reportChannelId: '',
      rates: {
        translation: 0.3,
        proofreading_translation: 0.1,
        editing: 0.5,
        proofreading_edit: 0.1,
      },
      roleIds: {
        owner: '',
        admin: '',
        supervisor: '',
      },
    },
    members: [],
    chapters: [],
    logs: [],
    payroll: {},
  };
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
}

function loadDb() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { guilds: {} };
  }
}

function saveDb(db) {
  ensure();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function getGuild(db, guildId) {
  if (!db.guilds[guildId]) db.guilds[guildId] = defaultGuild();
  return db.guilds[guildId];
}

function ensureGuild(guildId, prefix = '!') {
  const db = loadDb();
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = defaultGuild(prefix);
    saveDb(db);
  }
  return db.guilds[guildId];
}

function updateGuild(guildId, updater, prefix = '!') {
  const db = loadDb();
  if (!db.guilds[guildId]) db.guilds[guildId] = defaultGuild(prefix);
  const current = db.guilds[guildId];
  const next = updater(current) || current;
  db.guilds[guildId] = next;
  saveDb(db);
  return next;
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function memberKey(member) {
  if (!member) return '';
  if (member.discordId) return `d:${member.discordId}`;
  return `n:${normalizeName(member.name).toLowerCase()}`;
}

function findMember(guild, identifier) {
  const needle = normalizeName(identifier).toLowerCase();
  return guild.members.find(m =>
    String(m.discordId || '').toLowerCase() === needle ||
    normalizeName(m.name).toLowerCase() === needle
  );
}

function addLog(guild, item) {
  guild.logs.push(item);
  if (guild.logs.length > 500) guild.logs = guild.logs.slice(-500);
}

module.exports = {
  loadDb,
  saveDb,
  getGuild,
  ensureGuild,
  updateGuild,
  normalizeName,
  memberKey,
  findMember,
  addLog,
  defaultGuild,
};
