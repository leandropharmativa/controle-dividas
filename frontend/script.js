// 🌐 URLs da API
const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";
const ADICAO_URL = "https://controle-dividas.onrender.com/adicoes";

// 🔐 Senha de acesso única (defina aqui)
const SENHA = "1234";

// 🛡️ Valida senha antes de carregar o sistema
document.getElementById("btn-acessar").addEventListener("click", () => {
  const input = document.getElementById("campo-senha").value;
  if (input === SENHA) {
    document.getElementById("tela-senha").style.display = "none";
    document.getElementById("conteudo-sistema").style.display = "block";
    carregarPromissorias(); // carrega o conteúdo real
    criarBotaoMostrarPagas(); // exibe o botão de pagas
  } else {
    document.getElementById("erro-senha").style.display = "block";
  }
});

// 🔧 Utilitário para remover acentos e padronizar textos
function removerAcentos(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// 🎯 Elementos principais
const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

let divPagas, btnPagas, visivelPagas = false;

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

// ✅ Marcar promissória como quitada
async function quitarPromissoria(id) {
  if (!confirm("Deseja realmente marcar como quitada?")) return;
  await fetch(`${API_URL}/${id}/quitar`, { method: "PUT" });
  carregarPromissorias();
}

// ➖ Registrar pagamento parcial
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

// 💸 Adicionar valor à dívida
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

// 📜 Mostrar histórico de adições e pagamentos
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

// 🔁 Carregar promissórias ativas e atualizar pagas dinamicamente
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

  // 👁 Atualiza lista de pagas automaticamente se estiver filtrando
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

// 📌 Renderizar item da lista de promissória ativa
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

// 👁 Criar botão final de "Mostrar/ocultar promissórias pagas"
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

// 📜 Mostrar lista de promissórias pagas (manual ou por busca)
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

// ▶️ Inicialização
carregarPromissorias();
criarBotaoMostrarPagas();
document.getElementById("filtro-nome").addEventListener("input", carregarPromissorias);
