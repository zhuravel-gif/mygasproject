function showDashboard2Html() {
  return dashboard2GetWebAppUrl_();
}

function dashboard2GetWebAppUrl_() {
  const baseUrl = dashboard1GetWebAppUrl_();
  if (!baseUrl) return '';
  return baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + 'page=dashboard2';
}

function openDashboard2WebAppFromMenu() {
  const url = dashboard2GetWebAppUrl_();

  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Dashboard2 WebApp',
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

  SpreadsheetApp.getUi().showModalDialog(html, 'Открытие Dashboard2');
}