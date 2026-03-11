/**
 * Создание меню при открытии таблицы.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Отчетность ВБ')
    .addItem('Создать отчет', 'generateWbReport')
    .addItem('Запустить XLSX импорт', 'runDailyXlsxImportJob')
    .addSeparator()
    .addItem('Установить ежедневный импорт 04:00', 'setupDailyXlsxImportTrigger')
    .addToUi();
}
