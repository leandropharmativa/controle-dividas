const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(cors({
  origin: ['https://controle-dividas-frontend.onrender.com'],
  credentials: true
}));
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

// 🔁 Listar produtos
app.get('/produtos', async (req, res) => {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'estoque!A2:A',
  });
  const produtos = [...new Set(result.data.values?.map(r => r[0]).filter(Boolean))];
  res.json(produtos);
});

// 📦 Registrar movimentação de estoque e atualizar saldo
app.post('/estoque', async (req, res) => {
  const { produto, quantidade, tipo, justificativa } = req.body;
  if (!produto || !quantidade || !tipo) return res.status(400).send("Campos obrigatórios ausentes.");

  const qtd = parseFloat(quantidade);
  const delta = tipo === "entrada" ? qtd : -qtd;
  const data = new Date().toISOString().split('T')[0];
  const sheets = await getSheetsClient();

  // Atualiza saldo na aba estoque
  const estoqueRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'estoque!A2:B',
  });
  const rows = estoqueRes.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === produto);

  let novoSaldo;
  if (rowIndex !== -1) {
    const atual = parseFloat(rows[rowIndex][1] || 0);
    novoSaldo = Math.max(0, atual + delta);
    rows[rowIndex][1] = novoSaldo.toString();

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `estoque!A${rowIndex + 2}:B${rowIndex + 2}`,
      valueInputOption: 'RAW',
      resource: { values: [rows[rowIndex]] },
    });
  } else {
    novoSaldo = Math.max(0, delta);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'estoque!A:B',
      valueInputOption: 'RAW',
      resource: { values: [[produto, novoSaldo.toString()]] },
    });
  }

  // Registra movimentação
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'movimentacoes!A:E',
    valueInputOption: 'RAW',
    resource: {
      values: [[produto, quantidade, tipo, data, justificativa || ""]],
    },
  });

  res.sendStatus(201);
});

// 📊 Consultar estoque atual (saldo com valores)
app.get('/estoque', async (req, res) => {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'estoque!A2:D', // Certifique-se de pegar até a coluna do valor total
  });

  const registros = (result.data.values || []).map(row => {
    const produto = row[0] || "";

    const parseMoeda = valor =>
      parseFloat((valor || "0").toString().replace("R$", "").replace(",", ".").trim());

    const quantidade = parseMoeda(row[1]);
    const valorUnitario = parseMoeda(row[2]);
    const valorTotal =
      row[3] ? parseMoeda(row[3]) : parseFloat((quantidade * valorUnitario).toFixed(2));

    return {
      produto,
      quantidade,
      valorUnitario,
      valorTotal,
    };
  });

  res.json(registros);
});

// 🔁 Histórico completo de movimentações
app.get('/movimentacoes', async (req, res) => {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'movimentacoes!A2:E',
  });

  const rows = result.data.values || [];
  const registros = rows.map(row => ({
    produto: row[0],
    quantidade: row[1],
    tipo: row[2],
    data: row[3],
    justificativa: row[4],
  }));

  res.json(registros);
});

//Lançar nova duplicata:
app.post('/duplicatas', async (req, res) => {
  const { produto, valor, vencimento, observacoes } = req.body;
  if (!produto || !valor || !vencimento) return res.status(400).send("Campos obrigatórios ausentes.");

  const sheets = await getSheetsClient();
  const id = `${Date.now()}`;
  const status = "pendente";

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'duplicatas!A:F',
    valueInputOption: 'RAW',
    resource: { values: [[id, produto, valor, vencimento, status, observacoes || ""]] },
  });

  res.sendStatus(201);
});

//Listar duplicatas:
app.get('/duplicatas', async (req, res) => {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'duplicatas!A2:F',
  });

  const registros = (result.data.values || []).map(row => ({
    id: row[0],
    produto: row[1],
    valor: row[2],
    vencimento: row[3],
    status: row[4],
    observacoes: row[5],
  }));

  res.json(registros);
});

//Quitar duplicata:
app.put('/duplicatas/:id/quitar', async (req, res) => {
  const { id } = req.params;
  const sheets = await getSheetsClient();
  const range = 'duplicatas!A2:F';

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const rows = result.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === id);
  if (rowIndex === -1) return res.status(404).send("Duplicata não encontrada.");

  rows[rowIndex][4] = "paga"; // Atualiza status

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `duplicatas!A${rowIndex + 2}:F${rowIndex + 2}`,
    valueInputOption: 'RAW',
    resource: { values: [rows[rowIndex]] },
  });

  res.sendStatus(200);
});



