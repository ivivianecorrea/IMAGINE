// 🔎 SISTEMA DE BUSCA DA COMUNIDADE (EXPLORAR)
// 1. SELEÇÃO DE ELEMENTOS
// Seleciona o campo de entrada de texto (input) dentro da caixa de busca
const campoBuscaExplorar = document.querySelector('.caixa-busca-explorar input');
// 2. OUVINTE DE EVENTO (EVENT LISTENER)
// Fica vigiando o campo. Sempre que o usuário digitar ou apagar algo, a função roda
campoBuscaExplorar.addEventListener('input', function() {
    // Pega o texto digitado e transforma tudo em letras minúsculas
    // Isso evita problemas se o usuário digitar "duna" e o livro estiver como "Duna"
    const termoBuscado = campoBuscaExplorar.value.toLowerCase().trim();
    // Seleciona todos os cards de livros que estão na seção "Em Alta"
    const cardsExplorar = document.querySelectorAll('.card-explorar');
    // 3. LAÇO DE REPETIÇÃO (LOOP)
    // Passa de livro em livro para decidir quem aparece e quem some
    cardsExplorar.forEach(card => {
        // Pega o texto de dentro da tag h4 (título do livro) e põe em minúsculas
        const tituloLivro = card.querySelector('h4').textContent.toLowerCase();

        // 4. LÓGICA DE FILTRAGEM
        // O método .includes() verifica se o termo buscado está dentro do título do livro
        if (tituloLivro.includes(termoBuscado)) {
            card.style.display = ""; // Mostra o card (redefine para o padrão do CSS)
        } else {
            card.style.display = "none"; // Esconde o card da tela
        }
    });
});