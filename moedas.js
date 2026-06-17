// 1. Pegar o elemento do saldo na tela
const saldoElement = document.getElementById('valortotal');
// 2. Pegar o saldo atual do localStorage (ou começar com 0)
let saldo = parseInt(localStorage.getItem('valortotal')) || 0;

// 3. Atualizar a tela com o saldo atual
saldoElement.textContent = saldo;
// 4. Selecionar TODOS os botões com a classe 'btn-resgatar'
const botoesResgatar = document.querySelectorAll('.recompensas');

// 5. Para cada botão, adicionar um "ouvinte de clique"
botoesResgatar.forEach(botao => {
    botao.addEventListener('click', function() {
        // Lê o valor da recompensa (atributo data-valor)
        const valor = parseInt(this.dataset.valor);
        // Soma ao saldo
        saldo = saldo + valor;
        // Atualiza a tela
        saldoElement.textContent = saldo;
        // Salva no localStorage para não perder ao recarregar
        localStorage.setItem('saldoMoedas', saldo);


        // (Opcional) Marca o botão como resgatado para não poder clicar de novo
        this.disabled = true;
        this.textContent = '✅ Resgatado!';
        this.style.Color = '#FF8C70';
    });
});