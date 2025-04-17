document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const paymentModal = document.getElementById('paymentModal');
  const closeModal = document.querySelector('.close');
  const paymentForm = document.getElementById('paymentForm');
  
  // Buscar dívidas
  searchBtn.addEventListener('click', async () => {
    const debtorName = document.getElementById('debtorSearch').value;
    
    try {
      const response = await fetch(`/api/debts?debtor=${encodeURIComponent(debtorName)}`);
      const debts = await response.json();
      
      renderDebtsTable(debts);
    } catch (error) {
      console.error('Erro ao buscar dívidas:', error);
    }
  });
  
  // Abrir modal de pagamento
  function openPaymentModal(debtId, totalAmount) {
    document.getElementById('debtId').value = debtId;
    document.getElementById('paymentAmount').max = totalAmount;
    paymentModal.style.display = 'block';
  }
  
  // Fechar modal
  closeModal.addEventListener('click', () => {
    paymentModal.style.display = 'none';
  });
  
  // Registrar pagamento
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const paymentData = {
      debtId: document.getElementById('debtId').value,
      amount: parseFloat(document.getElementById('paymentAmount').value),
      date: document.getElementById('paymentDate').value
    };
    
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData)
      });
      
      if (response.ok) {
        alert('Pagamento registrado com sucesso!');
        paymentModal.style.display = 'none';
        paymentForm.reset();
        // Atualizar a lista de dívidas
        searchBtn.click();
      }
    } catch (error) {
      console.error('Erro ao registrar pagamento:', error);
    }
  });
  
  // Renderizar tabela de dívidas
  function renderDebtsTable(debts) {
    const tbody = document.querySelector('#debtsTable tbody');
    tbody.innerHTML = '';
    
    debts.forEach(debt => {
      const row = document.createElement('tr');
      
      row.innerHTML = `
        <td>${debt.debtorName}</td>
        <td>R$ ${debt.totalAmount.toFixed(2)}</td>
        <td>R$ ${debt.pendingAmount.toFixed(2)}</td>
        <td>
          <button class="pay-btn" data-id="${debt.id}" data-amount="${debt.pendingAmount}">
            Registrar Pagamento
          </button>
        </td>
      `;
      
      tbody.appendChild(row);
    });
    
    // Adicionar eventos aos botões de pagamento
    document.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openPaymentModal(
          btn.dataset.id,
          parseFloat(btn.dataset.amount)
        );
      });
    });
  }
});
