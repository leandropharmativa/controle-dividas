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
const ADICOES_TAB = 'adicoes';

const auth = new google.auth.GoogleAuth({
  keyFile: 'google-credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function getSheetsClient() {
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client });
}

// 📌 Listar promissórias pendentes
app.get('/promissorias', async (req, res) => {
  const sheets = await getSheetsClient();
  const promissoriasRange = `${SHEET_TAB}!A2:G`;
  const promissoriasResult = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: promissoriasRange,
  });
  const promissoriasRows = promissoriasResult.data.values || [];

  // Pagamentos
  let pagamentosRows = [];
  try {
    const pagamentosRange = `${PAGAMENTOS_TAB}!A2:E`;
    const pagamentosResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: pagamentosRange,
    });
    pagamentosRows = pagamentosResult.data.values || [];
  } catch (err) {
    console.log("Aba de pagamentos não encontrada.");
  }

  const pagosPorId = {};
  pagamentosRows.forEach(row => {
    const id = row[0];
    const valor = parseFloat(row[2]);
    if (!pagosPorId[id]) pagosPorId[id] = 0;
    pagosPorId[id] += isNaN(valor) ? 0 : valor;
  });

  const promissorias = [];

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
        resource: { values: [promissoriasRows[i]] },
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

// ➕ Nova promissória
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

// ✅ Marcar promissória como quitada
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

  const [_, nome, telefone, valorOriginal, data, status, observacoes] = rows[rowIndex];

  // Soma pagamentos já realizados
  const pagamentosRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${PAGAMENTOS_TAB}!A2:E`,
  });
  const pagamentos = pagamentosRes.data.values || [];
  const totalPago = pagamentos
    .filter(p => p[0] === id)
    .reduce((acc, p) => acc + parseFloat(p[2] || 0), 0);

  const valorOriginalFloat = parseFloat(valorOriginal);
  const restante = Math.max(0, valorOriginalFloat - totalPago);

  // Atualiza status para "paga"
  rows[rowIndex][5] = "paga";
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A${rowIndex + 2}:G${rowIndex + 2}`,
    valueInputOption: 'RAW',
    resource: { values: [rows[rowIndex]] },
  });

  // Registra o restante como pagamento
  if (restante > 0) {
    const hoje = new Date().toISOString().split('T')[0];
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${PAGAMENTOS_TAB}!A:E`,
      valueInputOption: 'RAW',
      resource: {
        values: [[id, nome, restante.toFixed(2), hoje, "Quitação manual"]],
      },
    });
  }

  res.sendStatus(200);
});

// ➖ Registrar pagamento parcial
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

// 💸 Adicionar valor a dívida + registrar na aba adicoes
app.put('/promissorias/:id/adicionar', async (req, res) => {
  const { id } = req.params;
  const { valorAdicional, nome, observacao } = req.body;
  const sheets = await getSheetsClient();

  const range = `${SHEET_TAB}!A2:G`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const rows = result.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);
  if (rowIndex === -1) return res.status(404).send('Promissória não encontrada');

  const valorAtual = parseFloat(rows[rowIndex][3]) || 0;
  const novoValor = valorAtual + parseFloat(valorAdicional);
  rows[rowIndex][3] = novoValor.toFixed(2);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A${rowIndex + 2}:G${rowIndex + 2}`,
    valueInputOption: 'RAW',
    resource: { values: [rows[rowIndex]] },
  });

  const dataHoje = new Date().toISOString().split('T')[0];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${ADICOES_TAB}!A:E`,
    valueInputOption: 'RAW',
    resource: {
      values: [[id, nome, valorAdicional, dataHoje, observacao || ""]],
    },
  });

  res.sendStatus(200);
});

// 🧾 Listar pagamentos
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

// 💸 Listar adições
app.get('/adicoes/:id', async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const range = `${ADICOES_TAB}!A2:E`;

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
    res.status(500).send("Erro ao buscar adições");
  }
});

// 👁 Listar promissórias pagas
app.get('/promissorias/pagas', async (req, res) => {
  const sheets = await getSheetsClient();
  const range = `${SHEET_TAB}!A2:G`;
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const rows = result.data.values || [];

  const pagas = rows
    .filter(row => row[5]?.toLowerCase() === 'paga')
    .map(row => ({
      id: row[0],
      nome: row[1],
      telefone: row[2],
      valor: parseFloat(row[3]).toFixed(2),
      data: row[4],
      status: row[5],
      observacoes: row[6],
    }));

  res.json(pagas);
});

// 🌐 Status da API
app.get('/', (req, res) => {
  res.json({ mensagem: "API Controle de Dívidas online" });
});


// 🚀 Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

app.post('/verificar-senha', async (req, res) => {
  const { senha } = req.body;
  const sheets = await getSheetsClient();

  // Buscar a senha salva na planilha
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'config!A1', // 👈 crie uma aba "config" e coloque a senha na célula A1
  });

  const senhaCorreta = result.data.values?.[0]?.[0] || "";

  if (senha === senhaCorreta) {
    res.sendStatus(200);
  } else {
    res.sendStatus(403);
  }
});

