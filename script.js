document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // 1. INICIALIZAÇÃO DE DADOS
    // ==========================================================================
    let meusLivros = JSON.parse(localStorage.getItem('minhaBiblioteca')) || [];
    let modoExclusaoAtivo = false;
    let livrosSelecionados = [];

    // ==========================================================================
    // 2. SELEÇÃO DE ELEMENTOS DO DOM
    // ==========================================================================
    const btnMais = document.querySelector('.mais');
    const btnAdicionar = document.getElementById('adicionar');
    const btnEscanear = document.getElementById('escanear');
    const btnLixeiraSecao = document.getElementById('btn-lixeira-secao');
    const containerCardsC = document.getElementById('todoscardsC');
    const containerCardsR = document.getElementById('todoscardsR');
    const btnDeletarSelecionados = document.getElementById('btn-deletar-selecionados');
    const inputArquivo = document.getElementById('input-arquivo');
    const buscaInput = document.querySelector('.busca');
    const formBusca = document.querySelector('.formb');
    const botoesCategoria = document.querySelectorAll('.categoria-item');

    // Elementos do Modal de Edição
    const modalEdicao = document.getElementById('modal-edicao-livro');
    const btnFecharModalEdicao = document.getElementById('btn-fechar-modal-livro');
    const btnSalvarModalEdicao = document.getElementById('btn-salvar-modal-livro');
    const modalInputTitulo = document.getElementById('modal-input-titulo');
    const modalInputAutor = document.getElementById('modal-input-autor');
    const modalCapaImg = document.getElementById('modal-capa-livro');
    let livroSendoEditadoId = null;

    // ==========================================================================
    // 3. RENDERIZAÇÃO INTERNA OTIMIZADA
    // ==========================================================================
    function renderizarBiblioteca(categoriaFiltro = 'todos', termoBusca = '') {
        if (!containerCardsC) return;
        
        // Limpa os containers antes de desenhar para evitar duplicações e loops
        containerCardsC.innerHTML = '';
        if (containerCardsR) {
            containerCardsR.innerHTML = '';
        }

        const termoMin = termoBusca.toLowerCase().trim();

        // CORREÇÃO CRÍTICA: Definindo a variável livrosFiltrados antes de usá-la!
        const livrosFiltrados = meusLivros.filter(livro => {
            const correspondeCategoria = categoriaFiltro === 'todos' || livro.categoria === categoriaFiltro;
            const correspondeBusca = livro.titulo.toLowerCase().includes(termoMin) || 
                                     (livro.autor && livro.autor.toLowerCase().includes(termoMin));
            return correspondeCategoria && correspondeBusca;
        });
        
        // 1. Renderiza os Recentes (Apenas os que têm lidoRecentemente === true)
        if (containerCardsR) {
            const ultimosRecentes = meusLivros
                .filter(livro => livro.lidoRecentemente === true)
                .reverse()
                .slice(0, 4); // Limita aos 4 últimos

            ultimosRecentes.forEach(livro => {
                const cardR = document.createElement('div');
                cardR.className = 'card';
                cardR.style.width = '200px';
                cardR.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
                        <img src="${livro.capa || 'img/capapadrao.jpg'}" alt="Capa" style="width: 50px; height: 75px; object-fit: cover; border-radius: 4px;">
                        <div style="overflow: hidden; text-align: left;">
                            <h3 class="titulo" style="font-size: 13px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${livro.titulo}</h3>
                            <p style="font-size: 11px; margin: 3px 0 0 0; color: #5d5d6e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${livro.autor || 'Desconhecido'}</p>
                        </div>
                    </div>
                `;
                cardR.addEventListener('click', () => abrirModalEdicao(livro));
                containerCardsR.appendChild(cardR);
            });
        }
        
        // 2. Renderiza os Livros na Grade Principal (Todos Filtrados)
        livrosFiltrados.forEach(livro => {
            const card = document.createElement('div');
            card.className = `card card-livro-individual ${livrosSelecionados.includes(livro.id) ? 'card-selecionado-exclusao' : ''}`;
            card.dataset.id = livro.id;

            // Correção de sintaxe: Fechando corretamente as aspas do alt="Capa do Livro"
            card.innerHTML = `
                <div class="capa-container">
                    <img class="capa-livro" src="${livro.capa || 'img/capapadrao.jpg'}" alt="Capa do Livro" loading="lazy">
                    <div class="menu-categorias-capa">
                        <button class="btn-cat cat-lendo ${livro.categoria === 'lendo' ? 'selecionado' : ''}" title="Lendo" data-cat="lendo">L</button>
                        <button class="btn-cat cat-relendo ${livro.categoria === 'relendo' ? 'selecionado' : ''}" title="Relendo" data-cat="relendo">R</button>
                        <button class="btn-cat cat-quero-ler ${livro.categoria === 'quero-ler' ? 'selecionado' : ''}" title="Quero Ler" data-cat="quero-ler">Q</button>
                        <button class="btn-cat cat-finalizados ${livro.categoria === 'finalizados' ? 'selecionado' : ''}" title="Finalizados" data-cat="finalizados">F</button>
                        <button class="btn-cat cat-abandonados ${livro.categoria === 'abandonados' ? 'selecionado' : ''}" title="Abandonados" data-cat="abandonados">A</button>
                        <button class="btn-cat cat-favoritos ${livro.categoria === 'favoritos' ? 'selecionado' : ''}" title="Favoritos" data-cat="favoritos">★</button>
                    </div>
                </div>
                <div class="card-info">
                    <h3 class="titulo">${livro.titulo}</h3>
                    <p class="autor" style="font-size: 11px; margin: 0; color: #5d5d6e;">${livro.autor || 'Autor Desconhecido'}</p>
                </div>
            `;

            // Clique no card (abre edição ou seleciona para exclusão)
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-cat')) return;

                if (modoExclusaoAtivo) {
                    toggleSelecaoLivro(livro.id, card);
                } else {
                    abrirModalEdicao(livro);
                }
            });

            // Gerenciar alteração de categoria nos botões da capa
            const botoesCatCapa = card.querySelectorAll('.btn-cat');
            botoesCatCapa.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const novaCat = btn.dataset.cat;
                    livro.categoria = livro.categoria === novaCat ? 'todos' : novaCat;
                    salvarDados();
                    const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                    renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
                });
            });

            containerCardsC.appendChild(card);
        });
    }

    function salvarDados() {
        localStorage.setItem('minhaBiblioteca', JSON.stringify(meusLivros));
    }

    // ==========================================================================
    // 4. CRIAR NOVO LIVRO
    // ==========================================================================
    window.criarNovoCardNoApp = function(titulo, formato) {
        const novoLivro = {
            id: Date.now().toString(),
            titulo: titulo,
            autor: '',
            formato: formato,
            categoria: 'todos',
            capa: 'img/capapadrao.jpg',
            lidoRecentemente: false
        };

        meusLivros.push(novoLivro);
        salvarDados();
        
        const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
        renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
    };

    // ==========================================================================
    // 5. CONTROLE DO MENU FLUTUANTE BOTÃO (+)
    // ==========================================================================
    if (btnMais) {
        btnMais.addEventListener('click', (evento) => {
            evento.stopPropagation();
            const estaoAbertos = btnAdicionar.style.display === 'block';
            if (btnAdicionar) btnAdicionar.style.display = estaoAbertos ? 'none' : 'block';
            if (btnEscanear) btnEscanear.style.display = estaoAbertos ? 'none' : 'block';
        });
    }

    document.addEventListener('click', () => {
        if (btnAdicionar) btnAdicionar.style.display = 'none';
        if (btnEscanear) btnEscanear.style.display = 'none';
    });

    if (btnAdicionar && inputArquivo) {
        btnAdicionar.addEventListener('click', (evento) => {
            evento.stopPropagation();
            inputArquivo.click();
        });
    }

    if (inputArquivo) {
        inputArquivo.addEventListener('change', (evento) => {
            const arquivoSelecionado = evento.target.files[0];
            if (arquivoSelecionado) {
                const nomeCompleto = arquivoSelecionado.name;
                const partes = nomeCompleto.split('.');
                const extensao = partes.pop().toLowerCase();
                const tituloDoLivro = partes.join('.'); 

                window.criarNovoCardNoApp(tituloDoLivro, extensao);
                inputArquivo.value = '';
            }
        });
    }

    // ==========================================================================
    // 6. FILTROS DE CATEGORIA E BUSCA
    // ==========================================================================
    botoesCategoria.forEach(botao => {
        botao.addEventListener('click', () => {
            botoesCategoria.forEach(b => b.classList.remove('ativo'));
            botao.classList.add('ativo');
            renderizarBiblioteca(botao.dataset.categoria, buscaInput ? buscaInput.value : '');
        });
    });

    if (formBusca) {
        formBusca.addEventListener('submit', (e) => e.preventDefault());
    }
    if (buscaInput) {
        buscaInput.addEventListener('input', () => {
            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            renderizarBiblioteca(catAtiva, buscaInput.value);
        });
    }

    // ==========================================================================
    // 7. MODO DE EXCLUSÃO (ATUALIZADO COM SELECIONAR TUDO)
    // ==========================================================================
    const containerAcoesLixeira = document.getElementById('container-acoes-lixeira');
    const btnSelecionarTudo = document.getElementById('btn-selecionar-tudo');

    if (btnLixeiraSecao) {
        btnLixeiraSecao.addEventListener('click', () => {
            modoExclusaoAtivo = !modoExclusaoAtivo;
            livrosSelecionados = [];

            if (modoExclusaoAtivo) {
                btnLixeiraSecao.style.backgroundColor = '#e74c3c';
                btnLixeiraSecao.style.color = '#fff';
                if (containerAcoesLixeira) containerAcoesLixeira.style.display = 'flex';
                if (btnSelecionarTudo) btnSelecionarTudo.textContent = 'Selecionar Tudo';
            } else {
                btnLixeiraSecao.style.backgroundColor = 'transparent';
                btnLixeiraSecao.style.color = '#09092d';
                if (containerAcoesLixeira) containerAcoesLixeira.style.display = 'none';
            }

            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
        });
    }

    if (btnSelecionarTudo) {
        btnSelecionarTudo.addEventListener('click', () => {
            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            const termoBusca = buscaInput ? buscaInput.value.toLowerCase() : '';
            
            const livrosVisiveis = meusLivros.filter(livro => {
                const correspondeCategoria = catAtiva === 'todos' || livro.categoria === catAtiva;
                const correspondeBusca = livro.titulo.toLowerCase().includes(termoBusca) || 
                                         (livro.autor && livro.autor.toLowerCase().includes(termoBusca));
                return correspondeCategoria && correspondeBusca;
            });

            const todosVisiveisSelecionados = livrosVisiveis.every(livro => livrosSelecionados.includes(livro.id));

            if (todosVisiveisSelecionados) {
                livrosVisiveis.forEach(livro => {
                    const index = livrosSelecionados.indexOf(livro.id);
                    if (index > -1) livrosSelecionados.splice(index, 1);
                });
                btnSelecionarTudo.textContent = 'Selecionar Tudo';
            } else {
                livrosVisiveis.forEach(livro => {
                    if (!livrosSelecionados.includes(livro.id)) {
                        livrosSelecionados.push(livro.id);
                    }
                });
                btnSelecionarTudo.textContent = 'Desmarcar Todos';
            }

            renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
        });
    }

    function toggleSelecaoLivro(id, cardElement) {
        const index = livrosSelecionados.indexOf(id);
        if (index > -1) {
            livrosSelecionados.splice(index, 1);
            cardElement.classList.remove('card-selecionado-exclusao');
        } else {
            livrosSelecionados.push(id);
            cardElement.classList.add('card-selecionado-exclusao');
        }

        if (btnSelecionarTudo) {
            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            const termoBusca = buscaInput ? buscaInput.value.toLowerCase() : '';
            const livrosVisiveis = meusLivros.filter(l => {
                return (catAtiva === 'todos' || l.categoria === catAtiva) && 
                       (l.titulo.toLowerCase().includes(termoBusca) || (l.autor && l.autor.toLowerCase().includes(termoBusca)));
            });
            
            const todosSelecionados = livrosVisiveis.every(l => livrosSelecionados.includes(l.id));
            btnSelecionarTudo.textContent = todosSelecionados ? 'Desmarcar Todos' : 'Selecionar Tudo';
        }
    }

    if (btnDeletarSelecionados) {
        btnDeletarSelecionados.addEventListener('click', () => {
            if (livrosSelecionados.length === 0) return;

            if (confirm(`Deseja mesmo remover os ${livrosSelecionados.length} livros selecionados?`)) {
                meusLivros = meusLivros.filter(livro => !livrosSelecionados.includes(livro.id));
                salvarDados();
                
                livrosSelecionados = [];
                modoExclusaoAtivo = false;
                
                if (containerAcoesLixeira) containerAcoesLixeira.style.display = 'none';
                if (btnLixeiraSecao) {
                    btnLixeiraSecao.style.backgroundColor = 'transparent';
                    btnLixeiraSecao.style.color = '#09092d';
                }

                const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
            }
        });
    }

    // ==========================================================================
    // 8. CONTROLE DO MODAL DE EDIÇÃO
    // ==========================================================================
    function abrirModalEdicao(livro) {
        if (!modalEdicao) return;
        livroSendoEditadoId = livro.id;
        modalInputTitulo.value = livro.titulo;
        modalInputAutor.value = livro.autor || '';
        modalCapaImg.src = livro.capa || 'img/capapadrao.jpg';
        
        if (!livro.lidoRecentemente) {
            livro.lidoRecentemente = true;
            salvarDados();
            
            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
        }

        modalEdicao.style.display = 'flex';
    }

    if (btnFecharModalEdicao && modalEdicao) {
        btnFecharModalEdicao.addEventListener('click', () => {
            modalEdicao.style.display = 'none';
        });
    }

    if (btnSalvarModalEdicao && modalEdicao) {
        btnSalvarModalEdicao.addEventListener('click', () => {
            const livro = meusLivros.find(l => l.id === livroSendoEditadoId);
            if (livro) {
                livro.titulo = modalInputTitulo.value.trim() || livro.titulo;
                livro.autor = modalInputAutor.value.trim();
                salvarDados();
                
                const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
            }
            modalEdicao.style.display = 'none';
        });
    }

    if (modalEdicao) {
        modalEdicao.addEventListener('click', (evento) => {
            if (evento.target === modalEdicao) {
                modalEdicao.style.display = 'none';
            }
        });
    }

    // Primeira renderização ao carregar a página
    renderizarBiblioteca();
});