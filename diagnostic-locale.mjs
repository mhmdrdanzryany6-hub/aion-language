const guidance = {
  E_TYPE: 'نوع مقدار با نوع مورد انتظار سازگار نیست؛ مقدار و تعریف متغیر یا تابع را بررسی کن.',
  E_FILE: 'فایل پیدا نشد یا قابل خواندن نیست؛ مسیر فایل را بررسی کن.',
  E_NAME: 'نام تعریف نشده یا تکراری است؛ ترتیب تعریف و املای نام را بررسی کن.',
  E_PARSE: 'ساختار کد درست نیست؛ پرانتزها، آکولادها و دستور مشخص‌شده را بررسی کن.',
  E_LEX: 'نویسه یا رشته معتبر نیست؛ علامت نقل قول و نویسه‌های ویژه را بررسی کن.',
  E_IMMUTABLE: 'برای تغییر مقدار یک متغیر، آن را با var تعریف کن.',
  E_BOUNDS: 'شمارهٔ خانه بیرون از محدودهٔ آرایه یا رشته است.',
  E_FUEL: 'بودجهٔ اجرای برنامه تمام شد؛ حلقه‌ها را بررسی کن.',
  E_DEPTH: 'عمق توابع یا ساختار داده بیش از حد مجاز است.',
  E_BYTECODE: 'فایل بایت‌کد معتبر نیست؛ آن را از سورس دوباره بساز.',
  E_CAPABILITY: 'دسترسی به فایل مجاز نیست؛ پوشهٔ لازم را صریحاً مجاز کن.',
  E_ARGS: 'گزینهٔ خط فرمان درست نیست؛ فرمان help را ببین.',
  E_PROJECT: 'تنظیمات پروژه یا مسیر آن معتبر نیست؛ aion.json را بررسی کن.',
  E_ASSERT: 'بررسی assert شکست خورد؛ نتیجهٔ واقعی با انتظار تست سازگار نیست.',
  E_ZERO: 'تقسیم بر صفر مجاز نیست.'
};
export function diagnosticData(error, lang = 'en') {
  return { code: error.code ?? 'E_CLI', message: error.message, filename: error.filename ?? null, line: error.line ?? null, column: error.column ?? null, ...(lang === 'fa' ? { guidance: guidance[error.code] ?? 'کد و پیام خطا را بررسی کن.' } : {}), notes: error.notes ?? [], frames: error.frames ?? [] };
}
export function renderDiagnostic(error, source = '', lang = 'en') {
  const base = error.render ? error.render(source) : `${error.code ?? 'E_CLI'}: ${error.message}`;
  return base + (lang === 'fa' ? `\nراهنما: ${diagnosticData(error, lang).guidance}` : '');
}
