// 🌐 Endpoints da API
const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";

// 🎯 Referências ao DOM
const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

// 📌 Submete nova promissória
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

// 💰 Registrar pagamento parcial
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

// 🔎 Mostrar histórico de pagamentos de uma promissória
async function mostrarPagamentos(id, container) {
  const existe = container.querySelector('.pagamentos');
  if (existe) {
    existe.remove(); // Oculta se já estiver aberto
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
      const li = document.createElement("li");
      li.textContent = `→ R$${p.valor} - ${p.data}${p.observacao ? ` - ${p.observacao}` : ''}`;
      ul.appendChild(li);
    });
  }

  container.appendChild(ul);
}

// 🔄 Carrega e exibe todas as promissórias
async function carregarPromissorias() {
  lista.innerHTML = "Carregando...";
  const res = await fetch(API_URL);
  const promissorias = await res.json();

  // 💵 Total geral das dívidas em aberto
  let total = 0;
  promissorias.forEach(p => {
    const valor = parseFloat(p.valorAtual);
    if (!isNaN(valor)) total += valor;
  });
  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;
  lista.innerHTML = "";

  // 📝 Exibe cada promissória na tela
  promissorias.forEach(p => {
    const li = document.createElement("li");

    // ✓ Botão para quitar
    const btnQuitar = document.createElement("button");
    btnQuitar.textContent = "✓";
    btnQuitar.title = "Marcar como quitada";
    btnQuitar.onclick = () => quitarPromissoria(p.id);

    // 💬 Botão para visualizar pagamentos
    const btnPagamentos = document.createElement("button");
    btnPagamentos.textContent = "💬";
    btnPagamentos.title = "Ver histórico de pagamentos";
    btnPagamentos.onclick = () => mostrarPagamentos(p.id, li);

    // ➕ Botão para registrar pagamento parcial
    const btnParcial = document.createElement("button");
    btnParcial.textContent = "+";
    btnParcial.title = "Registrar pagamento parcial";
    btnParcial.onclick = () => registrarPagamento(p.id, p.nome);

    // ▶️ Ordem dos botões
    li.appendChild(btnQuitar);
    li.appendChild(btnPagamentos);
    li.appendChild(btnParcial);

    // 🧾 Informações da dívida
    const dataBR = p.data.split('-').reverse().join('/'); // DD/MM/AAAA
    const telefoneLimpo = p.telefone.replace(/[^\d\-]/g, ''); // remove parênteses

    // Nome e telefone em negrito
    const spanIdentificacao = document.createElement("span");
    spanIdentificacao.style.fontWeight = "bold";
    spanIdentificacao.textContent = `${p.nome} ${telefoneLimpo}`;
    li.appendChild(spanIdentificacao);

    // Texto com valores e data
    const texto = document.createTextNode(
      ` - R$${p.valorAtual} (original: R$${p.valor}) - ${dataBR}`
    );
    li.appendChild(texto);

    // Observação ao final, se houver
    if (p.observacoes) {
      const obs = document.createTextNode(` - Obs.: ${p.observacoes}`);
      li.appendChild(obs);
    }

    lista.appendChild(li);
  });
}

// ▶️ Carrega ao iniciar
carregarPromissorias();
