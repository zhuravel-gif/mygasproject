/**
 * Устанавливает ежедневный триггер импорта XLSX на 04:00 по timezone скрипта.
 * Перед созданием удаляет существующие дубликаты для того же обработчика.
 */
function setupDailyXlsxImportTrigger() {
  const handlerFunction = 'runDailyXlsxImportJob';

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handlerFunction)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(handlerFunction)
    .timeBased()
    .everyDays(1)
    .atHour(4)
    .create();

  appendImportLog_('SUCCESS', 'Триггер ежедневного импорта XLSX установлен (04:00 по timezone скрипта).', {
    rows: '',
    details: ''
  });
}
