function refreshAllDataForTrigger() {
  const importResult = importLatestXlsxFromGmailForTrigger();

  if (!importResult.ok) {
    return {
      ok: false,
      stage: 'import',
      message: 'Импорт не выполнен: ' + importResult.message
    };
  }

  return {
    ok: true,
    stage: 'done',
    message:
      'Обновление завершено.\n' +
      'Импорт: ' + (importResult.fileName || 'без имени файла') +
      ', строк: ' + (importResult.rows || 0) + '.\n' +
      'Report теперь строится внешним DuckDB workflow.'
  };
}

function createEvery15MinutesRefreshTrigger() {
  ScriptApp.newTrigger('refreshAllDataForTrigger')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function createHourlyRefreshTrigger() {
  ScriptApp.newTrigger('refreshAllDataForTrigger')
    .timeBased()
    .everyHours(1)
    .create();
}

function createDailyRefreshTriggerAt9() {
  ScriptApp.newTrigger('refreshAllDataForTrigger')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
}

function createDailyRefreshTriggerAt12() {
  ScriptApp.newTrigger('refreshAllDataForTrigger')
    .timeBased()
    .atHour(12)
    .everyDays(1)
    .create();
}

function createDailyRefreshTriggerAt18() {
  ScriptApp.newTrigger('refreshAllDataForTrigger')
    .timeBased()
    .atHour(18)
    .everyDays(1)
    .create();
}

function logProjectTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger, index) {
    Logger.log(
      [
        'Trigger #' + (index + 1),
        'handler=' + trigger.getHandlerFunction(),
        'eventType=' + trigger.getEventType(),
        'triggerSource=' + trigger.getTriggerSource(),
        'id=' + trigger.getUniqueId()
      ].join(' | ')
    );
  });

  return {
    ok: true,
    count: triggers.length,
    message: 'Найдено триггеров: ' + triggers.length
  };
}

function deleteAllProjectTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });

  return {
    ok: true,
    count: triggers.length,
    message: 'Удалено триггеров: ' + triggers.length
  };
}