// 🌐 Endpoints da API
const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";
const ADICAO_URL = "https://controle-dividas.onrender.com/adicoes";

// 🔧 Função auxiliar para busca sem acento
function removerAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// 🎯 Elementos principais
const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

async function aguardarBackend() {
  const STATUS_URL = "https://controle-dividas.onrender.com/";

  while (true) {
    try {
      const res = await fetch(STATUS_URL);
      if (res.ok) break;
    } catch (err) {
      console.log("Backend ainda não respondeu...");
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  document.getElementById("tela-loading").style.display = "none";
  document.getElementById("tela-senha").style.display = "block";
}

let divPagas, btnPagas, visivelPagas = false;

// 🔐 Validação da senha
document.getElementById("btn-acessar").addEventListener("click", async () => {
  const senha = document.getElementById("campo-senha").value;

  const res = await fetch("https://controle-dividas.onrender.com/verificar-senha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha }),
  });

  if (res.ok) {
    document.getElementById("tela-senha").style.display = "none";
    document.getElementById("menu-principal").style.display = "block";
  } else {
    document.getElementById("erro-senha").style.display = "block";
  }
});

// 👁 Escolha do módulo após login
document.getElementById("btn-promissorias").addEventListener("click", () => {
  document.getElementById("menu-principal").style.display = "none";
  document.getElementById("conteudo-sistema").style.display = "block";
  carregarPromissorias();
  criarBotaoMostrarPagas();
});

document.getElementById("btn-estoque").addEventListener("click", () => {
  document.getElementById("menu-principal").style.display = "none";
  mostrarTelaEstoque();
});

// ➕ Criar nova promissória
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nova = {
    nome: form.nome.value,
    telefone: form.telefone.value,
    valor: form.valor.value,
    data: form.data.value,
    status: "pendente",
    observacoes: form.observacoes.value,
  };

  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(nova),
  });

  form.reset();
  carregarPromissorias();
});

// ✅ Marcar como quitada
async function quitarPromissoria(id) {
  if (!confirm("Deseja realmente marcar como quitada?")) return;
  await fetch(`${API_URL}/${id}/quitar`, { method: "PUT" });
  carregarPromissorias();
}

// ➖ Pagamento parcial
async function registrarPagamento(id, nome) {
  const valor = prompt("Informe o valor pago:");
  if (!valor) return;
  const observacao = prompt("Alguma observação?") || "";
  const data = new Date().toISOString().split("T")[0];

  await fetch(PAGAMENTO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, nome, valor, data, observacao }),
  });

  alert("Pagamento registrado com sucesso!");
  carregarPromissorias();
}

// 💸 Adicionar valor
async function adicionarValor(id, nome) {
  const valor = prompt("Informe o valor adicional:");
  if (!valor || isNaN(valor)) return;
  const observacao = prompt("Alguma observação?") || "";

  await fetch(`${API_URL}/${id}/adicionar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valorAdicional: valor, nome, observacao }),
  });

  alert("Valor adicionado com sucesso!");
  carregarPromissorias();
}

// 📜 Histórico de pagamentos e adições
async function mostrarPagamentos(id, container) {
  const existe = container.querySelector(".pagamentos");
  if (existe) {
    existe.remove();
    return;
  }

  const [resPagamentos, resAdicoes] = await Promise.all([
    fetch(`${PAGAMENTO_URL}/${id}`),
    fetch(`${ADICAO_URL}/${id}`),
  ]);

  const pagamentos = await resPagamentos.json();
  const adicoes = await resAdicoes.json();

  const ul = document.createElement("ul");
  ul.className = "pagamentos";

  if (adicoes.length > 0) {
    const titulo = document.createElement("li");
    titulo.textContent = "💸 Valores adicionados:";
    titulo.style.fontWeight = "bold";
    ul.appendChild(titulo);

    adicoes.forEach((a) => {
      const dataBR = a.data.split("-").reverse().join("/");
      const li = document.createElement("li");
      li.textContent = `→ R$${a.valor} - ${dataBR}${a.observacao ? ` - ${a.observacao}` : ""}`;
      ul.appendChild(li);
    });
  }

  if (pagamentos.length > 0) {
    const titulo = document.createElement("li");
    titulo.textContent = "➖ Pagamentos realizados:";
    titulo.style.fontWeight = "bold";
    ul.appendChild(titulo);

    pagamentos.forEach((p) => {
      const dataBR = p.data.split("-").reverse().join("/");
      const li = document.createElement("li");
      li.textContent = `→ R$${p.valor} - ${dataBR}${p.observacao ? ` - ${p.observacao}` : ""}`;
      ul.appendChild(li);
    });
  }

  if (adicoes.length === 0 && pagamentos.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum histórico registrado.";
    ul.appendChild(li);
  }

  container.appendChild(ul);
}

// 🔁 Carrega promissórias ativas
async function carregarPromissorias() {
  const filtroNome = document.getElementById("filtro-nome").value;

  const res = await fetch(API_URL);
  const promissorias = await res.json();

  const filtradas = promissorias.filter(p =>
    !filtroNome || removerAcentos(p.nome).includes(removerAcentos(filtroNome))
  );

  let total = 0;
  lista.innerHTML = "";

  filtradas.forEach(p => {
    const li = renderPromissoria(p);
    lista.appendChild(li);
    total += parseFloat(p.valorAtual);
  });

  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;

  if (filtroNome) {
    mostrarPagas(true);
    btnPagas.textContent = "👁 Ocultar promissórias pagas";
    visivelPagas = true;
  } else {
    divPagas.innerHTML = "";
    btnPagas.textContent = "👁 Mostrar promissórias pagas";
    visivelPagas = false;
  }
}

// 🧍 Renderiza promissória ativa
function renderPromissoria(p) {
  const li = document.createElement("li");

  const btnQuitar = document.createElement("button");
  btnQuitar.textContent = "✓";
  btnQuitar.title = "Marcar como quitada";
  btnQuitar.onclick = () => quitarPromissoria(p.id);

  const btnPagamentos = document.createElement("button");
  btnPagamentos.textContent = "🧾";
  btnPagamentos.title = "Ver histórico";
  btnPagamentos.onclick = () => mostrarPagamentos(p.id, li);

  const btnParcial = document.createElement("button");
  btnParcial.textContent = "-";
  btnParcial.title = "Registrar pagamento parcial";
  btnParcial.onclick = () => registrarPagamento(p.id, p.nome);

  const btnAdicionar = document.createElement("button");
  btnAdicionar.textContent = "+💸";
  btnAdicionar.title = "Adicionar valor à dívida";
  btnAdicionar.onclick = () => adicionarValor(p.id, p.nome);

  li.appendChild(btnQuitar);
  li.appendChild(btnPagamentos);
  li.appendChild(btnParcial);
  li.appendChild(btnAdicionar);

  const dataBR = p.data.split("-").reverse().join("/");
  const telefone = p.telefone.replace(/[^\d\-]/g, "");
  const spanNome = document.createElement("span");
  spanNome.style.fontWeight = "bold";
  spanNome.textContent = `${p.nome} ${telefone}`;
  li.appendChild(spanNome);

  const texto = document.createTextNode(` - R$${p.valorAtual} (original: R$${p.valor}) - ${dataBR}`);
  li.appendChild(texto);

  if (p.observacoes) {
    const obs = document.createTextNode(` - Obs.: ${p.observacoes}`);
    li.appendChild(obs);
  }

  return li;
}

// 👁 Botão "Mostrar promissórias pagas"
function criarBotaoMostrarPagas() {
  const container = document.createElement("div");
  container.style.textAlign = "center";
  container.style.marginTop = "2rem";

  btnPagas = document.createElement("button");
  btnPagas.textContent = "👁 Mostrar promissórias pagas";
  btnPagas.style.padding = "8px 16px";
  btnPagas.style.border = "none";
  btnPagas.style.borderRadius = "6px";
  btnPagas.style.background = "#ccc";
  btnPagas.style.cursor = "pointer";
  btnPagas.style.fontWeight = "bold";

  divPagas = document.createElement("div");
  divPagas.id = "lista-pagas";
  divPagas.style.marginTop = "1rem";

  btnPagas.onclick = async () => {
    if (visivelPagas) {
      divPagas.innerHTML = "";
      btnPagas.textContent = "👁 Mostrar promissórias pagas";
      visivelPagas = false;
    } else {
      await mostrarPagas();
      btnPagas.textContent = "👁 Ocultar promissórias pagas";
      visivelPagas = true;
    }
  };

  container.appendChild(btnPagas);
  container.appendChild(divPagas);
  document.body.appendChild(container);
}

// 📜 Lista de promissórias pagas
async function mostrarPagas(apenasFiltradas = false) {
  const filtroNome = document.getElementById("filtro-nome").value;
  const res = await fetch(`${API_URL}/pagas`);
  const pagas = await res.json();

  const filtradas = pagas.filter(p =>
    !filtroNome || removerAcentos(p.nome).includes(removerAcentos(filtroNome))
  );

  if (apenasFiltradas && filtradas.length === 0) {
    divPagas.innerHTML = "";
    return;
  }

  divPagas.innerHTML = "<h3>✓ Promissórias Pagas</h3>";
  if (filtradas.length === 0) {
    divPagas.innerHTML += "<p>Nenhuma promissória paga registrada.</p>";
    return;
  }

  const ul = document.createElement("ul");
  filtradas.forEach(p => {
    const li = document.createElement("li");
    li.style.color = "#777";
    const dataBR = p.data.split('-').reverse().join('/');
    const telefone = p.telefone.replace(/[^\d\-]/g, '');
    const obs = p.observacoes ? ` - Obs.: ${p.observacoes}` : "";
    li.textContent = `✓ ${p.nome} ${telefone} - R$${p.valor} - ${dataBR}${obs}`;
    ul.appendChild(li);
  });
  divPagas.appendChild(ul);
}

// 🧭 Atualização ao digitar
document.getElementById("filtro-nome").addEventListener("input", carregarPromissorias);

// 📦 Controle de Estoque (início da estrutura)

async function carregarProdutos() {
  const select = document.getElementById("select-produto");
  select.innerHTML = '<option value="">🔽 Selecione um produto</option>';

  try {
    const res = await fetch("https://controle-dividas.onrender.com/produtos");
    const produtos = await res.json();

    produtos.forEach(produto => {
      const option = document.createElement("option");
      option.value = produto;
      option.textContent = produto;
      select.appendChild(option);
    });
  } catch (err) {
    alert("Erro ao carregar produtos.");
  }
}

document.getElementById("form-estoque").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;

  const produto = form.produto.value;
  const quantidade = form.quantidade.value;
  const tipo = form.tipo.value;
  const justificativa = form.justificativa.value;

  // 🔒 Verifica se todos os campos estão preenchidos
  if (!produto || !quantidade || !tipo) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  // 🔢 Verifica se a quantidade é válida
  const qtd = parseFloat(quantidade);
  if (isNaN(qtd) || qtd <= 0) {
    alert("A quantidade deve ser um número positivo.");
    return;
  }

  try {
    await fetch("https://controle-dividas.onrender.com/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto, quantidade: qtd, tipo, justificativa }),
    });

    alert("Movimentação registrada com sucesso.");
    form.reset();
    document.getElementById("select-produto").focus();
    carregarEstoque();
  } catch (err) {
    alert("Erro ao registrar movimentação.");
  }
});

function mostrarTelaEstoque() {
  document.getElementById("tela-estoque").style.display = "block";
  carregarProdutos();
  carregarEstoque();
}

function voltarMenu() {
  document.getElementById("tela-estoque").style.display = "none";
  document.getElementById("conteudo-sistema").style.display = "none";
  document.getElementById("menu-principal").style.display = "block";
}

async function carregarEstoque() {
  const lista = document.getElementById("lista-estoque");
  lista.innerHTML = "<p style='opacity:0.6;'>🔄 Carregando registros...</p>";

  try {
    const res = await fetch("https://controle-dividas.onrender.com/estoque");
    const dados = await res.json();

    if (dados.length === 0) {
      lista.innerHTML = "<p>Nenhum registro encontrado.</p>";
      return;
    }

    const ul = document.createElement("ul");

    dados.forEach(reg => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${reg.produto}</strong> - ${reg.quantidade} (${reg.tipo}) em ${reg.data}` +
        (reg.justificativa ? ` – ${reg.justificativa}` : "");
      ul.appendChild(li);
    });

    lista.innerHTML = "";
    lista.appendChild(ul);
  } catch (err) {
    lista.innerHTML = "<p>Erro ao carregar estoque.</p>";
  }
}

aguardarBackend();
