/**
 * Создание меню при открытии таблицы.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Отчетность ВБ')
    .addItem('Создать отчет', 'generateWbReport')
    .addToUi();
}
