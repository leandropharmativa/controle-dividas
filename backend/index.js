const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const fs = require('fs');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB;

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// 🔎 Listar promissórias
app.get('/promissorias', async (req, res) => {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TAB}!A2:F`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  const rows = result.data.values || [];
  res.json(rows.map(row => ({
    id: row[0],
    nome: row[1],
    valor: row[2],
    data: row[3],
    status: row[4],
    observacoes: row[5],
  })));
});

// ➕ Criar nova promissória
app.post('/promissorias', async (req, res) => {
  const { id, nome, valor, data, status, observacoes } = req.body;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:F`,
    valueInputOption: 'RAW',
    resource: {
      values: [[id, nome, valor, data, status, observacoes]],
    },
  });
  res.sendStatus(201);
});
// Rota raiz para teste
app.get('/', (req, res) => {
  res.json({ mensagem: "API Controle de Dívidas online" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
app.get('/', (req, res) => {
  res.json({ mensagem: "API Controle de Dívidas online" });
});

