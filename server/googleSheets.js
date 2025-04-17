const { google } = require('googleapis');

// Configuração do cliente OAuth2
const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Função para acessar a planilha
async function getSheetData(spreadsheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });
  
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  
  return response.data.values;
}

// Função para atualizar a planilha com pagamentos
async function recordPayment(spreadsheetId, paymentData) {
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Implemente a lógica para atualizar a planilha com os pagamentos
  // Isso depende da estrutura da sua planilha
}

module.exports = { getSheetData, recordPayment };
