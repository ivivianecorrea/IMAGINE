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

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

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
    const inputPasta = document.getElementById('input-pasta');  // NOVO
    const buscaInput = document.querySelector('.busca');
    const formBusca = document.querySelector('.formb');
    const botoesCategoria = document.querySelectorAll('.categoria-item');

    // Filtros
    const btnFiltro = document.getElementById('btn-filtro');
    const balaoFiltro = document.getElementById('balao-filtro');
    const opcoesFiltro = document.querySelectorAll('.opcao-filtro');
    let ordenacaoAtual = 'padrao';

    // Elementos do Modal de Edição
    const modalEdicao = document.getElementById('modal-edicao-livro');
    const btnFecharModalEdicao = document.getElementById('btn-fechar-modal-livro');
    const btnSalvarModalEdicao = document.getElementById('btn-salvar-modal-livro');
    const modalInputTitulo = document.getElementById('modal-input-titulo');
    const modalInputAutor = document.getElementById('modal-input-autor');
    const modalCapaImg = document.getElementById('modal-capa-livro');
    let livroSendoEditadoId = null;

    // ==========================================================================
    // 3. FUNÇÃO REUTILIZÁVEL PARA ADICIONAR UM ARQUIVO (PDF/EPUB)
    // ==========================================================================
    async function adicionarLivroPorArquivo(arquivo, idUnico) {
        return new Promise(async (resolve, reject) => {
            const extensao = arquivo.name.split('.').pop().toLowerCase();
            let capaBase64 = 'img/capapadrao.jpg';

            // Extrair capa
            try {
                if (extensao === 'pdf') {
                    const arrayBuffer = await arquivo.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 0.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                    capaBase64 = canvas.toDataURL('image/jpeg');
                } 
                else if (extensao === 'epub') {
                    const arrayBuffer = await arquivo.arrayBuffer();
                    const book = ePub(arrayBuffer);
                    let coverUrl = await book.coverUrl();
                    if (!coverUrl) {
                        await book.ready;
                        const coverItem = book.resources.replacementUrls.find(url => 
                            url.includes('cover') || url.includes('Capa') || url.includes('capa')
                        );
                        if (coverItem) coverUrl = coverItem;
                        else {
                            const firstImage = book.resources.replacementUrls.find(url => 
                                url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png')
                            );
                            if (firstImage) coverUrl = firstImage;
                        }
                    }
                    if (coverUrl) {
                        const resposta = await fetch(coverUrl);
                        const blob = await resposta.blob();
                        capaBase64 = await new Promise((resolve) => {
                            const leitor = new FileReader();
                            leitor.onloadend = () => resolve(leitor.result);
                            leitor.readAsDataURL(blob);
                        });
                    }
                }
            } catch (err) {
                console.warn("Erro ao extrair capa de", arquivo.name, err);
            }

            // Salvar no IndexedDB
            const reqDB = indexedDB.open("BibliotecaArquivos", 1);
            reqDB.onsuccess = (eventoDB) => {
                const db = eventoDB.target.result;
                const tx = db.transaction("arquivos", "readwrite");
                tx.objectStore("arquivos").put(arquivo, idUnico);
                tx.oncomplete = () => {
                    const novoLivro = {
                        id: idUnico,
                        titulo: arquivo.name.replace(/\.[^/.]+$/, ""),
                        autor: '',
                        formato: extensao,
                        categoria: 'todos',
                        capa: capaBase64,
                        lidoRecentemente: false,
                        favorito: false
                    };
                    resolve(novoLivro);
                };
                tx.onerror = (e) => reject(e);
            };
            reqDB.onerror = (e) => reject(e);
        });
    }

    // ==========================================================================
    // 4. RENDERIZAÇÃO INTERNA OTIMIZADA
    // ==========================================================================
    function renderizarBiblioteca(categoriaFiltro = 'todos', termoBusca = '') {
        if (!containerCardsC) return;
        
        containerCardsC.innerHTML = '';
        if (containerCardsR) {
            containerCardsR.innerHTML = '';
        }

        const termoMin = termoBusca.toLowerCase().trim();

        const livrosFiltrados = meusLivros.filter(livro => {
            const correspondeCategoria = categoriaFiltro === 'todos' || 
                                         (categoriaFiltro === 'favoritos' ? livro.favorito === true : livro.categoria === categoriaFiltro);
            const correspondeBusca = livro.titulo.toLowerCase().includes(termoMin) || 
                                     (livro.autor && livro.autor.toLowerCase().includes(termoMin));
            return correspondeCategoria && correspondeBusca;
        });

        if (ordenacaoAtual === 'az') {
            livrosFiltrados.sort((a, b) => a.titulo.localeCompare(b.titulo));
        } else if (ordenacaoAtual === 'za') {
            livrosFiltrados.sort((a, b) => b.titulo.localeCompare(a.titulo));
        }
        
        if (containerCardsR) {
            const templateRecente = document.getElementById('template-card-recente');
            const ultimosRecentes = meusLivros
                .filter(livro => livro.lidoRecentemente === true)
                .reverse()
                .slice(0, 4); 

            ultimosRecentes.forEach(livro => {
                const clone = templateRecente.content.cloneNode(true);
                const cardR = clone.querySelector('.card');
                cardR.querySelector('.card-recente-capa').src = livro.capa || 'img/capapadrao.jpg';
                cardR.querySelector('.card-recente-titulo').textContent = livro.titulo;
                cardR.querySelector('.card-recente-autor').textContent = livro.autor || 'Desconhecido';
                cardR.addEventListener('click', () => {
                    window.open(`leitor.html?id=${livro.id}`, '_blank');
                });
                containerCardsR.appendChild(cardR);
            });
        }
        
        const templatePrincipal = document.getElementById('template-card-principal');
        
        livrosFiltrados.forEach(livro => {
            const clone = templatePrincipal.content.cloneNode(true);
            const card = clone.querySelector('.card');
            card.dataset.id = livro.id;
            
            if (livrosSelecionados.includes(livro.id)) {
                card.classList.add('card-selecionado-exclusao');
            }

            card.querySelector('.capa-livro').src = livro.capa || 'img/capapadrao.jpg';
            card.querySelector('.titulo').textContent = livro.titulo;
            card.querySelector('.card-principal-autor').textContent = livro.autor || 'Autor Desconhecido';

            const botoesCatCapa = card.querySelectorAll('.btn-cat');
            botoesCatCapa.forEach(btn => {
                const catDoBotao = btn.dataset.cat;
                if ((catDoBotao === 'favoritos' && livro.favorito) || 
                    (catDoBotao !== 'favoritos' && livro.categoria === catDoBotao)) {
                    btn.classList.add('selecionado');
                }
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

            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-cat')) return;
                if (modoExclusaoAtivo) {
                    toggleSelecaoLivro(livro.id, card);
                } else {
                    abrirModalEdicao(livro);
                }
            });

            containerCardsC.appendChild(card);
        });
    }

    function salvarDados() {
        localStorage.setItem('minhaBiblioteca', JSON.stringify(meusLivros));
    }

    // ==========================================================================
    // 5. EVENTO PARA ADICIONAR ARQUIVO ÚNICO (mantido)
    // ==========================================================================
    if (inputArquivo) {
        inputArquivo.addEventListener('change', async (e) => {
            const arquivo = e.target.files[0];
            if (!arquivo) return;
            const idNovo = Date.now().toString();
            try {
                const novoLivro = await adicionarLivroPorArquivo(arquivo, idNovo);
                meusLivros.unshift(novoLivro);
                salvarDados();
                renderizarBiblioteca();
            } catch (err) {
                console.error("Erro ao adicionar arquivo:", err);
                alert("Falha ao adicionar o arquivo.");
            }
            inputArquivo.value = '';
        });
    }

    // ==========================================================================
    // 6. ESCANEAMENTO DE PASTA (vários arquivos)
    // ==========================================================================
    if (inputPasta) {
        inputPasta.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const arquivosLivros = files.filter(file => {
                const ext = file.name.split('.').pop().toLowerCase();
                return ext === 'pdf' || ext === 'epub';
            });

            if (arquivosLivros.length === 0) {
                alert("Nenhum arquivo PDF ou EPUB encontrado nesta pasta.");
                return;
            }

            // Desabilitar o botão durante o processo (opcional)
            const escanearBtn = document.getElementById('escanear');
            if (escanearBtn) escanearBtn.style.pointerEvents = 'none';
            
            let contador = 0;
            for (const arquivo of arquivosLivros) {
                const idUnico = Date.now() + '_' + contador + '_' + Math.random().toString(36).substr(2, 5);
                try {
                    const novoLivro = await adicionarLivroPorArquivo(arquivo, idUnico);
                    meusLivros.unshift(novoLivro);
                    salvarDados();
                    // Re-renderiza a cada adição (ou pode fazer apenas no final)
                    renderizarBiblioteca();
                    contador++;
                } catch (err) {
                    console.error("Erro ao adicionar", arquivo.name, err);
                }
            }
            
            if (escanearBtn) escanearBtn.style.pointerEvents = 'auto';
            alert(`${contador} livro(s) adicionado(s) com sucesso!`);
            inputPasta.value = ''; // limpa para permitir nova seleção
        });
    }

    // ==========================================================================
    // 7. EVENTOS DE MENU, FILTROS E LIXEIRA
    // ==========================================================================
    if (btnMais) {
        btnMais.addEventListener('click', (evento) => {
            evento.stopPropagation();
            const estaoAbertos = btnAdicionar.style.display === 'block';
            if (btnAdicionar) btnAdicionar.style.display = estaoAbertos ? 'none' : 'block';
            if (btnEscanear) btnEscanear.style.display = estaoAbertos ? 'none' : 'block';
        });
    }

    // Ações do Filtro Dropdown (igual ao original)
    if (btnFiltro && balaoFiltro) {
        btnFiltro.addEventListener('click', (e) => {
            e.stopPropagation(); 
            balaoFiltro.classList.toggle('visivel');
        });

        document.addEventListener('click', (e) => {
            if (!balaoFiltro.contains(e.target) && e.target !== btnFiltro) {
                balaoFiltro.classList.remove('visivel');
            }
        });

        opcoesFiltro.forEach(opcao => {
            opcao.addEventListener('click', () => {
                opcoesFiltro.forEach(opt => opt.classList.remove('ativa'));
                opcao.classList.add('ativa');
                ordenacaoAtual = opcao.dataset.ordem;
                balaoFiltro.classList.remove('visivel');
                const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
            });
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

    // Escanear dispositivo: abrir seletor de pasta
    if (btnEscanear && inputPasta) {
        btnEscanear.addEventListener('click', (evento) => {
            evento.stopPropagation();
            inputPasta.click();
        });
    }

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
    // 8. MODO DE EXCLUSÃO (mantido igual)
    // ==========================================================================
    const containerAcoesLixeira = document.getElementById('container-acoes-lixeira');
    const btnSelecionarTudo = document.getElementById('btn-selecionar-tudo');

    if (btnLixeiraSecao) {
    btnLixeiraSecao.addEventListener('click', () => {
        modoExclusaoAtivo = !modoExclusaoAtivo;
        livrosSelecionados = [];

        if (modoExclusaoAtivo) {
            // Modo ativo: aplica estilo inline apenas para destacar (opcional)
            btnLixeiraSecao.style.color = '#c62222';
            btnLixeiraSecao.style.backgroundColor = 'transparent';
            if (containerAcoesLixeira) containerAcoesLixeira.style.display = 'flex';
            if (btnSelecionarTudo) btnSelecionarTudo.textContent = 'Selecionar Tudo';
        } else {
            // Remove os estilos inline para voltar ao CSS original
            btnLixeiraSecao.style.color = '';
            btnLixeiraSecao.style.backgroundColor = '';
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
                const req = indexedDB.open("BibliotecaArquivos", 1);
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction("arquivos", "readwrite");
                    const store = tx.objectStore("arquivos");
                    livrosSelecionados.forEach(id => store.delete(id));
                    tx.oncomplete = () => {
                        meusLivros = meusLivros.filter(livro => !livrosSelecionados.includes(livro.id));
                        salvarDados();
                        livrosSelecionados = [];
                        modoExclusaoAtivo = false;
                        if (containerAcoesLixeira) containerAcoesLixeira.style.display = 'none';
                       if (btnLixeiraSecao) {
    btnLixeiraSecao.style.color = '';
    btnLixeiraSecao.style.backgroundColor = '';
}
                        const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                        renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
                    };
                };
            }
        });
    }

    // ==========================================================================
    // 9. CONTROLE DO MODAL DE EDIÇÃO E DIREÇÃO PARA LEITURA (igual)
    // ==========================================================================
    function abrirModalEdicao(livro) {
        if (!modalEdicao) return;
        livroSendoEditadoId = livro.id; 
        modalInputTitulo.value = livro.titulo;
        modalInputAutor.value = livro.autor || '';
        modalCapaImg.src = livro.capa || 'img/capapadrao.jpg';
        
        if (btnFecharModalEdicao) {
            btnFecharModalEdicao.onclick = () => {
                modalEdicao.style.display = 'none';
            };
        }

        if (btnSalvarModalEdicao) {
            btnSalvarModalEdicao.onclick = () => {
                const livroEditando = meusLivros.find(l => l.id === livroSendoEditadoId);
                if (livroEditando) {
                    livroEditando.titulo = document.getElementById('modal-input-titulo').value.trim() || livroEditando.titulo;
                    livroEditando.autor = document.getElementById('modal-input-autor').value.trim();
                    salvarDados();
                    const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
                    renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
                }
                modalEdicao.style.display = 'none';
            };
        }

        modalEdicao.onclick = (evento) => {
            if (evento.target === modalEdicao) {
                modalEdicao.style.display = 'none';
            }
        };

        if (!livro.lidoRecentemente) {
            livro.lidoRecentemente = true;
            salvarDados();
            const catAtiva = document.querySelector('.categoria-item.ativo')?.dataset.categoria || 'todos';
            renderizarBiblioteca(catAtiva, buscaInput ? buscaInput.value : '');
        }

        modalEdicao.style.display = 'flex';
    }

    if (modalCapaImg) {
        modalCapaImg.style.cursor = 'pointer';
        modalCapaImg.title = 'Clique na capa para abrir o leitor';
        modalCapaImg.onclick = () => {
            if (livroSendoEditadoId) {
                let listaRecentes = JSON.parse(localStorage.getItem('cardsR')) || [];
                if (!listaRecentes.includes(livroSendoEditadoId)) {
                    listaRecentes.unshift(livroSendoEditadoId); 
                    if (listaRecentes.length > 5) listaRecentes.pop();
                    localStorage.setItem('cardsR', JSON.stringify(listaRecentes));
                }
                window.open(`leitor.html?id=${livroSendoEditadoId}`, '_blank');
            }
        };
    }

    renderizarBiblioteca();
});

// ==========================================================================
// CONTROLE DE MODO CLARO / ESCURO (PERSISTENTE) - mantido igual
// ==========================================================================
const btnTema = document.getElementById('btn-tema');
const iconLua = document.querySelector('.icon-lua');
const iconSol = document.querySelector('.icon-sol');

const temaSalvo = localStorage.getItem('tema') || 'claro';
if (temaSalvo === 'escuro') {
    document.body.classList.add('dark-mode');
    if (iconLua) iconLua.style.display = 'none';
    if (iconSol) iconSol.style.display = 'block';
}

if (btnTema) {
    btnTema.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const modoEscuroAtivo = document.body.classList.contains('dark-mode');
        localStorage.setItem('tema', modoEscuroAtivo ? 'escuro' : 'claro');
        if (modoEscuroAtivo) {
            iconLua.style.display = 'none';
            iconSol.style.display = 'block';
        } else {
            iconLua.style.display = 'block';
            iconSol.style.display = 'none';
        }
    });
}