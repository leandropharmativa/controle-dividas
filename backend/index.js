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
const PAGAMENTOS_TAB = 'pagamentos';

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

app.get('/promissorias', async (req, res) => {
  const sheets = await getSheetsClient();
  const promissoriasRange = `${SHEET_TAB}!A2:G`;
  const pagamentosRange = `${PAGAMENTOS_TAB}!A2:E`;

  const promissoriasResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: promissoriasRange,
  });
  const promissoriasRows = promissoriasResult.data.values || [];

  let pagamentosRows = [];
  try {
    const pagamentosResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: pagamentosRange,
    });
    pagamentosRows = pagamentosResult.data.values || [];
  } catch (err) {
    console.log("Nenhum pagamento registrado ainda.");
  }

  const pagosPorId = {};
  pagamentosRows.forEach(row => {
    const id = row[0];
    const valor = parseFloat(row[2]);
    if (!pagosPorId[id]) pagosPorId[id] = 0;
    pagosPorId[id] += isNaN(valor) ? 0 : valor;
  });

  const promissorias = promissoriasRows.map(row => {
    const id = row[0];
    const valorOriginal = parseFloat(row[3]);
    const valorPago = pagosPorId[id] || 0;
    const valorAtual = Math.max(0, valorOriginal - valorPago);

    return {
      id,
      nome: row[1],
      telefone: row[2],
      valor: valorOriginal.toFixed(2),
      valorPago: valorPago.toFixed(2),
      valorAtual: valorAtual.toFixed(2),
      data: row[4],
      status: row[5],
      observacoes: row[6],
    };
  }).filter(p => p.status.toLowerCase() !== "paga");

  promissorias.sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(promissorias);
});

app.post('/promissorias', async (req, res) => {
  const { nome, telefone, valor, data, observacoes } = req.body;
  const id = `${Date.now()}`;
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

app.put('/promissorias/:id/quitar', async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const range = `${SHEET_TAB}!A2:G`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const rows = result.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);
  if (rowIndex === -1) return res.status(404).send('Promissória não encontrada');

  rows[rowIndex][5] = "paga";

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A${rowIndex + 2}:G${rowIndex + 2}`,
    valueInputOption: 'RAW',
    resource: {
      values: [rows[rowIndex]],
    },
  });

  res.sendStatus(200);
});

app.post('/pagamentos', async (req, res) => {
  const { id, nome, valor, data, observacao } = req.body;
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${PAGAMENTOS_TAB}!A:E`,
    valueInputOption: 'RAW',
    resource: {
      values: [[id, nome, valor, data, observacao]],
    },
  });
  res.sendStatus(201);
});

app.get('/pagamentos/:id', async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const range = `${PAGAMENTOS_TAB}!A2:E`;

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range,
    });

    const rows = result.data.values || [];
    const filtrados = rows
      .filter(row => row[0] === id)
      .map(row => ({
        id: row[0],
        nome: row[1],
        valor: row[2],
        data: row[3],
        observacao: row[4],
      }));

    res.json(filtrados);
  } catch (err) {
    res.status(500).send("Erro ao buscar pagamentos");
  }
});

app.get('/', (req, res) => {
  res.json({ mensagem: "API Controle de Dívidas online" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
