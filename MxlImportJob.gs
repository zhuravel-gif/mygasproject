/**
 * Точка входа для ежедневного импорта XLSX (триггер/ручной запуск).
 */
function runDailyXlsxImportJob() {
  try {
    const result = import1CFromXlsx();
    appendImportLog_('SUCCESS', 'Импорт XLSX выполнен успешно.', {
      rows: result.rowsImported,
      details: `Файл: ${result.fileName} (${result.fileId})`
    });
    return result.rowsImported;
  } catch (error) {
    appendImportLog_('ERROR', 'Ошибка импорта XLSX.', {
      rows: 0,
      details: error && error.stack ? error.stack : String(error)
    });
    throw error;
  }
}
