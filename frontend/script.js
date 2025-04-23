// 🌐 Endpoints da API
const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";

// 🎯 Referências ao DOM
const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

// ➕ Envia nova promissória ao backend
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
  const confirmacao = confirm("Deseja realmente marcar como quitada?");
  if (!confirmacao) return;

  await fetch(`${API_URL}/${id}/quitar`, {
    method: "PUT",
  });

  carregarPromissorias();
}

// 💸 Adicionar valor a uma promissória existente
async function adicionarValor(id) {
  const valor = prompt("Informe o valor adicional à dívida:");
  if (!valor || isNaN(valor)) return;

  await fetch(`${API_URL}/${id}/adicionar`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ valorAdicional: valor }),
  });

  alert("Valor adicionado com sucesso!");
  carregarPromissorias();
}

// ➖ Registrar pagamento parcial
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

// 📜 Mostrar histórico de pagamentos
async function mostrarPagamentos(id, container) {
  const existe = container.querySelector('.pagamentos');
  if (existe) {
    existe.remove();
    return;
  }

  const res = await fetch(`${PAGAMENTO_URL}/${id}`);
  const pagamentos = await res.json();

  const ul = document.createElement("ul");
  ul.className = "pagamentos";

  if (pagamentos.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum pagamento registrado.";
    ul.appendChild(li);
  } else {
    pagamentos.forEach(p => {
      const dataBR = p.data.split('-').reverse().join('/');
      const li = document.createElement("li");
      li.textContent = `→ R$${p.valor} - ${dataBR}${p.observacao ? ` - ${p.observacao}` : ''}`;
      ul.appendChild(li);
    });
  }

  container.appendChild(ul);
}

// 🔁 Carregar promissórias da planilha
async function carregarPromissorias() {
  lista.innerHTML = "Carregando...";
  const res = await fetch(API_URL);
  const promissorias = await res.json();

  // 💵 Soma total das dívidas pendentes
  let total = 0;
  promissorias.forEach(p => {
    const valor = parseFloat(p.valorAtual);
    if (!isNaN(valor)) total += valor;
  });
  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;
  lista.innerHTML = "";

  promissorias.forEach(p => {
    const li = document.createElement("li");

    // ✓ Botão quitar
    const btnQuitar = document.createElement("button");
    btnQuitar.textContent = "✓";
    btnQuitar.title = "Marcar como quitada";
    btnQuitar.onclick = () => quitarPromissoria(p.id);

    // 🧾 Botão para listar pagamentos
    const btnPagamentos = document.createElement("button");
    btnPagamentos.textContent = "🧾";
    btnPagamentos.title = "Ver histórico de pagamentos";
    btnPagamentos.onclick = () => mostrarPagamentos(p.id, li);

    // ➖ Botão pagamento parcial
    const btnParcial = document.createElement("button");
    btnParcial.textContent = "-";
    btnParcial.title = "Registrar pagamento parcial";
    btnParcial.onclick = () => registrarPagamento(p.id, p.nome);

    // 💸 Botão adicionar valor à dívida
    const btnAdicionar = document.createElement("button");
    btnAdicionar.textContent = "+💸";
    btnAdicionar.title = "Adicionar valor à dívida";
    btnAdicionar.onclick = () => adicionarValor(p.id);

    // Adiciona os botões na ordem desejada
    li.appendChild(btnQuitar);
    li.appendChild(btnPagamentos);
    li.appendChild(btnParcial);
    li.appendChild(btnAdicionar);

    // 📅 Formata data e limpa telefone
    const dataBR = p.data.split('-').reverse().join('/');
    const telefoneLimpo = p.telefone.replace(/[^\d\-]/g, '');

    // 🧍 Nome e telefone em negrito
    const spanIdentificacao = document.createElement("span");
    spanIdentificacao.style.fontWeight = "bold";
    spanIdentificacao.textContent = `${p.nome} ${telefoneLimpo}`;
    li.appendChild(spanIdentificacao);

    // 💲 Texto principal
    const texto = document.createTextNode(
      ` - R$${p.valorAtual} (original: R$${p.valor}) - ${dataBR}`
    );
    li.appendChild(texto);

    // 📌 Observações ao final
    if (p.observacoes) {
      const obs = document.createTextNode(` - Obs.: ${p.observacoes}`);
      li.appendChild(obs);
    }

    lista.appendChild(li);
  });
}

// ▶️ Iniciar carregamento ao abrir a página
carregarPromissorias();
