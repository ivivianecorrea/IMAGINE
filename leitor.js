let currentRendition = null;
let isPDF = false;
let pdfDoc = null;
let pdfPagesData = [];
let totalPages = 0;
let menusVisiveis = true;
let primeiraVez = true;
let preferencias = {
    bgCor: "#f2e9c8",
    textoCor: "#1c2351",
    fonte: "'roboto-medium', sans-serif",
    tamanho: 16,
    paragrafo: 16,
    letterSpacing: 0
};

function carregarPreferencias() {
    const salvas = localStorage.getItem("leitor_personalizacao");
    if (salvas) {
        try {
            const parsed = JSON.parse(salvas);
            preferencias = { ...preferencias, ...parsed };
        } catch(e) {}
    }
    aplicarPreferencias();
}

function salvarPreferencias() {
    localStorage.setItem("leitor_personalizacao", JSON.stringify(preferencias));
}

function gerarCSSepub() {
    return `
        body {
            background-color: ${preferencias.bgCor} !important;
            color: ${preferencias.textoCor} !important;
            font-family: ${preferencias.fonte} !important;
            font-size: ${preferencias.tamanho}px !important;
            letter-spacing: ${preferencias.letterSpacing}px !important;
            margin: 0 auto !important;
            max-width: 100% !important;
            padding: 20px !important;
        }
        p, div, section {
            margin-bottom: ${preferencias.paragrafo}px !important;
        }
        img {
            max-width: 100% !important;
            height: auto !important;
        }
    `;
}

function aplicarCSSnoIframe() {
    if (!currentRendition) return;
    const iframes = document.querySelectorAll("#conteudo-livro iframe");
    iframes.forEach(iframe => {
        try {
            const doc = iframe.contentDocument;
            if (doc && doc.head) {
                let style = doc.getElementById("custom-style");
                if (!style) {
                    style = doc.createElement("style");
                    style.id = "custom-style";
                    doc.head.appendChild(style);
                }
                style.textContent = gerarCSSepub();
            }
        } catch(e) { console.warn("Não foi possível acessar o iframe", e); }
    });
}

function aplicarPreferencias() {
    const container = document.getElementById("conteudo-livro");
    if (container) {
        container.style.backgroundColor = preferencias.bgCor;
        container.style.color = preferencias.textoCor;
    }
    if (!isPDF) {
        aplicarCSSnoIframe();
    }
}

async function renderPDFAllPages() {
    const container = document.getElementById("conteudo-livro");
    if (!pdfDoc) return;
    container.innerHTML = "";
    const containerWidth = container.clientWidth - 40;
    let pagesHeight = 0;
    pdfPagesData = [];
    for (let i = 1; i <= totalPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale: scale });
        const canvas = document.createElement("canvas");
        canvas.height = scaledViewport.height;
        canvas.width = scaledViewport.width;
        canvas.style.display = "block";
        canvas.className = "pdf-page";
        const context = canvas.getContext("2d");
        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        container.appendChild(canvas);
        pdfPagesData.push({
            top: pagesHeight,
            bottom: pagesHeight + canvas.height,
            pageNum: i
        });
        pagesHeight += canvas.height + 20;
    }
    // Aguarda o próximo frame para garantir layout calculado
    await new Promise(resolve => requestAnimationFrame(resolve));
    container.addEventListener("scroll", atualizarProgressoPorScroll);
    configurarBarraProgresso();
    atualizarProgressoPorScroll();
}

function configurarBarraProgresso() {
    const slider = document.getElementById("progresso-slider");
    if (!slider) return;
    const handler = (e) => {
        const progresso = parseFloat(e.target.value) / 100;
        const container = document.getElementById("conteudo-livro");
        const scrollHeight = container.scrollHeight - container.clientHeight;
        container.scrollTop = progresso * scrollHeight;
    };
    slider.removeEventListener("input", handler);
    slider.addEventListener("input", handler);
}

function atualizarProgressoPorScroll() {
    const slider = document.getElementById("progresso-slider");
    const spanAtual = document.getElementById("pagina-atual");
    const spanTotal = document.getElementById("pagina-total");
    const tooltip = document.getElementById("tooltip-porcentagem");
    if (!slider) return;

    const container = document.getElementById("conteudo-livro");
    if (!container) return;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    const progresso = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    slider.value = progresso * 100;
    tooltip.innerText = Math.round(progresso * 100) + "%";

    if (isPDF && pdfPagesData && pdfPagesData.length > 0) {
        let pagina = 1;
        for (let i = 0; i < pdfPagesData.length; i++) {
            if (scrollTop >= pdfPagesData[i].top - 50) {
                pagina = pdfPagesData[i].pageNum;
            } else {
                break;
            }
        }
        if (pagina < 1) pagina = 1;
        if (pagina > totalPages) pagina = totalPages;
        spanAtual.innerText = pagina;
        spanTotal.innerText = totalPages;
    } else {
        spanAtual.innerText = Math.round(progresso * 100);
        spanTotal.innerText = "100";
    }
}

function iniciarEPUB(blob) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        const book = ePub(arrayBuffer);
        const rendition = book.renderTo("conteudo-livro", {
            width: "100%",
            height: "100%",
            flow: "scrolled",
            manager: "continuous",
            spread: "none"
        });
        currentRendition = rendition;
        rendition.display().then(() => {
            // Tenta injetar CSS e configurar barra de progresso
            const checkInterval = setInterval(() => {
                const iframe = document.querySelector("#conteudo-livro iframe");
                if (iframe && iframe.contentDocument) {
                    clearInterval(checkInterval);
                    aplicarCSSnoIframe();
                    const container = document.getElementById("conteudo-livro");
                    container.addEventListener("scroll", atualizarProgressoPorScroll);
                    configurarBarraProgresso();
                    atualizarProgressoPorScroll();
                    rendition.on("relocated", () => aplicarCSSnoIframe());
                }
            }, 500);
        }).catch(console.warn);
        carregarSumarioEpub(book);
    };
    reader.readAsArrayBuffer(blob);
}

function carregarSumarioEpub(book) {
    book.loaded.navigation.then((nav) => {
        const lista = document.getElementById("lista-sumario");
        if (!lista) return;
        lista.innerHTML = "";
        if (!nav.toc || nav.toc.length === 0) {
            lista.innerHTML = "<li>Nenhum capítulo encontrado.</li>";
            return;
        }
        function adicionarItens(itens, nivel = 0) {
            itens.forEach(item => {
                const li = document.createElement("li");
                li.textContent = item.label;
                li.style.paddingLeft = (nivel * 16) + 16 + "px";
                li.title = item.label;
                li.addEventListener("click", (e) => {
                    e.stopPropagation();
                    if (item.href) {
                        currentRendition.display(item.href).catch(console.warn);
                        setTimeout(() => {
                            const container = document.getElementById("conteudo-livro");
                            if (container) container.scrollTop = 0;
                        }, 100);
                        document.getElementById("sidebar-sumario")?.classList.remove("aberta");
                    }
                });
                lista.appendChild(li);
                if (item.subitems && item.subitems.length) adicionarItens(item.subitems, nivel + 1);
            });
        }
        adicionarItens(nav.toc);
    }).catch(err => {
        console.warn("Erro ao carregar sumário EPUB:", err);
        document.getElementById("lista-sumario").innerHTML = "<li>Sumário não disponível.</li>";
    });
}

async function extrairSumarioPDF(blob) {
    const lista = document.getElementById("lista-sumario");
    if (!lista) return;
    try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const outline = await pdf.getOutline();
        lista.innerHTML = "";
        if (!outline || outline.length === 0) {
            lista.innerHTML = "<li>Nenhum índice encontrado neste PDF.</li>";
            return;
        }
        
        async function getPageNumberFromDest(dest) {
            if (!dest) return null;
            if (typeof dest === 'number') return dest;
            try {
                const destRef = Array.isArray(dest) ? dest[0] : dest;
                const pageIndex = await pdf.getPageIndex(destRef);
                return pageIndex + 1;
            } catch(e) {
                if (Array.isArray(dest) && typeof dest[0] === 'number') return dest[0];
                console.warn("Não foi possível resolver destino", dest);
                return null;
            }
        }
        
        function adicionarItensPDF(itens, nivel = 0) {
            itens.forEach(item => {
                const li = document.createElement("li");
                li.textContent = item.title;
                li.style.paddingLeft = (nivel * 16) + 16 + "px";
                li.style.cursor = "pointer";
                li.title = `Ir para página ${item.dest ? (Array.isArray(item.dest) ? item.dest[0] : item.dest) : '?'}`;
                li.addEventListener("click", async () => {
                    if (item.dest) {
                        const pageNum = await getPageNumberFromDest(item.dest);
                        if (pageNum && pdfPagesData[pageNum - 1]) {
                            const container = document.getElementById("conteudo-livro");
                            container.scrollTo({
                                top: pdfPagesData[pageNum - 1].top,
                                behavior: "smooth"
                            });
                        } else {
                            alert(`Não foi possível ir para a página ${pageNum || 'destino'}.`);
                        }
                    } else {
                        alert("Destino não encontrado para este item.");
                    }
                    document.getElementById("sidebar-sumario")?.classList.remove("aberta");
                });
                lista.appendChild(li);
                if (item.items && item.items.length) adicionarItensPDF(item.items, nivel + 1);
            });
        }
        adicionarItensPDF(outline);
    } catch (err) {
        console.warn("Erro ao extrair outline do PDF:", err);
        lista.innerHTML = "<li>Não foi possível carregar o sumário do PDF.</li>";
    }
}

function inicializarPersonalizacao() {
    const sidebar = document.getElementById("sidebar-personalizacao");
    const btnPersonalizar = document.getElementById("btn-personalizar");
    const btnFecharPers = document.getElementById("fechar-personalizacao");
    const sidebarSumario = document.getElementById("sidebar-sumario");

    function togglePersonalizacao() {
        sidebar.classList.toggle("aberta");
        if (sidebar.classList.contains("aberta") && sidebarSumario.classList.contains("aberta")) {
            sidebarSumario.classList.remove("aberta");
        }
    }
    function fecharPersonalizacao() { sidebar.classList.remove("aberta"); }
    if (btnPersonalizar) btnPersonalizar.addEventListener("click", togglePersonalizacao);
    if (btnFecharPers) btnFecharPers.addEventListener("click", fecharPersonalizacao);
    document.addEventListener("click", (e) => {
        if (sidebar.classList.contains("aberta") && !sidebar.contains(e.target) && e.target !== btnPersonalizar && !btnPersonalizar.contains(e.target))
            fecharPersonalizacao();
    });

    const bgCorInput = document.getElementById("bg-cor");
    const textoCorInput = document.getElementById("texto-cor");
    const fonteSelect = document.getElementById("fonte-select");
    const tamanhoRange = document.getElementById("tamanho-range");
    const tamanhoValor = document.getElementById("tamanho-valor");
    const paragrafoRange = document.getElementById("paragrafo-range");
    const paragrafoValor = document.getElementById("paragrafo-valor");
    const letterspacingRange = document.getElementById("letterspacing-range");
    const letterspacingValor = document.getElementById("letterspacing-valor");
    const resetBg = document.getElementById("reset-bg");
    const resetTextoCor = document.getElementById("reset-texto-cor");
    const resetTodas = document.getElementById("reset-todas-pers");
    const uploadFonteBtn = document.getElementById("upload-fonte-btn");
    const uploadFonteInput = document.getElementById("upload-fonte-input");

    bgCorInput.value = preferencias.bgCor;
    textoCorInput.value = preferencias.textoCor;
    fonteSelect.value = preferencias.fonte;
    tamanhoRange.value = preferencias.tamanho;
    tamanhoValor.innerText = preferencias.tamanho + "px";
    paragrafoRange.value = preferencias.paragrafo;
    paragrafoValor.innerText = preferencias.paragrafo + "px";
    letterspacingRange.value = preferencias.letterSpacing;
    letterspacingValor.innerText = preferencias.letterSpacing + "px";

    function atualizarPreferencia(chave, valor) {
        preferencias[chave] = valor;
        salvarPreferencias();
        aplicarPreferencias();
    }

    bgCorInput.addEventListener("input", e => atualizarPreferencia("bgCor", e.target.value));
    textoCorInput.addEventListener("input", e => atualizarPreferencia("textoCor", e.target.value));
    fonteSelect.addEventListener("change", e => atualizarPreferencia("fonte", e.target.value));
    tamanhoRange.addEventListener("input", e => {
        tamanhoValor.innerText = e.target.value + "px";
        atualizarPreferencia("tamanho", parseInt(e.target.value));
    });
    paragrafoRange.addEventListener("input", e => {
        paragrafoValor.innerText = e.target.value + "px";
        atualizarPreferencia("paragrafo", parseInt(e.target.value));
    });
    letterspacingRange.addEventListener("input", e => {
        letterspacingValor.innerText = e.target.value + "px";
        atualizarPreferencia("letterSpacing", parseFloat(e.target.value));
    });
    resetBg.addEventListener("click", () => atualizarPreferencia("bgCor", "#f2e9c8"));
    resetTextoCor.addEventListener("click", () => atualizarPreferencia("textoCor", "#1c2351"));
    resetTodas.addEventListener("click", () => {
        preferencias = {
            bgCor: "#f2e9c8",
            textoCor: "#1c2351",
            fonte: "'roboto-medium', sans-serif",
            tamanho: 16,
            paragrafo: 16,
            letterSpacing: 0
        };
        salvarPreferencias();
        aplicarPreferencias();
        bgCorInput.value = preferencias.bgCor;
        textoCorInput.value = preferencias.textoCor;
        fonteSelect.value = preferencias.fonte;
        tamanhoRange.value = preferencias.tamanho;
        tamanhoValor.innerText = preferencias.tamanho + "px";
        paragrafoRange.value = preferencias.paragrafo;
        paragrafoValor.innerText = preferencias.paragrafo + "px";
        letterspacingRange.value = preferencias.letterSpacing;
        letterspacingValor.innerText = preferencias.letterSpacing + "px";
    });

    uploadFonteBtn.addEventListener("click", () => uploadFonteInput.click());
    uploadFonteInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fontName = "customFont_" + Date.now();
        const fontFace = new FontFace(fontName, await file.arrayBuffer());
        await fontFace.load();
        document.fonts.add(fontFace);
        const option = document.createElement("option");
        option.value = `'${fontName}', fallback`;
        option.textContent = file.name;
        fonteSelect.appendChild(option);
        fonteSelect.value = option.value;
        atualizarPreferencia("fonte", option.value);
        uploadFonteInput.value = "";
    });

    document.querySelectorAll('.btn-predef').forEach(btn => {
        btn.addEventListener('click', () => {
            const bg = btn.dataset.bg;
            const texto = btn.dataset.texto;
            atualizarPreferencia("bgCor", bg);
            atualizarPreferencia("textoCor", texto);
            bgCorInput.value = bg;
            textoCorInput.value = texto;
        });
    });
}

function executarLeitor() {
    carregarPreferencias();

    const params = new URLSearchParams(window.location.search);
    const idLivro = params.get("id");
    const container = document.getElementById("conteudo-livro");
    const titulo = document.getElementById("leitor-titulo");

    if (!container) return;
    if (!idLivro) { mostrarErro("Nenhum livro selecionado."); return; }

    const biblioteca = JSON.parse(localStorage.getItem("minhaBiblioteca")) || [];
    const livro = biblioteca.find(l => l.id === idLivro);
    if (!livro) { mostrarErro("Livro não encontrado."); return; }

    document.title = livro.titulo;
    if (titulo) titulo.textContent = livro.titulo;

    const request = indexedDB.open("BibliotecaArquivos", 1);
    request.onerror = () => mostrarErro("Erro ao abrir base de dados.");
    request.onsuccess = async (event) => {
        const db = event.target.result;
        const transaction = db.transaction("arquivos", "readonly");
        const store = transaction.objectStore("arquivos");
        const getReq = store.get(idLivro);
        getReq.onerror = () => mostrarErro("Erro ao extrair o arquivo.");
        getReq.onsuccess = async () => {
            const blob = getReq.result;
            if (!blob || blob.size === 0) { mostrarErro("Arquivo inválido."); return; }
            container.innerHTML = "";

            if (livro.formato === "pdf") {
                isPDF = true;
                const arrayBuffer = await blob.arrayBuffer();
                pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                totalPages = pdfDoc.numPages;
                document.getElementById("pagina-total").innerText = totalPages;
                extrairSumarioPDF(blob);
                await renderPDFAllPages();
                aplicarPreferencias();
                return;
            }

            if (livro.formato === "epub") {
                isPDF = false;
                iniciarEPUB(blob);
                return;
            }
            mostrarErro(`Formato não suportado: ${livro.formato}`);
        };
    };

    const btnSumario = document.getElementById("btn-sumario");
    const sidebarSumario = document.getElementById("sidebar-sumario");
    const fecharSumario = document.getElementById("fechar-sumario");
    function toggleSumario() {
        sidebarSumario.classList.toggle("aberta");
        const sidebarPers = document.getElementById("sidebar-personalizacao");
        if (sidebarPers && sidebarPers.classList.contains("aberta")) sidebarPers.classList.remove("aberta");
    }
    if (btnSumario) btnSumario.addEventListener("click", toggleSumario);
    if (fecharSumario) fecharSumario.addEventListener("click", () => sidebarSumario.classList.remove("aberta"));
    document.addEventListener("click", (e) => {
        if (sidebarSumario.classList.contains("aberta") && !sidebarSumario.contains(e.target) && e.target !== btnSumario && !btnSumario.contains(e.target)) {
            sidebarSumario.classList.remove("aberta");
        }
    });

    inicializarPersonalizacao();
}

function mostrarErro(msg) {
    console.error(msg);
    const container = document.getElementById("conteudo-livro");
    if (container) container.innerHTML = `<div style="padding:30px; color:red; font-family:sans-serif;">${msg}</div>`;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", executarLeitor);
} else {
    executarLeitor();
}

// ========== MOSTRAR/OCULTAR MENUS AO CLICAR NO CENTRO ==========
window.addEventListener('load', function() {
    const areaConteudo = document.getElementById('conteudo-livro');
    const dicaElement = document.getElementById('dica-clique');
    
    if (!areaConteudo) return;
    
    let menusVisiveis = true;
    
    function toggleMenus() {
        const body = document.body;
        if (menusVisiveis) {
            body.classList.add('menu-oculto');
            menusVisiveis = false;
        } else {
            body.classList.remove('menu-oculto');
            menusVisiveis = true;
        }
    }
    
    const jaMostrouDica = localStorage.getItem('leitor_mostrou_dica');
    if (!jaMostrouDica && dicaElement) {
        dicaElement.style.display = 'flex';
        localStorage.setItem('leitor_mostrou_dica', 'true');
        dicaElement.addEventListener('click', () => {
            dicaElement.style.display = 'none';
            toggleMenus();
        });
    } else {
        if (dicaElement) dicaElement.style.display = 'none';
    }
    
    areaConteudo.addEventListener('click', (e) => {
        if (dicaElement && dicaElement.style.display === 'flex') return;
        toggleMenus();
    });
    
    const elementosQueNaoOcultam = document.querySelectorAll('.barra-topo, .footer-leitor, .sidebar-sumario, .sidebar-personalizacao, .btn-voltar, .btn-sumario, .btn-personalizar, .fechar-sumario, .fechar-personalizacao');
    elementosQueNaoOcultam.forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
});