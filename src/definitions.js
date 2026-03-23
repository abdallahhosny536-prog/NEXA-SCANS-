const { SlashCommandBuilder, ChannelType } = require('discord.js');

function buildCommands() {
  return [
    new SlashCommandBuilder().setName('ping').setDescription('Show bot latency'),
    new SlashCommandBuilder().setName('help').setDescription('Show commands'),
    new SlashCommandBuilder().setName('panel').setDescription('Show the control panel'),

    new SlashCommandBuilder()
      .setName('config')
      .setDescription('Server configuration')
      .addSubcommand(s => s.setName('view').setDescription('Show current settings'))
      .addSubcommand(s => s.setName('setsheet').setDescription('Set Google Sheet ID').addStringOption(o => o.setName('sheet_id').setDescription('Spreadsheet ID').setRequired(true)))
      .addSubcommand(s => s.setName('setlog').setDescription('Set log channel').addChannelOption(o => o.setName('channel').setDescription('Log channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s.setName('setreport').setDescription('Set monthly report channel').addChannelOption(o => o.setName('channel').setDescription('Report channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
      .addSubcommand(s => s.setName('settimezone').setDescription('Set timezone').addStringOption(o => o.setName('timezone').setDescription('Example: Africa/Cairo').setRequired(true)))
      .addSubcommand(s => s.setName('setprefix').setDescription('Set text command prefix').addStringOption(o => o.setName('prefix').setDescription('Example: !').setRequired(true)))
      .addSubcommand(s => s.setName('setrate').setDescription('Set salary rate for a stage')
        .addStringOption(o => o.setName('stage').setDescription('translation / proofreading_translation / editing / proofreading_edit').setRequired(true))
        .addNumberOption(o => o.setName('value').setDescription('Rate value').setRequired(true)))
      .addSubcommand(s => s.setName('setrole').setDescription('Set a permission role')
        .addStringOption(o => o.setName('type').setDescription('owner / admin / supervisor').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Discord role').setRequired(true))),

    new SlashCommandBuilder()
      .setName('member')
      .setDescription('Member management')
      .addSubcommand(s => s.setName('register').setDescription('Register a member')
        .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(false))
        .addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true))
        .addStringOption(o => o.setName('role').setDescription('Role inside the team').setRequired(true))
        .addStringOption(o => o.setName('notes').setDescription('Notes').setRequired(false)))
      .addSubcommand(s => s.setName('profile').setDescription('Show member profile')
        .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(false))
        .addStringOption(o => o.setName('name').setDescription('Team name').setRequired(false)))
      .addSubcommand(s => s.setName('list').setDescription('Show registered members'))
      .addSubcommand(s => s.setName('remove').setDescription('Remove a member').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true)))
      .addSubcommand(s => s.setName('stats').setDescription('Show member stats').addStringOption(o => o.setName('name').setDescription('Team name').setRequired(true))),

    new SlashCommandBuilder()
      .setName('chapter')
      .setDescription('Chapter management')
      .addSubcommand(s => s.setName('add').setDescription('Add a chapter')
        .addStringOption(o => o.setName('work').setDescription('Work name').setRequired(true))
        .addStringOption(o => o.setName('chapter_number').setDescription('Chapter number').setRequired(true))
        .addStringOption(o => o.setName('translator').setDescription('Translator name').setRequired(true))
        .addStringOption(o => o.setName('translation_proofreader').setDescription('Translation proofreader name').setRequired(true))
        .addStringOption(o => o.setName('editor').setDescription('Editor name').setRequired(true))
        .addStringOption(o => o.setName('edit_proofreader').setDescription('Edit proofreader name').setRequired(true)))
      .addSubcommand(s => s.setName('stage').setDescription('Update one stage status')
        .addStringOption(o => o.setName('id').setDescription('Chapter ID').setRequired(true))
        .addStringOption(o => o.setName('field').setDescription('translation / proofreading_translation / editing / proofreading_edit / publish').setRequired(true))
        .addStringOption(o => o.setName('status').setDescription('New status').setRequired(true)))
      .addSubcommand(s => s.setName('assign').setDescription('Assign a chapter member')
        .addStringOption(o => o.setName('id').setDescription('Chapter ID').setRequired(true))
        .addStringOption(o => o.setName('field').setDescription('translator / translation_proofreader / editor / edit_proofreader').setRequired(true))
        .addStringOption(o => o.setName('member').setDescription('Member name').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('List chapters').addIntegerOption(o => o.setName('limit').setDescription('Limit').setMinValue(1).setMaxValue(25)))
      .addSubcommand(s => s.setName('search').setDescription('Search chapters').addStringOption(o => o.setName('query').setDescription('Search query').setRequired(true)))
      .addSubcommand(s => s.setName('today').setDescription('Show today chapters'))
      .addSubcommand(s => s.setName('remove').setDescription('Remove a chapter').addStringOption(o => o.setName('id').setDescription('Chapter ID').setRequired(true))),

    new SlashCommandBuilder()
      .setName('salary')
      .setDescription('Salary and payroll')
      .addSubcommand(s => s.setName('member').setDescription('Show salary for a member').addStringOption(o => o.setName('name').setDescription('Member name').setRequired(true)))
      .addSubcommand(s => s.setName('month').setDescription('Show payroll for a month').addStringOption(o => o.setName('month').setDescription('YYYY-MM').setRequired(false)))
      .addSubcommand(s => s.setName('report').setDescription('Send payroll report now')),

    new SlashCommandBuilder()
      .setName('monthly')
      .setDescription('Monthly work report')
      .addSubcommand(s => s.setName('report').setDescription('Generate monthly report now')),

    new SlashCommandBuilder()
      .setName('sheet')
      .setDescription('Sheet tools')
      .addSubcommand(s => s.setName('init').setDescription('Initialize/update sheets structure'))
      .addSubcommand(s => s.setName('sync').setDescription('Force sync current cache to sheet')),
  ];
}

function helpText(prefix = '!') {
  return [
    'الأوامر:',
    '/ping /help /panel',
    '/config view /config setsheet /config setlog /config setreport /config settimezone /config setprefix /config setrate /config setrole',
    '/member register /member profile /member list /member remove /member stats',
    '/chapter add /chapter stage /chapter assign /chapter list /chapter search /chapter today /chapter remove',
    '/salary member /salary month /salary report',
    '/monthly report',
    '/sheet init /sheet sync',
    '',
    'أوامر نصية:',
    `${prefix}ping`,
    `${prefix}help`,
    `${prefix}panel`,
    `${prefix}config view`,
    `${prefix}member register الاسم | الدور | ملاحظة اختياري`,
    `${prefix}chapter add اسم العمل | رقم الفصل | الترجمة | تدقيق الترجمة | التحرير | تدقيق التحرير`,
    `${prefix}chapter stage ID | field | status`,
    `${prefix}chapter assign ID | field | member`,
    `${prefix}salary member الاسم`,
    `${prefix}salary month YYYY-MM`,
  ].join('\n');
}

module.exports = { buildCommands, helpText };
