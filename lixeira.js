
// 1. Pega a lista de excluídos do navegador
let minhaLixeira = JSON.parse(localStorage.getItem('minhaLixeira')) || [];
const containerLixeira = document.getElementById('cards-lixeira');
const mensagemVazia = document.getElementById('mensagem-vazia');
// 2. Função para desenhar os livros excluídos na tela
function renderizarLixeira() {
    containerLixeira.innerHTML = ''; // Limpa a tela
    if (minhaLixeira.length === 0) {
        mensagemVazia.style.display = 'block';
        return;
    }
    mensagemVazia.style.display = 'none';
    minhaLixeira.forEach(livro => {
        const card = document.createElement('div');
        card.className = 'card';
        // Criamos uma capa temporária
        const img = document.createElement('img');
        img.src = 'https://placehold.co/300x450?text=' + livro.titulo.substring(0, 15);
        img.alt = livro.titulo;
        const h3 = document.createElement('h3');
        h3.textContent = livro.titulo;
        // Botão para restaurar o livro de volta à biblioteca
        const btnRestaurar = document.createElement('button');
        btnRestaurar.textContent = "♻️ Restaurar";
        btnRestaurar.style.cssText = "width: 100%; padding: 8px; margin-top: 5px; border-radius: 5px; cursor: pointer;";
        btnRestaurar.addEventListener('click', () => restaurarLivro(livro.id));
        card.appendChild(img);
        card.appendChild(h3);
        card.appendChild(btnRestaurar);
        containerLixeira.appendChild(card);
    });
}
// 3. Função para tirar da lixeira e devolver para a biblioteca
function restaurarLivro(idLivro) {
    let meusLivros = JSON.parse(localStorage.getItem('minhaBiblioteca')) || [];
    // Encontra o livro na lixeira
    const index = minhaLixeira.findIndex(l => l.id === idLivro);
    if (index !== -1) {
        // Remove da lixeira e joga de volta na biblioteca
        const livroRestaurado = minhaLixeira.splice(index, 1)[0];
        meusLivros.push(livroRestaurado);
        // Atualiza o LocalStorage
        localStorage.setItem('minhaLixeira', JSON.stringify(minhaLixeira));
        localStorage.setItem('minhaBiblioteca', JSON.stringify(meusLivros));
        // Atualiza a tela da lixeira
        renderizarLixeira();
    }
}
// Executa assim que abre a página
renderizarLixeira();