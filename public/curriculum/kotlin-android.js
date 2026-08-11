/*
 * Modulo de linguagem: Kotlin voltado ao desenvolvimento Android.
 *
 * Formato de licao:
 *   id      identificador estavel (usado no progresso salvo)
 *   kind    'drill' (repeticao de simbolos) | 'code' (trecho real) | 'challenge' (enunciado + solucao)
 *   tags    conceitos exercitados -> alimentam a analise de erros e o modo revisao
 *   minAcc  precisao minima para passar
 *   brief   uma linha, aparece acima do trecho
 *   explain explicacao contextual (modo "Entenda + Digite")
 *   prompt  enunciado, apenas em challenges
 *   lang    sobrescreve a linguagem do modulo (ex.: xml, gradle)
 */

export const kotlinAndroid = {
  id: 'kotlin-android',
  name: 'Kotlin para Android',
  language: 'kotlin',
  icon: 'KT',
  color: '#a97bff',
  description:
    'Do primeiro par de chaves ate um app com ViewModel, coroutines e Jetpack Compose — digitando cada caractere.',
  units: [
    /* ------------------------------------------------------------------ U1 */
    {
      id: 'kt-u1',
      title: 'Unidade 1 — Simbolos e sintaxe base',
      subtitle: 'A memoria muscular dos caracteres que voce vai digitar milhares de vezes.',
      lessons: [
        {
          id: 'kt-1-1',
          title: 'Chaves, parenteses e blocos',
          kind: 'drill',
          tags: ['bloco', 'chaves'],
          minAcc: 0.97,
          xp: 15,
          brief: 'Kotlin nao usa ponto e virgula. O bloco { } e a unidade basica.',
          explain:
            'Todo corpo de funcao, classe ou lambda vive entre chaves. O par ( ) delimita parametros e argumentos. Treine o alcance dos dedos ate acertar sem olhar: Shift+[ para {, Shift+9 para (.',
          code: `fun main() {
    println("Ola")
}

fun start() {
    setup()
    run()
}`
        },
        {
          id: 'kt-1-2',
          title: 'Dois-pontos, tipos e virgulas',
          kind: 'drill',
          tags: ['tipo', 'parametro'],
          minAcc: 0.97,
          xp: 15,
          brief: 'Em Kotlin o tipo vem depois do nome, separado por dois-pontos.',
          explain:
            'nome: Tipo e a assinatura mais comum da linguagem. Note o espaco DEPOIS dos dois-pontos e nunca antes. Em listas de parametros a virgula tambem leva um espaco depois.',
          code: `fun soma(a: Int, b: Int): Int {
    return a + b
}

fun saudacao(nome: String, idade: Int): String {
    return nome
}`
        },
        {
          id: 'kt-1-3',
          title: 'Aspas e interpolacao de String',
          kind: 'drill',
          tags: ['string', 'interpolacao'],
          minAcc: 0.96,
          xp: 20,
          brief: 'O cifrao injeta valores dentro da String, com ou sem chaves.',
          explain:
            '"$nome" insere uma variavel simples. Quando houver expressao (chamada de metodo, propriedade, operacao) use "\${...}". Errar a chave de fechamento aqui e o erro de sintaxe mais comum de iniciantes.',
          code: `val nome = "Ana"
val itens = listOf(1, 2, 3)

println("Ola, $nome")
println("Total: \${itens.size}")
println("Primeiro: \${itens.first()}")
println("Soma: \${1 + 2}")`
        },
        {
          id: 'kt-1-4',
          title: 'Setas de lambda',
          kind: 'drill',
          tags: ['lambda', 'seta'],
          minAcc: 0.96,
          xp: 20,
          brief: 'A seta -> aparece em lambdas e em when. Sao dois toques: hifen e maior-que.',
          explain:
            'Em { it -> ... } a seta separa parametro do corpo. Em when ela separa a condicao do resultado. Digite sempre com espaco antes e depois.',
          code: `val dobro = { x: Int -> x * 2 }

val nomes = listOf("ana", "bob")
nomes.forEach { nome -> println(nome) }

val tipo = when (1) {
    1 -> "um"
    2 -> "dois"
    else -> "outro"
}`
        },
        {
          id: 'kt-1-5',
          title: 'Simbolos de null safety',
          kind: 'drill',
          tags: ['null-safety', 'elvis'],
          minAcc: 0.96,
          xp: 20,
          brief: 'A assinatura do Kotlin: ? . ?. ?: !!',
          explain:
            '? marca um tipo anulavel. ?. so chama se nao for nulo. ?: (elvis) fornece o valor alternativo. !! forca e explode se for nulo — evite. Esses quatro simbolos aparecem em quase todo arquivo Android.',
          code: `var texto: String? = null

val tamanho = texto?.length
val seguro = texto?.length ?: 0
val maiusculo = texto?.uppercase() ?: "vazio"
val forcado = texto!!.length`
        }
      ]
    },

    /* ------------------------------------------------------------------ U2 */
    {
      id: 'kt-u2',
      title: 'Unidade 2 — Variaveis e tipos',
      subtitle: 'val, var, inferencia e os tipos que o Android usa o tempo todo.',
      lessons: [
        {
          id: 'kt-2-1',
          title: 'val e var',
          kind: 'code',
          tags: ['val', 'var'],
          minAcc: 0.97,
          xp: 20,
          brief: 'val nao pode ser reatribuido; var pode.',
          explain:
            'A regra pratica em Android: comece sempre com val. So troque para var quando o compilador reclamar. Isso reduz bugs de estado compartilhado, especialmente dentro de Activities.',
          code: `val nomeApp = "MeuApp"
val versao = 3

var contador = 0
contador = contador + 1
contador += 1

println("$nomeApp v$versao -> $contador")`
        },
        {
          id: 'kt-2-2',
          title: 'Tipos basicos e conversao',
          kind: 'code',
          tags: ['tipo', 'conversao'],
          minAcc: 0.96,
          xp: 20,
          brief: 'Int, Long, Double, Boolean, Char, String — sem conversao implicita.',
          explain:
            'Kotlin nao converte numeros automaticamente. Um Int nao vira Long sozinho: use toLong(), toDouble(), toInt(). Em Android isso aparece o tempo todo com timestamps (Long) e dimensoes (Float).',
          code: `val idade: Int = 30
val id: Long = 1_000_000L
val preco: Double = 19.99
val ativo: Boolean = true
val inicial: Char = 'K'

val idadeLong: Long = idade.toLong()
val precoInt: Int = preco.toInt()
val textoPreco: String = preco.toString()`
        },
        {
          id: 'kt-2-3',
          title: 'const, lateinit e anulaveis',
          kind: 'code',
          tags: ['const', 'lateinit', 'null-safety'],
          minAcc: 0.96,
          xp: 25,
          brief: 'Tres formas de declarar que aparecem em toda Activity.',
          explain:
            'const val e constante de tempo de compilacao (fora de classes ou em companion object). lateinit var promete inicializar depois — tipico de binding e adapters. O tipo com ? aceita nulo e obriga a tratar.',
          code: `const val TAG = "MainActivity"
const val BASE_URL = "https://api.exemplo.com/"

lateinit var adapter: UsuarioAdapter

var usuarioAtual: String? = null
val nomeExibido: String = usuarioAtual ?: "Visitante"`
        },
        {
          id: 'kt-2-4',
          title: 'Inferencia de tipo',
          kind: 'code',
          tags: ['tipo', 'inferencia'],
          minAcc: 0.96,
          xp: 20,
          brief: 'Quando o valor e obvio, o tipo pode ser omitido.',
          explain:
            'O compilador deduz o tipo pelo valor atribuido. Escreva o tipo explicito quando ele nao for obvio na leitura ou quando fizer parte de uma API publica.',
          code: `val titulo = "Lista de tarefas"
val quantidade = 42
val media = 7.5
val concluido = false
val tags = listOf("android", "kotlin")
val mapa = mapOf("id" to 1, "nome" to "Ana")`
        },
        {
          id: 'kt-2-5',
          title: 'Any, is e cast inteligente',
          kind: 'code',
          tags: ['cast', 'is'],
          minAcc: 0.95,
          xp: 25,
          brief: 'Depois de checar com is, o Kotlin ja trata a variavel como o tipo certo.',
          explain:
            'O smart cast elimina o cast manual do Java. Depois de "if (valor is String)" voce ja pode chamar valor.length. Use "as?" para um cast seguro que devolve null em vez de estourar.',
          code: `fun descrever(valor: Any): String {
    if (valor is String) {
        return "texto de \${valor.length} letras"
    }
    if (valor is Int) {
        return "numero \${valor + 1}"
    }
    val texto = valor as? String
    return texto ?: "desconhecido"
}`
        }
      ]
    },

    /* ------------------------------------------------------------------ U3 */
    {
      id: 'kt-u3',
      title: 'Unidade 3 — Operadores e controle de fluxo',
      subtitle: 'if como expressao, when e ranges.',
      lessons: [
        {
          id: 'kt-3-1',
          title: 'Operadores aritmeticos e de atribuicao',
          kind: 'drill',
          tags: ['operador'],
          minAcc: 0.97,
          xp: 15,
          brief: '+ - * / % e as formas compostas.',
          explain:
            'Atencao a divisao inteira: 7 / 2 da 3, nao 3.5. Para decimal, pelo menos um dos lados precisa ser Double.',
          code: `var total = 10

total = total + 5
total -= 3
total *= 2
total /= 4
total %= 3

val exato = 7 / 2
val decimal = 7.0 / 2`
        },
        {
          id: 'kt-3-2',
          title: 'Comparacao e operadores logicos',
          kind: 'drill',
          tags: ['operador', 'booleano'],
          minAcc: 0.96,
          xp: 20,
          brief: '== compara valor, === compara referencia.',
          explain:
            'Diferente do Java, == em Kotlin chama equals(). Para comparar identidade use ===. && e || tem avaliacao curta-circuito: o lado direito so roda se necessario.',
          code: `val a = 10
val b = 20

val igual = a == b
val diferente = a != b
val maior = a > b
val menorIgual = a <= b

val ambos = a > 0 && b > 0
val algum = a > 100 || b > 100
val negado = !ambos`
        },
        {
          id: 'kt-3-3',
          title: 'if como expressao',
          kind: 'code',
          tags: ['if', 'expressao'],
          minAcc: 0.96,
          xp: 25,
          brief: 'Em Kotlin o if devolve valor — nao existe operador ternario.',
          explain:
            'Como o if e uma expressao, ele substitui o "cond ? a : b" do Java. A ultima linha de cada bloco e o valor retornado.',
          code: `val pontos = 85

val nivel = if (pontos >= 90) {
    "avancado"
} else if (pontos >= 70) {
    "intermediario"
} else {
    "iniciante"
}

val status = if (pontos > 0) "ativo" else "inativo"`
        },
        {
          id: 'kt-3-4',
          title: 'when — o switch turbinado',
          kind: 'code',
          tags: ['when', 'expressao'],
          minAcc: 0.96,
          xp: 25,
          brief: 'when cobre valores, faixas, tipos e condicoes.',
          explain:
            'Quando o when e usado como expressao, o else e obrigatorio (a menos que todos os casos de uma sealed class ou enum estejam cobertos). Nao existe fall-through nem break.',
          code: `fun classificar(nota: Int): String = when (nota) {
    10 -> "perfeito"
    in 7..9 -> "aprovado"
    in 5..6 -> "recuperacao"
    0, 1, 2 -> "critico"
    else -> "reprovado"
}

fun tipoDe(valor: Any) = when (valor) {
    is String -> "texto"
    is Int -> "inteiro"
    else -> "outro"
}`
        },
        {
          id: 'kt-3-5',
          title: 'Ranges e o operador in',
          kind: 'code',
          tags: ['range', 'in'],
          minAcc: 0.96,
          xp: 20,
          brief: '.. downTo step until — e o teste de pertencimento com in.',
          explain:
            '1..10 inclui o 10; 1 until 10 para no 9. Esses ranges alimentam loops e validacoes de faixa (idade, indice, progresso).',
          code: `val faixa = 1..10
val decrescente = 10 downTo 1
val pulando = 0..100 step 10
val exclusivo = 0 until 5

val dentro = 7 in faixa
val fora = 42 !in faixa
val letra = 'k' in 'a'..'z'`
        }
      ]
    },

    /* ------------------------------------------------------------------ U4 */
    {
      id: 'kt-u4',
      title: 'Unidade 4 — Loops e colecoes',
      subtitle: 'for, while e as operacoes funcionais que substituem a maioria deles.',
      lessons: [
        {
          id: 'kt-4-1',
          title: 'for e while',
          kind: 'code',
          tags: ['loop', 'for', 'while'],
          minAcc: 0.96,
          xp: 20,
          brief: 'O for do Kotlin sempre percorre algo iteravel.',
          explain:
            'Nao existe "for (int i = 0; i < n; i++)". Use ranges ou a propria colecao. withIndex() entrega indice e valor de uma vez.',
          code: `for (i in 1..5) {
    println(i)
}

val nomes = listOf("ana", "bob", "caio")
for (nome in nomes) {
    println(nome)
}

for ((indice, nome) in nomes.withIndex()) {
    println("$indice: $nome")
}

var contador = 3
while (contador > 0) {
    contador--
}`
        },
        {
          id: 'kt-4-2',
          title: 'repeat, break e continue',
          kind: 'code',
          tags: ['loop', 'controle'],
          minAcc: 0.96,
          xp: 20,
          brief: 'repeat(n) para repeticoes simples; break e continue seguem iguais ao Java.',
          explain:
            'repeat recebe uma lambda e expoe o indice como "it". break sai do loop, continue pula para a proxima iteracao.',
          code: `repeat(3) {
    println("tentativa $it")
}

for (n in 1..10) {
    if (n % 2 == 0) continue
    if (n > 7) break
    println(n)
}`
        },
        {
          id: 'kt-4-3',
          title: 'Listas: listOf e mutableListOf',
          kind: 'code',
          tags: ['colecao', 'lista'],
          minAcc: 0.96,
          xp: 25,
          brief: 'Colecoes imutaveis por padrao; a versao mutable e explicita.',
          explain:
            'listOf cria uma lista somente leitura — ideal para expor estado de um ViewModel. mutableListOf permite add/remove. Prefira sempre a imutavel na fronteira das camadas.',
          code: `val cores = listOf("azul", "verde", "vermelho")
val primeira = cores.first()
val ultima = cores.last()
val porIndice = cores[1]
val tamanho = cores.size

val tarefas = mutableListOf<String>()
tarefas.add("estudar")
tarefas.add("treinar")
tarefas.removeAt(0)`
        },
        {
          id: 'kt-4-4',
          title: 'map, filter e sortedBy',
          kind: 'code',
          tags: ['colecao', 'lambda', 'funcional'],
          minAcc: 0.95,
          xp: 30,
          brief: 'A cadeia funcional que substitui a maioria dos loops.',
          explain:
            'Dentro dessas lambdas o parametro implicito chama-se "it". As operacoes encadeiam: cada uma devolve uma nova lista. Esse padrao aparece em praticamente todo Repository Android.',
          code: `val numeros = listOf(5, 12, 8, 130, 44)

val dobrados = numeros.map { it * 2 }
val grandes = numeros.filter { it > 10 }
val ordenados = numeros.sortedBy { it }
val soma = numeros.sum()
val temGrande = numeros.any { it > 100 }
val todosPositivos = numeros.all { it > 0 }
val texto = numeros.joinToString(", ")`
        },
        {
          id: 'kt-4-5',
          title: 'Mapas e destructuring',
          kind: 'code',
          tags: ['colecao', 'mapa'],
          minAcc: 0.95,
          xp: 25,
          brief: 'mapOf usa o infix "to" para montar os pares.',
          explain:
            'Ao percorrer um mapa voce pode desestruturar em (chave, valor). O acesso por colchetes devolve um tipo anulavel, por isso o elvis costuma aparecer logo em seguida.',
          code: `val usuario = mapOf(
    "nome" to "Ana",
    "cidade" to "Recife"
)

val nome = usuario["nome"] ?: "sem nome"

for ((chave, valor) in usuario) {
    println("$chave = $valor")
}

val contagem = mutableMapOf<String, Int>()
contagem["cliques"] = 1`
        }
      ]
    },

    /* ------------------------------------------------------------------ U5 */
    {
      id: 'kt-u5',
      title: 'Unidade 5 — Funcoes',
      subtitle: 'Da funcao basica as extensions e lambdas de alta ordem.',
      lessons: [
        {
          id: 'kt-5-1',
          title: 'Funcoes e retorno',
          kind: 'code',
          tags: ['funcao'],
          minAcc: 0.97,
          xp: 20,
          brief: 'fun nome(params): TipoRetorno { }',
          explain:
            'Sem tipo de retorno declarado, a funcao devolve Unit (equivalente ao void). Unit pode ser omitido.',
          code: `fun dobrar(valor: Int): Int {
    return valor * 2
}

fun registrar(mensagem: String) {
    println(mensagem)
}

fun mediaDe(a: Double, b: Double): Double {
    return (a + b) / 2
}`
        },
        {
          id: 'kt-5-2',
          title: 'Parametros padrao e argumentos nomeados',
          kind: 'code',
          tags: ['funcao', 'parametro'],
          minAcc: 0.96,
          xp: 25,
          brief: 'Valores padrao eliminam a explosao de sobrecargas do Java.',
          explain:
            'Com argumentos nomeados voce pula parametros do meio e ganha legibilidade na chamada — muito usado em componentes de UI com muitas opcoes.',
          code: `fun criarUsuario(
    nome: String,
    idade: Int = 18,
    ativo: Boolean = true
): String {
    return "$nome/$idade/$ativo"
}

val a = criarUsuario("Ana")
val b = criarUsuario("Bob", 30)
val c = criarUsuario(nome = "Caio", ativo = false)`
        },
        {
          id: 'kt-5-3',
          title: 'Funcao de expressao unica',
          kind: 'code',
          tags: ['funcao', 'expressao'],
          minAcc: 0.96,
          xp: 20,
          brief: 'Quando o corpo e uma unica expressao, use = em vez de chaves.',
          explain:
            'Forma compacta muito comum em mappers e helpers. O tipo de retorno pode ser inferido, mas declare-o em APIs publicas.',
          code: `fun dobrar(x: Int) = x * 2

fun ehPar(n: Int): Boolean = n % 2 == 0

fun saudacao(nome: String) = "Ola, $nome"

fun maiorDe(a: Int, b: Int) = if (a > b) a else b`
        },
        {
          id: 'kt-5-4',
          title: 'Extension functions',
          kind: 'code',
          tags: ['funcao', 'extension'],
          minAcc: 0.95,
          xp: 30,
          brief: 'Adicione metodos a tipos que voce nao controla.',
          explain:
            'Dentro da extension, "this" e o objeto receptor. E o recurso mais usado em utilitarios Android: Context.toast(), View.show(), String.isValidEmail().',
          code: `fun String.primeiraMaiuscula(): String {
    return this.replaceFirstChar { it.uppercase() }
}

fun Int.paraReais(): String = "R$ " + this + ",00"

fun View.mostrar() {
    visibility = View.VISIBLE
}

fun View.esconder() {
    visibility = View.GONE
}`
        },
        {
          id: 'kt-5-5',
          title: 'Funcoes de alta ordem',
          kind: 'code',
          tags: ['funcao', 'lambda', 'callback'],
          minAcc: 0.94,
          xp: 30,
          brief: 'Funcoes que recebem ou devolvem outras funcoes.',
          explain:
            'A assinatura (T) -> R descreve uma lambda. Quando a lambda e o ultimo parametro, ela sai dos parenteses — e por isso que setOnClickListener { } tem aquela cara.',
          code: `fun executar(vezes: Int, acao: (Int) -> Unit) {
    for (i in 1..vezes) {
        acao(i)
    }
}

executar(3) { indice ->
    println("passo $indice")
}

fun aoConcluir(callback: () -> Unit) {
    callback()
}`
        }
      ]
    },

    /* ------------------------------------------------------------------ U6 */
    {
      id: 'kt-u6',
      title: 'Unidade 6 — Classes e orientacao a objetos',
      subtitle: 'data class, heranca, object e sealed class.',
      lessons: [
        {
          id: 'kt-6-1',
          title: 'Classe e construtor primario',
          kind: 'code',
          tags: ['classe', 'construtor'],
          minAcc: 0.96,
          xp: 25,
          brief: 'O construtor fica na propria assinatura da classe.',
          explain:
            'Declarar val/var nos parametros ja cria as propriedades. O bloco init roda na construcao. Classes sao final por padrao.',
          code: `class Usuario(val nome: String, var idade: Int) {

    var ativo: Boolean = true
        private set

    init {
        println("criado: $nome")
    }

    fun desativar() {
        ativo = false
    }
}`
        },
        {
          id: 'kt-6-2',
          title: 'data class',
          kind: 'code',
          tags: ['classe', 'data-class', 'modelo'],
          minAcc: 0.96,
          xp: 25,
          brief: 'equals, hashCode, toString e copy de graca.',
          explain:
            'E a classe de modelo padrao em Android: respostas de API, entidades e estados de tela. copy() cria uma nova instancia mudando so o que voce indicar — base da UI imutavel.',
          code: `data class Produto(
    val id: Int,
    val nome: String,
    val preco: Double,
    val emEstoque: Boolean = true
)

val camisa = Produto(1, "Camisa", 79.9)
val promocao = camisa.copy(preco = 59.9)
val (id, nome) = camisa`
        },
        {
          id: 'kt-6-3',
          title: 'Heranca e interfaces',
          kind: 'code',
          tags: ['classe', 'heranca', 'interface'],
          minAcc: 0.95,
          xp: 30,
          brief: 'open libera a heranca; override e obrigatorio e explicito.',
          explain:
            'Sem open, nada pode ser estendido ou sobrescrito. Interfaces podem ter implementacao padrao. Esse par aparece em todo listener e callback de Android.',
          code: `interface Clicavel {
    fun aoClicar()
    fun descricao(): String = "elemento clicavel"
}

open class Componente(val id: String) {
    open fun renderizar() {
        println("render $id")
    }
}

class Botao(id: String) : Componente(id), Clicavel {

    override fun renderizar() {
        super.renderizar()
        println("botao pronto")
    }

    override fun aoClicar() {
        println("clique em $id")
    }
}`
        },
        {
          id: 'kt-6-4',
          title: 'object e companion object',
          kind: 'code',
          tags: ['classe', 'singleton', 'companion'],
          minAcc: 0.95,
          xp: 25,
          brief: 'object = singleton. companion object = membros "estaticos".',
          explain:
            'O padrao newInstance() de Fragment e as constantes de Intent vivem em companion object. object declara um singleton pronto, sem boilerplate.',
          code: `object Configuracao {
    const val TIMEOUT = 30
    var modoEscuro = false

    fun alternarTema() {
        modoEscuro = !modoEscuro
    }
}

class DetalheActivity {
    companion object {
        const val EXTRA_ID = "extra_id"

        fun criarIntent(id: Int): String = "detalhe/$id"
    }
}`
        },
        {
          id: 'kt-6-5',
          title: 'sealed class e enum',
          kind: 'code',
          tags: ['classe', 'sealed', 'enum', 'estado'],
          minAcc: 0.94,
          xp: 35,
          brief: 'O jeito idiomatico de modelar estados de tela.',
          explain:
            'Com sealed class o compilador conhece todos os subtipos: o when fica exaustivo e dispensa else. Loading/Success/Error e o esqueleto de UI state mais usado em Android moderno.',
          code: `enum class Status {
    ATIVO, INATIVO, PENDENTE
}

sealed class UiState {
    object Loading : UiState()
    data class Success(val itens: List<String>) : UiState()
    data class Error(val mensagem: String) : UiState()
}

fun render(estado: UiState) = when (estado) {
    is UiState.Loading -> "carregando"
    is UiState.Success -> "\${estado.itens.size} itens"
    is UiState.Error -> estado.mensagem
}`
        }
      ]
    },

    /* ------------------------------------------------------------------ U7 */
    {
      id: 'kt-u7',
      title: 'Unidade 7 — Null safety e tratamento de erros',
      subtitle: 'Onde o app trava — e como o Kotlin evita isso.',
      lessons: [
        {
          id: 'kt-7-1',
          title: 'Cadeia segura e elvis',
          kind: 'code',
          tags: ['null-safety', 'elvis'],
          minAcc: 0.95,
          xp: 25,
          brief: 'Encadeie ?. e finalize com ?: para nunca ficar sem valor.',
          explain:
            'Se qualquer elo da cadeia for nulo, o resultado inteiro e nulo — e o elvis entrega o padrao. Substitui as pilhas de "if != null" do Java.',
          code: `data class Endereco(val cidade: String?)
data class Perfil(val endereco: Endereco?)
data class Conta(val perfil: Perfil?)

fun cidadeDe(conta: Conta?): String {
    return conta?.perfil?.endereco?.cidade ?: "nao informada"
}`
        },
        {
          id: 'kt-7-2',
          title: 'let, run, apply e also',
          kind: 'code',
          tags: ['scope-function', 'null-safety'],
          minAcc: 0.94,
          xp: 30,
          brief: 'As scope functions que aparecem em todo codigo Android.',
          explain:
            'let recebe o valor como "it" e devolve o resultado do bloco — combinado com ?. executa apenas quando nao for nulo. apply recebe como "this" e devolve o proprio objeto: perfeito para configurar Views e Intents.',
          code: `val nome: String? = "Ana"

nome?.let {
    println("ola, $it")
}

val tamanho = nome?.let { it.length } ?: 0

val config = StringBuilder().apply {
    append("linha 1")
    append("linha 2")
}

val resultado = nome.also { println("valor: $it") }`
        },
        {
          id: 'kt-7-3',
          title: 'try / catch / finally',
          kind: 'code',
          tags: ['erro', 'excecao'],
          minAcc: 0.95,
          xp: 25,
          brief: 'Em Kotlin try tambem e uma expressao.',
          explain:
            'Nao existem checked exceptions. O bloco try pode devolver valor direto para uma val, o que remove a variavel temporaria mutavel.',
          code: `fun paraInteiro(texto: String): Int {
    return try {
        texto.toInt()
    } catch (e: NumberFormatException) {
        0
    } finally {
        println("conversao finalizada")
    }
}

fun validarIdade(idade: Int) {
    if (idade < 0) {
        throw IllegalArgumentException("idade invalida")
    }
}`
        },
        {
          id: 'kt-7-4',
          title: 'Result e runCatching',
          kind: 'code',
          tags: ['erro', 'result'],
          minAcc: 0.94,
          xp: 30,
          brief: 'Erro como valor de retorno, sem espalhar try/catch.',
          explain:
            'runCatching captura a excecao e devolve um Result. onSuccess/onFailure e getOrElse deixam a camada de dados limpa — padrao muito usado em Repository.',
          code: `fun carregar(id: Int): Result<String> = runCatching {
    if (id <= 0) error("id invalido")
    "usuario-$id"
}

fun exibir(id: Int) {
    carregar(id)
        .onSuccess { println("ok: $it") }
        .onFailure { println("falhou: \${it.message}") }

    val valor = carregar(id).getOrElse { "padrao" }
}`
        },
        {
          id: 'kt-7-5',
          title: 'Excecoes customizadas',
          kind: 'code',
          tags: ['erro', 'classe'],
          minAcc: 0.94,
          xp: 25,
          brief: 'Erros de dominio com nome proprio.',
          explain:
            'Uma hierarquia sealed de erros permite tratar cada caso no when sem strings magicas — util para mapear falhas de rede na camada de UI.',
          code: `sealed class AppException(mensagem: String) : Exception(mensagem) {
    class SemRede : AppException("sem conexao")
    class NaoAutorizado : AppException("token expirado")
    class Desconhecido(causa: String) : AppException(causa)
}

fun tratar(e: AppException): String = when (e) {
    is AppException.SemRede -> "Verifique sua internet"
    is AppException.NaoAutorizado -> "Faca login novamente"
    is AppException.Desconhecido -> e.message ?: "erro"
}`
        }
      ]
    },

    /* ------------------------------------------------------------------ U8 */
    {
      id: 'kt-u8',
      title: 'Unidade 8 — Android essencial (Views)',
      subtitle: 'Activity, ciclo de vida, binding, Intents e RecyclerView.',
      lessons: [
        {
          id: 'kt-8-1',
          title: 'Activity e onCreate',
          kind: 'code',
          tags: ['android', 'activity', 'ciclo-de-vida'],
          minAcc: 0.95,
          xp: 30,
          brief: 'O ponto de entrada de qualquer tela Android.',
          explain:
            'Toda Activity estende AppCompatActivity e sobrescreve onCreate. A chamada a super.onCreate deve vir primeiro; setContentView infla o layout XML.',
          code: `package com.exemplo.app

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
    }
}`
        },
        {
          id: 'kt-8-2',
          title: 'ViewBinding e clique',
          kind: 'code',
          tags: ['android', 'viewbinding', 'listener'],
          minAcc: 0.94,
          xp: 35,
          brief: 'Acesso a Views com seguranca de tipo, sem findViewById.',
          explain:
            'O binding e gerado a partir do nome do layout: activity_main.xml vira ActivityMainBinding. Guarde-o em lateinit e infle no onCreate. O listener e uma lambda porque e o ultimo parametro.',
          code: `class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.botaoSalvar.setOnClickListener {
            val texto = binding.campoNome.text.toString()
            binding.textoResultado.text = "Ola, $texto"
        }
    }
}`
        },
        {
          id: 'kt-8-3',
          title: 'Intent, extras e Toast',
          kind: 'code',
          tags: ['android', 'intent', 'navegacao'],
          minAcc: 0.94,
          xp: 30,
          brief: 'Navegar entre telas levando dados.',
          explain:
            'Intent(this, Destino::class.java) e a forma explicita. putExtra grava e getStringExtra le — sempre anulavel do outro lado. apply deixa a montagem do Intent em um bloco so.',
          code: `val intent = Intent(this, DetalheActivity::class.java).apply {
    putExtra("EXTRA_ID", 42)
    putExtra("EXTRA_NOME", "Ana")
}
startActivity(intent)

val id = intent.getIntExtra("EXTRA_ID", 0)
val nome = intent.getStringExtra("EXTRA_NOME") ?: ""

Toast.makeText(this, "Aberto: $nome", Toast.LENGTH_SHORT).show()
Log.d(TAG, "abrindo detalhe $id")`
        },
        {
          id: 'kt-8-4',
          title: 'Ciclo de vida da Activity',
          kind: 'code',
          tags: ['android', 'ciclo-de-vida'],
          minAcc: 0.95,
          xp: 30,
          brief: 'Os callbacks que definem onde alocar e liberar recursos.',
          explain:
            'onStart/onResume para retomar (sensores, animacoes); onPause/onStop para pausar e salvar; onDestroy para liberar. Errar isso e a causa classica de vazamento de memoria em Android.',
          code: `override fun onStart() {
    super.onStart()
    Log.d(TAG, "onStart")
}

override fun onResume() {
    super.onResume()
    iniciarAtualizacoes()
}

override fun onPause() {
    super.onPause()
    pararAtualizacoes()
}

override fun onDestroy() {
    super.onDestroy()
    listener = null
}`
        },
        {
          id: 'kt-8-5',
          title: 'RecyclerView Adapter',
          kind: 'code',
          tags: ['android', 'recyclerview', 'adapter', 'lista'],
          minAcc: 0.93,
          xp: 45,
          brief: 'O trecho mais digitado da carreira de um dev Android.',
          explain:
            'Tres metodos obrigatorios: onCreateViewHolder (infla o item), onBindViewHolder (liga os dados) e getItemCount. O ViewHolder guarda as referencias para nao reinflar a cada rolagem.',
          code: `class UsuarioAdapter(
    private val itens: List<Usuario>,
    private val aoClicar: (Usuario) -> Unit
) : RecyclerView.Adapter<UsuarioAdapter.ViewHolder>() {

    inner class ViewHolder(val binding: ItemUsuarioBinding) :
        RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemUsuarioBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = itens[position]
        holder.binding.titulo.text = item.nome
        holder.itemView.setOnClickListener { aoClicar(item) }
    }

    override fun getItemCount(): Int = itens.size
}`
        },
        {
          id: 'kt-8-6',
          title: 'Layout XML e Manifest',
          kind: 'code',
          lang: 'xml',
          tags: ['android', 'xml', 'layout'],
          minAcc: 0.93,
          xp: 30,
          brief: 'Nem tudo em Android e Kotlin: treine tambem o XML.',
          explain:
            'Atributos android:* seguem sempre o formato nome="valor". Toda Activity precisa estar declarada no AndroidManifest para poder ser aberta.',
          code: `<LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="vertical">

    <TextView
        android:id="@+id/textoResultado"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="@string/titulo" />

    <Button
        android:id="@+id/botaoSalvar"
        android:layout_width="match_parent"
        android:layout_height="wrap_content" />

</LinearLayout>`
        }
      ]
    },

    /* ------------------------------------------------------------------ U9 */
    {
      id: 'kt-u9',
      title: 'Unidade 9 — Coroutines e arquitetura',
      subtitle: 'ViewModel, StateFlow, Retrofit e Room.',
      lessons: [
        {
          id: 'kt-9-1',
          title: 'suspend e coroutines',
          kind: 'code',
          tags: ['coroutine', 'assincrono'],
          minAcc: 0.94,
          xp: 35,
          brief: 'Funcoes que podem pausar sem travar a thread principal.',
          explain:
            'suspend so pode ser chamada de dentro de outra suspend ou de um escopo. withContext(Dispatchers.IO) move o trabalho pesado para fora da main thread — regra de ouro em Android.',
          code: `suspend fun buscarUsuario(id: Int): Usuario {
    return withContext(Dispatchers.IO) {
        delay(1000)
        Usuario("Ana", 30)
    }
}

suspend fun carregarTudo() = coroutineScope {
    val perfil = async { buscarUsuario(1) }
    val amigos = async { buscarAmigos(1) }
    perfil.await() to amigos.await()
}`
        },
        {
          id: 'kt-9-2',
          title: 'ViewModel com StateFlow',
          kind: 'code',
          tags: ['android', 'viewmodel', 'stateflow', 'estado'],
          minAcc: 0.93,
          xp: 45,
          brief: 'O coracao da arquitetura Android moderna.',
          explain:
            'MutableStateFlow privado + StateFlow publico e o padrao de estado unidirecional: so o ViewModel escreve, a UI apenas observa. viewModelScope cancela as coroutines sozinho quando a tela morre.',
          code: `class UsuarioViewModel(
    private val repository: UsuarioRepository
) : ViewModel() {

    private val _estado = MutableStateFlow<UiState>(UiState.Loading)
    val estado: StateFlow<UiState> = _estado.asStateFlow()

    fun carregar(id: Int) {
        viewModelScope.launch {
            _estado.value = UiState.Loading
            runCatching { repository.buscar(id) }
                .onSuccess { _estado.value = UiState.Success(it) }
                .onFailure { _estado.value = UiState.Error(it.message ?: "erro") }
        }
    }
}`
        },
        {
          id: 'kt-9-3',
          title: 'Retrofit: API e chamada',
          kind: 'code',
          tags: ['android', 'retrofit', 'rede'],
          minAcc: 0.93,
          xp: 40,
          brief: 'A interface anotada que vira cliente HTTP.',
          explain:
            'Cada metodo suspend descreve uma rota. @Path preenche o segmento entre chaves, @Query vira parametro de URL. O Retrofit gera a implementacao em tempo de execucao.',
          code: `interface ApiService {

    @GET("usuarios/{id}")
    suspend fun getUsuario(@Path("id") id: Int): UsuarioDto

    @GET("usuarios")
    suspend fun listar(@Query("pagina") pagina: Int = 1): List<UsuarioDto>

    @POST("usuarios")
    suspend fun criar(@Body corpo: UsuarioDto): UsuarioDto
}

val retrofit = Retrofit.Builder()
    .baseUrl(BASE_URL)
    .addConverterFactory(GsonConverterFactory.create())
    .build()

val api = retrofit.create(ApiService::class.java)`
        },
        {
          id: 'kt-9-4',
          title: 'Room: Entity e DAO',
          kind: 'code',
          tags: ['android', 'room', 'banco'],
          minAcc: 0.93,
          xp: 40,
          brief: 'Persistencia local com SQL verificado em tempo de compilacao.',
          explain:
            '@Entity mapeia a tabela, @Dao declara as consultas. Retornar Flow faz a UI reagir automaticamente a cada alteracao no banco.',
          code: `@Entity(tableName = "tarefas")
data class TarefaEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    @ColumnInfo(name = "titulo") val titulo: String,
    val concluida: Boolean = false
)

@Dao
interface TarefaDao {

    @Query("SELECT * FROM tarefas ORDER BY id DESC")
    fun observarTodas(): Flow<List<TarefaEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun inserir(tarefa: TarefaEntity)

    @Delete
    suspend fun remover(tarefa: TarefaEntity)
}`
        },
        {
          id: 'kt-9-5',
          title: 'Repository e injecao',
          kind: 'code',
          tags: ['android', 'repository', 'arquitetura', 'hilt'],
          minAcc: 0.93,
          xp: 40,
          brief: 'A camada que esconde de onde os dados vieram.',
          explain:
            'O ViewModel nunca fala com Retrofit ou Room diretamente. O Repository decide entre rede e cache; @Inject constructor deixa o Hilt montar tudo.',
          code: `class UsuarioRepository @Inject constructor(
    private val api: ApiService,
    private val dao: UsuarioDao
) {

    suspend fun buscar(id: Int): Usuario {
        val local = dao.porId(id)
        if (local != null) {
            return local.paraDominio()
        }
        val remoto = api.getUsuario(id)
        dao.inserir(remoto.paraEntity())
        return remoto.paraDominio()
    }

    fun observar(): Flow<List<Usuario>> {
        return dao.observarTodos().map { lista ->
            lista.map { it.paraDominio() }
        }
    }
}`
        }
      ]
    },

    /* ----------------------------------------------------------------- U10 */
    {
      id: 'kt-u10',
      title: 'Unidade 10 — Jetpack Compose',
      subtitle: 'UI declarativa: composables, estado e listas.',
      lessons: [
        {
          id: 'kt-10-1',
          title: 'Primeiro @Composable',
          kind: 'code',
          tags: ['compose', 'android', 'ui'],
          minAcc: 0.94,
          xp: 30,
          brief: 'Funcoes que descrevem a tela em vez de XML.',
          explain:
            'Um composable e uma funcao anotada com @Composable, sempre com nome em PascalCase. O parametro modifier: Modifier = Modifier e convencao obrigatoria em componentes reutilizaveis.',
          code: `@Composable
fun Saudacao(nome: String, modifier: Modifier = Modifier) {
    Text(
        text = "Ola, $nome!",
        style = MaterialTheme.typography.titleLarge,
        modifier = modifier.padding(16.dp)
    )
}

@Preview(showBackground = true)
@Composable
fun SaudacaoPreview() {
    Saudacao(nome = "Android")
}`
        },
        {
          id: 'kt-10-2',
          title: 'Column, Row e Modifier',
          kind: 'code',
          tags: ['compose', 'layout'],
          minAcc: 0.93,
          xp: 35,
          brief: 'A ordem dos modifiers importa — cada um envolve o anterior.',
          explain:
            'Column empilha na vertical, Row na horizontal. verticalArrangement e horizontalAlignment controlam o espacamento e o alinhamento. Encadeie modifiers com ponto, um por linha.',
          code: `@Composable
fun Cartao(titulo: String, subtitulo: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(text = titulo)
        Row(
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = subtitulo)
            Spacer(modifier = Modifier.width(8.dp))
        }
    }
}`
        },
        {
          id: 'kt-10-3',
          title: 'Estado com remember',
          kind: 'code',
          tags: ['compose', 'estado', 'recomposicao'],
          minAcc: 0.93,
          xp: 40,
          brief: 'by remember { mutableStateOf(...) } — o estado local da UI.',
          explain:
            'Sem remember o valor se perde a cada recomposicao. Com "by" voce le e escreve a variavel direto, sem .value. rememberSaveable sobrevive a rotacao de tela.',
          code: `@Composable
fun Contador() {
    var cliques by remember { mutableStateOf(0) }
    var texto by rememberSaveable { mutableStateOf("") }

    Column {
        Text(text = "Cliques: $cliques")

        Button(onClick = { cliques++ }) {
            Text(text = "Somar")
        }

        OutlinedTextField(
            value = texto,
            onValueChange = { texto = it },
            label = { Text("Nome") }
        )
    }
}`
        },
        {
          id: 'kt-10-4',
          title: 'LazyColumn',
          kind: 'code',
          tags: ['compose', 'lista'],
          minAcc: 0.93,
          xp: 35,
          brief: 'O RecyclerView do Compose — em oito linhas.',
          explain:
            'items() percorre a lista criando apenas o que esta visivel. Informar o key ajuda o Compose a reaproveitar itens corretamente quando a lista muda.',
          code: `@Composable
fun ListaDeTarefas(tarefas: List<Tarefa>, aoClicar: (Tarefa) -> Unit) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(tarefas, key = { it.id }) { tarefa ->
            Card(modifier = Modifier.clickable { aoClicar(tarefa) }) {
                Text(
                    text = tarefa.titulo,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }
    }
}`
        },
        {
          id: 'kt-10-5',
          title: 'Tela completa com ViewModel',
          kind: 'code',
          tags: ['compose', 'viewmodel', 'stateflow', 'arquitetura'],
          minAcc: 0.92,
          xp: 50,
          brief: 'Estado do ViewModel + Scaffold: a tela real de um app moderno.',
          explain:
            'collectAsStateWithLifecycle observa o StateFlow respeitando o ciclo de vida. O when sobre a sealed class cobre carregando, sucesso e erro — sem else, porque o compilador ja sabe todos os casos.',
          code: `@Composable
fun TarefasScreen(viewModel: TarefasViewModel = hiltViewModel()) {

    val estado by viewModel.estado.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Tarefas") }) },
        floatingActionButton = {
            FloatingActionButton(onClick = { viewModel.adicionar() }) {
                Icon(Icons.Default.Add, contentDescription = "Adicionar")
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (val atual = estado) {
                is UiState.Loading -> CircularProgressIndicator()
                is UiState.Success -> ListaDeTarefas(atual.itens) { }
                is UiState.Error -> Text(text = atual.mensagem)
            }
        }
    }
}`
        }
      ]
    },

    /* ----------------------------------------------------------------- U11 */
    {
      id: 'kt-u11',
      title: 'Unidade 11 — Desafios praticos',
      subtitle: 'Leia o enunciado, esconda a solucao e digite de cabeca.',
      lessons: [
        {
          id: 'kt-11-1',
          title: 'Desafio: media de notas',
          kind: 'challenge',
          tags: ['funcao', 'colecao', 'desafio'],
          minAcc: 0.95,
          xp: 40,
          prompt:
            'Escreva uma funcao que receba uma lista de Int e devolva a media como Double. Se a lista estiver vazia, devolva 0.0.',
          brief: 'Sem loop manual: use as funcoes de colecao.',
          explain: 'isEmpty() antes de dividir evita divisao por zero. average() ja devolve Double.',
          code: `fun media(notas: List<Int>): Double {
    if (notas.isEmpty()) {
        return 0.0
    }
    return notas.average()
}`
        },
        {
          id: 'kt-11-2',
          title: 'Desafio: data class de estado',
          kind: 'challenge',
          tags: ['data-class', 'estado', 'desafio'],
          minAcc: 0.95,
          xp: 40,
          prompt:
            'Modele o estado de uma tela de login com uma data class contendo email, senha, carregando e erro (anulavel), com valores padrao. Depois crie uma copia marcando carregando como true.',
          brief: 'Estado de UI imutavel com copy().',
          explain:
            'Data class + copy e o padrao de UI state: cada evento gera um novo estado, nunca uma mutacao no lugar.',
          code: `data class LoginState(
    val email: String = "",
    val senha: String = "",
    val carregando: Boolean = false,
    val erro: String? = null
)

val inicial = LoginState()
val enviando = inicial.copy(carregando = true, erro = null)`
        },
        {
          id: 'kt-11-3',
          title: 'Desafio: extension de validacao',
          kind: 'challenge',
          tags: ['extension', 'string', 'desafio'],
          minAcc: 0.94,
          xp: 45,
          prompt:
            'Crie uma extension em String? que devolva true quando o texto for um email valido: nao nulo, contendo "@" e pelo menos um ponto depois do arroba.',
          brief: 'Extension em tipo anulavel — o receptor pode ser null.',
          explain:
            'Extensions declaradas sobre String? podem ser chamadas em valores nulos; dentro delas "this" e anulavel e precisa ser tratado.',
          code: `fun String?.ehEmailValido(): Boolean {
    val valor = this ?: return false
    if (!valor.contains("@")) {
        return false
    }
    val dominio = valor.substringAfter("@")
    return dominio.contains(".") && dominio.length > 3
}`
        },
        {
          id: 'kt-11-4',
          title: 'Desafio: carregar com coroutine',
          kind: 'challenge',
          tags: ['coroutine', 'viewmodel', 'desafio'],
          minAcc: 0.93,
          xp: 55,
          prompt:
            'Em um ViewModel, escreva a funcao que carrega uma lista do repositorio dentro de viewModelScope, atualizando um MutableStateFlow para Loading, Success ou Error.',
          brief: 'Junta tudo: escopo, estado, tratamento de erro.',
          explain:
            'Esse bloco de 12 linhas e o esqueleto repetido em praticamente toda tela de um app Android moderno. Digite ate sair sem pensar.',
          code: `fun carregar() {
    viewModelScope.launch {
        _estado.value = UiState.Loading
        try {
            val itens = repository.listar()
            _estado.value = UiState.Success(itens)
        } catch (e: Exception) {
            _estado.value = UiState.Error(e.message ?: "erro inesperado")
        }
    }
}`
        },
        {
          id: 'kt-11-5',
          title: 'Desafio: composable de item clicavel',
          kind: 'challenge',
          tags: ['compose', 'desafio', 'ui'],
          minAcc: 0.93,
          xp: 50,
          prompt:
            'Escreva um composable ItemLista que receba titulo, subtitulo e um callback de clique, exibindo os dois textos em uma Column dentro de um Card clicavel, com modifier opcional.',
          brief: 'Convencoes de API de composable: modifier por ultimo entre os obrigatorios.',
          explain:
            'Parametros na ordem: dados, modifier, depois callbacks e slots. Isso mantem a API consistente com a biblioteca do Compose.',
          code: `@Composable
fun ItemLista(
    titulo: String,
    subtitulo: String,
    modifier: Modifier = Modifier,
    aoClicar: () -> Unit
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { aoClicar() }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = titulo, style = MaterialTheme.typography.titleMedium)
            Text(text = subtitulo, style = MaterialTheme.typography.bodySmall)
        }
    }
}`
        }
      ]
    }
  ]
};
