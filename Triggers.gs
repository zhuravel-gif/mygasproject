/**
 * Устанавливает ежедневный триггер импорта MXL на 04:00 по timezone скрипта.
 * Перед созданием удаляет существующие дубликаты для того же обработчика.
 */
function setupDailyMxlImportTrigger() {
  const handlerFunction = 'runDailyMxlImportJob';

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handlerFunction)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(handlerFunction)
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();

  appendImportLog_('success', 'Триггер ежедневного импорта установлен (04:00 по timezone скрипта).');
}

/**
 * Обертка для запуска ежедневного импорта по триггеру.
 */
function runDailyMxlImportJob() {
  try {
    if (typeof importInfoFromMxl !== 'function') {
      throw new Error('Функция importInfoFromMxl не найдена в проекте.');
    }

    importInfoFromMxl();
    appendImportLog_('success', 'Ежедневный импорт MXL выполнен успешно.');
  } catch (error) {
    appendImportLog_('error', 'Ошибка ежедневного импорта MXL.', error);
    throw error;
  }
}

/**
 * Добавляет запись в лист logs.
 */
function appendImportLog_(status, message, error) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'logs';
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['timestamp', 'status', 'message', 'details']);
  }

  const details = error ? String(error && error.stack ? error.stack : error) : '';
  sheet.appendRow([new Date(), status, message, details]);
}
