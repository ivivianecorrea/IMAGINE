function executarLeitor() {
    console.log("Leitor iniciado.");

    const params = new URLSearchParams(window.location.search);
    const idLivro = params.get("id");

    const container = document.getElementById("conteudo-livro");
    const titulo = document.getElementById("leitor-titulo");

    if (!container) {
        console.error("Container não encontrado.");
        return;
    }

    // Verifica se um ID foi passado na URL
    if (!idLivro) {
        mostrarErro("Nenhum livro selecionado.");
        return;
    }

    // Busca as informações do livro no LocalStorage
    const biblioteca = JSON.parse(localStorage.getItem("minhaBiblioteca")) || [];
    const livro = biblioteca.find(l => l.id === idLivro);

    if (!livro) {
        mostrarErro("Livro não encontrado.");
        return;
    }

    // Atualiza o título da página
    document.title = livro.titulo;
    if (titulo) {
        titulo.textContent = livro.titulo;
    }

    // Verifica se a biblioteca do EPUB carregou corretamente no HTML
    if (livro.formato === "epub" && typeof ePub === "undefined") {
        mostrarErro("EPUB.js não foi carregado.");
        console.error("ePub is not defined");
        return;
    }

    // Abre o cofre de arquivos grandes (IndexedDB)
    const request = indexedDB.open("BibliotecaArquivos", 1);

    request.onerror = () => {
        mostrarErro("Erro ao abrir base de dados.");
    };

    request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction("arquivos", "readonly");
        const store = transaction.objectStore("arquivos");
        
        // Pede para o banco de dados devolver o arquivo cru associado a este ID
        const getReq = store.get(idLivro);

        getReq.onerror = () => {
            mostrarErro("Erro ao extrair o arquivo do banco de dados.");
        };

        getReq.onsuccess = () => {
            try {
                const blob = getReq.result;
                console.log("Arquivo encontrado:", blob);

                if (!blob || blob.size === 0) {
                    throw new Error("Arquivo inválido ou vazio.");
                }

                // Limpa a mensagem de "A processar..."
                container.innerHTML = "";

                // ==================================================
                // Processamento de PDF
                // ==================================================
                if (livro.formato === "pdf") {
                    const url = URL.createObjectURL(blob);
                    
                    // O SEGREDO ESTÁ AQUI: Adicionamos #toolbar=0&navpanes=0 na URL
                    // Isso diz ao navegador para esconder os botões e painéis laterais
                    container.innerHTML = `
                        <iframe
                            src="${url}#toolbar=0&navpanes=0"
                            style="width:100%; height:100%; border:none;">
                        </iframe>
                    `;
                    return; // Encerra a função aqui se for um PDF
                }

                // ==================================================
                // Processamento de EPUB
                // ==================================================
                if (livro.formato === "epub") {
                    console.log("Processando EPUB...");
                    const reader = new FileReader();

                    // Instrução 1: O que fazer se der erro
                    reader.onerror = () => {
                        mostrarErro("Erro ao ler o arquivo EPUB.");
                    };

                    // Instrução 2: O que fazer quando terminar de ler
                    reader.onload = function(e) {
                        try {
                            const arrayBuffer = e.target.result;
                            console.log("ArrayBuffer carregado com sucesso.");
                            
                            const book = ePub(arrayBuffer);
                            const rendition = book.renderTo("conteudo-livro", {
                                width: "100%",
                                height: "100%",
                                flow: "scrolled",
                                manager: "continuous",
                                spread: "none",
                                allowScriptedContent: true
                            });

                            rendition.display();

                            setTimeout(() => {
                                const iframes = container.querySelectorAll("iframe");
                                iframes.forEach((iframe) => {
                                    iframe.setAttribute(
                                        "sandbox",
                                        "allow-same-origin allow-scripts allow-popups allow-forms"
                                    );
                                });
                            }, 1000);

                        } catch(err) {
                            console.error(err);
                            mostrarErro(err.message);
                        }
                    };

                    // O Comando de Ação: Inicia a leitura do arquivo cru (blob)
                    reader.readAsArrayBuffer(blob);
                    return; // Encerra a função aqui se for um EPUB
                }

                // ==================================================
                // Formato desconhecido (Se não entrou em nenhum dos IFs acima)
                // ==================================================
                throw new Error(`Formato não suportado: ${livro.formato}`);

            } catch(err) {
                console.error(err);
                mostrarErro(err.message);
            }
        };
    };
}

// Mostra o erro de forma visual dentro do container de leitura
function mostrarErro(msg) {
    console.error(msg);
    const container = document.getElementById("conteudo-livro");
    if (container) {
        container.innerHTML = `
            <div style="padding:30px; color:red; font-size:18px; font-family:sans-serif;">
                ${msg}
            </div>
        `;
    }
}

// Inicia o programa assim que a página terminar de carregar
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", executarLeitor);
} else {
    executarLeitor();
}