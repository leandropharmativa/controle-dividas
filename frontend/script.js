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

    lista.appendChild(li);
  });
}

carregarPromissorias();
