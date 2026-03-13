function onOpen(e) {
  const ui = SpreadsheetApp.getUi();

  const menu = ui.createMenu('Импорт')
    .addItem('Импорт XLSX в Info', 'showImportXlsxDialog')
    .addSeparator()
    .addItem('Импорт XLSX в Info (без окна)', 'runImportXlsxFromMenu')
    .addItem('Построить report', 'runBuildReportFromMenu')
    .addItem('Импорт + report', 'runRefreshAllFromMenu');

  if (typeof openDashboard1WebAppFromMenu === 'function') {
    menu
      .addSeparator()
      .addItem('Открыть Dashboard1 (WebApp)', 'openDashboard1WebAppFromMenu');
  }

  if (typeof runBuildDashboard1FromMenu === 'function') {
    menu
      .addSeparator()
      .addItem('Построить Dashboard1', 'runBuildDashboard1FromMenu');
  }

  menu.addToUi();
}

function runImportXlsxFromMenu() {
  const result = importLatestXlsxToInfoForTrigger();
  SpreadsheetApp.getUi().alert('Импорт XLSX', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function runBuildReportFromMenu() {
  const result = buildReportForTrigger();
  SpreadsheetApp.getUi().alert('Report', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function runRefreshAllFromMenu() {
  const result = refreshAllDataForTrigger();
  SpreadsheetApp.getUi().alert('Обновление данных', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function runBuildDashboard1FromMenu() {
  const result = buildDashboard1ForTrigger();
  SpreadsheetApp.getUi().alert('Dashboard1', result.message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function openDashboard1WebAppFromMenu() {
  const url = dashboard1GetWebAppUrl_();

  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Dashboard1 WebApp',
      'Не задан URL Web App. Сначала задеплойте Web App и сохраните ссылку в Script Properties с ключом DASHBOARD1_WEBAPP_URL.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const html = HtmlService.createHtmlOutput(
    '<html><body><script>' +
      'window.open("' + url + '", "_blank");' +
      'google.script.host.close();' +
    '</script></body></html>'
  ).setWidth(220).setHeight(80);

  SpreadsheetApp.getUi().showModalDialog(html, 'Открытие Dashboard1');
}