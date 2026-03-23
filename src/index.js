require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  REST,
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { buildCommands, helpText } = require('./definitions');
const {
  loadDb,
  saveDb,
  getGuild,
  ensureGuild,
  updateGuild,
  normalizeName,
  findMember,
  addLog,
} = require('./storage');
const { syncSnapshot } = require('./sheets');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || '';
const DEFAULT_PREFIX = process.env.PREFIX || '!';
const DEFAULT_TZ = process.env.DEFAULT_TIMEZONE || 'Africa/Cairo';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const STAGES = {
  translation: {
    label: 'الترجمة',
    statusField: 'translationStatus',
    doneAtField: 'translationDoneAt',
    pending: 'قيد الترجمة',
    done: 'تمت الترجمة',
    memberField: 'translator',
    rateKey: 'translation',
  },
  proofreading_translation: {
    label: 'تدقيق الترجمة',
    statusField: 'proofreadingTranslationStatus',
    doneAtField: 'proofreadingTranslationDoneAt',
    pending: 'قيد التدقيق',
    done: 'تم التدقيق',
    memberField: 'translation_proofreader',
    rateKey: 'proofreading_translation',
  },
  editing: {
    label: 'التحرير',
    statusField: 'editingStatus',
    doneAtField: 'editingDoneAt',
    pending: 'قيد التحرير',
    done: 'تم التحرير',
    memberField: 'editor',
    rateKey: 'editing',
  },
  proofreading_edit: {
    label: 'تدقيق التحرير',
    statusField: 'proofreadingEditStatus',
    doneAtField: 'proofreadingEditDoneAt',
    pending: 'قيد تدقيق التحرير',
    done: 'تم تدقيق التحرير',
    memberField: 'edit_proofreader',
    rateKey: 'proofreading_edit',
  },
  publish: {
    label: 'النشر',
    statusField: 'publishStatus',
    doneAtField: 'publishDoneAt',
    pending: 'قيد النشر',
    done: 'تم النشر',
    memberField: null,
    rateKey: null,
  },
};

function now() {
  return new Date();
}

function tzKey(date, tz) {
  const d = date || new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || DEFAULT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return `${parts.year}-${parts.month}`;
}

function tzDateString(date, tz) {
  return new Date(date).toLocaleString('ar-EG', { timeZone: tz || DEFAULT_TZ });
}

function inMonth(date, monthKey, tz) {
  return tzKey(date, tz) === monthKey;
}

function getStageMeta(field) {
  return STAGES[field] || null;
}

function stageFieldFromText(text) {
  const t = String(text || '').toLowerCase().trim();
  if (['translation', 'ترجمة', 'الترجمة'].includes(t)) return 'translation';
  if (['proofreading_translation', 'translation_proofreader', 'tproof', 'تدقيق الترجمة', 'التدقيق', 'proofread_translation'].includes(t)) return 'proofreading_translation';
  if (['editing', 'تحرير', 'التحرير'].includes(t)) return 'editing';
  if (['proofreading_edit', 'edit_proofreader', 'editproof', 'تدقيق التحرير'].includes(t)) return 'proofreading_edit';
  if (['publish', 'النشر', 'رفع', 'رفع الفصل'].includes(t)) return 'publish';
  return null;
}

function isDoneStatus(field, status) {
  const meta = getStageMeta(field);
  if (!meta) return false;
  return normalizeName(status) === meta.done;
}

function chapterOverallStatus(ch) {
  if (ch.publishStatus === STAGES.publish.done) return ch.publishStatus;
  if (ch.proofreadingEditStatus === STAGES.proofreading_edit.done) return ch.proofreadingEditStatus;
  if (ch.editingStatus === STAGES.editing.done) return ch.editingStatus;
  if (ch.proofreadingTranslationStatus === STAGES.proofreading_translation.done) return ch.proofreadingTranslationStatus;
  if (ch.translationStatus === STAGES.translation.done) return ch.translationStatus;
  return ch.translationStatus || STAGES.translation.pending;
}

function stageStatus(ch, field) {
  const meta = getStageMeta(field);
  if (!meta) return '';
  return ch[meta.statusField] || '';
}

function findChapter(guild, id) {
  return guild.chapters.find(c => String(c.id) === String(id));
}

function ensureMemberByName(guild, name) {
  return guild.members.find(m => normalizeName(m.name).toLowerCase() === normalizeName(name).toLowerCase());
}

function requireRegisteredMember(guild, name) {
  const found = ensureMemberByName(guild, name);
  if (!found) {
    throw new Error(`العضو "${name}" غير مسجل. استخدم أمر التسجيل أولًا.`);
  }
  return found;
}

function memberDisplayName(member) {
  return member.name || member.discordId || 'غير معروف';
}

function isPrivileged(discordMember, guild) {
  if (!discordMember || !guild) return false;
  if (discordMember.id === guild.ownerId) return true;
  if (discordMember.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (discordMember.permissions.has(PermissionsBitField.Flags.ManageGuild)) return true;

  const ids = guild.config.roleIds || {};
  for (const id of Object.values(ids)) {
    if (id && discordMember.roles.cache.has(id)) return true;
  }
  return false;
}

function memberMatches(member, query) {
  const q = normalizeName(query).toLowerCase();
  return (
    normalizeName(member.name).toLowerCase().includes(q) ||
    String(member.discordId || '').includes(q) ||
    normalizeName(member.role).toLowerCase().includes(q)
  );
}

function chapterMatches(ch, query) {
  const q = normalizeName(query).toLowerCase();
  return [
    ch.id,
    ch.workName,
    ch.chapterNumber,
    ch.translator,
    ch.translation_proofreader,
    ch.editor,
    ch.edit_proofreader,
    ch.translationStatus,
    ch.proofreadingTranslationStatus,
    ch.editingStatus,
    ch.proofreadingEditStatus,
    ch.publishStatus,
  ].some(v => String(v || '').toLowerCase().includes(q));
}

function stageCompletedAtField(field) {
  const meta = getStageMeta(field);
  return meta ? meta.doneAtField : null;
}

function buildMemberStats(guild, memberName, tz = DEFAULT_TZ) {
  const needle = normalizeName(memberName).toLowerCase();
  const chapters = guild.chapters.filter(ch =>
    normalizeName(ch.translator).toLowerCase() === needle ||
    normalizeName(ch.translation_proofreader).toLowerCase() === needle ||
    normalizeName(ch.editor).toLowerCase() === needle ||
    normalizeName(ch.edit_proofreader).toLowerCase() === needle
  );

  const counts = { translation: 0, proofreading_translation: 0, editing: 0, proofreading_edit: 0 };
  let latest = null;

  for (const ch of chapters) {
    if (normalizeName(ch.translator).toLowerCase() === needle && ch.translationStatus === STAGES.translation.done) {
      counts.translation += 1;
      latest = latest ? new Date(Math.max(+new Date(latest), +new Date(ch.translationDoneAt || ch.updatedAt || ch.createdAt))).toISOString() : (ch.translationDoneAt || ch.updatedAt || ch.createdAt);
    }
    if (normalizeName(ch.translation_proofreader).toLowerCase() === needle && ch.proofreadingTranslationStatus === STAGES.proofreading_translation.done) {
      counts.proofreading_translation += 1;
      latest = latest ? new Date(Math.max(+new Date(latest), +new Date(ch.proofreadingTranslationDoneAt || ch.updatedAt || ch.createdAt))).toISOString() : (ch.proofreadingTranslationDoneAt || ch.updatedAt || ch.createdAt);
    }
    if (normalizeName(ch.editor).toLowerCase() === needle && ch.editingStatus === STAGES.editing.done) {
      counts.editing += 1;
      latest = latest ? new Date(Math.max(+new Date(latest), +new Date(ch.editingDoneAt || ch.updatedAt || ch.createdAt))).toISOString() : (ch.editingDoneAt || ch.updatedAt || ch.createdAt);
    }
    if (normalizeName(ch.edit_proofreader).toLowerCase() === needle && ch.proofreadingEditStatus === STAGES.proofreading_edit.done) {
      counts.proofreading_edit += 1;
      latest = latest ? new Date(Math.max(+new Date(latest), +new Date(ch.proofreadingEditDoneAt || ch.updatedAt || ch.createdAt))).toISOString() : (ch.proofreadingEditDoneAt || ch.updatedAt || ch.createdAt);
    }
  }

  const salary = (counts.translation * guild.config.rates.translation)
    + (counts.proofreading_translation * guild.config.rates.proofreading_translation)
    + (counts.editing * guild.config.rates.editing)
    + (counts.proofreading_edit * guild.config.rates.proofreading_edit);

  return {
    chapters,
    counts,
    salary: Number(salary.toFixed(2)),
    latest,
  };
}

function computePayrollForMonth(guild, month, tz = DEFAULT_TZ) {
  const rows = guild.members.map(m => ({
    discordId: m.discordId || '',
    name: m.name,
    translation: 0,
    proofreading_translation: 0,
    editing: 0,
    proofreading_edit: 0,
    total: 0,
    salary: 0,
    paid: false,
    notes: '',
  }));

  const byName = new Map(rows.map(r => [normalizeName(r.name).toLowerCase(), r]));
  const getRow = (name) => byName.get(normalizeName(name).toLowerCase());

  for (const ch of guild.chapters) {
    const pairs = [
      ['translation', 'translator', 'translationStatus', 'translationDoneAt'],
      ['proofreading_translation', 'translation_proofreader', 'proofreadingTranslationStatus', 'proofreadingTranslationDoneAt'],
      ['editing', 'editor', 'editingStatus', 'editingDoneAt'],
      ['proofreading_edit', 'edit_proofreader', 'proofreadingEditStatus', 'proofreadingEditDoneAt'],
    ];

    for (const [rateKey, memberField, statusField, doneAtField] of pairs) {
      const doneAt = ch[doneAtField];
      const status = ch[statusField];
      const memberName = ch[memberField];
      if (!doneAt || status !== STAGES[rateKey].done) continue;
      if (!inMonth(doneAt, month, tz)) continue;
      const row = getRow(memberName);
      if (!row) continue;
      row[rateKey] += 1;
    }
  }

  for (const row of rows) {
    row.total = row.translation + row.proofreading_translation + row.editing + row.proofreading_edit;
    row.salary = Number(
      (
        row.translation * guild.config.rates.translation +
        row.proofreading_translation * guild.config.rates.proofreading_translation +
        row.editing * guild.config.rates.editing +
        row.proofreading_edit * guild.config.rates.proofreading_edit
      ).toFixed(2)
    );
  }

  rows.sort((a, b) => b.salary - a.salary || b.total - a.total || a.name.localeCompare(b.name, 'ar'));
  return rows;
}

function updateChapterStageTimestamp(ch, field) {
  const meta = getStageMeta(field);
  if (!meta) return;
  if (ch[meta.statusField] === meta.done && !ch[meta.doneAtField]) {
    ch[meta.doneAtField] = new Date().toISOString();
  }
  if (ch[meta.statusField] !== meta.done) {
    ch[meta.doneAtField] = ch[meta.doneAtField] || '';
  }
}

function setChapterStage(ch, field, status) {
  const meta = getStageMeta(field);
  if (!meta) throw new Error('حقل المرحلة غير صحيح.');
  ch[meta.statusField] = status;
  if (status === meta.done) {
    ch[meta.doneAtField] = new Date().toISOString();
  }
  ch.updatedAt = new Date().toISOString();
}

function buildSnapshot(guild, tz = DEFAULT_TZ) {
  const settingsRows = [
    ['key', 'value', 'description'],
    ['prefix', guild.config.prefix || DEFAULT_PREFIX, 'بادئة الأوامر النصية'],
    ['timezone', guild.config.timezone || tz, 'المنطقة الزمنية'],
    ['sheet_id', guild.config.sheetId || '', 'معرف Google Sheet'],
    ['log_channel_id', guild.config.logChannelId || '', 'قناة اللوج'],
    ['report_channel_id', guild.config.reportChannelId || '', 'قناة التقرير الشهري'],
    ['translation_rate', guild.config.rates.translation, 'سعر فصل الترجمة'],
    ['proofreading_translation_rate', guild.config.rates.proofreading_translation, 'سعر فصل تدقيق الترجمة'],
    ['editing_rate', guild.config.rates.editing, 'سعر فصل التحرير'],
    ['proofreading_edit_rate', guild.config.rates.proofreading_edit, 'سعر فصل تدقيق التحرير'],
  ];

  const membersRows = [[
    'Discord ID','اسم العضو','الدور','الحالة','تاريخ التسجيل','ترجمة','تدقيق ترجمة','تحرير','تدقيق تحرير','إجمالي الفصول','الراتب','آخر نشاط','ملاحظات'
  ]];
  for (const member of guild.members) {
    const stats = buildMemberStats(guild, member.name, tz);
    membersRows.push([
      member.discordId || '',
      member.name || '',
      member.role || '',
      member.status || 'active',
      member.joinedAt ? tzDateString(member.joinedAt, tz) : '',
      stats.counts.translation,
      stats.counts.proofreading_translation,
      stats.counts.editing,
      stats.counts.proofreading_edit,
      stats.counts.translation + stats.counts.proofreading_translation + stats.counts.editing + stats.counts.proofreading_edit,
      stats.salary,
      stats.latest ? tzDateString(stats.latest, tz) : '',
      member.notes || '',
    ]);
  }

  const worksMap = new Map();
  for (const ch of guild.chapters) {
    const name = normalizeName(ch.workName);
    if (!worksMap.has(name)) {
      worksMap.set(name, {
        workName: ch.workName,
        chapters: 0,
        translation: 0,
        proofreading_translation: 0,
        editing: 0,
        proofreading_edit: 0,
        publish: 0,
        updatedAt: ch.updatedAt || ch.createdAt,
      });
    }
    const item = worksMap.get(name);
    item.chapters += 1;
    item.translation += ch.translationStatus === STAGES.translation.done ? 1 : 0;
    item.proofreading_translation += ch.proofreadingTranslationStatus === STAGES.proofreading_translation.done ? 1 : 0;
    item.editing += ch.editingStatus === STAGES.editing.done ? 1 : 0;
    item.proofreading_edit += ch.proofreadingEditStatus === STAGES.proofreading_edit.done ? 1 : 0;
    item.publish += ch.publishStatus === STAGES.publish.done ? 1 : 0;
    item.updatedAt = new Date(Math.max(+new Date(item.updatedAt || 0), +new Date(ch.updatedAt || ch.createdAt))).toISOString();
  }

  const worksRows = [[
    'اسم العمل','عدد الفصول','تمت الترجمة','تم التدقيق','تم التحرير','تم تدقيق التحرير','تم النشر','آخر تحديث','ملاحظات'
  ]];
  [...worksMap.values()]
    .sort((a, b) => a.workName.localeCompare(b.workName, 'ar'))
    .forEach(item => {
      worksRows.push([
        item.workName,
        item.chapters,
        item.translation,
        item.proofreading_translation,
        item.editing,
        item.proofreading_edit,
        item.publish,
        tzDateString(item.updatedAt, tz),
        '',
      ]);
    });

  const chaptersRows = [[
    'ID','اسم العمل','رقم الفصل','حالة الترجمة','حالة تدقيق الترجمة','حالة التحرير','حالة تدقيق التحرير','حالة النشر','عضو الترجمة','عضو تدقيق الترجمة','عضو التحرير','عضو تدقيق التحرير','تاريخ الإضافة','آخر تحديث','أضيف بواسطة'
  ]];
  const chaptersSorted = [...guild.chapters].sort((a, b) => Number(a.id) - Number(b.id));
  for (const ch of chaptersSorted) {
    chaptersRows.push([
      ch.id,
      ch.workName,
      ch.chapterNumber,
      ch.translationStatus || '',
      ch.proofreadingTranslationStatus || '',
      ch.editingStatus || '',
      ch.proofreadingEditStatus || '',
      ch.publishStatus || '',
      ch.translator || '',
      ch.translation_proofreader || '',
      ch.editor || '',
      ch.edit_proofreader || '',
      ch.createdAt ? tzDateString(ch.createdAt, tz) : '',
      ch.updatedAt ? tzDateString(ch.updatedAt, tz) : '',
      ch.addedBy || '',
    ]);
  }

  const payrollMap = {};
  const months = new Set();
  for (const ch of guild.chapters) {
    const doneFields = ['translationDoneAt', 'proofreadingTranslationDoneAt', 'editingDoneAt', 'proofreadingEditDoneAt'];
    for (const f of doneFields) {
      if (ch[f]) months.add(tzKey(new Date(ch[f]), tz));
    }
  }
  if (!months.size) months.add(tzKey(new Date(), tz));
  for (const month of months) {
    payrollMap[month] = computePayrollForMonth(guild, month, tz);
  }
  guild.payroll = payrollMap;

  const payrollRows = [[
    'الشهر','Discord ID','اسم العضو','ترجمة','تدقيق ترجمة','تحرير','تدقيق تحرير','الإجمالي','الراتب','حالة الدفع'
  ]];
  Object.keys(payrollMap).sort().forEach(month => {
    for (const row of payrollMap[month]) {
      payrollRows.push([
        month,
        row.discordId || '',
        row.name,
        row.translation,
        row.proofreading_translation,
        row.editing,
        row.proofreading_edit,
        row.total,
        row.salary,
        row.paid ? 'مدفوع' : 'غير مدفوع',
      ]);
    }
  });

  const logsRows = [[ 'الوقت', 'النوع', 'المستخدم', 'التفاصيل' ]];
  const logs = [...guild.logs].slice(-200);
  for (const log of logs) {
    logsRows.push([
      log.ts ? tzDateString(log.ts, tz) : '',
      log.type || '',
      log.user || '',
      log.detail || '',
    ]);
  }

  return { settingsRows, membersRows, worksRows, chaptersRows, payrollRows, logsRows };
}

function logAction(guildId, discordGuild, type, user, detail) {
  updateGuild(guildId, g => {
    addLog(g, {
      ts: new Date().toISOString(),
      type,
      user,
      detail,
    });
    return g;
  }, DEFAULT_PREFIX);

  if (discordGuild) {
    sendLogToChannel(discordGuild, `**${type}** | ${user} | ${detail}`).catch(() => {});
  }
}

function parsePipe(text) {
  return String(text || '').split('|').map(v => v.trim()).filter(Boolean);
}

function safeRoleId(role) {
  return role && role.id ? role.id : '';
}

function formatMoney(n) {
  return Number(n || 0).toFixed(2);
}

function payloadToText(payload) {
  if (typeof payload === 'string') return payload;
  if (!payload) return '';
  if (payload.content) return payload.content;
  if (payload.embeds && payload.embeds.length) {
    const e = payload.embeds[0];
    return [e.title, e.description].filter(Boolean).join('\n');
  }
  return '';
}

function buildMainEmbed(guild) {
  return new EmbedBuilder()
    .setColor(0x5b8def)
    .setTitle('🛠️ لوحة البوت')
    .setDescription('بوت إدارة فصول + أعضاء + رواتب + شيتات + تقارير.')
    .addFields(
      { name: 'Prefix', value: guild.config.prefix || DEFAULT_PREFIX, inline: true },
      { name: 'Timezone', value: guild.config.timezone || DEFAULT_TZ, inline: true },
      { name: 'Sheet', value: guild.config.sheetId ? 'متصل' : 'غير متصل', inline: true },
      { name: 'Log Channel', value: guild.config.logChannelId ? `<#${guild.config.logChannelId}>` : 'غير محدد', inline: true },
      { name: 'Report Channel', value: guild.config.reportChannelId ? `<#${guild.config.reportChannelId}>` : 'غير محدد', inline: true },
      { name: 'Rates', value: `ترجمة ${guild.config.rates.translation} | تدقيق ترجمة ${guild.config.rates.proofreading_translation} | تحرير ${guild.config.rates.editing} | تدقيق تحرير ${guild.config.rates.proofreading_edit}`, inline: false },
    );
}

function buildMemberEmbed(guild, member, tz = DEFAULT_TZ) {
  const stats = buildMemberStats(guild, member.name, tz);
  return new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle(`👤 ${member.name}`)
    .addFields(
      { name: 'Discord ID', value: member.discordId || '—', inline: true },
      { name: 'الدور', value: member.role || '—', inline: true },
      { name: 'الحالة', value: member.status || 'active', inline: true },
      { name: 'الترجمة', value: String(stats.counts.translation), inline: true },
      { name: 'تدقيق الترجمة', value: String(stats.counts.proofreading_translation), inline: true },
      { name: 'التحرير', value: String(stats.counts.editing), inline: true },
      { name: 'تدقيق التحرير', value: String(stats.counts.proofreading_edit), inline: true },
      { name: 'الراتب', value: formatMoney(stats.salary), inline: true },
      { name: 'آخر نشاط', value: stats.latest ? tzDateString(stats.latest, tz) : '—', inline: true },
    )
    .setFooter({ text: member.notes || '' });
}

function buildSalaryEmbed(month, rows) {
  const top = rows.slice(0, 10).map(r => `• ${r.name}: ${r.salary} (${r.total})`).join('\n') || 'لا توجد بيانات';
  return new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`💰 الرواتب — ${month}`)
    .setDescription(top);
}

function buildMonthlyEmbed(guild, month, tz = DEFAULT_TZ) {
  const rows = guild.payroll[month] || computePayrollForMonth(guild, month, tz);
  const totalSalary = rows.reduce((sum, r) => sum + r.salary, 0);
  const totalChapters = rows.reduce((sum, r) => sum + r.total, 0);
  return new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(`📅 التقرير الشهري — ${month}`)
    .addFields(
      { name: 'عدد الفصول/المهام', value: String(totalChapters), inline: true },
      { name: 'إجمالي الرواتب', value: formatMoney(totalSalary), inline: true },
      { name: 'عدد الأعضاء', value: String(rows.length), inline: true },
    )
    .setDescription(rows.slice(0, 10).map(r => `• ${r.name}: ${r.total} مهمة — ${r.salary}`).join('\n') || 'لا توجد بيانات');
}

function buildChapterEmbed(ch) {
  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`📘 فصل #${ch.id}`)
    .setDescription([
      `**اسم العمل:** ${ch.workName}`,
      `**رقم الفصل:** ${ch.chapterNumber}`,
      `**الحالة الحالية:** ${chapterOverallStatus(ch)}`,
      `**الترجمة:** ${ch.translationStatus || ''}`,
      `**تدقيق الترجمة:** ${ch.proofreadingTranslationStatus || ''}`,
      `**التحرير:** ${ch.editingStatus || ''}`,
      `**تدقيق التحرير:** ${ch.proofreadingEditStatus || ''}`,
      `**النشر:** ${ch.publishStatus || ''}`,
      `**عضو الترجمة:** ${ch.translator || ''}`,
      `**عضو تدقيق الترجمة:** ${ch.translation_proofreader || ''}`,
      `**عضو التحرير:** ${ch.editor || ''}`,
      `**عضو تدقيق التحرير:** ${ch.edit_proofreader || ''}`,
    ].join('\n'));
}

async function recordAndMaybeLog(guildId, discordGuild, type, user, detail) {
  logAction(guildId, discordGuild, type, user, detail);
}

function channelMentionToId(text) {
  const match = String(text || '').match(/^<#(\d+)>$/);
  return match ? match[1] : String(text || '').trim();
}

function buildChaptersListEmbed(chapters, title) {
  return new EmbedBuilder()
    .setColor(0x7f8c8d)
    .setTitle(title)
    .setDescription(chapters.length
      ? chapters.map(ch => `**#${ch.id}** | ${ch.workName} | فصل ${ch.chapterNumber} | ${chapterOverallStatus(ch)}`).join('\n\n')
      : 'لا توجد نتائج.');
}

async function syncGuild(guild) {
  const snapshot = buildSnapshot(guild, guild.config.timezone || DEFAULT_TZ);
  await syncSnapshot(guild.config.sheetId, snapshot).catch(() => {});
}

function updateRoleIdConfig(guild, type, roleId) {
  if (!guild.config.roleIds) guild.config.roleIds = { owner: '', admin: '', supervisor: '' };
  guild.config.roleIds[type] = roleId;
}

async function handleConfig(interaction, guild) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'view') {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('⚙️ الإعدادات').addFields(
      { name: 'Prefix', value: guild.config.prefix || DEFAULT_PREFIX, inline: true },
      { name: 'Timezone', value: guild.config.timezone || DEFAULT_TZ, inline: true },
      { name: 'Sheet ID', value: guild.config.sheetId || '—', inline: false },
      { name: 'Log Channel', value: guild.config.logChannelId ? `<#${guild.config.logChannelId}>` : '—', inline: false },
      { name: 'Report Channel', value: guild.config.reportChannelId ? `<#${guild.config.reportChannelId}>` : '—', inline: false },
      { name: 'Owner Role', value: guild.config.roleIds?.owner ? `<@&${guild.config.roleIds.owner}>` : '—', inline: true },
      { name: 'Admin Role', value: guild.config.roleIds?.admin ? `<@&${guild.config.roleIds.admin}>` : '—', inline: true },
      { name: 'Supervisor Role', value: guild.config.roleIds?.supervisor ? `<@&${guild.config.roleIds.supervisor}>` : '—', inline: true },
    )], ephemeral: true });
  }
  if (sub === 'setsheet') {
    const id = interaction.options.getString('sheet_id', true).trim();
    updateGuild(interaction.guild.id, g => { g.config.sheetId = id; return g; }, DEFAULT_PREFIX);
    await syncGuild(getGuild(loadDb(), interaction.guild.id)).catch(() => {});
    return interaction.reply({ content: '✅ تم حفظ Spreadsheet ID.', ephemeral: true });
  }
  if (sub === 'setlog') {
    const channel = interaction.options.getChannel('channel', true);
    updateGuild(interaction.guild.id, g => { g.config.logChannelId = channel.id; return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم ضبط قناة اللوج: ${channel}`, ephemeral: true });
  }
  if (sub === 'setreport') {
    const channel = interaction.options.getChannel('channel', true);
    updateGuild(interaction.guild.id, g => { g.config.reportChannelId = channel.id; return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم ضبط قناة التقرير: ${channel}`, ephemeral: true });
  }
  if (sub === 'settimezone') {
    const tz = interaction.options.getString('timezone', true).trim();
    new Intl.DateTimeFormat('en', { timeZone: tz });
    updateGuild(interaction.guild.id, g => { g.config.timezone = tz; return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم ضبط المنطقة الزمنية إلى ${tz}`, ephemeral: true });
  }
  if (sub === 'setprefix') {
    const prefix = interaction.options.getString('prefix', true).trim();
    updateGuild(interaction.guild.id, g => { g.config.prefix = prefix; return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم ضبط البادئة إلى ${prefix}`, ephemeral: true });
  }
  if (sub === 'setrate') {
    const stage = interaction.options.getString('stage', true);
    const value = interaction.options.getNumber('value', true);
    const map = {
      translation: 'translation',
      proofreading_translation: 'proofreading_translation',
      editing: 'editing',
      proofreading_edit: 'proofreading_edit',
    };
    const key = map[stage];
    if (!key) return interaction.reply({ content: 'مرحلة غير صحيحة.', ephemeral: true });
    updateGuild(interaction.guild.id, g => { g.config.rates[key] = value; return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم تحديث السعر: ${key} = ${value}`, ephemeral: true });
  }
  if (sub === 'setrole') {
    const type = interaction.options.getString('type', true).trim().toLowerCase();
    const role = interaction.options.getRole('role', true);
    if (!['owner', 'admin', 'supervisor'].includes(type)) {
      return interaction.reply({ content: 'type must be owner / admin / supervisor', ephemeral: true });
    }
    updateGuild(interaction.guild.id, g => { updateRoleIdConfig(g, type, role.id); return g; }, DEFAULT_PREFIX);
    return interaction.reply({ content: `✅ تم ضبط role ${type} إلى ${role}`, ephemeral: true });
  }
}

async function handleMember(interaction, guild) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'register') {
    const user = interaction.options.getUser('user');
    const name = normalizeName(interaction.options.getString('name', true));
    const role = normalizeName(interaction.options.getString('role', true));
    const notes = normalizeName(interaction.options.getString('notes') || '');
    const discordId = user ? user.id : '';
    let existed = false;

    updateGuild(interaction.guild.id, g => {
      const found = g.members.find(m =>
        (discordId && m.discordId === discordId) ||
        normalizeName(m.name).toLowerCase() === name.toLowerCase()
      );
      if (found) {
        found.name = name;
        found.role = role;
        found.notes = notes;
        found.discordId = discordId || found.discordId || '';
        found.updatedAt = new Date().toISOString();
        existed = true;
      } else {
        g.members.push({
          discordId,
          name,
          role,
          status: 'active',
          joinedAt: new Date().toISOString(),
          notes,
          updatedAt: new Date().toISOString(),
        });
      }
      return g;
    }, DEFAULT_PREFIX);

    await recordAndMaybeLog(interaction.guild.id, interaction.guild, 'MEMBER_REGISTER', interaction.user.tag, `${name} / ${role}`);
    return interaction.reply({ content: existed ? '✅ تم تحديث العضو.' : '✅ تم تسجيل العضو.', ephemeral: true });
  }

  if (sub === 'profile') {
    const user = interaction.options.getUser('user');
    const name = normalizeName(interaction.options.getString('name') || '');
    const target = user
      ? guild.members.find(m => m.discordId === user.id)
      : findMember(guild, name);

    if (!target) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });
    return interaction.reply({ embeds: [buildMemberEmbed(guild, target, guild.config.timezone || DEFAULT_TZ)], ephemeral: true });
  }

  if (sub === 'list') {
    const rows = guild.members.slice().sort((a, b) => a.name.localeCompare(b.name, 'ar')).map(m => `• ${m.name} — ${m.role} ${m.discordId ? `(<@${m.discordId}>)` : ''}`);
    return interaction.reply({ content: rows.length ? rows.join('\n') : 'لا يوجد أعضاء مسجلون.', ephemeral: true });
  }

  if (sub === 'remove') {
    if (!isPrivileged(interaction.member, guild)) return interaction.reply({ content: 'ليس لديك صلاحية.', ephemeral: true });
    const name = normalizeName(interaction.options.getString('name', true));
    const before = guild.members.length;
    updateGuild(interaction.guild.id, g => {
      g.members = g.members.filter(m => normalizeName(m.name).toLowerCase() !== name.toLowerCase());
      return g;
    }, DEFAULT_PREFIX);
    const removed = before - getGuild(loadDb(), interaction.guild.id).members.length;
    return interaction.reply({ content: removed ? '✅ تم حذف العضو.' : 'العضو غير موجود.', ephemeral: true });
  }

  if (sub === 'stats') {
    const name = normalizeName(interaction.options.getString('name', true));
    const member = findMember(guild, name);
    if (!member) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });
    const stats = buildMemberStats(guild, member.name, guild.config.timezone || DEFAULT_TZ);
    const embed = buildMemberEmbed(guild, member, guild.config.timezone || DEFAULT_TZ)
      .setTitle(`📊 إحصائيات: ${member.name}`);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleChapter(interaction, guild) {
  const sub = interaction.options.getSubcommand();
  const tz = guild.config.timezone || DEFAULT_TZ;

  if (sub === 'add') {
    const work = normalizeName(interaction.options.getString('work', true));
    const chapterNumber = normalizeName(interaction.options.getString('chapter_number', true));
    const translator = normalizeName(interaction.options.getString('translator', true));
    const proofT = normalizeName(interaction.options.getString('translation_proofreader', true));
    const editor = normalizeName(interaction.options.getString('editor', true));
    const proofE = normalizeName(interaction.options.getString('edit_proofreader', true));

    [translator, proofT, editor, proofE].forEach(name => requireRegisteredMember(guild, name));

    const duplicate = guild.chapters.find(c => normalizeName(c.workName).toLowerCase() === work.toLowerCase() && String(c.chapterNumber) === String(chapterNumber));
    if (duplicate) return interaction.reply({ content: 'هذا الفصل موجود بالفعل.', ephemeral: true });

    const id = guild.chapters.length ? String(Math.max(...guild.chapters.map(c => Number(c.id) || 0)) + 1) : '1';
    const chapter = {
      id,
      workName: work,
      chapterNumber,
      translationStatus: STAGES.translation.pending,
      proofreadingTranslationStatus: '',
      editingStatus: '',
      proofreadingEditStatus: '',
      publishStatus: '',
      translator,
      translation_proofreader: proofT,
      editor,
      edit_proofreader: proofE,
      translationDoneAt: '',
      proofreadingTranslationDoneAt: '',
      editingDoneAt: '',
      proofreadingEditDoneAt: '',
      publishDoneAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addedBy: interaction.user.tag,
    };

    updateGuild(interaction.guild.id, g => { g.chapters.push(chapter); return g; }, DEFAULT_PREFIX);
    await recordAndMaybeLog(interaction.guild.id, interaction.guild, 'CHAPTER_ADD', interaction.user.tag, `${work} #${chapterNumber}`);
    await syncGuild(getGuild(loadDb(), interaction.guild.id)).catch(() => {});
    return interaction.reply({ embeds: [buildChapterEmbed(chapter)], ephemeral: false });
  }

  if (sub === 'stage') {
    const id = interaction.options.getString('id', true);
    const field = stageFieldFromText(interaction.options.getString('field', true));
    const status = normalizeName(interaction.options.getString('status', true));
    if (!field) return interaction.reply({ content: 'مرحلة غير صحيحة.', ephemeral: true });

    let updated = null;
    updateGuild(interaction.guild.id, g => {
      const ch = findChapter(g, id);
      if (!ch) return g;
      setChapterStage(ch, field, status);
      updated = ch;
      return g;
    }, DEFAULT_PREFIX);

    if (!updated) return interaction.reply({ content: 'الفصل غير موجود.', ephemeral: true });
    await recordAndMaybeLog(interaction.guild.id, interaction.guild, 'CHAPTER_STAGE', interaction.user.tag, `#${id} ${field} -> ${status}`);
    await syncGuild(getGuild(loadDb(), interaction.guild.id)).catch(() => {});
    return interaction.reply({ embeds: [buildChapterEmbed(updated)], ephemeral: false });
  }

  if (sub === 'assign') {
    const id = interaction.options.getString('id', true);
    const field = normalizeName(interaction.options.getString('field', true)).toLowerCase();
    const memberName = normalizeName(interaction.options.getString('member', true));
    const map = {
      translator: 'translator',
      translation_proofreader: 'translation_proofreader',
      editor: 'editor',
      edit_proofreader: 'edit_proofreader',
    };
    if (!map[field]) return interaction.reply({ content: 'field غير صحيح.', ephemeral: true });
    requireRegisteredMember(guild, memberName);

    let updated = null;
    updateGuild(interaction.guild.id, g => {
      const ch = findChapter(g, id);
      if (!ch) return g;
      ch[map[field]] = memberName;
      ch.updatedAt = new Date().toISOString();
      updated = ch;
      return g;
    }, DEFAULT_PREFIX);

    if (!updated) return interaction.reply({ content: 'الفصل غير موجود.', ephemeral: true });
    await recordAndMaybeLog(interaction.guild.id, interaction.guild, 'CHAPTER_ASSIGN', interaction.user.tag, `#${id} ${field} -> ${memberName}`);
    await syncGuild(getGuild(loadDb(), interaction.guild.id)).catch(() => {});
    return interaction.reply({ embeds: [buildChapterEmbed(updated)], ephemeral: false });
  }

  if (sub === 'list') {
    const limit = interaction.options.getInteger('limit') || 10;
    const list = [...guild.chapters].slice(-limit).reverse();
    return interaction.reply({ embeds: [buildChaptersListEmbed(list, `📚 آخر ${limit} فصول`)], ephemeral: true });
  }

  if (sub === 'search') {
    const query = normalizeName(interaction.options.getString('query', true));
    const list = guild.chapters.filter(ch => chapterMatches(ch, query)).slice(0, 15);
    return interaction.reply({ embeds: [buildChaptersListEmbed(list, `🔎 نتائج البحث: ${query}`)], ephemeral: true });
  }

  if (sub === 'today') {
    const list = guild.chapters.filter(ch => tzKey(new Date(ch.createdAt), tz) === tzKey(new Date(), tz));
    return interaction.reply({ embeds: [buildChaptersListEmbed(list, '🗓️ فصول اليوم')], ephemeral: true });
  }

  if (sub === 'remove') {
    if (!isPrivileged(interaction.member, guild)) return interaction.reply({ content: 'ليس لديك صلاحية.', ephemeral: true });
    const id = interaction.options.getString('id', true);
    let removed = null;
    updateGuild(interaction.guild.id, g => {
      const idx = g.chapters.findIndex(c => String(c.id) === String(id));
      if (idx >= 0) removed = g.chapters.splice(idx, 1)[0];
      return g;
    }, DEFAULT_PREFIX);
    await recordAndMaybeLog(interaction.guild.id, interaction.guild, 'CHAPTER_REMOVE', interaction.user.tag, `#${id}`);
    await syncGuild(getGuild(loadDb(), interaction.guild.id)).catch(() => {});
    return interaction.reply({ content: removed ? '✅ تم حذف الفصل.' : 'الفصل غير موجود.', ephemeral: true });
  }
}

async function handleSalary(interaction, guild) {
  const sub = interaction.options.getSubcommand();
  const tz = guild.config.timezone || DEFAULT_TZ;
  if (sub === 'member') {
    const name = normalizeName(interaction.options.getString('name', true));
    const member = findMember(guild, name);
    if (!member) return interaction.reply({ content: 'العضو غير موجود.', ephemeral: true });
    const stats = buildMemberStats(guild, member.name, tz);
    return interaction.reply({ embeds: [buildMemberEmbed(guild, member, tz)], ephemeral: true });
  }
  if (sub === 'month') {
    const month = interaction.options.getString('month') || tzKey(new Date(), tz);
    const rows = guild.payroll[month] || computePayrollForMonth(guild, month, tz);
    return interaction.reply({ embeds: [buildSalaryEmbed(month, rows)], ephemeral: true });
  }
  if (sub === 'report') {
    const month = tzKey(new Date(), tz);
    const rows = guild.payroll[month] || computePayrollForMonth(guild, month, tz);
    const channel = guild.config.reportChannelId ? interaction.guild.channels.cache.get(guild.config.reportChannelId) : null;
    const embed = buildSalaryEmbed(month, rows);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: '✅ تم إرسال تقرير الرواتب.', ephemeral: true });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleMonthly(interaction, guild) {
  const month = tzKey(new Date(), guild.config.timezone || DEFAULT_TZ);
  const embed = buildMonthlyEmbed(guild, month, guild.config.timezone || DEFAULT_TZ);
  const channel = guild.config.reportChannelId ? interaction.guild.channels.cache.get(guild.config.reportChannelId) : null;
  if (interaction.options.getSubcommand() === 'report') {
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: '✅ تم إرسال التقرير الشهري.', ephemeral: true });
    }
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function handleSheet(interaction, guild) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'init' || sub === 'sync') {
    await syncGuild(guild).catch(() => {});
    return interaction.reply({ content: '✅ تم مزامنة الشيت.', ephemeral: true });
  }
}

async function textRouter(message, guild) {
  const prefix = guild.config.prefix || DEFAULT_PREFIX;
  if (!message.content.startsWith(prefix) || message.author.bot) return false;

  const raw = message.content.slice(prefix.length).trim();
  const parts = raw.split(/\s+/);
  const cmd = (parts.shift() || '').toLowerCase();
  const sub = (parts.shift() || '').toLowerCase();
  const rest = parts.join(' ').trim();

  const reply = (content) => message.reply(content);

  if (cmd === 'ping') return reply(`🏓 Pong! ${message.client.ws.ping}ms`);
  if (cmd === 'help') return message.channel.send(helpText(prefix));
  if (cmd === 'panel') return message.channel.send({ embeds: [buildMainEmbed(guild)] });

  if (cmd === 'config') {
    if (sub === 'view') return message.channel.send({ embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('⚙️ الإعدادات').setDescription(`Prefix: ${guild.config.prefix}\nTimezone: ${guild.config.timezone}\nSheet: ${guild.config.sheetId || '—'}`)] });
    if (sub === 'setsheet') { updateGuild(message.guild.id, g => { g.config.sheetId = rest; return g; }, DEFAULT_PREFIX); await syncGuild(getGuild(loadDb(), message.guild.id)).catch(() => {}); return reply('✅ تم حفظ Spreadsheet ID.'); }
    if (sub === 'setlog') { const id = channelMentionToId(rest); updateGuild(message.guild.id, g => { g.config.logChannelId = id; return g; }, DEFAULT_PREFIX); return reply('✅ تم ضبط قناة اللوج.'); }
    if (sub === 'setreport') { const id = channelMentionToId(rest); updateGuild(message.guild.id, g => { g.config.reportChannelId = id; return g; }, DEFAULT_PREFIX); return reply('✅ تم ضبط قناة التقرير.'); }
    if (sub === 'settimezone') { updateGuild(message.guild.id, g => { g.config.timezone = rest || DEFAULT_TZ; return g; }, DEFAULT_PREFIX); return reply('✅ تم ضبط المنطقة الزمنية.'); }
    if (sub === 'setprefix') { updateGuild(message.guild.id, g => { g.config.prefix = rest || DEFAULT_PREFIX; return g; }, DEFAULT_PREFIX); return reply('✅ تم ضبط البادئة.'); }
    return reply('أمر config غير صحيح.');
  }

  if (cmd === 'member') {
    if (sub === 'register') {
      const arr = parsePipe(rest);
      const name = normalizeName(arr[0] || '');
      const role = normalizeName(arr[1] || '');
      const notes = normalizeName(arr[2] || '');
      if (!name || !role) return reply(`الصيغة: ${prefix}member register الاسم | الدور | ملاحظة`);
      updateGuild(message.guild.id, g => {
        const found = g.members.find(m => normalizeName(m.name).toLowerCase() === name.toLowerCase());
        if (found) { found.role = role; found.notes = notes; found.updatedAt = new Date().toISOString(); }
        else g.members.push({ name, role, notes, discordId: message.author.id, status: 'active', joinedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return g;
      }, DEFAULT_PREFIX);
      await syncGuild(getGuild(loadDb(), message.guild.id)).catch(() => {});
      return reply('✅ تم تسجيل العضو.');
    }
    if (sub === 'profile') {
      const member = findMember(guild, rest);
      if (!member) return reply('العضو غير موجود.');
      return message.channel.send({ embeds: [buildMemberEmbed(guild, member, guild.config.timezone || DEFAULT_TZ)] });
    }
    if (sub === 'list') return reply(guild.members.length ? guild.members.map(m => `• ${m.name} — ${m.role}`).join('\n') : 'لا يوجد أعضاء.');
    if (sub === 'remove') {
      if (!isPrivileged(message.member, guild)) return reply('ليس لديك صلاحية.');
      const name = normalizeName(rest);
      updateGuild(message.guild.id, g => { g.members = g.members.filter(m => normalizeName(m.name).toLowerCase() !== name.toLowerCase()); return g; }, DEFAULT_PREFIX);
      await syncGuild(getGuild(loadDb(), message.guild.id)).catch(() => {});
      return reply('✅ تم حذف العضو.');
    }
    if (sub === 'stats') {
      const member = findMember(guild, rest);
      if (!member) return reply('العضو غير موجود.');
      return message.channel.send({ embeds: [buildMemberEmbed(guild, member, guild.config.timezone || DEFAULT_TZ)] });
    }
  }

  if (cmd === 'chapter') {
    if (sub === 'add') {
      const arr = parsePipe(rest);
      if (arr.length < 6) return reply(`الصيغة: ${prefix}chapter add اسم العمل | رقم الفصل | الترجمة | تدقيق الترجمة | التحرير | تدقيق التحرير`);
      const fakeInteraction = {
        options: { getString: (n) => {
          const map = { work: arr[0], chapter_number: arr[1], translator: arr[2], translation_proofreader: arr[3], editor: arr[4], edit_proofreader: arr[5] };
          return map[n];
        }},
        guild: message.guild,
        user: message.author,
        reply: async (x) => message.channel.send(payloadToText(x) || '✅ تم التنفيذ'),
      };
      try { await handleChapter(fakeInteraction, guild); } catch (e) { return reply(String(e.message || e)); }
      return true;
    }
    if (sub === 'stage') {
      const arr = parsePipe(rest);
      const fake = {
        options: { getString: (n) => ({ id: arr[0], field: arr[1], status: arr[2] }[n]) },
        guild: message.guild,
        user: message.author,
        reply: async (x) => message.channel.send(payloadToText(x) || '✅ تم التنفيذ'),
      };
      try { await handleChapter(fake, guild); } catch (e) { return reply(String(e.message || e)); }
      return true;
    }
    if (sub === 'assign') {
      const arr = parsePipe(rest);
      const fake = {
        options: { getString: (n) => ({ id: arr[0], field: arr[1], member: arr[2] }[n]) },
        guild: message.guild,
        user: message.author,
        reply: async (x) => message.channel.send(payloadToText(x) || '✅ تم التنفيذ'),
      };
      try { await handleChapter(fake, guild); } catch (e) { return reply(String(e.message || e)); }
      return true;
    }
    if (sub === 'list') { const list = [...guild.chapters].slice(-10).reverse(); return message.channel.send({ embeds: [buildChaptersListEmbed(list, '📚 آخر الفصول')] }); }
    if (sub === 'search') { const list = guild.chapters.filter(ch => chapterMatches(ch, rest)).slice(0, 15); return message.channel.send({ embeds: [buildChaptersListEmbed(list, `🔎 ${rest}`)] }); }
    if (sub === 'today') { const list = guild.chapters.filter(ch => tzKey(new Date(ch.createdAt), guild.config.timezone || DEFAULT_TZ) === tzKey(new Date(), guild.config.timezone || DEFAULT_TZ)); return message.channel.send({ embeds: [buildChaptersListEmbed(list, '🗓️ فصول اليوم')] }); }
  }

  if (cmd === 'salary') {
    if (sub === 'member') {
      const member = findMember(guild, rest);
      if (!member) return reply('العضو غير موجود.');
      return message.channel.send({ embeds: [buildMemberEmbed(guild, member, guild.config.timezone || DEFAULT_TZ)] });
    }
    if (sub === 'month') {
      const month = rest || tzKey(new Date(), guild.config.timezone || DEFAULT_TZ);
      const rows = guild.payroll[month] || computePayrollForMonth(guild, month, guild.config.timezone || DEFAULT_TZ);
      return message.channel.send({ embeds: [buildSalaryEmbed(month, rows)] });
    }
  }

  if (cmd === 'monthly' && sub === 'report') {
    const month = tzKey(new Date(), guild.config.timezone || DEFAULT_TZ);
    return message.channel.send({ embeds: [buildMonthlyEmbed(guild, month, guild.config.timezone || DEFAULT_TZ)] });
  }

  if (cmd === 'sheet' && (sub === 'init' || sub === 'sync')) {
    await syncGuild(guild).catch(() => {});
    return reply('✅ تم مزامنة الشيت.');
  }

  return false;
}

async function sendLogToChannel(discordGuild, text) {
  if (!discordGuild) return;
  const data = getGuild(loadDb(), discordGuild.id);
  const channelId = data.config.logChannelId;
  if (!channelId) return;
  const channel = discordGuild.channels.cache.get(channelId);
  if (channel && channel.isTextBased()) {
    await channel.send(`🪵 ${text}`).catch(() => {});
  }
}

async function autoMonthlyReports(client) {
  for (const [guildId, discordGuild] of client.guilds.cache) {
    const guild = getGuild(loadDb(), guildId);
    const tz = guild.config.timezone || DEFAULT_TZ;
    const month = tzKey(new Date(), tz);
    const day = new Date().toLocaleString('en-US', { timeZone: tz });
    const marker = `monthly_sent_${month}`;
    if (guild[marker]) continue;
    const reportChannelId = guild.config.reportChannelId;
    if (!reportChannelId) continue;
    const channel = discordGuild.channels.cache.get(reportChannelId);
    if (!channel || !channel.isTextBased()) continue;
    const embed = buildMonthlyEmbed(guild, month, tz);
    await channel.send({ embeds: [embed] }).catch(() => {});
    updateGuild(guildId, g => { g[marker] = true; return g; }, DEFAULT_PREFIX);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  for (const guild of client.guilds.cache.values()) ensureGuild(guild.id, DEFAULT_PREFIX);
  setInterval(() => autoMonthlyReports(client).catch(() => {}), 60 * 1000);
});

client.on('guildCreate', async guild => {
  ensureGuild(guild.id, DEFAULT_PREFIX);
});

client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  const guild = ensureGuild(message.guild.id, DEFAULT_PREFIX);
  await textRouter(message, guild).catch(async err => {
    try { await message.reply(err.message || 'حدث خطأ غير متوقع.'); } catch {}
  });
});

client.on('interactionCreate', async interaction => {
  try {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;
    ensureGuild(interaction.guild.id, DEFAULT_PREFIX);
    const guild = getGuild(loadDb(), interaction.guild.id);

    if (interaction.commandName === 'ping') {
      return interaction.reply({ content: `🏓 Pong! ${client.ws.ping}ms`, ephemeral: true });
    }
    if (interaction.commandName === 'help') {
      return interaction.reply({ content: helpText(guild.config.prefix || DEFAULT_PREFIX), ephemeral: true });
    }
    if (interaction.commandName === 'panel') {
      return interaction.reply({ embeds: [buildMainEmbed(guild)], ephemeral: true });
    }
    if (interaction.commandName === 'config') return handleConfig(interaction, guild);
    if (interaction.commandName === 'member') return handleMember(interaction, guild);
    if (interaction.commandName === 'chapter') return handleChapter(interaction, guild);
    if (interaction.commandName === 'salary') return handleSalary(interaction, guild);
    if (interaction.commandName === 'monthly') return handleMonthly(interaction, guild);
    if (interaction.commandName === 'sheet') return handleSheet(interaction, guild);
  } catch (err) {
    console.error(err);
    try {
      const msg = err && err.message ? err.message : 'حدث خطأ غير متوقع.';
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    } catch {}
  }
});

async function registerCommands() {
  const commands = buildCommands().map(c => c.toJSON());
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  } else {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  }
}

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running");
});
