const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";
const ADICAO_URL = "https://controle-dividas.onrender.com/adicoes";

const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");
const pagasDiv = document.getElementById("lista-pagas");

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
  carregarListas();
});

// ✅ Marcar como quitada
async function quitarPromissoria(id) {
  if (!confirm("Deseja realmente marcar como quitada?")) return;
  await fetch(`${API_URL}/${id}/quitar`, { method: "PUT" });
  carregarListas();
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
  carregarListas();
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
  carregarListas();
}

// 📜 Mostrar histórico
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

// 🔄 Carrega e renderiza promissórias ativas e pagas com base no nome buscado
async function carregarListas() {
  const filtroNome = document.getElementById("filtro-nome").value.toLowerCase();

  const [resAtivas, resPagas] = await Promise.all([
    fetch(API_URL),
    fetch(`${API_URL}/pagas`)
  ]);

  const ativas = await resAtivas.json();
  const pagas = await resPagas.json();

  let total = 0;
  lista.innerHTML = "";

  // Ativas
  ativas
    .filter(p => p.nome.toLowerCase().includes(filtroNome))
    .forEach(p => {
      const li = renderPromissoria(p, true);
      lista.appendChild(li);
      total += parseFloat(p.valorAtual);
    });

  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;

  // Pagas
  pagasDiv.innerHTML = "";
  const filtradasPagas = pagas.filter(p => p.nome.toLowerCase().includes(filtroNome));

  if (filtroNome && filtradasPagas.length > 0) {
    pagasDiv.innerHTML = "<h3>✓ Promissórias Pagas</h3>";
    const ul = document.createElement("ul");
    filtradasPagas.forEach(p => {
      const dataBR = p.data.split('-').reverse().join('/');
      const telefone = p.telefone.replace(/[^\d\-]/g, '');
      const obs = p.observacoes ? ` - Obs.: ${p.observacoes}` : "";

      const li = document.createElement("li");
      li.style.color = "#777";
      li.textContent = `✓ ${p.nome} ${telefone} - R$${p.valor} - ${dataBR}${obs}`;
      ul.appendChild(li);
    });
    pagasDiv.appendChild(ul);
  }
}

// 🔧 Renderiza uma promissória ativa
function renderPromissoria(p, ativa = true) {
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

// ▶️ Inicializa
carregarListas();
document.getElementById("filtro-nome").addEventListener("input", carregarListas);
