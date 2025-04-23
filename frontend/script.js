// 🌐 Endpoints da API
const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";
const ADICAO_URL = "https://controle-dividas.onrender.com/adicoes";

// 🎯 DOM
const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

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
  const data = new Date().toISOString().split('T')[0];

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
  const existe = container.querySelector('.pagamentos');
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

  // 💸 Adições
  if (adicoes.length > 0) {
    const titulo = document.createElement("li");
    titulo.textContent = "💸 Valores adicionados:";
    titulo.style.fontWeight = "bold";
    ul.appendChild(titulo);

    adicoes.forEach(a => {
      const dataBR = a.data.split('-').reverse().join('/');
      const li = document.createElement("li");
      li.textContent = `→ R$${a.valor} - ${dataBR}${a.observacao ? ` - ${a.observacao}` : ''}`;
      ul.appendChild(li);
    });
  }

  // ➖ Pagamentos
  if (pagamentos.length > 0) {
    const titulo = document.createElement("li");
    titulo.textContent = "➖ Pagamentos realizados:";
    titulo.style.fontWeight = "bold";
    ul.appendChild(titulo);

    pagamentos.forEach(p => {
      const dataBR = p.data.split('-').reverse().join('/');
      const li = document.createElement("li");
      li.textContent = `→ R$${p.valor} - ${dataBR}${p.observacao ? ` - ${p.observacao}` : ''}`;
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

// 🔁 Carregar promissórias
async function carregarPromissorias() {
  lista.innerHTML = "Carregando...";
  const res = await fetch(API_URL);
  const promissorias = await res.json();

  let total = 0;
  promissorias.forEach(p => {
    const valor = parseFloat(p.valorAtual);
    if (!isNaN(valor)) total += valor;
  });

  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;
  lista.innerHTML = "";

  promissorias.forEach(p => {
    const li = document.createElement("li");

    // Botões
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

    // Nome + telefone
    const dataBR = p.data.split('-').reverse().join('/');
    const telefone = p.telefone.replace(/[^\d\-]/g, '');
    const spanNome = document.createElement("span");
    spanNome.style.fontWeight = "bold";
    spanNome.textContent = `${p.nome} ${telefone}`;
    li.appendChild(spanNome);

    // Valores + data
    const texto = document.createTextNode(
      ` - R$${p.valorAtual} (original: R$${p.valor}) - ${dataBR}`
    );
    li.appendChild(texto);

    // Observação (se houver)
    if (p.observacoes) {
      const obs = document.createTextNode(` - Obs.: ${p.observacoes}`);
      li.appendChild(obs);
    }

    lista.appendChild(li);
  });
}

// ▶️ Inicia
carregarPromissorias();
