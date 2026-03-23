const {
  SlashCommandBuilder,
} = require('discord.js');

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('قياس سرعة استجابة البوت'),

    new SlashCommandBuilder()
      .setName('help')
      .setDescription('عرض المساعدة'),

    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('عرض لوحة البوت'),

    new SlashCommandBuilder()
      .setName('config')
      .setDescription('إدارة إعدادات البوت')
      .addSubcommand(sub =>
        sub
          .setName('view')
          .setDescription('عرض الإعدادات الحالية')
      )
      .addSubcommand(sub =>
        sub
          .setName('setsheet')
          .setDescription('تحديد Spreadsheet ID')
          .addStringOption(opt =>
            opt
              .setName('sheet_id')
              .setDescription('معرف Google Sheet')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('setlog')
          .setDescription('تحديد قناة اللوج')
          .addChannelOption(opt =>
            opt
              .setName('channel')
              .setDescription('القناة المطلوبة')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('setreport')
          .setDescription('تحديد قناة التقرير')
          .addChannelOption(opt =>
            opt
              .setName('channel')
              .setDescription('القناة المطلوبة')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('settimezone')
          .setDescription('تحديد المنطقة الزمنية')
          .addStringOption(opt =>
            opt
              .setName('timezone')
              .setDescription('مثال: Africa/Cairo')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('setprefix')
          .setDescription('تحديد بادئة الأوامر النصية')
          .addStringOption(opt =>
            opt
              .setName('prefix')
              .setDescription('مثال: !')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('setrate')
          .setDescription('تحديد سعر مرحلة معينة')
          .addStringOption(opt =>
            opt
              .setName('stage')
              .setDescription('المرحلة المطلوب تعديلها')
              .setRequired(true)
              .addChoices(
                { name: 'الترجمة', value: 'translation' },
                { name: 'تدقيق الترجمة', value: 'proofreading_translation' },
                { name: 'التحرير', value: 'editing' },
                { name: 'تدقيق التحرير', value: 'proofreading_edit' },
              )
          )
          .addNumberOption(opt =>
            opt
              .setName('value')
              .setDescription('قيمة السعر')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('setrole')
          .setDescription('تعيين رتبة إدارية')
          .addStringOption(opt =>
            opt
              .setName('type')
              .setDescription('نوع الرتبة')
              .setRequired(true)
              .addChoices(
                { name: 'owner', value: 'owner' },
                { name: 'admin', value: 'admin' },
                { name: 'supervisor', value: 'supervisor' },
              )
          )
          .addRoleOption(opt =>
            opt
              .setName('role')
              .setDescription('الرتبة')
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName('member')
      .setDescription('إدارة الأعضاء')
      .addSubcommand(sub =>
        sub
          .setName('register')
          .setDescription('تسجيل عضو')
          .addStringOption(opt =>
            opt
              .setName('name')
              .setDescription('اسم العضو')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('role')
              .setDescription('دور العضو')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('notes')
              .setDescription('ملاحظات')
              .setRequired(false)
          )
          .addUserOption(opt =>
            opt
              .setName('user')
              .setDescription('ربط العضو بحساب ديسكورد')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('profile')
          .setDescription('عرض ملف عضو')
          .addUserOption(opt =>
            opt
              .setName('user')
              .setDescription('اختيار العضو من ديسكورد')
              .setRequired(false)
          )
          .addStringOption(opt =>
            opt
              .setName('name')
              .setDescription('اسم العضو المسجل')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('list')
          .setDescription('عرض قائمة الأعضاء')
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('حذف عضو')
          .addStringOption(opt =>
            opt
              .setName('name')
              .setDescription('اسم العضو')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('stats')
          .setDescription('عرض إحصائيات عضو')
          .addStringOption(opt =>
            opt
              .setName('name')
              .setDescription('اسم العضو')
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName('chapter')
      .setDescription('إدارة الفصول')
      .addSubcommand(sub =>
        sub
          .setName('add')
          .setDescription('إضافة فصل جديد')
          .addStringOption(opt =>
            opt
              .setName('work')
              .setDescription('اسم العمل')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('chapter_number')
              .setDescription('رقم الفصل')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('translator')
              .setDescription('اسم المترجم')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('translation_proofreader')
              .setDescription('اسم مدقق الترجمة')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('editor')
              .setDescription('اسم المحرر')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('edit_proofreader')
              .setDescription('اسم مدقق التحرير')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('stage')
          .setDescription('تحديث حالة مرحلة')
          .addStringOption(opt =>
            opt
              .setName('id')
              .setDescription('معرف الفصل')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('field')
              .setDescription('اسم المرحلة')
              .setRequired(true)
              .addChoices(
                { name: 'translation', value: 'translation' },
                { name: 'proofreading_translation', value: 'proofreading_translation' },
                { name: 'editing', value: 'editing' },
                { name: 'proofreading_edit', value: 'proofreading_edit' },
                { name: 'publish', value: 'publish' },
              )
          )
          .addStringOption(opt =>
            opt
              .setName('status')
              .setDescription('الحالة الجديدة')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('assign')
          .setDescription('تعيين عضو لمرحلة في فصل')
          .addStringOption(opt =>
            opt
              .setName('id')
              .setDescription('معرف الفصل')
              .setRequired(true)
          )
          .addStringOption(opt =>
            opt
              .setName('field')
              .setDescription('اسم الحقل')
              .setRequired(true)
              .addChoices(
                { name: 'translator', value: 'translator' },
                { name: 'translation_proofreader', value: 'translation_proofreader' },
                { name: 'editor', value: 'editor' },
                { name: 'edit_proofreader', value: 'edit_proofreader' },
              )
          )
          .addStringOption(opt =>
            opt
              .setName('member')
              .setDescription('اسم العضو')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('list')
          .setDescription('عرض آخر الفصول')
          .addIntegerOption(opt =>
            opt
              .setName('limit')
              .setDescription('عدد النتائج')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('search')
          .setDescription('البحث في الفصول')
          .addStringOption(opt =>
            opt
              .setName('query')
              .setDescription('كلمة البحث')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('today')
          .setDescription('عرض فصول اليوم')
      )
      .addSubcommand(sub =>
        sub
          .setName('remove')
          .setDescription('حذف فصل')
          .addStringOption(opt =>
            opt
              .setName('id')
              .setDescription('معرف الفصل')
              .setRequired(true)
          )
      ),

    new SlashCommandBuilder()
      .setName('salary')
      .setDescription('إدارة الرواتب')
      .addSubcommand(sub =>
        sub
          .setName('member')
          .setDescription('عرض راتب عضو')
          .addStringOption(opt =>
            opt
              .setName('name')
              .setDescription('اسم العضو')
              .setRequired(true)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('month')
          .setDescription('عرض رواتب شهر')
          .addStringOption(opt =>
            opt
              .setName('month')
              .setDescription('صيغة الشهر: YYYY-MM')
              .setRequired(false)
          )
      )
      .addSubcommand(sub =>
        sub
          .setName('report')
          .setDescription('إرسال تقرير الرواتب')
      ),

    new SlashCommandBuilder()
      .setName('monthly')
      .setDescription('التقرير الشهري')
      .addSubcommand(sub =>
        sub
          .setName('report')
          .setDescription('إرسال التقرير الشهري')
      ),

    new SlashCommandBuilder()
      .setName('sheet')
      .setDescription('مزامنة الشيت')
      .addSubcommand(sub =>
        sub
          .setName('init')
          .setDescription('تهيئة الشيت')
      )
      .addSubcommand(sub =>
        sub
          .setName('sync')
          .setDescription('مزامنة فورية')
      ),
  ];
}

function helpText(prefix = '!') {
  return [
    `**أوامر البوت**`,
    ``,
    `**أوامر نصية**`,
    `${prefix}ping`,
    `${prefix}help`,
    `${prefix}panel`,
    `${prefix}config view`,
    `${prefix}config setsheet <sheet_id>`,
    `${prefix}config setlog <#channel>`,
    `${prefix}config setreport <#channel>`,
    `${prefix}config settimezone <timezone>`,
    `${prefix}config setprefix <prefix>`,
    `${prefix}member register الاسم | الدور | ملاحظة`,
    `${prefix}member profile الاسم`,
    `${prefix}member list`,
    `${prefix}member remove الاسم`,
    `${prefix}member stats الاسم`,
    `${prefix}chapter add اسم العمل | رقم الفصل | الترجمة | تدقيق الترجمة | التحرير | تدقيق التحرير`,
    `${prefix}chapter stage id | field | status`,
    `${prefix}chapter assign id | field | member`,
    `${prefix}chapter list`,
    `${prefix}chapter search كلمة`,
    `${prefix}chapter today`,
    `${prefix}chapter remove id`,
    `${prefix}salary member الاسم`,
    `${prefix}salary month YYYY-MM`,
    `${prefix}monthly report`,
    `${prefix}sheet sync`,
  ].join('\n');
}

module.exports = { buildCommands, helpText };
