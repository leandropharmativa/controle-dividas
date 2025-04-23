const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cors = require('cors');

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

// 📌 Listar promissórias pendentes (atualiza status se valor zerado)
app.get('/promissorias', async (req, res) => {
  const sheets = await getSheetsClient();
  const promissoriasRange = `${SHEET_TAB}!A2:G`;
  const promissoriasResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: promissoriasRange,
  });
  const promissoriasRows = promissoriasResult.data.values || [];

  // Busca pagamentos parciais
  let pagamentosRows = [];
  try {
    const pagamentosRange = `${PAGAMENTOS_TAB}!A2:E`;
    const pagamentosResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: pagamentosRange,
    });
    pagamentosRows = pagamentosResult.data.values || [];
  } catch (err) {
    console.log("Aba de pagamentos ainda não criada.");
  }

  // Soma os pagamentos por ID
  const pagosPorId = {};
  pagamentosRows.forEach(row => {
    const id = row[0];
    const valor = parseFloat(row[2]);
    if (!pagosPorId[id]) pagosPorId[id] = 0;
    pagosPorId[id] += isNaN(valor) ? 0 : valor;
  });

  const promissorias = [];

  // Monta lista e atualiza status para "paga" se necessário
  for (let i = 0; i < promissoriasRows.length; i++) {
    const row = promissoriasRows[i];
    const id = row[0];
    const valorOriginal = parseFloat(row[3]);
    const valorPago = pagosPorId[id] || 0;
    const valorAtual = Math.max(0, valorOriginal - valorPago);
    const statusAtual = row[5];

    if (valorAtual === 0 && statusAtual.toLowerCase() !== "paga") {
      promissoriasRows[i][5] = "paga";
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_TAB}!A${i + 2}:G${i + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [promissoriasRows[i]],
        },
      });
      continue;
    }

    if (statusAtual.toLowerCase() !== "paga") {
      promissorias.push({
        id,
        nome: row[1],
        telefone: row[2],
        valor: valorOriginal.toFixed(2),
        valorPago: valorPago.toFixed(2),
        valorAtual: valorAtual.toFixed(2),
        data: row[4],
        status: statusAtual,
        observacoes: row[6],
      });
    }
  }

  promissorias.sort((a, b) => a.nome.localeCompare(b.nome));
  res.json(promissorias);
});

// ➕ Criar nova promissória
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

// ✅ Marcar promissória como quitada manualmente
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

// ➕ Registrar pagamento parcial
