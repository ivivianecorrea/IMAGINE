// ==========================================================================
// 0. INICIALIZAÇÃO DO BANCO DE DADOS INDEXEDDB (Para arquivos pesados PDF/EPUB)
// ==========================================================================
const pedidoDB = indexedDB.open("BibliotecaArquivos", 1);
pedidoDB.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains("arquivos")) {
        db.createObjectStore("arquivos");
    }
};

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

        // Filtro aceita a propriedade favorita cumulativa/independente
        const livrosFiltrados = meusLivros.filter(livro => {
            const correspondeCategoria = categoriaFiltro === 'todos' || 
                                         (categoriaFiltro === 'favoritos' ? livro.favorito === true : livro.categoria === categoriaFiltro);
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
        
        // 2. Renderiza os Livros na Grade Principal (Todos Filtrados com Ícones SVG)
        livrosFiltrados.forEach(livro => {
            const card = document.createElement('div');
            card.className = `card card-livro-individual ${livrosSelecionados.includes(livro.id) ? 'card-selecionado-exclusao' : ''}`;
            card.dataset.id = livro.id;

            card.innerHTML = `
                <div class="capa-container">
                    <img class="capa-livro" src="${livro.capa || 'img/capapadrao.jpg'}" alt="Capa do Livro" loading="lazy">
                    <div class="menu-categorias-capa">
                        <button class="btn-cat cat-lendo ${livro.categoria === 'lendo' ? 'selecionado' : ''}" title="Lendo" data-cat="lendo">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                        </button>
                        
                        <button class="btn-cat cat-relendo ${livro.categoria === 'relendo' ? 'selecionado' : ''}" title="Relendo" data-cat="relendo">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                        
                        <button class="btn-cat cat-quero-ler ${livro.categoria === 'quero-ler' ? 'selecionado' : ''}" title="Quero Ler" data-cat="quero-ler">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        
                        <button class="btn-cat cat-finalizados ${livro.categoria === 'finalizados' ? 'selecionado' : ''}" title="Finalizados" data-cat="finalizados">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                        
                        <button class="btn-cat cat-abandonados ${livro.categoria === 'abandonados' ? 'selecionado' : ''}" title="Abandonados" data-cat="abandonados">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        
                        <button class="btn-cat cat-favoritos ${livro.favorito ? 'selecionado' : ''}" title="Favoritos" data-cat="favoritos">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        </button>
                    </div>
                </div>
                <div class="card-info">
                    <h3 class="titulo">${livro.titulo}</h3>
                    <p class="autor" style="font-size: 11px; margin: 0; color: #5d5d6e;">${livro.autor || 'Autor Desconhecido'}</p>
                </div>
            `;

            // Clique no card (Abre edição ou seleciona para exclusão)
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-cat')) return;

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
                    
                    if (novaCat === 'favoritos') {
                        livro.favorito = !livro.favorito;
                    } else {
                        livro.categoria = livro.categoria === novaCat ? 'todos' : novaCat;
                    }
                    
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
    // 4. CRIAR NOVO LIVRO (Modificado para sincronizar com IndexedDB)
    // ==========================================================================
    window.criarNovoCardNoApp = function(titulo, formato, idNovo) {
        const novoLivro = {
            id: idNovo, // Recebe o ID único gerado no evento de upload
            titulo: titulo,
            autor: '',
            formato: formato,
            categoria: 'todos',
            capa: 'img/capapadrao.jpg',
            lidoRecentemente: false,
            favorito: false
            // O conteúdo textual bruto não é mais salvo aqui para economizar o localStorage
        };

        meusLivros.push(novoLivro);
        salvarDados();
        
        const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
        renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
    };

    // ==========================================================================
    // 5. CONTROLE DO MENU FLUTUANTE BOTÃO (+) E LEITURA DE ARQUIVO (IndexedDB)
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

                // Cria o ID único que vai ligar o item do LocalStorage ao arquivo do IndexedDB
                const idNovo = Date.now().toString(); 

                // Abre o banco IndexedDB e guarda o arquivo binário bruto (Blob) do PDF/EPUB
                const req = indexedDB.open("BibliotecaArquivos", 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction("arquivos", "readwrite");
                    const store = tx.objectStore("arquivos");
                    
                    store.put(arquivoSelecionado, idNovo); // Salva o arquivo inteiro de forma segura
                    
                    tx.oncomplete = () => {
                        // Só cria o card visual na tela após o arquivo terminar de ser salvo
                        window.criarNovoCardNoApp(tituloDoLivro, extensao, idNovo);
                    };
                };
                
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
    // 7. MODO DE EXCLUSÃO (Modificado para limpar também o IndexedDB)
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
                const correspondeCategoria = catAtiva === 'todos' || 
                                             (catAtiva === 'favoritos' ? livro.favorito === true : livro.categoria === catAtiva);
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
                const correspondeCategoria = catAtiva === 'todos' || 
                                             (catAtiva === 'favoritos' ? l.favorito === true : l.categoria === catAtiva);
                return correspondeCategoria && 
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
                
                // Abre o IndexedDB para apagar também os arquivos reais pesados associados
                const req = indexedDB.open("BibliotecaArquivos", 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction("arquivos", "readwrite");
                    const store = tx.objectStore("arquivos");
                    
                    // Remove cada arquivo do IndexedDB
                    livrosSelecionados.forEach(id => {
                        store.delete(id);
                    });
                    
                    tx.oncomplete = () => {
                        // Só limpa o LocalStorage e atualiza a interface após apagar do IndexedDB
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
                    };
                };
            }
        });
    }

    // ==========================================================================
    // 8. CONTROLE DO MODAL DE EDIÇÃO E DIREÇÃO PARA LEITURA
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

    // Ao clicar na capa dentro do modal, abre a página de leitura passando o id do livro
    if (modalCapaImg) {
        modalCapaImg.style.cursor = 'pointer';
        modalCapaImg.title = 'Clique na capa para abrir o leitor';
        modalCapaImg.addEventListener('click', () => {
            if (livroSendoEditadoId) {
                window.location.href = `leitor.html?id=${livroSendoEditadoId}`;
            }
        });
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