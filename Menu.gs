/**
 * Создание меню при открытии таблицы.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Отчетность ВБ')
    .addItem('Создать отчет', 'generateWbReport')
    .addItem('Запустить MXL импорт', 'runDailyMxlImportJob')
    .addToUi();
}
