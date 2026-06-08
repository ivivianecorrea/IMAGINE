// 🪙 LÓGICA DO SALDO E RECOMPENSAS (Menus/moedas.js)
// 1. Puxa o saldo salvo do navegador. Se não existir, começa com 150.
let saldoAtual = parseInt(localStorage.getItem('saldoMoedas')) || 150;
// Seleciona os elementos da tela
const elementoSaldo = document.querySelector('.valor-saldo');
const btnResgatar = document.querySelector('.btn-recompensa.resgatar');
// 2. Atualiza a tela com o saldo correto assim que a página abre
elementoSaldo.textContent = `🪙 ${saldoAtual}`;
// 3. Verifica se o usuário já resgatou esse prêmio antes nesta sessão
if (localStorage.getItem('desafioLeitorFeito') === 'true') {
    deixarBotaoConcluido();
}
// 4. Configura o clique no botão de resgatar
if (btnResgatar) {
    btnResgatar.addEventListener('click', function() {
        // Soma 50 moedas ao saldo
        saldoAtual += 50;
        
        // Atualiza a tela e o LocalStorage
        elementoSaldo.textContent = `🪙 ${saldoAtual}`;
        localStorage.setItem('saldoMoedas', saldoAtual);
        
        // Salva que este desafio já foi feito
        localStorage.setItem('desafioLeitorFeito', 'true');
        
        // Muda o visual do botão para "Concluído"
        deixarBotaoConcluido();
    });
}
// Função auxiliar para mudar o estado do botão
function deixarBotaoConcluido() {
    if (btnResgatar) {
        btnResgatar.textContent = "Concluído ✓";
        btnResgatar.classList.remove('resgatar'); // Remove o pulso amarelo do CSS
        btnResgatar.style.backgroundColor = "#e0e0e0";
        btnResgatar.style.color = "#888";
        btnResgatar.style.cursor = "default";
        btnResgatar.disabled = true; // Desativa o botão para não clicar de novo
    }
}