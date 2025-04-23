const API_URL = "https://SEU-BACKEND.onrender.com/promissorias"; // substitua pelo seu endpoint

const form = document.getElementById("form-promissoria");
const lista = document.getElementById("lista-promissorias");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nova = {
    id: form.id.value,
    nome: form.nome.value,
    valor: form.valor.value,
    data: form.data.value,
    status: form.status.value,
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

async function carregarPromissorias() {
  lista.innerHTML = "Carregando...";
  const res = await fetch(API_URL);
  const promissorias = await res.json();
  lista.innerHTML = "";

  promissorias.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.id} - ${p.nome} - R$${p.valor} - ${p.status}`;
    lista.appendChild(li);
  });
}

carregarPromissorias();
