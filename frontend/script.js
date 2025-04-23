const API_URL = "https://controle-dividas.onrender.com/promissorias";
const PAGAMENTO_URL = "https://controle-dividas.onrender.com/pagamentos";

const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

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

async function quitarPromissoria(id) {
  const confirmacao = confirm("Deseja realmente marcar como quitada?");
  if (!confirmacao) return;

  await fetch(`${API_URL}/${id}/quitar`, {
    method: "PUT",
  });
  carregarPromissorias();
}

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
}

async function carregarPromissorias() {
  lista.innerHTML = "Carregando...";
  const res = await fetch(API_URL);
  const promissorias = await res.json();
  let total = 0;
  promissorias.forEach(p => {
  total += parseFloat(p.valorAtual);
  });
  document.getElementById("total-dividas").textContent = `R$${total.toFixed(2)}`;
  lista.innerHTML = "";

  promissorias.forEach(p => {
    const li = document.createElement("li");

    const btnQuitar = document.createElement("button");
    btnQuitar.textContent = "✓";
    btnQuitar.title = "Marcar como quitada";
    btnQuitar.onclick = () => quitarPromissoria(p.id);

    const btnParcial = document.createElement("button");
    btnParcial.textContent = "+";
    btnParcial.title = "Registrar pagamento parcial";
    btnParcial.onclick = () => registrarPagamento(p.id, p.nome);

    li.appendChild(btnQuitar);
    li.appendChild(btnParcial);

    const texto = document.createTextNode(
    ` ${p.nome} (${p.telefone}) - R$${p.valorAtual} (original: R$${p.valor}) - ${p.data} - ${p.status}${p.observacoes ? ` - ${p.observacoes}` : ''}`
    );

    li.appendChild(texto);
    li.style.cursor = "pointer";
    texto.style.textDecoration = "underline";
    texto.style.color = "blue";
    texto.onclick = () => mostrarPagamentos(p.id, li);

    lista.appendChild(li);
  });
}

async function mostrarPagamentos(id, container) {
  const existe = container.querySelector('.pagamentos');
  if (existe) {
    existe.remove(); // esconde se já estiver aberto
    return;
  }

  const res = await fetch(`https://controle-dividas.onrender.com/pagamentos/${id}`);
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

carregarPromissorias();
