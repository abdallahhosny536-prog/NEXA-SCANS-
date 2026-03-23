# NEXA SCANS Discord Bot

بوت ديسكورد كامل لإدارة:
- الأعضاء
- الفصول
- الرواتب
- اللوجز
- التقرير الشهري
- مزامنة الشيتات

## التشغيل السريع
```bash
npm install
npm run deploy
npm start
```

## متغيرات البيئة
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID` اختياري أثناء الاختبار
- `PREFIX`
- `DEFAULT_TIMEZONE`

### Google Sheets
للاستخدام الاحترافي مع الشيت:
- استخدم `GOOGLE_SERVICE_ACCOUNT_JSON`
أو
- `GOOGLE_CLIENT_EMAIL` و `GOOGLE_PRIVATE_KEY`

ثم ضع `sheet_id` داخل أمر:
- `/config setsheet`

## على Render
1. ارفع المشروع إلى GitHub.
2. أنشئ Render Web Service.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. أضف متغيرات البيئة.
6. لو تستخدم Google Sheets، شارك الشيت مع service account email كـ Editor.

## ملفات إضافية
- `templates/NEXA_SCANS_cleaned.xlsx`: نسخة نظيفة من الشيت الأصلي بعد مسح الأسماء
- `templates/NEXA_Scans_GoogleSheets_Template.xlsx`: قالب شيت جاهز بالأوراق الأساسية

## أهم الأوامر
### الأعضاء
- `/member register`
- `/member profile`
- `/member list`
- `/member remove`
- `/member stats`

### الفصول
- `/chapter add`
- `/chapter stage`
- `/chapter assign`
- `/chapter list`
- `/chapter search`
- `/chapter today`
- `/chapter remove`

### الرواتب
- `/salary member`
- `/salary month`
- `/salary report`

### الإعدادات
- `/config view`
- `/config setsheet`
- `/config setlog`
- `/config setreport`
- `/config settimezone`
- `/config setprefix`
- `/config setrate`
- `/config setrole`

### إضافي
- `/monthly report`
- `/sheet init`
- `/sheet sync`

## ملاحظات مهمة
- البوت يدعم أوامر نصية أيضًا بنفس المنطق.
- الشيت يتم تحديثه كمزامنة من بيانات البوت.
- الرواتب محسوبة وفق الأسعار التي طلبتها:
  - الترجمة: 0.3
  - التحرير: 0.5
  - تدقيق الترجمة: 0.1
  - تدقيق التحرير: 0.1
