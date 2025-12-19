// backend/services/importStudents.js — БЕЗЖАЛОСТНЫЙ ИМПОРТЕР (НИКТО НЕ УЙДЁТ ОБИЖЕННЫМ)
const exceljs = require('exceljs');

/**
 * САМАЯ ЖЁСТКАЯ ОЧИСТКА НАЗВАНИЯ ГРУППЫ В МИРЕ
 */
const normalizeGroupName = (name) => {
  if (!name) return '';
  return name
    .toString()
    .toLowerCase()
    .replace(/[ё]/g, 'е')                    // ё → е
    .replace(/[ы]/g, 'и')                    // ы → и (иногда путают)
    .replace(/[^a-zа-яё0-9\s\-]/g, '')       // убираем ВСЁ кроме букв, цифр, пробелов, дефисов
    .replace(/\s+/g, '')                     // убираем ВСЕ пробелы
    .replace(/[-–—]/g, '-')                  // любые тире → обычный дефис
    .trim();
};

const importStudentsFromBuffer = async (buffer, prisma) => {
  try {
    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('Лист не найден');

    const errors = [];
    const added = [];
    const skipped = [];
    const notFoundGroups = new Set();

    // КЭШ ГРУПП — С ЖЁСТКОЙ НОРМАЛИЗАЦИЕЙ
    const groups = await prisma.group.findMany({ select: { id: true, name: true } });
    const groupMap = new Map();
    groups.forEach(g => {
      const key = normalizeGroupName(g.name);
      groupMap.set(key, g.id);
      // Добавляем варианты с пробелами и без
      groupMap.set(key.replace(/-/g, ''), g.id);
      groupMap.set(g.name.toLowerCase().trim(), g.id);
    });

    // Существующие студенты
    const existing = await prisma.student.findMany({
      select: { fullName: true, groupId: true }
    });
    const existingSet = new Set(
      existing.map(s => `${s.fullName.toLowerCase().trim()}::${s.groupId}`)
    );

    let totalProcessed = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      totalProcessed++;

      const values = row.values;
      if (!values || values.length < 4) {
        errors.push(`Строка ${rowNumber}: мало колонок`);
        return;
      }

      const lastName = (values[1] || '').toString().trim();
      const firstName = (values[2] || '').toString().trim();
      const middleName = (values[3] || '').toString().trim();
      let groupRaw = (values[4] || '').toString().trim();

      if (!lastName || !firstName || !groupRaw) {
        errors.push(`Строка ${rowNumber}: нет ФИО или группы`);
        return;
      }

      const fullName = `${lastName} ${firstName} ${middleName}`.trim().replace(/\s+/g, ' ');
      const normalized = normalizeGroupName(groupRaw);

      let groupId = groupMap.get(normalized) ||
                   groupMap.get(normalized.replace(/-/g, '')) ||
                   groupMap.get(groupRaw.toLowerCase().trim());

      if (!groupId) {
        notFoundGroups.add(groupRaw);
        errors.push(`Строка ${rowNumber} (${fullName}): ГРУППА НЕ НАЙДЕНА → "${groupRaw}"`);
        return;
      }

      const key = `${fullName.toLowerCase()}::${groupId}`;
      if (existingSet.has(key)) {
        skipped.push({ fullName, group: groupRaw, reason: 'уже есть в базе' });
        return;
      }

      added.push({ fullName, groupId });
      existingSet.add(key);
    });

    // Добавляем
    let importedCount = 0;
    if (added.length > 0) {
      const result = await prisma.student.createMany({
        data: added,
        skipDuplicates: true
      });
      importedCount = result.count;
    }

    return {
      totalInFile: totalProcessed,
      importedCount,
      skippedCount: skipped.length,
      errorsCount: errors.length,
      notFoundGroups: Array.from(notFoundGroups),
      message: `Добавлено: ${importedCount} | Пропущено: ${skipped.length} | Ошибок: ${errors.length}`,
      errors: errors.length > 0 ? errors.slice(0, 50) : undefined // первые 50 ошибок
    };

  } catch (err) {
    console.error('Критическая ошибка импорта:', err);
    throw new Error(`Файл не обработан: ${err.message}`);
  }
};

module.exports = { importStudentsFromBuffer };