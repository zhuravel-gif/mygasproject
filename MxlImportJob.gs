/**
 * Точка входа для ежедневного импорта MXL (триггер/ручной запуск).
 */
function runDailyMxlImportJob() {
  try {
    const importedRows = executeMxlImport_();
    appendImportLog_('SUCCESS', 'Импорт выполнен успешно.', {
      rows: importedRows,
      details: ''
    });
    return importedRows;
  } catch (error) {
    appendImportLog_('ERROR', 'Ошибка импорта MXL.', {
      rows: 0,
      details: error && error.stack ? error.stack : String(error)
    });
    throw error;
  }
}

/**
 * Внутренний исполнитель импорта.
 *
 * Если в проекте уже есть функция импорта, используем её без изменения API.
 */
function executeMxlImport_() {
  if (typeof importMxlData === 'function') {
    const result = importMxlData();
    return Number(result) || 0;
  }

  throw new Error('Функция importMxlData() не найдена. Подключите существующий модуль импорта MXL.');
}
