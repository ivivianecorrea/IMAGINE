// ================== SISTEMA DE DESAFIOS ==================

let desafios = JSON.parse(localStorage.getItem('desafios')) || [];

function calcularDatasPeriodo(periodo, dataReferencia = new Date()) {
    const inicio = new Date(dataReferencia);
    let fim = new Date(dataReferencia);
    switch(periodo) {
        case 'diario':
            inicio.setHours(0,0,0,0);
            fim.setHours(23,59,59,999);
            break;
        case 'semanal':
            const diaSemana = inicio.getDay();
            inicio.setDate(inicio.getDate() - diaSemana);
            inicio.setHours(0,0,0,0);
            fim = new Date(inicio);
            fim.setDate(inicio.getDate() + 6);
            fim.setHours(23,59,59,999);
            break;
        case 'mensal':
            inicio.setDate(1);
            inicio.setHours(0,0,0,0);
            fim = new Date(inicio.getFullYear(), inicio.getMonth()+1, 0);
            fim.setHours(23,59,59,999);
            break;
        case 'anual':
            inicio.setMonth(0,1);
            inicio.setHours(0,0,0,0);
            fim = new Date(inicio.getFullYear(), 11, 31);
            fim.setHours(23,59,59,999);
            break;
        default:
            break;
    }
    return { inicio, fim };
}

function obterProgressoDesafio(desafio) {
    if (desafio.concluido && desafio.sucesso === false) return 0;
    let valorAtual = 0;
    if (desafio.tipo === 'livros') {
        const biblioteca = JSON.parse(localStorage.getItem('minhaBiblioteca')) || [];
        valorAtual = biblioteca.filter(livro => livro.categoria === 'finalizados').length;
    } else if (desafio.tipo === 'tempo') {
        const minutos = parseInt(localStorage.getItem('tempoLeituraMinutos')) || 0;
        valorAtual = Math.floor(minutos / 60);
    }
    return Math.min(valorAtual, desafio.meta);
}

function atualizarStatusDesafio(desafio) {
    if (desafio.concluido) return desafio; // já concluído, não mexe

    const agora = new Date();
    const progresso = obterProgressoDesafio(desafio);
    const metaAtingida = (progresso >= desafio.meta);
    const tempoEsgotado = (desafio.dataFim && agora > new Date(desafio.dataFim));

    // Se a meta foi atingida, conclui com sucesso (independente do tempo)
    if (metaAtingida) {
        desafio.concluido = true;
        desafio.sucesso = true;
        // Se houver recorrência, cria novo desafio
        if (desafio.recorrencia === 'sim') {
            criarNovoDesafioRecorrente(desafio);
        }
        salvarDesafios();
        return desafio;
    }

    // Se o tempo acabou e a meta não foi atingida, conclui como falha
    if (tempoEsgotado) {
        desafio.concluido = true;
        desafio.sucesso = false;
        if (desafio.recorrencia === 'sim') {
            criarNovoDesafioRecorrente(desafio);
        }
        salvarDesafios();
        return desafio;
    }

    // Caso contrário, ainda em progresso
    return desafio;
}

// Função auxiliar para criar novo desafio recorrente
function criarNovoDesafioRecorrente(desafioAntigo) {
    const novoDesafio = JSON.parse(JSON.stringify(desafioAntigo));
    delete novoDesafio.id;
    delete novoDesafio.concluido;
    delete novoDesafio.sucesso;

    const novaDataInicio = new Date(desafioAntigo.dataFim);
    novaDataInicio.setMilliseconds(novaDataInicio.getMilliseconds() + 1);
    let { inicio, fim } = calcularDatasPeriodo(desafioAntigo.periodo, novaDataInicio);
    if (desafioAntigo.periodo === 'personalizado') {
        const duracao = desafioAntigo.dataFim - desafioAntigo.dataInicio;
        inicio = novaDataInicio;
        fim = new Date(inicio.getTime() + duracao);
    }
    novoDesafio.dataInicio = inicio.getTime();
    novoDesafio.dataFim = fim.getTime();
    novoDesafio.id = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    desafios.push(novoDesafio);
}

function salvarDesafios() {
    localStorage.setItem('desafios', JSON.stringify(desafios));
    renderizarDesafios();
}

// ========== FUNÇÃO PARA EXCLUIR DESAFIO ==========
function excluirDesafio(id) {
    if (!confirm('Tem certeza que deseja excluir este desafio?')) return;
    desafios = desafios.filter(d => d.id !== id);
    salvarDesafios();
}

// ========== FUNÇÃO PARA ESVAZIAR HISTÓRICO ==========
function esvaziarHistorico() {
    const temConcluidos = desafios.some(d => d.concluido);
    if (!temConcluidos) {
        alert('Não há desafios concluídos para remover.');
        return;
    }
    if (!confirm('Remover todos os desafios concluídos do histórico?')) return;
    desafios = desafios.filter(d => !d.concluido);
    salvarDesafios();
}

function renderizarDesafios() {
    const containerAtual = document.getElementById('desafio-atual');
    const containerHistorico = document.getElementById('lista-historico');
    if (!containerAtual) return;

    // ATUALIZA TODOS OS DESAFIOS (verifica meta atingida ou tempo esgotado)
    desafios = desafios.map(d => atualizarStatusDesafio(d));

    // Separa em listas
    const emProgresso = desafios.filter(d => !d.concluido);
    const historico = desafios.filter(d => d.concluido);

    // ---- SEÇÃO "EM PROGRESSO" ----
    if (emProgresso.length === 0) {
        containerAtual.innerHTML = `<p class="sem-desafio">Nenhum desafio em progresso. Clique em "Adicionar Desafio" para começar!</p>`;
    } else {
        let html = '';
        emProgresso.forEach(d => {
            const progresso = obterProgressoDesafio(d);
            const percentual = (progresso / d.meta) * 100;
            const dataInicio = new Date(d.dataInicio).toLocaleDateString();
            const dataFim = new Date(d.dataFim).toLocaleDateString();
            html += `
                <div class="card-desafio">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 1;">
                            <p><strong>${d.nome}</strong> <span class="badge-status status-emprogresso">Em progresso</span></p>
                            <p>Tipo: ${d.tipo === 'livros' ? 'Livros lidos' : 'Tempo de leitura (horas)'}</p>
                            <p>Progresso: ${progresso} / ${d.meta} (${percentual.toFixed(1)}%)</p>
                            <div class="progresso-bar"><div class="progresso-fill" style="width: ${percentual}%;"></div></div>
                            <p>${dataInicio} até ${dataFim}</p>
                        </div>
                        <button class="btn-excluir" onclick="excluirDesafio('${d.id}')" title="Excluir desafio">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });
        containerAtual.innerHTML = html;
    }

    // ---- SEÇÃO "HISTÓRICO" ----
    if (historico.length === 0) {
        containerHistorico.innerHTML = `<p class="sem-historico">Adicione um desafio!</p>`;
    } else {
        let html = '';
        historico.forEach(d => {
            const progresso = obterProgressoDesafio(d);
            const percentual = (progresso / d.meta) * 100;
            const statusText = d.sucesso ? 'Concluído' : 'Não concluído';
            const statusClass = d.sucesso ? 'status-concluido' : 'status-falho';
            const dataInicio = new Date(d.dataInicio).toLocaleDateString();
            const dataFim = new Date(d.dataFim).toLocaleDateString();
            html += `
                <div class="card-desafio">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                        <div style="flex: 1;">
                            <p><strong>${d.nome}</strong> <span class="badge-status ${statusClass}">${statusText}</span></p>
                            <p>${d.meta} ${d.tipo === 'livros' ? 'livros' : 'horas'}</p>
                            <p>${progresso} / ${d.meta} (${percentual.toFixed(1)}%)</p>
                            <div class="progresso-bar"><div class="progresso-fill" style="width: ${percentual}%;"></div></div>
                            <p>${dataInicio} até ${dataFim}</p>
                        </div>
                        <button class="btn-excluir" onclick="excluirDesafio('${d.id}')" title="Excluir desafio">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        });

        // Botão para esvaziar histórico (remove todos os concluídos)
        html += `
            <div style="text-align: center; margin-top: 15px;">
                <button class="btn-esvaziar-historico" onclick="esvaziarHistorico()">🗑️ Esvaziar Histórico</button>
            </div>
        `;
        containerHistorico.innerHTML = html;
    }
}

function adicionarDesafio() {
    const nome = document.getElementById('nome-desafio').value.trim();
    const tipo = document.getElementById('tipo-desafio').value;
    const meta = parseInt(document.getElementById('meta-desafio').value);
    const periodo = document.getElementById('periodo-desafio').value;
    const recorrencia = document.getElementById('recorrencia-desafio').value;
    let dataInicio = null;
    let dataFim = null;

    if (!nome) {
        alert('Por favor, digite um nome para o desafio.');
        return;
    }
    if (isNaN(meta) || meta <= 0) {
        alert('A meta deve ser um número positivo.');
        return;
    }

    if (periodo === 'personalizado') {
        const dataEscolhida = document.getElementById('data-inicio-desafio').value;
        if (!dataEscolhida) {
            alert('Selecione uma data de início para o desafio personalizado.');
            return;
        }
        dataInicio = new Date(dataEscolhida);
        dataInicio.setHours(0,0,0,0);
        dataFim = new Date(dataInicio);
        dataFim.setDate(dataInicio.getDate() + 1);
        dataFim.setHours(23,59,59,999);
    } else {
        const { inicio, fim } = calcularDatasPeriodo(periodo, new Date());
        dataInicio = inicio;
        dataFim = fim;
    }

    const novoDesafio = {
        id: Date.now() + '_' + Math.random().toString(36).substr(2,5),
        nome: nome,
        tipo: tipo,
        meta: meta,
        periodo: periodo,
        dataInicio: dataInicio.getTime(),
        dataFim: dataFim.getTime(),
        recorrencia: recorrencia,
        concluido: false,
        sucesso: null
    };
    desafios.push(novoDesafio);
    salvarDesafios();
    fecharModal();
    console.log('Função adicionarDesafio chamada');
}

// ================== CONFIGURAÇÃO DO MODAL ==================
const modal = document.getElementById('modal-desafio');
const btnAbrir = document.getElementById('btn-adicionar-desafio');
const btnFechar = document.getElementById('fechar-modal-desafio');
const btnSalvar = document.getElementById('salvar-desafio');
const periodoSelect = document.getElementById('periodo-desafio');
const campoDataInicio = document.getElementById('campo-data-inicio');

function abrirModal() {
    modal.style.display = 'flex';
    document.getElementById('nome-desafio').value = '';
    document.getElementById('tipo-desafio').value = 'livros';
    document.getElementById('meta-desafio').value = '1';
    periodoSelect.value = 'diario';
    document.getElementById('recorrencia-desafio').value = 'nao';
    campoDataInicio.style.display = 'none';
    document.getElementById('data-inicio-desafio').value = '';
}

function fecharModal() {
    modal.style.display = 'none';
}

if (btnAbrir) btnAbrir.addEventListener('click', abrirModal);
if (btnFechar) btnFechar.addEventListener('click', fecharModal);
if (btnSalvar) btnSalvar.addEventListener('click', adicionarDesafio);

window.addEventListener('click', (e) => {
    if (e.target === modal) fecharModal();
});

periodoSelect.addEventListener('change', () => {
    campoDataInicio.style.display = periodoSelect.value === 'personalizado' ? 'block' : 'none';
});

// ================== SIMULAÇÃO DE TEMPO (opcional) ==================
const btnSimularTempo = document.getElementById('btn-simular-tempo');
if (btnSimularTempo) {
    btnSimularTempo.addEventListener('click', () => {
        let minutos = parseInt(localStorage.getItem('tempoLeituraMinutos')) || 0;
        minutos += 60;
        localStorage.setItem('tempoLeituraMinutos', minutos);
        renderizarDesafios();
        alert('Adicionada 1 hora de leitura simulada!');
    });
}

// ================== INICIALIZAÇÃO ==================
renderizarDesafios();

// ================== VERIFICAÇÃO AUTOMÁTICA (a cada 30 segundos) ==================
setInterval(() => {
    // Verifica se algum desafio em progresso teve a meta atingida ou expirou
    let precisaAtualizar = false;
    for (const d of desafios) {
        if (d.concluido) continue;
        const progresso = obterProgressoDesafio(d);
        const metaAtingida = (progresso >= d.meta);
        const tempoEsgotado = (d.dataFim && new Date() > new Date(d.dataFim));
        if (metaAtingida || tempoEsgotado) {
            precisaAtualizar = true;
            break;
        }
    }
    if (precisaAtualizar) {
        renderizarDesafios(); // reavalia e move os concluídos para o histórico
    }
}, 30000); // a cada 30 segundos (pode ajustar)
60000; // a cada 60 segundos