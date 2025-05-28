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
  mostrarTela('promissorias');
});

document.getElementById("btn-estoque").addEventListener("click", () => {
  mostrarTela('estoque');
});

document.getElementById("btn-duplicatas").addEventListener("click", () => {
  mostrarTela('duplicatas');
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
  if (!(await confirmar("Deseja realmente marcar como quitada?"))) return;
  await fetch(`${API_URL}/${id}/quitar`, { method: "PUT" });
  carregarPromissorias();
}

// ➖ Pagamento parcial
async function registrarPagamento(id, nome) {
  const valor = await solicitarEntrada("Informe o valor pago:");
  if (!valor) return;
  const observacao = await solicitarEntrada("Alguma observação?") || "";
  const data = new Date().toISOString().split("T")[0];

  await fetch(PAGAMENTO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, nome, valor, data, observacao }),
  });

  exibirMensagem("Pagamento registrado com sucesso!");
  carregarPromissorias();
}

// 💸 Adicionar valor
async function adicionarValor(id, nome) {
  const valor = await solicitarEntrada("Informe o valor adicional:");
  if (!valor || isNaN(valor)) return;
  const observacao = await solicitarEntrada("Alguma observação?") || "";

  await fetch(`${API_URL}/${id}/adicionar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valorAdicional: valor, nome, observacao }),
  });

  exibirMensagem("Valor adicionado com sucesso!");
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
  btnQuitar.innerHTML = "✅";
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
  btnPagas = document.getElementById("btn-pagas");
  divPagas = document.getElementById("lista-pagas");

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
    exibirMensagem("Erro ao carregar produtos.", "erro");
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
    exibirMensagem("Preencha todos os campos obrigatórios.", "erro");
    return;
  }

  // 🔢 Verifica se a quantidade é válida
  const qtd = parseFloat(quantidade);
  if (isNaN(qtd) || qtd <= 0) {
    exibirMensagem("A quantidade deve ser um número positivo.", "erro");
    return;
  }

  try {
    await fetch("https://controle-dividas.onrender.com/estoque", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto, quantidade: qtd, tipo, justificativa }),
    });

    exibirMensagem("Movimentação registrada com sucesso!");
    form.reset();
    document.getElementById("select-produto").focus();
    carregarEstoque();
  } catch (err) {
    exibirMensagem("Erro ao registrar movimentação.", "erro");
  }
});

function mostrarTelaEstoque() {
  document.getElementById("tela-estoque").style.display = "block";
  carregarProdutos();
  carregarEstoque();
}

function mostrarTela(tipo) {
  ocultarTodasAsTelas();

  // Mostrar botão de voltar ao entrar em qualquer tela
  document.querySelector('.btn-voltar-circulo').style.display = "flex";

  if (tipo === "promissorias") {
    document.getElementById("conteudo-sistema").style.display = "block";
    carregarPromissorias();
    criarBotaoMostrarPagas();
  } else if (tipo === "estoque") {
    document.getElementById("tela-estoque").style.display = "block";
    carregarProdutos();
    carregarEstoque();
  } else if (tipo === "duplicatas") {
    document.getElementById("tela-duplicatas").style.display = "block";
    carregarDuplicatas();
  }
}

function voltarMenu() {
  ocultarTodasAsTelas();
  document.getElementById("menu-principal").style.display = "block";

  // Ocultar botão de voltar ao retornar ao menu
  document.querySelector('.btn-voltar-circulo').style.display = "none";
}

function ocultarTodasAsTelas() {
  document.getElementById('menu-principal').style.display = 'none';
  document.getElementById('conteudo-sistema').style.display = 'none';
  document.getElementById('tela-estoque').style.display = 'none';
  document.getElementById('tela-duplicatas').style.display = 'none';
}

async function carregarEstoque() {
  const lista = document.getElementById("lista-estoque");
  lista.innerHTML = "<p>Carregando registros...</p>";

  try {
    const res = await fetch("https://controle-dividas.onrender.com/estoque");
    const dados = await res.json();

    if (dados.length === 0) {
      lista.innerHTML = "<p>Nenhum registro encontrado.</p>";
      return;
    }

    const ul = document.createElement("ul");
    let totalGeral = 0;

    dados.forEach(reg => {
      const li = document.createElement("li");

      const qtd = parseFloat(reg.quantidade) || 0;
      const preco = parseFloat(reg.valorUnitario) || 0;
      const total = parseFloat(reg.valorTotal) || qtd * preco;
      totalGeral += total;

      li.innerHTML = `<strong>${reg.produto}</strong> - ${qtd} und x R$${preco.toFixed(2)} = <strong>R$${total.toFixed(2)}</strong>`;
      ul.appendChild(li);
    });

    lista.innerHTML = "";
    lista.appendChild(ul);

    const totalDiv = document.createElement("div");
    totalDiv.style.marginTop = "1rem";
    totalDiv.style.fontWeight = "bold";
    totalDiv.textContent = `📦 Valor total do estoque: R$${totalGeral.toFixed(2)}`;
    lista.appendChild(totalDiv);
  } catch (err) {
    lista.innerHTML = "<p>Erro ao carregar estoque.</p>";
  }
}

document.getElementById("form-duplicata").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const produto = form.produto.value;
  const valor = form.valor.value;
  const vencimento = form.vencimento.value;
  const observacoes = form.observacoes.value;

  if (!produto || !valor || !vencimento) {
    exibirMensagem("Preencha todos os campos obrigatórios.", "erro");
    return;
  }

  try {
    await fetch("https://controle-dividas.onrender.com/duplicatas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto, valor, vencimento, observacoes }),
    });

    exibirMensagem("Duplicata lançada com sucesso!");
    form.reset();
    carregarDuplicatas();
  } catch (err) {
    exibirMensagem("Erro ao lançar duplicata.", "erro");
  }
});

async function carregarDuplicatas() {
  const lista = document.getElementById("lista-duplicatas");
  lista.innerHTML = "<p>Carregando duplicatas...</p>";

  try {
    const res = await fetch("https://controle-dividas.onrender.com/duplicatas");
    const duplicatas = await res.json();

    // Função para formatar datas no padrão BR
    const formatarData = (iso) => {
      const partes = iso.split("-");
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    };

    // Ordenar por data de vencimento (asc)
    duplicatas.sort((a, b) => new Date(a.vencimento) - new Date(b.vencimento));

    const pendentes = duplicatas.filter(d => d.status !== "paga");
    const pagas = duplicatas.filter(d => d.status === "paga");

    const criarSecao = (titulo, duplicatas, corIcone) => {
      const div = document.createElement("div");
      const h3 = document.createElement("h3");
      h3.textContent = titulo;
      div.appendChild(h3);

      if (duplicatas.length === 0) {
        const p = document.createElement("p");
        p.textContent = "Nenhuma duplicata nesta categoria.";
        div.appendChild(p);
        return div;
      }

      const ul = document.createElement("ul");
      duplicatas.forEach(d => {
        const li = document.createElement("li");
        const venc = formatarData(d.vencimento);
        const obs = d.observacoes ? ` — Obs.: ${d.observacoes}` : "";
        const icone = d.status === "paga" ? "🟢" : "🔴";

        li.innerHTML = `${icone} <strong>${d.produto}</strong> — R$${parseFloat(d.valor).toFixed(2)} — Venc.: ${venc}${obs}`;

        if (d.status !== "paga") {
          const btn = document.createElement("button");
          btn.textContent = "✓ Quitar";
          btn.style.marginLeft = "1rem";
          btn.onclick = async () => {
            if (await confirmar("Confirmar quitação da duplicata?")) {
              await fetch(`https://controle-dividas.onrender.com/duplicatas/${d.id}/quitar`, {
                method: "PUT",
              });
              carregarDuplicatas();
            }
          };
          li.appendChild(btn);
        }

        ul.appendChild(li);
      });

      div.appendChild(ul);
      return div;
    };

    // Montar na tela
    lista.innerHTML = "";
    lista.appendChild(criarSecao("🔴 Duplicatas Pendentes", pendentes));
    lista.appendChild(criarSecao("🟢 Duplicatas Pagas", pagas));

  } catch (err) {
    console.error(err);
    lista.innerHTML = "<p>Erro ao carregar duplicatas.</p>";
  }
}

function exibirMensagem(texto, tipo = "sucesso") {
  const div = document.getElementById("mensagem-sistema");
  if (!div) return;
  div.textContent = texto;
  div.style.display = "block";
  div.style.color = tipo === "erro" ? "red" : "green";
  setTimeout(() => {
    div.style.display = "none";
  }, 4000);
}

function confirmar(texto) {
  return new Promise(resolve => {
    const modal = document.getElementById("modal-confirmacao");
    document.getElementById("confirmacao-texto").textContent = texto;
    modal.style.display = "flex";

    const sim = document.getElementById("confirmar-sim");
    const nao = document.getElementById("confirmar-nao");

    const fechar = (res) => {
      modal.style.display = "none";
      sim.onclick = null;
      nao.onclick = null;
      resolve(res);
    };

    sim.onclick = () => fechar(true);
    nao.onclick = () => fechar(false);
  });
}

function solicitarEntrada(texto, valorPadrao = "") {
  return new Promise(resolve => {
    const modal = document.getElementById("modal-prompt");
    const input = document.getElementById("prompt-input");
    document.getElementById("prompt-texto").textContent = texto;
    input.value = valorPadrao;
    modal.style.display = "flex";
    input.focus();

    const ok = document.getElementById("prompt-ok");
    const cancelar = document.getElementById("prompt-cancelar");

    const fechar = (res) => {
      modal.style.display = "none";
      ok.onclick = null;
      cancelar.onclick = null;
      resolve(res);
    };

    ok.onclick = () => fechar(input.value.trim());
    cancelar.onclick = () => fechar(null);
  });
}

aguardarBackend();
