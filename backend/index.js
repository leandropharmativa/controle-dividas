const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cors = require('cors');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(cors());
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

// 🔎 Listar promissórias (corrigido)
app.get('/promissorias', async (req, res) => {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TAB}!A2:G`; // 7 colunas: ID, Nome, Telefone, Valor, Data, Status, Observações
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  const rows = result.data.values || [];

const promissorias = rows.map(row => ({
  id: row[0],
  nome: row[1],
  telefone: row[2],
  valor: row[3],
  data: row[4],
  status: row[5],
  observacoes: row[6],
}));
promissorias.sort((a, b) => a.nome.localeCompare(b.nome));
res.json(promissorias); 
});

// ➕ Criar nova promissória
app.post('/promissorias', async (req, res) => {
  const { nome, telefone, valor, data, observacoes } = req.body;

  const id = `${Date.now()}`; // ID único baseado em timestamp
  const status = "pendente";

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A:G`,
    valueInputOption: 'RAW',
    resource: {
      values: [[id, nome, telefone, valor, data, status, observacoes]],
    },
  });
  res.sendStatus(201);
});

// 🌐 Rota raiz para teste
app.get('/', (req, res) => {
  res.json({ mensagem: "API Controle de Dívidas online" });
});

// 🚀 Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
