// ==========================================================================
// SISTEMA DE MOEDAS E RECOMPENSAS
// ==========================================================================

// IDs únicos para cada recompensa (devem corresponder aos atributos data-id no HTML)
const RECOMPENSAS = {
    // Diárias
    'leitor-assiduo': { tipo: 'diaria', valor: 1, nome: 'Leitor Assíduo', descricao: 'Leia um livro hoje.' },
    'login-diario': { tipo: 'diaria', valor: 1, nome: 'Login Diário', descricao: 'Entre no aplicativo uma vez.' },
    // Semanais
    'rato-biblioteca': { tipo: 'semanal', valor: 2, nome: 'Rato de Biblioteca', descricao: 'Adicione um novo livro à sua biblioteca.' },
    'organizado': { tipo: 'semanal', valor: 2, nome: 'Organizado!', descricao: 'Adicione uma categoria à um livro.' },
    'desafiador-n1': { tipo: 'semanal', valor: 2, nome: 'Desafiador - Nível 1', descricao: 'Complete um desafio semanal.' },
    'leitor': { tipo: 'semanal', valor: 2, nome: 'Leitor(a)', descricao: 'Termine um livro.' },
    'colecionador-figurinhas': { tipo: 'semanal', valor: 2, nome: 'Colecionador de Figurinhas', descricao: 'Compre uma figurinha na loja.' },
    'colecionador-marcapaginas': { tipo: 'semanal', valor: 2, nome: 'Colecionador de Marca-Páginas', descricao: 'Compre um marca-páginas na loja.' },
    // Mensais
    'desafiador-n2': { tipo: 'mensal', valor: 5, nome: 'Desafiador - Nível 2', descricao: 'Complete um desafio mensal.' },
    // Anuais
    'desafiador-n3': { tipo: 'anual', valor: 20, nome: 'Desafiador - Nível 3', descricao: 'Complete um desafio anual.' }
};

// Estado persistente
let estado = {
    saldo: 0,
    recompensas: {} // chave: id, valor: { status: 'nao_concluida'|'concluida'|'resgatada', dataConclusao: timestamp, dataResgate: timestamp }
};

// ==========================================================================
// CARREGAR / SALVAR DADOS
// ==========================================================================
function carregarEstado() {
    const dados = localStorage.getItem('moedas_estado');
    if (dados) {
        try {
            const parsed = JSON.parse(dados);
            estado.saldo = parsed.saldo || 0;
            estado.recompensas = parsed.recompensas || {};
        } catch(e) {
            console.warn('Erro ao carregar estado, reiniciando.');
        }
    }
    // Garantir que todas as recompensas existam no estado
    for (const id in RECOMPENSAS) {
        if (!estado.recompensas[id]) {
            estado.recompensas[id] = { status: 'nao_concluida' };
        }
    }
    salvarEstado();
}

function salvarEstado() {
    localStorage.setItem('moedas_estado', JSON.stringify(estado));
}

// ==========================================================================
// VERIFICAÇÃO DE PERÍODOS (reseta automaticamente)
// ==========================================================================
function obterInicioPeriodo(tipo) {
    const agora = new Date();
    if (tipo === 'diaria') {
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    } else if (tipo === 'semanal') {
        const diaSemana = agora.getDay(); // 0=domingo
        const diff = agora.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); // ajustar para segunda-feira
        return new Date(agora.getFullYear(), agora.getMonth(), diff);
    } else if (tipo === 'mensal') {
        return new Date(agora.getFullYear(), agora.getMonth(), 1);
    } else if (tipo === 'anual') {
        return new Date(agora.getFullYear(), 0, 1);
    }
    return agora;
}

function obterFimPeriodo(tipo) {
    const inicio = obterInicioPeriodo(tipo);
    if (tipo === 'diaria') {
        return new Date(inicio.getTime() + 24*60*60*1000 - 1);
    } else if (tipo === 'semanal') {
        return new Date(inicio.getTime() + 7*24*60*60*1000 - 1);
    } else if (tipo === 'mensal') {
        const mesSeguinte = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
        return new Date(mesSeguinte.getTime() - 1);
    } else if (tipo === 'anual') {
        return new Date(inicio.getFullYear() + 1, 0, 1) - 1;
    }
    return inicio;
}

function estaNoPeriodoAtual(data, tipo) {
    const inicio = obterInicioPeriodo(tipo);
    const fim = obterFimPeriodo(tipo);
    return data >= inicio.getTime() && data <= fim.getTime();
}

// Resetar recompensas cujo período expirou
function resetarRecompensasExpiradas() {
    for (const id in estado.recompensas) {
        const rec = estado.recompensas[id];
        const info = RECOMPENSAS[id];
        if (!info) continue;

        // Se já foi resgatada, verificar se o período acabou
        if (rec.status === 'resgatada' && rec.dataResgate) {
            if (!estaNoPeriodoAtual(rec.dataResgate, info.tipo)) {
                // Reseta para não concluída
                rec.status = 'nao_concluida';
                delete rec.dataConclusao;
                delete rec.dataResgate;
            }
        }
        // Se está concluída mas não resgatada, verificar se o período ainda é o mesmo da conclusão
        else if (rec.status === 'concluida' && rec.dataConclusao) {
            if (!estaNoPeriodoAtual(rec.dataConclusao, info.tipo)) {
                // Reseta para não concluída
                rec.status = 'nao_concluida';
                delete rec.dataConclusao;
                delete rec.dataResgate;
            }
        }
    }
    salvarEstado();
}

// ==========================================================================
// FUNÇÕES PARA MARCAR CONCLUSÃO DE RECOMPENSAS (chamadas de outras páginas)
// ==========================================================================
function marcarRecompensaConcluida(id) {
    if (!RECOMPENSAS[id]) return false;
    const rec = estado.recompensas[id];
    if (!rec) return false;
    // Se já está concluída ou resgatada no período atual, não faz nada
    if (rec.status === 'concluida' || rec.status === 'resgatada') {
        // Verifica se ainda está no período, se não, permite concluir novamente
        if (rec.dataConclusao && estaNoPeriodoAtual(rec.dataConclusao, RECOMPENSAS[id].tipo)) {
            return false; // já concluída neste período
        }
    }
    rec.status = 'concluida';
    rec.dataConclusao = Date.now();
    salvarEstado();
    atualizarInterface();
    return true;
}

function marcarRecompensaResgatada(id) {
    if (!RECOMPENSAS[id]) return false;
    const rec = estado.recompensas[id];
    if (!rec) return false;
    if (rec.status !== 'concluida') return false; // só pode resgatar se concluída
    // Adiciona moedas ao saldo
    const valor = RECOMPENSAS[id].valor;
    estado.saldo += valor;
    rec.status = 'resgatada';
    rec.dataResgate = Date.now();
    salvarEstado();
    atualizarInterface();
    return true;
}

// ==========================================================================
// INTERFACE - RENDERIZAR RECOMPENSAS
// ==========================================================================
function atualizarInterface() {
    resetarRecompensasExpiradas();

    // Atualizar saldo total
    const valortotal = document.getElementById('valortotal');
    if (valortotal) valortotal.textContent = estado.saldo;

    // Obter todos os cards de recompensa (dentro de .recompensas)
    const cards = document.querySelectorAll('.recompensas > card, .recompensas > .conteudocards');
    // Na estrutura atual, cada recompensa está dentro de um div .recompensas, e dentro há um card ou diretamente o .conteudocards
    // Vamos buscar por .conteudocards que estão dentro de .recompensas
    const containers = document.querySelectorAll('.recompensas');
    containers.forEach(container => {
        const card = container.querySelector('.conteudocards');
        if (!card) return;
        // Procurar o botão de moedas dentro deste container
        const btnMoedas = container.querySelector('.moedas');
        if (!btnMoedas) return;

        // Identificar qual recompensa é esta (pelo título)
        const tituloEl = card.querySelector('.titulos');
        if (!tituloEl) return;
        const nomeRecompensa = tituloEl.textContent.trim();
        // Encontrar o id correspondente
        let id = null;
        for (const key in RECOMPENSAS) {
            if (RECOMPENSAS[key].nome === nomeRecompensa) {
                id = key;
                break;
            }
        }
        if (!id) return;

        const estadoRec = estado.recompensas[id];
        if (!estadoRec) return;

        // Determinar onde este card deve aparecer: na seção original ou em "Resgatar"
        const secaoResgatar = document.getElementById('resgatarmenu');
        if (!secaoResgatar) return;

        // Se a recompensa está concluída ou resgatada, mover para Resgatar
        if (estadoRec.status === 'concluida' || estadoRec.status === 'resgatada') {
            // Mover o container inteiro para dentro de resgatarmenu
            // Mas precisamos garantir que não haja duplicatas
            const pai = container.parentNode;
            if (pai !== secaoResgatar) {
                // Remove do local atual e adiciona em resgatarmenu
                // Antes de mover, vamos clonar ou reutilizar?
                // Vamos mover o container inteiro
                secaoResgatar.appendChild(container);
                // O container pode ter sido movido, então precisamos atualizar referências
                // O botão de moedas dentro dele agora deve ser configurado para resgate
                const novoBtn = container.querySelector('.moedas');
                if (novoBtn) {
                    // Mudar o texto para "Resgatar +X"
                    const valor = RECOMPENSAS[id].valor;
                    novoBtn.innerHTML = `Resgatar +${valor} <svg class="iconemoedas" ...>`; // manter o SVG
                    // Remover event listener antigo e adicionar novo
                    novoBtn.onclick = function(e) {
                        e.stopPropagation();
                        if (estadoRec.status === 'concluida') {
                            marcarRecompensaResgatada(id);
                            // Após resgatar, a recompensa ainda fica em Resgatar (status 'resgatada')
                            // Mas o botão deve mudar para "Resgatado" ou ficar inativo
                            atualizarInterface();
                        } else if (estadoRec.status === 'resgatada') {
                            alert('Recompensa já resgatada neste período.');
                        }
                    };
                }
                // Remover o texto "Nada aqui ainda" se existir
                const msgVazia = secaoResgatar.querySelector('.conteudocards-resgatar');
                if (msgVazia) msgVazia.style.display = 'none';
            }
            // Atualizar aparência do botão se resgatado
            if (estadoRec.status === 'resgatada') {
                const btn = container.querySelector('.moedas');
                if (btn) {
                    btn.innerHTML = 'Resgatado ✓';
                    btn.style.opacity = '0.6';
                    btn.style.pointerEvents = 'none';
                }
            } else if (estadoRec.status === 'concluida') {
                const btn = container.querySelector('.moedas');
                if (btn) {
                    // Já configuramos o onclick acima
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            }
        } else {
            // Se não concluída, garantir que esteja na seção original (fora de Resgatar)
            // Se o container estiver dentro de resgatarmenu, movê-lo de volta para seu lugar original
            // Mas precisamos saber onde era originalmente. Vamos usar um dataset para guardar o local original.
            // Ou podemos simplesmente deixar onde está, mas se estiver em Resgatar e não concluída, mover para fora.
            if (container.parentNode === secaoResgatar) {
                // Mover para o local apropriado (recolocar na seção de recompensas correspondente)
                // Vamos procurar a seção pai correta com base no tipo
                const tipo = RECOMPENSAS[id].tipo;
                let secaoPai = null;
                if (tipo === 'diaria') secaoPai = document.querySelector('.recompensas-diárias')?.parentNode;
                else if (tipo === 'semanal') secaoPai = document.querySelector('.recompensas-semanais')?.parentNode;
                else if (tipo === 'mensal') secaoPai = document.querySelector('.recompensas-mensais')?.parentNode;
                else if (tipo === 'anual') secaoPai = document.querySelector('.recompensas-anuais')?.parentNode;
                if (secaoPai) {
                    // Inserir antes do próximo elemento (ex: próxima seção)
                    const irmao = secaoPai.querySelector('.recompensas');
                    if (irmao) secaoPai.insertBefore(container, irmao);
                    else secaoPai.appendChild(container);
                }
            }
            // Restaurar botão para o estado normal (mostrar +valor)
            const btn = container.querySelector('.moedas');
            if (btn) {
                const valor = RECOMPENSAS[id].valor;
                btn.innerHTML = `+${valor} <svg class="iconemoedas" ...>`; // manter o SVG
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.onclick = null; // remover evento de resgate
                // O botão originalmente não fazia nada, mas podemos deixar vazio
            }
        }
    });

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
function init() {
    carregarEstado();
    resetarRecompensasExpiradas();
    atualizarInterface();

    // Verificar periodicamente (a cada minuto) se houve mudança de período
    setInterval(() => {
        resetarRecompensasExpiradas();
        atualizarInterface();
    }, 60000);
}

// ==========================================================================
// EXPORTAR FUNÇÕES PARA OUTROS SCRIPTS (global)
// ==========================================================================
window.marcarRecompensaConcluida = marcarRecompensaConcluida;
window.marcarRecompensaResgatada = marcarRecompensaResgatada;
window.estadoMoedas = estado;
window.RECOMPENSAS = RECOMPENSAS;

// Executar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}