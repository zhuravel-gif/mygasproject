/**
 * Создание меню при открытии таблицы.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Отчетность ВБ')
    .addItem('Создать отчет', 'generateWbReport')
    .addSeparator()
    .addItem('Установить ежедневный импорт 04:00', 'setupDailyMxlImportTrigger')
    .addToUi();
}
