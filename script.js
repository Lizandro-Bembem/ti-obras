/* Monitoramento de TI em Obras
   Dados salvos no navegador (localStorage). */

const CHAVE = "ti-obras-v2";
const CHAVE_BACKUP = "ti-obras-ultimo-backup";
const DIAS_LEMBRETE = 7;
const LIMITE_EQUIP = 5;
const LIMITE_SOLIC = 3;
const STATUS = { online: "Em uso", manutencao: "Em manutenção", parado: "Equip. Parado", offline: "Offline" };
const URGENCIA = { "Normal": "online", "Média": "manutencao", "Alta": "offline" };
const SITUACOES = ["Pendente", "Aprovada", "Entregue", "Recusada"];

const GAIOLAS_PADRAO = [
    { id: "g1", nome: "Gaiola 01" },
    { id: "g2", nome: "Gaiola 02" },
    { id: "g3", nome: "Gaiola 03" },
    { id: "g4", nome: "Gaiola 04" },
    { id: "g5", nome: "Gaiola 05" },
    { id: "g6", nome: "Gaiola 06" }
];

const TIPOS_ESTOQUE = [
    "Cabo", "Câmera", "Carregador p/ Notebook", "Carregador p/ Rádio", "Carregador p/ Rádio Móvel",
    "Corrediça", "CPU", "Cooler de CPU", "DVR", "Fonte de CPU", "Gabinete", "HD",
    "Impressora", "Luva", "Maleta de Ferramentas", "Monitor", "Nobreak", "Notebook", "Rádio",
    "Roteador", "SSD", "Starlink", "Suporte de Monitor", "Suporte p/ ThinkPad", "Teclado c/ fio",
    "Teclado s/ fio", "Toner", "Tubo", "Outro"
];

function preencherTiposEstoque(valorSelecionado) {
    const sel = $("#selTipoItemEstoque");
    if (!sel) return;
    // Ordem alfabética, mantendo "Outro" sempre por último
    const ordenados = TIPOS_ESTOQUE
        .filter((t) => t !== "Outro")
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .concat("Outro");
    // Se o item editado tiver um tipo que não está mais na lista, ele é preservado
    if (valorSelecionado && !ordenados.includes(valorSelecionado)) ordenados.splice(ordenados.length - 1, 0, valorSelecionado);
    sel.innerHTML = ordenados.map((t) => `<option value="${escapar(t)}">${escapar(t)}</option>`).join("");
    if (valorSelecionado) sel.value = valorSelecionado;
}

const dadosIniciais = {
    obras: [
        { id: "o1", nome: "Alagoinhas", cidade: "", engenheiro: "", admin: "Ane" },
        { id: "o2", nome: "Camaçari", cidade: "", engenheiro: "Dr. Luiz Paixão", admin: "João Pedro" },
        { id: "o3", nome: "Cruz Das Almas", cidade: "", engenheiro: "", admin: "Matheus" },
        { id: "o4", nome: "Explanada", cidade: "", engenheiro: "", admin: "Ane" },
        { id: "o5", nome: "Jaguaripe", cidade: "", engenheiro: "Eng. José Gualdencio", admin: "Cristian" },
        { id: "o6", nome: "Santo Antônio de Jesus", cidade: "", engenheiro: "", admin: "" },
        { id: "o7", nome: "São Felipe", cidade: "", engenheiro: "", admin: "Jonas" },
        { id: "o8", nome: "Usina", cidade: "", engenheiro: "", admin: "" },
        { id: "o9", nome: "Matarandiba", cidade: "", engenheiro: "Eng. Isaildo", admin: "Ricardo" },
        { id: "o10", nome: "Wenceslau G.", cidade: "", engenheiro: "Eng. Romervan", admin: "Janderson" },
        { id: "o11", nome: "Cabaceiras do Paraguaçu", cidade: "", engenheiro: "", admin: "Matheus" },
        { id: "o12", nome: "Pedreira Capinan", cidade: "", engenheiro: "", admin: "Léo, Maximo" },
        { id: "o13", nome: "Amargosa", cidade: "", engenheiro: "", admin: "Jonas" },
        { id: "o14", nome: "Nazaré", cidade: "", engenheiro: "Eng. Artime", admin: "Ricardo" },
        { id: "o15", nome: "Castro Alves", cidade: "", engenheiro: "Eng. Ségio", admin: "Sandro" }
    ],
    equipamentos: [],
    solicitacoes: [],
    funcionarios: [],
    desligados: [],
    auditoria: [],
    estoque: [],
    mesclado: true,
    versao: 15
};

const $ = (s) => document.querySelector(s);
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };

let estado = carregar();
let obraAtual = "todas";
let telaAtual = "obras";
let abaFuncionariosAtual = "ativos";
let filtroAuditoriaAtual = "todos";
let painelGradeAberto = true;
let expandidoEquip = false;
let expandidoSolic = false;

let funcionarioEmEdicaoId = null;
let funcionarioParaReservaId = null;
let funcionarioParaDesligarId = null;
let funcionarioParaBaixaId = null;
let editandoEquip = null;
let editandoSolic = null;
let obraEmEdicaoId = null;

let exclusaoFuncPendenteId = null;
let exclusaoEquipPendenteId = null;
let exclusaoSolicPendenteId = null;

// Estoque / Gaiolas
let gaiolaAtual = "g1";
let painelGradeGaiolasAberto = true;
let editandoItemEstoqueId = null;
let gaiolaParaRemoverId = null;
let itemParaRemoverEstoqueId = null;

const ordemEquip = { campo: null, dir: 1 };
const ordemSolic = { campo: null, dir: 1 };

function normalizarEstado(d) {
    ["obras", "equipamentos", "solicitacoes", "funcionarios", "desligados", "auditoria", "estoque"]
        .forEach((k) => { d[k] = Array.isArray(d[k]) ? d[k] : []; });
    d.funcionarios = d.funcionarios.map((f) => {
        if (!Array.isArray(f.equipamentos)) {
            f.equipamentos = (f.tipoEquipamento || f.equipamento) ? [{
                tipo: f.tipoEquipamento || "Notebook",
                marca: f.nomeMarcaEquipamento || f.equipamento || "Padrão",
                dataEntrega: f.dataEntrega || dataLocal(),
                status: f.status || "Em uso"
            }] : [];
        }
        return f;
    });
    return d;
}

function carregar() {
    try {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo) return normalizarEstado(JSON.parse(salvo));
    } catch (e) { /* ignora */ }
    return structuredClone(dadosIniciais);
}

function salvar() {
    try {
        localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
        mostrarAviso("Atenção: Não foi possível salvar no navegador.");
        return false;
    }
    atualizarAvisoArmazenamento();
    return true;
}

const porNome = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR");
const nomeObra = (id) => (estado.obras.find((o) => o.id === id) || {}).nome || "-";
const nomeGaiola = (id) => (GAIOLAS_PADRAO.find((g) => g.id === id) || {}).nome || "Estoque";
const novoId = (p) => p + Math.random().toString(36).slice(2, 9);
function dataLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const formatarData = (t) => t ? new Date(t).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
function formatarDataHora(t) { return t ? new Date(t).toLocaleString("pt-BR") : "-"; }
const formatarDataSimples = (dataStr) => {
    if (!dataStr) return "-";
    const p = String(dataStr).split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dataStr;
};
const escapar = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatarIniciaisMaiusculas(texto) {
    const minusculas = new Set(["da", "de", "do", "das", "dos", "e"]);
    return texto.toLowerCase().replace(/(^|\s)(\S+)/g, (m, esp, palavra, pos) =>
        esp + ((pos > 0 && minusculas.has(palavra)) ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1)));
}

function mostrarAviso(msg, ms = 3200) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(mostrarAviso.timer);
    mostrarAviso.timer = setTimeout(() => t.classList.remove("show"), ms);
}

/* Modal do próprio sistema (substitui alert/confirm do navegador).
   Retorna uma Promise: true = confirmou, false = cancelou / fechou. */
function mostrarModalSistema(titulo, mensagem, comConfirmacao = false) {
    return new Promise((resolve) => {
        const dlg = $("#dlgAvisoSistema");
        if (!dlg || dlg.open) { resolve(false); return; }

        $("#tituloAvisoSistema").textContent = titulo || "Aviso";
        $("#textoAvisoSistema").textContent = mensagem || "";

        const btnOk = $("#btnConfirmarAviso");
        const btnCancelar = $("#btnCancelarAviso");
        btnCancelar.hidden = !comConfirmacao;
        btnOk.textContent = comConfirmacao ? "Sim" : "OK";

        let resultado = false;
        btnOk.onclick = (ev) => { ev.preventDefault(); resultado = true; dlg.close(); };
        btnCancelar.onclick = (ev) => { ev.preventDefault(); resultado = false; dlg.close(); };
        dlg.onclose = () => { dlg.onclose = null; resolve(resultado); };

        dlg.showModal();
    });
}

/* Rede de segurança: nenhum alert() nativo aparece; vira modal do sistema.
   E nenhum balão de validação nativo ("Preencha este campo") aparece. */
window.alert = (msg) => { mostrarModalSistema("Aviso do Sistema", String(msg ?? "")); };
document.addEventListener("invalid", (ev) => ev.preventDefault(), true);

/* ==========================================================================
   AUTENTICAÇÃO
   ========================================================================== */

const CHAVE_ACESSO = "ti-obras-acesso";
const CHAVE_SESSAO = "ti-obras-sessao";
let modoLogin = "entrar";

/* Hash antigo — mantido apenas para validar senhas criadas em versões anteriores. */
function hashTexto(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return "h_" + Math.abs(hash).toString(36);
}

/* Hash forte SHA-256 com salt (WebCrypto). Em contexto sem suporte (http/file://), usa o hash antigo. */
async function hashSenhaForte(senha, salt) {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        const dados = new TextEncoder().encode(`${salt}:${senha}`);
        const resumo = await crypto.subtle.digest("SHA-256", dados);
        return "s_" + [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return hashTexto(senha);
}

function gerarSalt() {
    if (window.crypto && crypto.getRandomValues) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return String(Date.now());
}

function lerAcesso() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ACESSO)); } catch (e) { return null; }
}
function gravarAcesso(obj) { localStorage.setItem(CHAVE_ACESSO, JSON.stringify(obj)); }

/* Cria o registro de acesso com hash SHA-256 + salt. */
async function criarAcesso(senha, codigo) {
    const salt = gerarSalt();
    const hash = await hashSenhaForte(senha, salt);
    return { algo: "sha256", salt, hash, codigo };
}

/* Verifica a senha e migra automaticamente senhas antigas (hash fraco) para SHA-256. */
async function verificarSenha(senha) {
    const acesso = lerAcesso();
    if (!acesso) return false;
    if (acesso.algo === "sha256" && acesso.salt && acesso.hash) {
        return (await hashSenhaForte(senha, acesso.salt)) === acesso.hash;
    }
    if (hashTexto(senha) === acesso.hash) {
        try {
            gravarAcesso(await criarAcesso(senha, acesso.codigo || ""));
        } catch (e) { /* mantém o formato antigo se não for possível migrar */ }
        return true;
    }
    return false;
}

function definirModoLogin(modo) {
    modoLogin = modo;
    const titulos = {
        criar: ["Criar senha", "Primeiro acesso: defina sua senha de entrada.", "Criar senha e entrar", "Nova senha"],
        entrar: ["Entrar", "Digite sua senha para acessar o sistema.", "Entrar", "Senha"],
        recuperar: ["Redefinir senha", "Informe o código de recuperação e a nova senha.", "Redefinir e entrar", "Nova senha"]
    }[modo];

    $("#loginTitulo").textContent = titulos[0];
    $("#loginSub").textContent = titulos[1];
    $("#btnLogin").textContent = titulos[2];
    $("#rotuloSenha").textContent = titulos[3];
    $("#grupoCodigo").hidden = modo !== "recuperar";
    $("#grupoConfirma").hidden = modo === "entrar";
    $("#linkTroca").hidden = modo === "criar";
    $("#linkTroca").textContent = modo === "recuperar" ? "Voltar" : "Esqueci a senha";
    $("#loginSenha").value = "";
    $("#loginConfirma").value = "";
    $("#loginCodigo").value = "";
    $("#loginErro").hidden = true;
}

function entrarNoSistema() {
    sessionStorage.setItem(CHAVE_SESSAO, "autenticado");
    document.body.classList.add("autenticado");
    $("#telaLogin").style.display = "none";
    renderTudo();
}

function gerarCodigoRecuperacao() {
    const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const letras = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join("");
    return `${letras.slice(0, 4)}-${letras.slice(4, 8)}-${letras.slice(8, 12)}`;
}

/* ==========================================================================
   PWA — INSTALAÇÃO NO CELULAR E ATUALIZAÇÕES
   ========================================================================== */

let promptInstalacao = null;
const CHAVE_INSTALAR_DISPENSADO = "ti-obras-instalar-dispensado";

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    promptInstalacao = e;
    atualizarInterfaceInstalar();
});

window.addEventListener("appinstalled", () => {
    promptInstalacao = null;
    atualizarInterfaceInstalar();
    mostrarAviso("Aplicativo instalado com sucesso!");
});

function ehIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function estaRodandoInstalado() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function instalacaoDisponivel() {
    return !!promptInstalacao || ehIOS();
}

function atualizarInterfaceInstalar() {
    const disponivel = instalacaoDisponivel() && !estaRodandoInstalado();
    ["#btnInstalarApp", "#btnInstalarLogin"].forEach((s) => {
        const el = $(s);
        if (el) el.hidden = !disponivel;
    });
    const barra = $("#barraInstalar");
    if (barra) {
        const dispensado = sessionStorage.getItem(CHAVE_INSTALAR_DISPENSADO) === "1";
        barra.hidden = !(promptInstalacao && !estaRodandoInstalado() && !dispensado);
    }
}

function abrirModalInstalar() {
    const dlg = $("#dlgInstalar");
    if (!dlg) return;
    const botao = $("#btnInstalarAgora");
    const texto = $("#textoInstalar");

    if (estaRodandoInstalado()) {
        texto.textContent = "O aplicativo já está instalado neste dispositivo. Procure o ícone \"TI em Obras\" na tela inicial.";
        botao.hidden = true;
    } else if (promptInstalacao) {
        texto.textContent = "Instale o TI em Obras no seu celular para abrir direto da tela inicial, em tela cheia e funcionando até sem internet.";
        botao.hidden = false;
    } else if (ehIOS()) {
        texto.innerHTML = "No iPhone/iPad, siga os passos:<br><br>" +
            "<strong>1.</strong> Toque no botão <strong>Compartilhar</strong> do Safari (quadrado com seta para cima).<br>" +
            "<strong>2.</strong> Toque em <strong>Adicionar à Tela de Início</strong>.<br>" +
            "<strong>3.</strong> Toque em <strong>Adicionar</strong>. Pronto!";
        botao.hidden = true;
    } else {
        texto.textContent = "Abra este site no Chrome (no celular ou no computador) e use a opção \"Instalar aplicativo\" do menu do navegador.";
        botao.hidden = true;
    }
    const sb = $("#sidebar");
    if (sb) sb.classList.remove("aberta");
    dlg.showModal();
}

function fecharBarraInstalar() {
    sessionStorage.setItem(CHAVE_INSTALAR_DISPENSADO, "1");
    atualizarInterfaceInstalar();
}

function instalarAgora() {
    if (!promptInstalacao) { abrirModalInstalar(); return; }
    promptInstalacao.prompt();
    if (promptInstalacao.userChoice) {
        promptInstalacao.userChoice.then(() => {
            promptInstalacao = null;
            atualizarInterfaceInstalar();
        }).catch(() => {});
    }
    const dlg = $("#dlgInstalar");
    if (dlg) dlg.close();
}

/* Service Worker: só registra em contexto seguro (https ou localhost) */
function registrarServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    const seguro = window.isSecureContext || location.protocol === "https:" ||
        ["localhost", "127.0.0.1"].includes(location.hostname);
    if (!seguro) return;
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then((reg) => {
                reg.addEventListener("updatefound", () => {
                    const nw = reg.installing;
                    if (!nw) return;
                    nw.addEventListener("statechange", () => {
                        if (nw.state === "installed" && navigator.serviceWorker.controller) {
                            mostrarAviso("Nova versão disponível. Feche e abra o aplicativo novamente para atualizar.", 6000);
                        }
                    });
                });
            })
            .catch(() => { /* ambiente sem suporte: o sistema segue funcionando normalmente */ });
    });
}
registrarServiceWorker();

/* ==========================================================================
   INICIALIZAÇÃO DOS EVENTOS
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ----- Navegação Estoque -----
    $("#btnMenuEstoque").addEventListener("click", () => {
        painelGradeGaiolasAberto = true;
        alternarTela("estoque");
    });

    $("#btnVoltarListaGaiolas").addEventListener("click", () => {
        painelGradeGaiolasAberto = true;
        renderTudoEstoque();
    });

    $("#gradeGaiolas").addEventListener("click", (ev) => {
        const card = ev.target.closest("[data-gaiola]");
        if (!card) return;
        gaiolaAtual = card.dataset.gaiola;
        painelGradeGaiolasAberto = false;
        renderTudoEstoque();
    });

    $("#buscaGaiolaLista").addEventListener("input", renderGradeGaiolas);
    $("#buscaEstoque").addEventListener("input", renderTabelaEstoque);
    $("#filtroSetorEstoque").addEventListener("change", renderTabelaEstoque);
    $("#filtroStatusEstoque").addEventListener("change", renderTabelaEstoque);

    // Botões de Ação na Gaiola
    $("#btnNovoItemEstoque").addEventListener("click", () => abrirModalItemEstoque(null));
    $("#cancelaItemEstoque").addEventListener("click", () => $("#dlgItemEstoque").close());

    // Regra automática de Setor (TI/ADM) trocando Equipamento/Material
    $("#selSetorItem").addEventListener("change", (e) => {
        const classificacaoInput = $("#inputClassificacaoAuto");
        if (classificacaoInput) {
            classificacaoInput.value = e.target.value === "TI" ? "Equipamento" : "Material";
        }
    });

    // Submissão do Cadastro/Edição de Item no Estoque
    $("#formItemEstoque").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const setor = f.get("setor");
        const tipo = f.get("tipo");
        const nome = (f.get("nome") || "").trim();
        const status = f.get("status");

        if (!setor || !tipo || !nome || !status) {
            mostrarAviso("Preencha todas as informações para cadastrar o item.");
            return;
        }

        const classificacao = setor === "TI" ? "Equipamento" : "Material";

        if (editandoItemEstoqueId) {
            const item = estado.estoque.find((i) => i.id === editandoItemEstoqueId);
            if (item) {
                if (item.status !== status && status === "Em uso") {
                    item.dataEntrada = Date.now();
                    item.ultimoAlerta = 0;
                }
                item.setor = setor;
                item.classificacao = classificacao;
                item.tipo = tipo;
                item.nome = nome;
                item.status = status;
                registrar("edicao", "Item do estoque atualizado", nome, nomeGaiola(item.gaiola), `Setor: ${setor} | Status: ${status}`);
                mostrarAviso("Item atualizado com sucesso!");
            }
            editandoItemEstoqueId = null;
        } else {
            estado.estoque.unshift({
                id: novoId("est"),
                gaiola: gaiolaAtual,
                setor,
                classificacao,
                tipo,
                nome,
                status,
                dataEntrada: Date.now(),
                ultimoAlerta: 0
            });
            registrar("novo", "Item cadastrado no estoque", nome, nomeGaiola(gaiolaAtual), `Tipo: ${tipo} | Setor: ${setor}`);
            mostrarAviso("Item cadastrado com sucesso.");
        }
        salvar();
        $("#dlgItemEstoque").close();
        renderTudoEstoque();
    });

    // Ações na tabela de itens (Editar / Remover com modal do sistema)
    $("#corpoTabelaEstoque").addEventListener("click", (ev) => {
        const ed = ev.target.closest("[data-editar-item]");
        if (ed) {
            const item = estado.estoque.find((i) => i.id === ed.dataset.editarItem);
            if (item) abrirModalItemEstoque(item);
            return;
        }
        const rem = ev.target.closest("[data-remover-item]");
        if (rem) {
            const item = estado.estoque.find((i) => i.id === rem.dataset.removerItem);
            if (!item) return;
            itemParaRemoverEstoqueId = item.id;
            $("#textoConfirmarRemoverItemEstoque").innerHTML = `
                <strong>Item:</strong> <span>${escapar(item.nome)} (${escapar(item.tipo)})</span><br>
                <small style="color: var(--texto-suave);">Setor: ${escapar(item.setor)} | Status: ${escapar(item.status)}</small>`;
            $("#dlgRemoverItemEstoque").showModal();
        }
    });

    $("#cancelaRemoverItemEstoque").addEventListener("click", () => {
        itemParaRemoverEstoqueId = null;
        $("#dlgRemoverItemEstoque").close();
    });

    $("#formRemoverItemEstoqueModal").addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (itemParaRemoverEstoqueId) {
            const item = estado.estoque.find((i) => i.id === itemParaRemoverEstoqueId);
            if (item) {
                estado.estoque = estado.estoque.filter((i) => i.id !== item.id);
                registrar("remocao", "Item removido do estoque", item.nome, nomeGaiola(item.gaiola), "");
                salvar();
                renderTudoEstoque();
                mostrarAviso("Item removido.");
            }
        }
        itemParaRemoverEstoqueId = null;
        $("#dlgRemoverItemEstoque").close();
    });

    // Esvaziar gaiola com modal e senha (funciona mesmo vazia)
    $("#btnRemoverItemEstoque").addEventListener("click", () => {
        gaiolaParaRemoverId = gaiolaAtual;
        const nomeG = nomeGaiola(gaiolaAtual);
        const qtdItens = estado.estoque.filter((i) => i.gaiola === gaiolaAtual).length;

        $("#textoExcluirGaiola").textContent = `Você deseja esvaziar ${nomeG}? (${qtdItens} item(ns) serão removidos). Digite sua senha para confirmar:`;
        $("#inputSenhaRemoverGaiola").value = "";
        $("#erroSenhaRemoverGaiola").hidden = true;
        $("#dlgSenhaRemoverGaiola").showModal();
    });

    $("#cancelaSenhaRemoverGaiola").addEventListener("click", () => {
        gaiolaParaRemoverId = null;
        $("#dlgSenhaRemoverGaiola").close();
    });

    $("#formSenhaRemoverGaiola").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const senhaDigitada = $("#inputSenhaRemoverGaiola").value.trim();

        if (!(await verificarSenha(senhaDigitada))) {
            $("#erroSenhaRemoverGaiola").hidden = false;
            $("#erroSenhaRemoverGaiola").textContent = senhaDigitada ? "Senha incorreta. Ação não autorizada." : "Digite a senha do sistema.";
            return;
        }

        if (gaiolaParaRemoverId) {
            const nomeG = nomeGaiola(gaiolaParaRemoverId);
            estado.estoque = estado.estoque.filter((i) => i.gaiola !== gaiolaParaRemoverId);
            registrar("remocao", "Gaiola esvaziada", nomeG, nomeG, "Itens removidos com confirmação de senha");
            salvar();
            renderTudoEstoque();
            mostrarAviso(`Itens de ${nomeG} removidos com sucesso.`);
        }
        gaiolaParaRemoverId = null;
        $("#dlgSenhaRemoverGaiola").close();
    });

    // Exportações do Estoque (Individual da Gaiola)
    $("#btnExportarEstoqueExcel").addEventListener("click", () => exportarEstoqueExcel());
    $("#btnExportarEstoquePdf").addEventListener("click", () => exportarEstoquePdf());

    // Exportações do Estoque (Geral: todas as gaiolas, na tela de lista)
    $("#btnExportarEstoqueGeralExcel").addEventListener("click", () => exportarEstoqueGeralExcel());
    $("#btnExportarEstoqueGeralPdf").addEventListener("click", () => exportarEstoqueGeralPdf());

    // ----- Login -----
    $("#formLogin").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const senha = $("#loginSenha").value.trim();
        const confirma = $("#loginConfirma").value.trim();
        const erro = $("#loginErro");
        const falha = (msg) => { erro.hidden = false; erro.textContent = msg; };

        if (modoLogin === "criar") {
            if (senha.length < 4) return falha("A senha deve ter no mínimo 4 caracteres.");
            if (senha !== confirma) return falha("As senhas não conferem.");
            const codigoNovo = gerarCodigoRecuperacao();
            gravarAcesso(await criarAcesso(senha, codigoNovo));
            $("#codigoRecuperacao").textContent = codigoNovo;
            $("#dlgCodigo").showModal();
            return;
        }

        if (modoLogin === "recuperar") {
            const cod = $("#loginCodigo").value.trim().toUpperCase();
            const acesso = lerAcesso();
            if (!acesso || cod !== acesso.codigo) return falha("Código de recuperação incorreto.");
            if (senha.length < 4 || senha !== confirma) return falha("Verifique os campos de nova senha.");
            gravarAcesso(await criarAcesso(senha, acesso.codigo));
            entrarNoSistema();
            return;
        }

        const acesso = lerAcesso();
        if (!acesso) { definirModoLogin("criar"); return; }
        if (await verificarSenha(senha)) entrarNoSistema();
        else falha("Senha incorreta. Tente novamente.");
    });

    $("#linkTroca").addEventListener("click", () => {
        definirModoLogin(modoLogin === "recuperar" ? "entrar" : "recuperar");
    });

    $("#verSenha").addEventListener("click", () => {
        const inp = $("#loginSenha");
        const ver = inp.type === "password";
        inp.type = ver ? "text" : "password";
        $("#loginConfirma").type = ver ? "text" : "password";
        $("#verSenha").textContent = ver ? "Ocultar" : "Mostrar";
    });

    $("#btnSair").addEventListener("click", () => {
        sessionStorage.removeItem(CHAVE_SESSAO);
        location.reload();
    });

    // ----- Navegação -----
    $("#btnMenuResumo").addEventListener("click", () => alternarTela("resumo"));
    $("#btnMenuFuncionarios").addEventListener("click", () => alternarTela("funcionarios"));
    $("#btnMenuAuditoria").addEventListener("click", () => alternarTela("auditoria"));
    $("#btnMenuObras").addEventListener("click", () => {
        painelGradeAberto = true;
        if (telaAtual !== "obras") alternarTela("obras");
        else { $("#sidebar").classList.remove("aberta"); renderTudo(); }
    });

    $("#btnVoltarListaObras").addEventListener("click", () => {
        painelGradeAberto = true;
        renderTudo();
    });

    $("#gradeObras").addEventListener("click", (ev) => {
        const card = ev.target.closest("[data-obra]");
        if (!card) return;
        obraAtual = card.dataset.obra;
        painelGradeAberto = false;
        expandidoEquip = false;
        expandidoSolic = false;
        renderTudo();
    });

    $("#buscaObraLista").addEventListener("input", renderGradeObras);

    // ----- Navegação inferior (estilo aplicativo de celular) -----
    document.querySelectorAll(".bottom-nav-item[data-tela]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const tela = btn.dataset.tela;
            if (tela === "obras") painelGradeAberto = true;
            if (tela === "estoque") painelGradeGaiolasAberto = true;
            if (telaAtual === tela) window.scrollTo({ top: 0, behavior: "smooth" });
            alternarTela(tela);
        });
    });
    on("#btnTabMais", "click", () => $("#sidebar").classList.toggle("aberta"));

    // ----- Instalação do aplicativo (PWA) -----
    on("#btnInstalarApp", "click", abrirModalInstalar);
    on("#btnInstalarLogin", "click", abrirModalInstalar);
    on("#btnInstalarBarra", "click", instalarAgora);
    on("#btnFecharBarraInstalar", "click", fecharBarraInstalar);
    on("#btnFecharInstalar", "click", () => $("#dlgInstalar").close());
    on("#btnInstalarAgora", "click", instalarAgora);
    atualizarInterfaceInstalar();

    // ----- KPIs e filtros de equipamentos -----
    $("#kpis").addEventListener("click", (ev) => {
        const btnKpi = ev.target.closest("[data-kpi-status]");
        if (!btnKpi) return;
        $("#filtroStatus").value = btnKpi.dataset.kpiStatus;
        renderTabela();
        renderKpis();
    });
    $("#kpis").addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const k = ev.target.closest("[data-kpi-status]");
        if (k) { ev.preventDefault(); k.click(); }
    });

    $("#busca").addEventListener("input", renderTabela);
    $("#filtroStatus").addEventListener("change", () => { renderTabela(); renderKpis(); });
    $("#filtroTipo").addEventListener("change", renderTabela);
    $("#limparFiltrosEquip").addEventListener("click", () => {
        $("#busca").value = ""; $("#filtroStatus").value = ""; $("#filtroTipo").value = "";
        renderTabela(); renderKpis();
    });
    $("#btnVerTodosEquip").addEventListener("click", () => { expandidoEquip = !expandidoEquip; renderTabela(); });

    // ----- Obras: nova / editar -----
    ["#btnNovaObraTop", "#btnNovaObra"].forEach((s) => on(s, "click", abrirNovaObra));
    $("#cancelaObra").addEventListener("click", () => $("#dlgObra").close());
    $("#formObra").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const nome = (f.get("nome") || "").trim();
        const eng = (f.get("engenheiro") || "").trim();
        const adm = (f.get("admin") || "").trim();
        const cid = (f.get("cidade") || "").trim();
        if (!nome) { mostrarAviso("Preencha o nome da obra."); return; }
        const duplicada = estado.obras.some((o) => o.id !== obraEmEdicaoId && o.nome.trim().toLowerCase() === nome.toLowerCase());
        if (duplicada) { mostrarAviso("Já existe uma obra com esse nome."); return; }

        if (obraEmEdicaoId) {
            const ob = estado.obras.find((o) => o.id === obraEmEdicaoId);
            if (ob) {
                ob.nome = nome; ob.engenheiro = eng; ob.admin = adm; ob.cidade = cid;
                registrar("edicao", "Obra atualizada", nome, nome, `Engenheiro: ${eng || "-"} | Escritório: ${adm || "-"}`);
                mostrarAviso("Obra atualizada com sucesso!");
            }
            obraEmEdicaoId = null;
        } else {
            estado.obras.push({ id: novoId("o"), nome, engenheiro: eng, admin: adm, cidade: cid });
            registrar("novo", "Obra cadastrada", nome, nome, "");
            mostrarAviso("Obra cadastrada.");
        }
        salvar();
        $("#dlgObra").close();
        renderTudo();
    });

    // ----- Obras: remover -----
    ["#btnRemoverObraTop", "#btnRemoverObra"].forEach((s) => on(s, "click", abrirRemoverObra));
    $("#selObraRemover").addEventListener("change", atualizarAvisoRemoverObra);
    $("#cancelaRemoverObra").addEventListener("click", () => $("#dlgRemoverObra").close());
    $("#formRemoverObra").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const id = $("#selObraRemover").value;
        if (!id) return;
        const nomeRem = nomeObra(id);
        const confirmadoObra = await mostrarModalSistema("Remover Obra", `Remover a obra "${nomeRem}" e todos os seus equipamentos e solicitações? Isso não pode ser desfeito.`, true);
        if (!confirmadoObra) return;
        estado.obras = estado.obras.filter((o) => o.id !== id);
        estado.equipamentos = estado.equipamentos.filter((e) => e.obra !== id);
        estado.solicitacoes = estado.solicitacoes.filter((s) => s.obra !== id);
        registrar("remocao", "Obra removida", nomeRem, nomeRem, "Equipamentos e solicitações removidos junto");
        if (obraAtual === id) { obraAtual = "todas"; painelGradeAberto = true; }
        salvar();
        $("#dlgRemoverObra").close();
        renderTudo();
        mostrarAviso("Obra removida.");
    });

    // ----- Backup -----
    $("#btnBackup").addEventListener("click", () => {
        const dados = { app: "ti-obras", exportadoEm: new Date().toISOString(), ...estado };
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
        baixarArquivo(blob, `backup-ti-obras-${dataLocal()}.json`);
        localStorage.setItem(CHAVE_BACKUP, String(Date.now()));
        registrar("sistema", "Exportação", "Backup", "-", "Backup completo salvo");
        atualizarInfoBackup();
        $("#sidebar").classList.remove("aberta");
    });
    $("#btnBackupFaixa").addEventListener("click", () => $("#btnBackup").click());

    $("#btnRestaurar").addEventListener("click", () => $("#arquivoBackup").click());
    $("#arquivoBackup").addEventListener("change", async (ev) => {
        const arquivo = ev.target.files[0];
        if (!arquivo) return;
        const confirmadoBackup = await mostrarModalSistema("Restaurar Backup", "Restaurar este backup vai substituir TODOS os dados atuais. Continuar?", true);
        if (!confirmadoBackup) {
            ev.target.value = "";
            return;
        }
        try {
            const d = JSON.parse(await arquivo.text());
            if (d && Array.isArray(d.obras)) {
                estado = normalizarEstado(d);
                obraAtual = "todas";
                painelGradeAberto = true;
                painelGradeGaiolasAberto = true;
                salvar();
                if (telaAtual === "estoque") renderTudoEstoque(); else renderTudo();
                mostrarAviso("Backup restaurado com sucesso.");
            } else {
                mostrarAviso("Arquivo de backup inválido.");
            }
        } catch (e) {
            mostrarAviso("Arquivo de backup inválido.");
        }
        ev.target.value = "";
    });

    // ----- Alterar senha -----
    $("#btnAlterarSenha").addEventListener("click", () => {
        $("#formAlterarSenha").reset();
        $("#erroAlterar").hidden = true;
        $("#sidebar").classList.remove("aberta");
        $("#dlgAlterarSenha").showModal();
    });
    $("#cancelaAlterar").addEventListener("click", () => $("#dlgAlterarSenha").close());
    $("#formAlterarSenha").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const el = $("#formAlterarSenha").elements;
        const atual = el.atual.value.trim();
        const nova = el.nova.value.trim();
        const conf = el.confirma.value.trim();
        const acesso = lerAcesso();

        if (!(await verificarSenha(atual))) { mostrarAviso("Senha atual incorreta."); return; }
        if (nova.length < 4 || nova !== conf) {
            mostrarAviso("A nova senha deve ter no mínimo 4 caracteres e ser idêntica nos dois campos.");
            return;
        }
        gravarAcesso(await criarAcesso(nova, acesso ? acesso.codigo : ""));
        $("#dlgAlterarSenha").close();
        mostrarAviso("Senha alterada com sucesso.");
    });

    // ----- Código de recuperação -----
    $("#dlgCodigo").addEventListener("cancel", (ev) => ev.preventDefault());
    $("#copiarCodigo").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText($("#codigoRecuperacao").textContent); mostrarAviso("Código copiado."); }
        catch (e) { mostrarAviso("Não foi possível copiar. Anote o código manualmente."); }
    });
    $("#formCodigo").addEventListener("submit", (ev) => {
        ev.preventDefault();
        $("#dlgCodigo").close();
        entrarNoSistema();
    });

    // ----- Equipamentos -----
    $("#btnNovoEquip").addEventListener("click", () => {
        editandoEquip = null;
        $("#formEquip").reset();
        preencherSelObra($("#selObra"), obraAtual !== "todas" ? obraAtual : "");
        preencherSelPessoas($("#selResponsavel"), "");
        $("#tituloEquip").textContent = "Novo equipamento";
        $("#grupoQtdEquip").hidden = false;
        $("#dlgEquip").showModal();
    });
    $("#cancelaEquip").addEventListener("click", () => $("#dlgEquip").close());
    $("#selObra").addEventListener("change", (e) => preencherSelPessoas($("#selResponsavel"), "", e.target.value));

    $("#formEquip").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const dados = { nome: (f.get("nome") || "").trim(), tipo: f.get("tipo"), obra: f.get("obra"), responsavel: (f.get("responsavel") || "").trim(), status: f.get("status") };
        if (!dados.nome) { mostrarAviso("Preencha o nome do equipamento."); return; }
        if (!dados.obra) { mostrarAviso("Selecione a obra do equipamento."); return; }

        if (editandoEquip) {
            const eq = estado.equipamentos.find((e) => e.id === editandoEquip);
            if (eq) {
                Object.assign(eq, dados);
                registrar("edicao", "Equipamento editado", dados.nome, nomeObra(dados.obra), `Status: ${STATUS[dados.status]}`);
            }
        } else {
            const qtd = Math.min(50, Math.max(1, parseInt(f.get("qtd"), 10) || 1));
            for (let i = 1; i <= qtd; i++) {
                estado.equipamentos.unshift({ id: novoId("e"), ...dados, nome: qtd > 1 ? `${dados.nome} ${String(i).padStart(2, "0")}` : dados.nome });
            }
            registrar("novo", "Equipamento cadastrado", dados.nome, nomeObra(dados.obra), `Quantidade: ${qtd}`);
        }
        salvar();
        $("#dlgEquip").close();
        renderFiltros();
        renderTabela();
        renderKpis();
    });

    $("#corpoTabela").addEventListener("click", (ev) => {
        const ed = ev.target.closest("[data-editar]");
        if (ed) {
            const eq = estado.equipamentos.find((e) => e.id === ed.dataset.editar);
            if (!eq) return;
            editandoEquip = eq.id;
            preencherSelObra($("#selObra"), eq.obra);
            preencherSelPessoas($("#selResponsavel"), eq.responsavel, eq.obra);
            const f = $("#formEquip").elements;
            $("#tituloEquip").textContent = "Editar equipamento";
            $("#grupoQtdEquip").hidden = true;
            f.nome.value = eq.nome; f.tipo.value = eq.tipo; f.status.value = eq.status;
            $("#dlgEquip").showModal();
            return;
        }
        const rem = ev.target.closest("[data-remover]");
        if (rem) {
            const eq = estado.equipamentos.find((e) => e.id === rem.dataset.remover);
            if (!eq) return;
            exclusaoEquipPendenteId = eq.id;
            $("#textoConfirmarExclusaoEquip").innerHTML = `
        <strong>Equipamento:</strong>
        <span>${escapar(eq.nome)} (${escapar(eq.tipo)})</span><br>
        <small style="color: var(--texto-suave);">Obra: ${escapar(nomeObra(eq.obra))}</small>`;
            $("#dlgConfirmarExclusaoEquip").showModal();
        }
    });

    $("#cancelaConfirmarExclusaoEquip").addEventListener("click", () => {
        exclusaoEquipPendenteId = null;
        $("#dlgConfirmarExclusaoEquip").close();
    });
    $("#formConfirmarExclusaoEquip").addEventListener("submit", (ev) => {
        ev.preventDefault();
        if (exclusaoEquipPendenteId) {
            const eq = estado.equipamentos.find((e) => e.id === exclusaoEquipPendenteId);
            estado.equipamentos = estado.equipamentos.filter((e) => e.id !== exclusaoEquipPendenteId);
            if (eq) registrar("remocao", "Equipamento removido", eq.nome, nomeObra(eq.obra), `Tipo: ${eq.tipo}`);
            salvar();
            renderFiltros();
            renderTabela();
            renderKpis();
            mostrarAviso("Equipamento removido.");
        }
        exclusaoEquipPendenteId = null;
        $("#dlgConfirmarExclusaoEquip").close();
    });

    // ----- Menu lateral (recolher / mobile) -----
    document.querySelectorAll(".btn-toggle-sidebar").forEach((b) => {
        b.addEventListener("click", () => document.body.classList.toggle("menu-recolhido"));
    });
    ["#menuToggle", "#menuToggleFunc", "#menuToggleAudit", "#menuToggleResumo", "#menuToggleEstoque"].forEach((s) =>
        on(s, "click", () => $("#sidebar").classList.toggle("aberta")));
    document.addEventListener("click", (ev) => {
        const sb = $("#sidebar");
        if (sb.classList.contains("aberta") && !ev.target.closest("#sidebar, .menu-toggle")) sb.classList.remove("aberta");
    });

    // ----- Solicitações -----
    on("#btnNovaSolic", "click", () => {
        if (!estado.obras.length) { mostrarAviso("Cadastre uma obra primeiro."); return; }
        abrirSolic(null);
    });
    on("#cancelaSolic", "click", () => $("#dlgSolic").close());
    on("#selObraSolic", "change", (e) => preencherSelPessoas($("#selSolicitante"), "", e.target.value));

    on("#formSolic", "submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const dados = {
            obra: f.get("obra"),
            equipamento: (f.get("equipamento") || "").trim(),
            tipo: f.get("tipo"),
            quantidade: Math.max(1, parseInt(f.get("quantidade"), 10) || 1),
            solicitante: f.get("solicitante") || "",
            urgencia: f.get("urgencia"),
            motivo: (f.get("motivo") || "").trim()
        };
        if (!dados.equipamento) { mostrarAviso("Preencha o nome do equipamento solicitado."); return; }
        if (!dados.obra) { mostrarAviso("Selecione a obra da solicitação."); return; }

        if (editandoSolic) {
            const s = estado.solicitacoes.find((x) => x.id === editandoSolic);
            if (s) {
                Object.assign(s, dados);
                registrar("edicao", "Solicitação editada", dados.equipamento, nomeObra(dados.obra), `Urgência: ${dados.urgencia}`);
            }
        } else {
            estado.solicitacoes.unshift({ id: novoId("s"), ...dados, situacao: "Pendente", data: Date.now() });
            registrar("novo", "Solicitação criada", dados.equipamento, nomeObra(dados.obra), `Qtd: ${dados.quantidade} | Urgência: ${dados.urgencia}`);
        }
        salvar();
        $("#dlgSolic").close();
        mostrarAviso("Solicitação salva.");
        renderTudo();
    });

    on("#corpoSolic", "click", (ev) => {
        const ed = ev.target.closest("[data-editar-solic]");
        if (ed) { abrirSolic(estado.solicitacoes.find((x) => x.id === ed.dataset.editarSolic)); return; }
        const rm = ev.target.closest("[data-remover-solic]");
        if (rm) {
            const s = estado.solicitacoes.find((x) => x.id === rm.dataset.removerSolic);
            if (!s) return;
            exclusaoSolicPendenteId = s.id;
            $("#textoConfirmarExclusaoSolic").innerHTML = `
          <strong>Equipamento solicitado:</strong>
          <span>${escapar(s.equipamento)} (${escapar(s.tipo)} — Qtd: ${escapar(s.quantidade)})</span><br>
          <small style="color: var(--texto-suave);">Obra: ${escapar(nomeObra(s.obra))} | Solicitante: ${escapar(s.solicitante || "-")}</small>`;
            $("#dlgConfirmarExclusaoSolic").showModal();
        }
    });
    on("#cancelaConfirmarExclusaoSolic", "click", () => {
        exclusaoSolicPendenteId = null;
        $("#dlgConfirmarExclusaoSolic").close();
    });
    on("#formConfirmarExclusaoSolic", "submit", (ev) => {
        ev.preventDefault();
        if (exclusaoSolicPendenteId) {
            const s = estado.solicitacoes.find((x) => x.id === exclusaoSolicPendenteId);
            if (s) {
                estado.solicitacoes = estado.solicitacoes.filter((x) => x.id !== s.id);
                registrar("remocao", "Solicitação removida", s.equipamento, nomeObra(s.obra), "");
                salvar();
                renderTudo();
                mostrarAviso("Solicitação removida.");
            }
        }
        exclusaoSolicPendenteId = null;
        $("#dlgConfirmarExclusaoSolic").close();
    });
    on("#corpoSolic", "change", (ev) => {
        const sel = ev.target.closest("[data-situacao]");
        if (!sel) return;
        const s = estado.solicitacoes.find((x) => x.id === sel.dataset.situacao);
        if (!s) return;
        s.situacao = sel.value;
        registrar("edicao", "Situação da solicitação alterada", s.equipamento, nomeObra(s.obra), `Nova situação: ${s.situacao}`);
        salvar();
        mostrarAviso(`Situação: ${s.situacao}`);
    });

    ["mousedown", "change"].forEach((evento) => {
        on("#filtroSituacao", evento, () => {
            const el = $("#filtroSituacao");
            el.classList.remove("animar-filtro-situacao");
            void el.offsetWidth;
            el.classList.add("animar-filtro-situacao");
        });
    });
    on("#filtroSituacao", "change", () => { renderSolicitacoes(); atualizarLimparSolic(); });
    on("#filtroUrgencia", "change", () => { renderSolicitacoes(); atualizarLimparSolic(); });
    on("#limparFiltrosSolic", "click", () => {
        $("#filtroSituacao").value = ""; $("#filtroUrgencia").value = "";
        renderSolicitacoes(); atualizarLimparSolic();
    });
    on("#btnVerTodasSolic", "click", () => { expandidoSolic = !expandidoSolic; renderSolicitacoes(); });

    // ----- Auditoria -----
    on("#btnArquivarAudit", "click", () => arquivarAuditoria());
    on("#btnArquivarFaixa", "click", () => arquivarAuditoria());
    on("#buscaAudit", "input", renderAuditoria);
    on("#filtroDataInicio", "change", renderAuditoria);
    on("#filtroDataFim", "change", renderAuditoria);
    on("#limparFiltrosDataAudit", "click", () => {
        $("#filtroDataInicio").value = "";
        $("#filtroDataFim").value = "";
        renderAuditoria();
    });
    document.querySelectorAll("[data-filtro-audit]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll("[data-filtro-audit]").forEach((b) => b.classList.remove("ativo-filtro-audit"));
            e.currentTarget.classList.add("ativo-filtro-audit");
            filtroAuditoriaAtual = e.currentTarget.dataset.filtroAudit;
            renderAuditoria();
        });
    });
    on("#btnToggleDropdownAudit", "click", (e) => {
        e.stopPropagation();
        const menu = $("#menuDropdownAudit");
        const aberto = !menu.hidden;
        fecharDropdowns();
        menu.hidden = aberto;
    });
    on("#btnAuditExcel", "click", () => {
        fecharDropdowns();
        exportar(linhasAudit(), "Auditoria", "auditoria", $("#btnToggleDropdownAudit"), "Auditoria do sistema");
    });
    on("#btnAuditPdf", "click", () => {
        fecharDropdowns();
        exportarPdf(linhasAudit(), "Auditoria do Sistema (Histórico Completo)");
    });

    // ----- Exportações de obras / solicitações / resumo -----
    on("#btnExportar", "click", () => exportar(linhasEquip(), "Equipamentos", "equipamentos", $("#btnExportar"), `Equipamentos - ${subtituloObra()}`));
    on("#btnExportarPdf", "click", () => exportarPdf(linhasEquip(), `Equipamentos - ${subtituloObra()}`));
    on("#btnExportarSolic", "click", () => exportar(linhasSolic(), "Solicitações", "solicitacoes", $("#btnExportarSolic"), `Solicitações - ${subtituloObra()}`));
    on("#btnExportarSolicPdf", "click", () => exportarPdf(linhasSolic(), `Solicitações - ${subtituloObra()}`));
    on("#btnExportarResumoExcel", "click", () => exportar(linhasResumo(), "Resumo", "resumo-geral", $("#btnExportarResumoExcel"), "Resumo geral consolidado"));
    on("#btnExportarResumoPdf", "click", () => exportarPdf(linhasResumo(), "Resumo Geral Consolidado"));
    on("#buscaResumoObra", "input", aplicarBuscaResumo);

    // ----- Ordenação -----
    ligarOrdenacao("#theadEquip", ordemEquip, () => renderTabela());
    ligarOrdenacao("#theadSolic", ordemSolic, () => renderSolicitacoes());

    // ----- Abas de funcionários -----
    on("#caixaAbaAtivos", "click", () => alternarAbaFuncionarios("ativos"));
    on("#caixaAbaDesligados", "click", () => alternarAbaFuncionarios("desligados"));
    on("#buscaFuncionario", "input", renderFuncionarios);
    on("#buscaDesligado", "input", renderDesligados);

    // ----- Reativar funcionário desligado -----
    on("#btnReativarFuncPeloDetalhe", "click", () => {
        $("#dlgDetalhesDesligado").close();
        $("#formSenhaReativar").reset();
        $("#erroSenhaReativar").hidden = true;
        $("#dlgSenhaReativar").showModal();
    });

    preencherFiltrosSolic();
    atualizarInfoBackup();
    atualizarAvisoArmazenamento();
    initFuncionariosEventos();

    // ----- Sessão (por último, com todos os eventos já registrados) -----
    if (sessionStorage.getItem(CHAVE_SESSAO) === "autenticado") {
        entrarNoSistema();
    } else {
        definirModoLogin(lerAcesso() ? "entrar" : "criar");
    }
});

/* ==========================================================================
   OBRAS: abrir/remover
   ========================================================================== */

function abrirNovaObra() {
    obraEmEdicaoId = null;
    $("#formObra").reset();
    const h3 = $("#dlgObra").querySelector("h3");
    if (h3) h3.textContent = "Nova obra";
    $("#sidebar").classList.remove("aberta");
    $("#dlgObra").showModal();
}

function atualizarAvisoRemoverObra() {
    const id = $("#selObraRemover").value;
    const qe = estado.equipamentos.filter((e) => e.obra === id).length;
    const qs = estado.solicitacoes.filter((s) => s.obra === id).length;
    $("#avisoRemover").textContent =
        `Serão removidos junto: ${qe} equipamento(s) e ${qs} solicitação(ões). Esta ação não pode ser desfeita.`;
}

function abrirRemoverObra() {
    if (!estado.obras.length) { mostrarAviso("Não há obras para remover."); return; }
    $("#selObraRemover").innerHTML = [...estado.obras].sort(porNome)
        .map((o) => `<option value="${escapar(o.id)}">${escapar(o.nome)}</option>`).join("");
    atualizarAvisoRemoverObra();
    $("#sidebar").classList.remove("aberta");
    $("#dlgRemoverObra").showModal();
}

// "+ Cadastrar Engenheiro" / "Editar" na lista de obras (captura: não abre a obra)
document.addEventListener("click", (ev) => {
    const btnEd = ev.target.closest("[data-editar-obra]");
    if (!btnEd) return;
    ev.stopPropagation();
    const obra = estado.obras.find((o) => o.id === btnEd.dataset.editarObra);
    if (!obra) return;
    obraEmEdicaoId = obra.id;
    const dlg = $("#dlgObra");
    const form = $("#formObra");
    const h3 = dlg.querySelector("h3");
    if (h3) h3.textContent = `Editar Obra — ${obra.nome}`;
    form.elements.nome.value = obra.nome || "";
    form.elements.engenheiro.value = obra.engenheiro || "";
    form.elements.admin.value = obra.admin || "";
    if (form.elements.cidade) form.elements.cidade.value = obra.cidade || "";
    dlg.showModal();
}, true);

/* ==========================================================================
   EVENTOS ESPECÍFICOS DE FUNCIONÁRIOS
   ========================================================================== */

function initFuncionariosEventos() {
    const campoNome = $("#campoNomeFuncionario");
    if (campoNome) {
        campoNome.addEventListener("input", (e) => {
            const pos = e.target.selectionStart;
            e.target.value = formatarIniciaisMaiusculas(e.target.value);
            e.target.setSelectionRange(pos, pos);
        });
    }

    $("#selTermoStatus").addEventListener("change", (e) => {
        const valor = e.target.value;
        const pendente = valor === "Pendente";
        $("#dataTermoEntregue").disabled = pendente;
        $("#dataTermoDevolvido").disabled = pendente;
        if (pendente) { $("#dataTermoEntregue").value = ""; $("#dataTermoDevolvido").value = ""; }
        $("#caixaAvisoConferencia").hidden = !valor;
    });

    $("#selTermoStatusReserva").addEventListener("change", (e) => {
        const pendente = e.target.value === "Pendente";
        $("#dataTermoEntregueReserva").disabled = pendente;
        $("#dataTermoDevolvidoReserva").disabled = pendente;
        if (pendente) { $("#dataTermoEntregueReserva").value = ""; $("#dataTermoDevolvidoReserva").value = ""; }
    });

    $("#btnAddEquipForm").addEventListener("click", () => adicionarLinhaEquipamentoForm());

    // Remoção com senha
    $("#cancelaSenhaRemoverFunc").addEventListener("click", () => {
        exclusaoFuncPendenteId = null;
        $("#dlgSenhaRemoverFunc").close();
    });
    $("#formSenhaRemoverFunc").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const senhaDigitada = $("#inputSenhaRemoverFunc").value.trim();

        if (!(await verificarSenha(senhaDigitada))) {
            $("#erroSenhaRemoverFunc").hidden = false;
            $("#erroSenhaRemoverFunc").textContent = senhaDigitada ? "Senha incorreta. Ação não autorizada." : "Digite a senha do sistema.";
            return;
        }

        const { id, tipo } = exclusaoFuncPendenteId || {};
        if (!id || !tipo) { $("#dlgSenhaRemoverFunc").close(); return; }

        if (tipo === "ativo") {
            const func = estado.funcionarios.find((x) => x.id === id);
            if (func) {
                estado.funcionarios = estado.funcionarios.filter((x) => x.id !== id);
                registrar("remocao", "Funcionário ativo removido", func.nome, "-", "Remoção permanente com senha");
                salvar();
                renderFuncionarios();
                mostrarAviso(`Funcionário "${func.nome}" removido permanentemente.`);
            }
        } else if (tipo === "desligado") {
            const deslig = estado.desligados.find((x) => x.id === id);
            if (deslig) {
                estado.desligados = estado.desligados.filter((x) => x.id !== id);
                registrar("remocao", "Funcionário desligado removido", deslig.nome, "-", "Remoção permanente com senha");
                salvar();
                renderDesligados();
                mostrarAviso(`Registro de "${deslig.nome}" removido permanentemente.`);
            }
        }
        exclusaoFuncPendenteId = null;
        $("#dlgSenhaRemoverFunc").close();
    });

    // Concluir manutenção
    $("#btnConcluirManutencaoDetalhe").addEventListener("click", () => {
        const func = estado.funcionarios.find((x) => x.id === funcionarioEmEdicaoId);
        if (!func) return;
        (func.equipamentos || []).forEach((eq) => {
            if (eq.status === "Em manutenção") eq.status = "Em uso";
        });
        func.status = "Em uso";
        func.reserva = { tem: "nao" };
        registrar("edicao", "Concluir manutenção", func.nome, "-", "Equipamentos retornados para uso e reserva encerrada");
        salvar();
        $("#dlgDetalhesFunc").close();
        renderFuncionarios();
        mostrarAviso(`Manutenção concluída e reserva encerrada para ${func.nome}.`);
    });

    // Reativar com senha
    $("#cancelaSenhaReativar").addEventListener("click", () => $("#dlgSenhaReativar").close());
    $("#formSenhaReativar").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const senhaDigitada = $("#inputSenhaReativar").value.trim();

        if (!(await verificarSenha(senhaDigitada))) {
            $("#erroSenhaReativar").hidden = false;
            $("#erroSenhaReativar").textContent = senhaDigitada ? "Senha incorreta. Ação não autorizada." : "Digite a senha do sistema.";
            return;
        }

        const desligado = estado.desligados.find((x) => x.id === funcionarioParaBaixaId);
        if (desligado) {
            estado.desligados = estado.desligados.filter((x) => x.id !== desligado.id);
            const reativado = {
                id: desligado.idOriginal || novoId("f"),
                nome: desligado.nome,
                equipamentos: desligado.equipamentosOriginais || [{ tipo: "Notebook", marca: "Equipamento Restabelecido", dataEntrega: dataLocal(), status: "Em uso" }],
                status: "Em uso",
                termoStatus: "Pendente",
                dataTermoEntregue: "",
                dataTermoDevolvido: "",
                reserva: { tem: "nao" }
            };
            reativado.equipamento = reativado.equipamentos.map((e) => `${e.tipo} (${e.marca})`).join(", ");
            estado.funcionarios.unshift(reativado);
            registrar("edicao", "Funcionário reativado", reativado.nome, "-", "Reativado com senha do sistema");
            salvar();
            $("#dlgSenhaReativar").close();
            alternarAbaFuncionarios("ativos");
            mostrarAviso(`Funcionário ${desligado.nome} reativado com sucesso!`);
        } else {
            $("#dlgSenhaReativar").close();
        }
    });

    // Botões do modal de detalhes (ativo)
    $("#fecharDetalhesFunc").addEventListener("click", () => $("#dlgDetalhesFunc").close());
    $("#btnGerenciarReservaDetalhe").addEventListener("click", () => {
        const item = estado.funcionarios.find((x) => x.id === funcionarioEmEdicaoId);
        $("#dlgDetalhesFunc").close();
        if (item) abrirModalReserva(item);
    });
    $("#btnEditarPeloDetalhe").addEventListener("click", () => {
        const item = estado.funcionarios.find((x) => x.id === funcionarioEmEdicaoId);
        $("#dlgDetalhesFunc").close();
        if (item) abrirModalFuncionario(item);
    });
    $("#btnDesligarPeloDetalhe").addEventListener("click", () => {
        const item = estado.funcionarios.find((x) => x.id === funcionarioEmEdicaoId);
        $("#dlgDetalhesFunc").close();
        if (item) abrirModalDesligamento(item);
    });
    $("#btnRemoverAtivoPeloDetalhe").addEventListener("click", () => {
        const id = funcionarioEmEdicaoId;
        $("#dlgDetalhesFunc").close();
        if (id) pedirSenhaRemoverAtivo(id);
    });

    // Botões do modal de detalhes (desligado)
    $("#fecharDetalhesDeslig").addEventListener("click", () => $("#dlgDetalhesDesligado").close());
    $("#btnRemoverDesligadoPeloDetalhe").addEventListener("click", () => {
        const id = funcionarioParaBaixaId;
        $("#dlgDetalhesDesligado").close();
        if (id) pedirSenhaRemoverDesligado(id);
    });
    $("#btnAcaoBaixaPeloDetalhe").addEventListener("click", () => {
        const item = estado.desligados.find((x) => x.id === funcionarioParaBaixaId);
        if (!item || item.devolvido) {
            mostrarAviso("A baixa deste registro já foi realizada.");
            return;
        }
        $("#dlgDetalhesDesligado").close();

        let htmlChecklist = `<div style="font-size:0.8rem; font-weight:600; margin-bottom:4px;">Selecione os itens que estão sendo devolvidos agora:</div>`;
        (item.itensDevolucao || []).forEach((it, idx) => {
            if (!it.devolvido) {
                htmlChecklist += `
            <label class="radio-label" style="margin-bottom:4px;">
              <input type="checkbox" name="baixaItem_${idx}" value="${escapar(it.nome)}" checked>
              <span><strong>${escapar(it.nome)}</strong></span>
            </label>`;
            }
        });

        $("#textoBaixaFuncionario").innerHTML = `Registrar devolução de equipamentos para <strong>${escapar(item.nome)}</strong>.`;
        $("#checklistItensBaixa").innerHTML = htmlChecklist;
        $("#dataBaixa").value = dataLocal();
        $("#dlgBaixaDevolucao").showModal();
    });

    // Cadastro / edição de funcionário
    $("#btnNovoFuncionario").addEventListener("click", () => abrirModalFuncionario());
    $("#cancelaFuncionario").addEventListener("click", () => $("#dlgFuncionario").close());

    $("#formFuncionario").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);

        const nome = formatarIniciaisMaiusculas((f.get("nome") || "").trim());
        const termoStatus = f.get("termoStatus");
        const dataTermoEntregue = f.get("dataTermoEntregue");
        const dataTermoDevolvido = f.get("dataTermoDevolvido");

        const equipamentos = [];
        document.querySelectorAll(".linha-equipamento-form").forEach((linha) => {
            const tipo = linha.querySelector(".sel-tipo-equip-item").value;
            const marca = linha.querySelector(".inp-marca-equip-item").value.trim();
            const dataEntrega = linha.querySelector(".inp-data-equip-item").value;
            const status = linha.querySelector(".sel-status-equip-item").value;
            const qtd = parseInt(linha.querySelector(".inp-qtd-equip-item").value, 10) || 1;

            for (let i = 0; i < qtd; i++) {
                equipamentos.push({
                    tipo,
                    marca: qtd > 1 ? `${marca} (${i + 1})` : marca,
                    dataEntrega,
                    status
                });
            }
        });

        if (!nome) { mostrarAviso("Preencha o nome do funcionário."); return; }
        if (equipamentos.length === 0) { mostrarAviso("Cadastre pelo menos 1 equipamento."); return; }
        if (equipamentos.some((e) => !e.marca)) { mostrarAviso("Preencha o nome/marca de todos os equipamentos."); return; }
        if (equipamentos.some((e) => !e.dataEntrega)) { mostrarAviso("Informe a data de entrega de todos os equipamentos."); return; }
        if (termoStatus === "Entregue" && !dataTermoEntregue) {
            mostrarAviso("Informe a data de entrega do termo ao funcionário.");
            return;
        }

        const dados = {
            nome,
            equipamentos,
            equipamento: equipamentos.map((e) => `${e.tipo} (${e.marca})`).join(", "),
            status: equipamentos.some((e) => e.status === "Em manutenção") ? "Em manutenção" : "Em uso",
            termoStatus,
            dataTermoEntregue: termoStatus === "Entregue" ? dataTermoEntregue : "",
            dataTermoDevolvido: termoStatus === "Entregue" ? (dataTermoDevolvido || "") : ""
        };

        if (funcionarioEmEdicaoId) {
            const funcExistente = estado.funcionarios.find((x) => x.id === funcionarioEmEdicaoId);
            if (funcExistente) {
                const tinhaManutencaoAntes = funcExistente.status === "Em manutenção";
                Object.assign(funcExistente, dados);
                if (dados.status === "Em uso") funcExistente.reserva = { tem: "nao" };
                registrar("edicao", "Funcionário editado", dados.nome, "-", "Equipamentos atualizados");
                salvar();
                $("#dlgFuncionario").close();
                renderFuncionarios();
                mostrarAviso("Funcionário atualizado com sucesso.");
                if (!tinhaManutencaoAntes && dados.status === "Em manutenção") abrirModalReserva(funcExistente);
            }
        } else {
            const novoFunc = { id: novoId("f"), ...dados, reserva: { tem: "nao" } };
            estado.funcionarios.unshift(novoFunc);
            registrar("novo", "Funcionário cadastrado", novoFunc.nome, "-", `Equipamentos: ${novoFunc.equipamento}`);
            salvar();
            $("#dlgFuncionario").close();
            renderFuncionarios();
            mostrarAviso("Funcionário cadastrado com sucesso.");
            if (dados.status === "Em manutenção") abrirModalReserva(novoFunc);
        }
    });

    // Reserva
    document.querySelectorAll("input[name='temReserva']").forEach((radio) => {
        radio.addEventListener("change", (e) => { $("#camposEquipReserva").hidden = e.target.value !== "sim"; });
    });
    $("#cancelaReserva").addEventListener("click", () => $("#dlgReserva").close());

    $("#formReserva").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const tem = f.get("temReserva");
        const func = estado.funcionarios.find((x) => x.id === funcionarioParaReservaId);

        if (func) {
            if (tem === "sim") {
                const tipoRes = f.get("tipoEquipamentoReserva");
                const marcaRes = (f.get("marcaEquipamentoReserva") || "").trim();
                const dataEntRes = f.get("dataEntregaReserva");
                const termoStatRes = f.get("termoStatusReserva");
                const dtTermoEntRes = f.get("dataTermoEntregueReserva");
                const dtTermoDevRes = f.get("dataTermoDevolvidoReserva");

                if (!marcaRes || !dataEntRes) {
                    mostrarAviso("Preencha o nome/marca e a data de entrega da reserva.");
                    return;
                }
                if (termoStatRes === "Entregue" && !dtTermoEntRes) {
                    mostrarAviso("Informe a data de entrega do termo da reserva.");
                    return;
                }

                func.reserva = {
                    tem: "sim",
                    tipo: tipoRes,
                    marca: marcaRes,
                    equipamento: `${tipoRes} (${marcaRes})`,
                    dataEntrega: dataEntRes,
                    termoStatus: termoStatRes,
                    dataTermoEntregue: termoStatRes === "Entregue" ? dtTermoEntRes : "",
                    dataTermoDevolvido: termoStatRes === "Entregue" ? (dtTermoDevRes || "") : ""
                };
                registrar("edicao", "Equipamento reserva cadastrado", func.nome, "-", `Reserva: ${func.reserva.equipamento}`);
                mostrarAviso(`Reserva e termo registrados para ${func.nome}.`);
            } else {
                func.reserva = { tem: "nao" };
                registrar("edicao", "Sem equipamento reserva", func.nome, "-", "Marcado como sem reserva");
                mostrarAviso(`Registrado que ${func.nome} está sem reserva.`);
            }
            salvar();
            renderFuncionarios();
        }
        $("#dlgReserva").close();
    });

    // Desligamento
    $("#cancelaDesligar").addEventListener("click", () => $("#dlgDesligar").close());

    $("#formDesligar").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const func = estado.funcionarios.find((x) => x.id === funcionarioParaDesligarId);
        if (!func) return;

        const dataDeslig = f.get("dataDesligamento") || dataLocal();
        const itensDevolucao = [];

        (func.equipamentos || []).forEach((eq, idx) => {
            const nomeItem = `${eq.tipo} (${eq.marca})`;
            const chk = document.querySelector(`[name="eqDeslig_${idx}"]`);
            const dev = chk ? chk.checked : false;
            itensDevolucao.push({ nome: nomeItem, devolvido: dev, dataDevolucao: dev ? dataDeslig : "" });
        });

        if (func.reserva && func.reserva.tem === "sim") {
            const chkRes = document.querySelector(`[name="eqDesligReserva"]`);
            const devRes = chkRes ? chkRes.checked : false;
            itensDevolucao.push({
                nome: `Reserva: ${func.reserva.equipamento}`,
                devolvido: devRes,
                dataDevolucao: devRes ? dataDeslig : ""
            });
        }

        const tudoDevolvido = itensDevolucao.every((it) => it.devolvido);

        const desligado = {
            id: novoId("d"),
            idOriginal: func.id,
            nome: func.nome,
            dataDesligamento: dataDeslig,
            equipamentosOriginais: func.equipamentos,
            equipamentoVinculado: (func.equipamentos || []).map((e) => `${e.tipo} (${e.marca})`).join(", "),
            itensDevolucao,
            devolvido: tudoDevolvido,
            dataDevolucao: tudoDevolvido ? dataDeslig : ""
        };

        estado.funcionarios = estado.funcionarios.filter((x) => x.id !== func.id);
        estado.desligados.unshift(desligado);
        registrar("desligamento", "Funcionário desligado", func.nome, "-", `Devolvido integralmente: ${tudoDevolvido ? "Sim" : "Pendente"}`);
        salvar();
        $("#dlgDesligar").close();
        renderFuncionarios();
        mostrarAviso(`Funcionário ${func.nome} desligado.`);
    });

    // Baixa de devolução
    $("#cancelaBaixaDevolucao").addEventListener("click", () => $("#dlgBaixaDevolucao").close());

    $("#formBaixaDevolucao").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        const item = estado.desligados.find((x) => x.id === funcionarioParaBaixaId);
        if (!item) return;

        const dataBaixa = f.get("dataBaixa") || dataLocal();
        let marcados = 0;
        (item.itensDevolucao || []).forEach((it, idx) => {
            if (!it.devolvido) {
                const chk = document.querySelector(`[name="baixaItem_${idx}"]`);
                if (chk && chk.checked) {
                    it.devolvido = true;
                    it.dataDevolucao = dataBaixa;
                    marcados++;
                }
            }
        });

        if (!marcados) { mostrarAviso("Selecione ao menos um item devolvido."); return; }

        item.devolvido = (item.itensDevolucao || []).every((it) => it.devolvido);
        if (item.devolvido) item.dataDevolucao = dataBaixa;

        registrar("edicao", "Baixa de equipamentos de desligado", item.nome, "-", "Atualizado status de devolução");
        salvar();
        $("#dlgBaixaDevolucao").close();
        renderDesligados();
        mostrarAviso(`Devolução registrada com sucesso para ${item.nome}.`);
    });

    // Listas
    $("#corpoFuncionarios").addEventListener("click", (ev) => {
        const btnRemover = ev.target.closest("[data-remover-ativo]");
        if (btnRemover) {
            ev.stopPropagation();
            pedirSenhaRemoverAtivo(btnRemover.dataset.removerAtivo);
            return;
        }
        const linha = ev.target.closest("[data-abrir-detalhes-func]");
        if (!linha) return;
        const item = estado.funcionarios.find((x) => x.id === linha.dataset.abrirDetalhesFunc);
        if (item) abrirModalDetalhesFuncionario(item);
    });

    $("#corpoDesligados").addEventListener("click", (ev) => {
        const btnRemover = ev.target.closest("[data-remover-desligado]");
        if (btnRemover) {
            ev.stopPropagation();
            pedirSenhaRemoverDesligado(btnRemover.dataset.removerDesligado);
            return;
        }
        const linha = ev.target.closest("[data-abrir-detalhes-deslig]");
        if (!linha) return;
        const item = estado.desligados.find((x) => x.id === linha.dataset.abrirDetalhesDeslig);
        if (item) abrirModalDetalhesDesligado(item);
    });

    // Dropdowns de exportação
    const ligarDropdown = (btnSel, menuSel) => on(btnSel, "click", (e) => {
        e.stopPropagation();
        const menu = $(menuSel);
        const aberto = !menu.hidden;
        fecharDropdowns();
        menu.hidden = aberto;
    });
    ligarDropdown("#btnToggleDropdownExport", "#menuDropdownExport");
    ligarDropdown("#btnToggleDropdownGeral", "#menuDropdownGeral");
    document.addEventListener("click", fecharDropdowns);

    on("#btnExportarFuncExcel", "click", () => { fecharDropdowns(); exportarFuncionariosExcel(); });
    on("#btnExportarFuncPdf", "click", () => { fecharDropdowns(); exportarFuncionariosPdf(); });
    on("#btnGeralExcel", "click", () => { fecharDropdowns(); exportarRelatorioGeralExcel(); });
    on("#btnGeralPdf", "click", () => { fecharDropdowns(); exportarRelatorioGeralPdf(); });
}

/* ==========================================================================
   EXPORTAÇÕES DE FUNCIONÁRIOS
   ========================================================================== */

function exportarFuncionariosExcel() {
    if (abaFuncionariosAtual === "ativos") {
        const linhas = [...estado.funcionarios].sort(porNome).map((f) => ({
            "Nome do Funcionário": f.nome,
            "Equipamentos": (f.equipamentos || []).map((e) => `${e.tipo} (${e.marca}) - ${e.status}`).join("; "),
            "Termo Titular": f.termoStatus || "Pendente",
            "Situação": "Ativo"
        }));
        if (!linhas.length) { mostrarAviso("Sem funcionários ativos para exportar."); return; }
        gerarPlanilha([{ nome: "Ativos", linhas }], `funcionarios-ativos-${dataLocal()}`, $("#btnToggleDropdownExport"), "Funcionários Ativos");
    } else {
        const linhas = [...estado.desligados].sort(porNome).map((d) => ({
            "Nome do Funcionário": d.nome,
            "Data Desligamento": formatarDataSimples(d.dataDesligamento),
            "Itens e Devolução": (d.itensDevolucao || []).map((i) => `${i.nome}: ${i.devolvido ? "Devolvido" : "Pendente"}`).join("; "),
            "Situação Geral": d.devolvido ? "Tudo Devolvido" : "Pendente"
        }));
        if (!linhas.length) { mostrarAviso("Sem desligados para exportar."); return; }
        gerarPlanilha([{ nome: "Desligados", linhas }], `funcionarios-desligados-${dataLocal()}`, $("#btnToggleDropdownExport"), "Funcionários Desligados");
    }
}

function exportarFuncionariosPdf() {
    if (abaFuncionariosAtual === "ativos") {
        const lista = [...estado.funcionarios].sort(porNome);
        if (!lista.length) { mostrarAviso("Sem funcionários ativos para PDF."); return; }
        let html = `<table><thead><tr><th>Nome</th><th>Equipamentos</th><th>Termo Titular</th><th>Reserva</th></tr></thead><tbody>`;
        lista.forEach((f) => {
            const eqs = (f.equipamentos || []).map((e) => escapar(`${e.tipo} (${e.marca})`)).join("<br>");
            const res = f.reserva && f.reserva.tem === "sim" ? `Sim (${f.reserva.equipamento})` : "Não";
            html += `<tr><td><strong>${escapar(f.nome)}</strong></td><td>${eqs}</td><td>${escapar(f.termoStatus || "Pendente")}</td><td>${escapar(res)}</td></tr>`;
        });
        html += `</tbody></table>`;
        imprimirComoPdf("Relatório de Funcionários Ativos", `Total: ${lista.length} colaboradores`, html);
    } else {
        const lista = [...estado.desligados].sort(porNome);
        if (!lista.length) { mostrarAviso("Sem funcionários desligados para PDF."); return; }
        let html = `<table><thead><tr><th>Nome do Funcionário</th><th>Data Desligamento</th><th>Itens / Devolução</th></tr></thead><tbody>`;
        lista.forEach((d) => {
            const itens = (d.itensDevolucao || []).map((i) => `${escapar(i.nome)}: <strong>${i.devolvido ? "Devolvido" : "Pendente"}</strong>`).join("<br>");
            html += `<tr><td><strong>${escapar(d.nome)}</strong></td><td>${formatarDataSimples(d.dataDesligamento)}</td><td>${itens}</td></tr>`;
        });
        html += `</tbody></table>`;
        imprimirComoPdf("Relatório de Funcionários Desligados", `Total: ${lista.length} registros`, html);
    }
}

function montarDadosGeraisFuncionarios() {
    return [
        ...estado.funcionarios.map((f) => ({
            nome: f.nome,
            situacao: "Ativo",
            detalhesEquips: (f.equipamentos || []).map((e) => `${e.tipo} (${e.marca})`).join(", "),
            statusGeral: f.status || "Em uso",
            termo: f.termoStatus || "Pendente",
            deslig: "-",
            devolv: "-"
        })),
        ...estado.desligados.map((d) => ({
            nome: d.nome,
            situacao: "Desligado",
            detalhesEquips: d.equipamentoVinculado || "-",
            statusGeral: "Desligado",
            termo: "-",
            deslig: formatarDataSimples(d.dataDesligamento),
            devolv: d.devolvido ? "Tudo Devolvido" : "Pendente"
        }))
    ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function exportarRelatorioGeralExcel() {
    const todos = montarDadosGeraisFuncionarios();
    if (!todos.length) { mostrarAviso("Sem dados para exportar."); return; }
    const linhasExcel = todos.map((t) => ({
        "Nome": t.nome, "Situação": t.situacao, "Equipamentos": t.detalhesEquips, "Status": t.statusGeral,
        "Termo": t.termo, "Desligamento": t.deslig, "Devolvido?": t.devolv
    }));
    gerarPlanilha([{ nome: "Geral", linhas: linhasExcel }], `relatorio-geral-funcionarios-${dataLocal()}`, $("#btnToggleDropdownGeral"), "Relatório Geral Excel");
}

function exportarRelatorioGeralPdf() {
    const todos = montarDadosGeraisFuncionarios();
    if (!todos.length) { mostrarAviso("Sem dados para exportar."); return; }
    let html = `<table><thead><tr><th>Nome</th><th>Situação</th><th>Equipamentos</th><th>Status</th><th>Desligamento</th><th>Devolvido?</th></tr></thead><tbody>`;
    todos.forEach((t) => {
        html += `<tr><td><strong>${escapar(t.nome)}</strong></td><td><span class="badge ${t.situacao === "Ativo" ? "online" : "offline"}">${escapar(t.situacao)}</span></td><td>${escapar(t.detalhesEquips)}</td><td>${escapar(t.statusGeral)}</td><td>${escapar(t.deslig)}</td><td>${escapar(t.devolv)}</td></tr>`;
    });
    html += `</tbody></table>`;
    imprimirComoPdf("Relatório Geral Consolidado de Funcionários", `Total: ${todos.length} registros`, html);
}

/* ==========================================================================
   MODAIS DE FUNCIONÁRIOS
   ========================================================================== */

function abrirModalDesligamento(func) {
    funcionarioParaDesligarId = func.id;
    $("#dataDesligamento").value = dataLocal();

    const eqs = func.equipamentos || [];
    let htmlChecklist = `<div style="font-size:0.8rem; font-weight:600; margin-bottom:4px;">Checklist de Devolução na Saída:</div>`;

    eqs.forEach((eq, idx) => {
        const manutItem = eq.status === "Em manutenção";
        htmlChecklist += `
      <label class="radio-label" style="align-items:flex-start; margin-bottom:4px;">
        <input type="checkbox" name="eqDeslig_${idx}" value="${escapar(eq.tipo)}" ${manutItem ? "" : "checked"} style="margin-top:3px;">
        <span><strong>${escapar(eq.tipo)} (${escapar(eq.marca)})</strong> — ${manutItem ? "<span style='color:#1e7e34'>Já em manutenção (Retorna para a empresa)</span>" : "Devolvido na saída"}</span>
      </label>`;
    });

    if (func.reserva && func.reserva.tem === "sim") {
        const r = func.reserva;
        htmlChecklist += `
      <label class="radio-label" style="align-items:flex-start; margin-bottom:4px;">
        <input type="checkbox" name="eqDesligReserva" value="${escapar(r.equipamento)}" checked style="margin-top:3px;">
        <span><strong>Equipamento Reserva: ${escapar(r.equipamento)}</strong> — Devolvido na saída</span>
      </label>`;
    }

    $("#textoDesligarConfirm").innerHTML = `Confirma o desligamento de <strong>${escapar(func.nome)}</strong>?`;
    $("#blocoChecklistDesligamento").innerHTML = htmlChecklist;
    $("#dlgDesligar").showModal();
}

function abrirModalDetalhesDesligado(d) {
    if (!d) return;
    funcionarioParaBaixaId = d.id;
    $("#detalheDesligNome").textContent = d.nome;

    let itensListaHtml = "";
    if (Array.isArray(d.itensDevolucao) && d.itensDevolucao.length > 0) {
        itensListaHtml = d.itensDevolucao.map((it) => `
      <div style="margin-bottom: 4px;">
        • ${escapar(it.nome)} — <strong>${it.devolvido ? `Devolvido em ${formatarDataSimples(it.dataDevolucao)}` : "Pendente de devolução"}</strong>
      </div>`).join("");
    } else {
        itensListaHtml = `<div>• ${escapar(d.equipamentoVinculado || "-")} — <strong>${d.devolvido ? "Devolvido" : "Pendente"}</strong></div>`;
    }

    $("#detalheDesligCorpo").innerHTML = `
    <div class="item-detalhe-bloco">
      <strong>Data do Desligamento</strong>
      <span>${formatarDataSimples(d.dataDesligamento)}</span>
    </div>
    <div class="item-detalhe-bloco">
      <strong>Equipamentos e Status de Devolução</strong>
      <span>${itensListaHtml}</span>
    </div>`;

    const btnBaixa = $("#btnAcaoBaixaPeloDetalhe");
    const rotuloConcluido = $("#rotuloBaixaConcluida");
    if (d.devolvido) {
        btnBaixa.hidden = true;
        rotuloConcluido.hidden = false;
    } else {
        btnBaixa.hidden = false;
        btnBaixa.textContent = "Dar Baixa";
        rotuloConcluido.hidden = true;
    }

    $("#dlgDetalhesDesligado").showModal();
}

function abrirModalDetalhesFuncionario(func) {
    if (!func) return;
    funcionarioEmEdicaoId = func.id;
    $("#detalheFuncNome").textContent = func.nome;

    const listaEquips = func.equipamentos || [];
    const temManutencao = listaEquips.some((eq) => eq.status === "Em manutenção");
    const temReserva = func.reserva && func.reserva.tem === "sim";

    $("#detalheFuncBadgeStatus").textContent = temManutencao ? "Em manutenção" : "Ativo";
    $("#detalheFuncBadgeStatus").className = `badge ${temManutencao ? "manutencao" : "online"}`;

    $("#btnConcluirManutencaoDetalhe").hidden = !temManutencao;
    $("#btnGerenciarReservaDetalhe").hidden = !temManutencao;

    const equipsHtml = listaEquips.map((eq) => `
    <div style="margin-bottom: 4px;">
      • <strong>${escapar(eq.tipo)}</strong>: ${escapar(eq.marca)} (Entregue em: ${formatarDataSimples(eq.dataEntrega)}) — <span style="color: ${eq.status === "Em manutenção" ? "var(--vermelho-aveludado)" : "var(--texto-principal)"};">${escapar(eq.status)}</span>
    </div>`).join("") || "-";

    let blocoReservaHtml = "";
    if (temReserva) {
        const r = func.reserva;
        blocoReservaHtml = `
      <div class="item-detalhe-bloco" style="border-left: 3px solid var(--cinza-sidebar);">
        <strong>Equipamento Reserva em Uso</strong>
        <span><strong>Sim</strong> — ${escapar(r.equipamento)}</span><br>
        <small style="color: var(--texto-suave); display: inline-block; margin-top: 3px;">
          Entregue em: <strong>${formatarDataSimples(r.dataEntrega)}</strong>
        </small>
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed var(--borda-suave);">
          <strong style="margin-bottom: 2px;">Termo de Responsabilidade (Equip. Reserva)</strong>
          <span>Situação: <strong>${escapar(r.termoStatus || "Pendente")}</strong></span><br>
          <small style="color: var(--texto-suave);">
            Entregue em: <strong>${formatarDataSimples(r.dataTermoEntregue)}</strong> |
            Devolvido assinado em: <strong>${formatarDataSimples(r.dataTermoDevolvido)}</strong>
          </small>
        </div>
      </div>`;
    }

    $("#detalheFuncCorpo").innerHTML = `
    <div class="item-detalhe-bloco">
      <strong>Equipamentos Titulares</strong>
      <span>${equipsHtml}</span>
    </div>
    <div class="item-detalhe-bloco">
      <strong>Termo de Responsabilidade (Titular)</strong>
      <span>Situação: <strong>${escapar(func.termoStatus || "Pendente")}</strong></span><br>
      <small style="color: var(--texto-suave); display: inline-block; margin-top: 4px;">
        Entregue ao funcionário em: <strong>${formatarDataSimples(func.dataTermoEntregue)}</strong> |
        Devolvido assinado em: <strong>${formatarDataSimples(func.dataTermoDevolvido)}</strong>
      </small>
    </div>
    ${blocoReservaHtml}`;
    $("#dlgDetalhesFunc").showModal();
}

function abrirModalFuncionario(func = null) {
    funcionarioEmEdicaoId = func ? func.id : null;
    $("#tituloDlgFunc").textContent = func ? "Editar Funcionário" : "Cadastrar Funcionário";
    $("#formFuncionario").reset();
    $("#containerEquipamentosForm").innerHTML = "";
    $("#caixaAvisoConferencia").hidden = true;

    // Preenche o select de Local dinamicamente com as obras cadastradas
    const selLocal = $("#selLocalFunc");
    if (selLocal) {
        const obrasOrdenadas = [...estado.obras].sort((a, b) => a.nome.localeCompare(b.nome));
        selLocal.innerHTML = obrasOrdenadas.map(obra =>
            `<option value="${escapar(obra.nome)}">${escapar(obra.nome)}</option>`
        ).join("");
    }

    if (func) {
        const f = $("#formFuncionario").elements;
        f.nome.value = func.nome;

        if (f.empresa) f.empresa.value = func.empresa || "Campbel Construções";
        if (f.local && func.local) f.local.value = func.local;

        f.termoStatus.value = func.termoStatus || "Pendente";
        const pendente = (func.termoStatus || "Pendente") === "Pendente";
        $("#dataTermoEntregue").disabled = pendente;
        $("#dataTermoDevolvido").disabled = pendente;
        f.dataTermoEntregue.value = func.dataTermoEntregue || "";
        f.dataTermoDevolvido.value = func.dataTermoDevolvido || "";
        $("#caixaAvisoConferencia").hidden = false;

        const eqs = (func.equipamentos && func.equipamentos.length) ? func.equipamentos : [{ tipo: "Notebook", marca: "", dataEntrega: dataLocal(), status: "Em uso" }];
        eqs.forEach((eq) => adicionarLinhaEquipamentoForm(eq.tipo, eq.marca, eq.dataEntrega, eq.status));
    } else {
        $("#selTermoStatus").value = "Pendente";
        $("#dataTermoEntregue").disabled = true;
        $("#dataTermoDevolvido").disabled = true;
        adicionarLinhaEquipamentoForm();
    }

    $("#dlgFuncionario").showModal();
}

function abrirModalReserva(func) {
    funcionarioParaReservaId = func.id;
    $("#formReserva").reset();
    $("#textoPerguntaReserva").textContent = `${func.nome} está com outro equipamento reserva para trabalhar?`;

    const r = func.reserva || { tem: "nao" };
    const temSim = r.tem === "sim";

    document.querySelectorAll("input[name='temReserva']").forEach((rad) => {
        rad.checked = rad.value === (temSim ? "sim" : "nao");
    });
    $("#camposEquipReserva").hidden = !temSim;

    if (temSim) {
        $("#selTipoEquipReserva").value = r.tipo || "Notebook";
        $("#inputMarcaEquipReserva").value = r.marca || "";
        $("#dataEntregaReserva").value = r.dataEntrega || dataLocal();
        $("#selTermoStatusReserva").value = r.termoStatus || "Pendente";
        const pend = (r.termoStatus || "Pendente") === "Pendente";
        $("#dataTermoEntregueReserva").disabled = pend;
        $("#dataTermoDevolvidoReserva").disabled = pend;
        $("#dataTermoEntregueReserva").value = r.dataTermoEntregue || "";
        $("#dataTermoDevolvidoReserva").value = r.dataTermoDevolvido || "";
    } else {
        $("#dataEntregaReserva").value = dataLocal();
        $("#selTermoStatusReserva").value = "Pendente";
        $("#dataTermoEntregueReserva").disabled = true;
        $("#dataTermoDevolvidoReserva").disabled = true;
    }

    $("#dlgReserva").showModal();
}

function adicionarLinhaEquipamentoForm(tipoVal = "Notebook", marcaVal = "", dataVal = dataLocal(), statusVal = "Em uso", qtdVal = 1) {
    const container = $("#containerEquipamentosForm");
    const div = document.createElement("div");
    div.className = "linha-equipamento-form";
    div.style.cssText = "background: var(--fundo-sutil); border: 1px solid var(--borda-suave); padding: 10px; border-radius: var(--raio); display: grid; gap: 8px;";

    div.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <strong style="font-size: 0.75rem; color: var(--texto-suave); text-transform: uppercase;">Equipamento</strong>
      <button type="button" class="btn-icone btn-remover-equip-linha" style="color: var(--vermelho-aveludado);" title="Remover item">✕ Remover</button>
    </div>
    <div style="display: grid; grid-template-columns: 2fr 2fr 70px; gap: 8px;">
      <label style="font-size: 0.75rem;">Tipo
        <select class="sel-tipo-equip-item">
          <option>Atena (s) de Rádio</option>
          <option>Bateria</option>
          <option>Cabo</option>
          <option>Carregador p/ Notebook</option>
          <option>Carregador p/ Rádio</option>
          <option>Carregador p/ Rádio Móvel</option>
          <option>Celular</option>
          <option>Gabinete</option>
          <option>Impressora</option>
          <option>Kit Teclado e Mouse</option>
          <option>Mochila</option>
          <option>Monitor</option>
          <option>Mouse</option>
          <option>Notebook</option>
          <option>Par de Rádio - Locado</option>
          <option>Rádio</option>
          <option>Rádio Fixo</option>
          <option>Rádio Locado</option>
          <option>Rádio Portátil</option>
          <option>Rádio Transceptor</option>
          <option>Régua de Energia</option>
          <option>Suporte para notebook</option>
          <option>Teclado</option>
          <option>Televisão</option>
          <option>Outro</option>
        </select>
      </label>
      <label style="font-size: 0.75rem;">Nome / Marca <input type="text" class="inp-marca-equip-item" placeholder="Ex.: Dell Inspiron" value="${escapar(marcaVal)}"></label>
      <label style="font-size: 0.75rem;">1 <input type="number" class="inp-qtd-equip-item" min="1" max="50" value="${escapar(qtdVal)}" style="width: 100%; padding: 6px; text-align: center; font-weight: 600;"></label>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <label style="font-size: 0.75rem;">Data Entrega <input type="date" class="inp-data-equip-item" value="${escapar(dataVal)}"></label>
      <label style="font-size: 0.75rem;">Status
        <select class="sel-status-equip-item">
          <option value="Em uso">Em uso</option>
          <option value="Em manutenção">Em manutenção</option>
        </select>
      </label>
    </div>`;

    const selTipo = div.querySelector(".sel-tipo-equip-item");
    const inpMarca = div.querySelector(".inp-marca-equip-item");
    selTipo.value = tipoVal;
    div.querySelector(".sel-status-equip-item").value = statusVal;

    if (tipoVal === "Suporte para notebook") {
        inpMarca.value = "Padrão";
        inpMarca.disabled = true;
    }

    selTipo.addEventListener("change", (e) => {
        if (e.target.value === "Suporte para notebook") {
            inpMarca.value = "Padrão";
            inpMarca.disabled = true;
        } else {
            if (inpMarca.value === "Padrão") inpMarca.value = "";
            inpMarca.disabled = false;
        }
    });

    div.querySelector(".btn-remover-equip-linha").addEventListener("click", () => {
        if (container.querySelectorAll(".linha-equipamento-form").length > 1) div.remove();
        else mostrarAviso("O funcionário precisa ter pelo menos 1 equipamento.");
    });

    container.appendChild(div);
}

function alternarAbaFuncionarios(aba) {
    abaFuncionariosAtual = aba;
    const isAtivos = aba === "ativos";
    $("#caixaAbaAtivos").classList.toggle("ativa", isAtivos);
    $("#caixaAbaDesligados").classList.toggle("ativa", !isAtivos);
    $("#painelListaAtivos").hidden = !isAtivos;
    $("#painelListaDesligados").hidden = isAtivos;

    if (isAtivos) renderFuncionarios();
    else renderDesligados();
}

function alternarTela(tela) {
    telaAtual = tela;
    $("#paginaObras").hidden = tela !== "obras";
    $("#paginaFuncionarios").hidden = tela !== "funcionarios";
    $("#paginaAuditoria").hidden = tela !== "auditoria";
    $("#paginaResumo").hidden = tela !== "resumo";
    $("#paginaEstoque").hidden = tela !== "estoque";

    $("#btnMenuResumo").classList.toggle("ativo", tela === "resumo");
    $("#btnMenuObras").classList.toggle("ativo", tela === "obras");
    $("#btnMenuFuncionarios").classList.toggle("ativo", tela === "funcionarios");
    $("#btnMenuEstoque").classList.toggle("ativo", tela === "estoque");
    $("#btnMenuAuditoria").classList.toggle("ativo", tela === "auditoria");

    document.querySelectorAll("#bottomNav .bottom-nav-item").forEach((b) => {
        b.classList.toggle("ativo", b.dataset.tela === tela);
    });

    $("#sidebar").classList.remove("aberta");

    if (tela === "resumo") renderResumoObras();
    else if (tela === "funcionarios") alternarAbaFuncionarios(abaFuncionariosAtual);
    else if (tela === "auditoria") renderAuditoria();
    else if (tela === "estoque") renderTudoEstoque();
    else renderTudo();
}

function contar(lista) {
    return {
        total: lista.length,
        online: lista.filter((e) => e.status === "online").length,
        manutencao: lista.filter((e) => e.status === "manutencao").length,
        parado: lista.filter((e) => e.status === "parado").length
    };
}

function fecharDropdowns() {
    ["#menuDropdownExport", "#menuDropdownGeral", "#menuDropdownAudit"].forEach((s) => {
        const m = $(s);
        if (m) m.hidden = true;
    });
}

function pedirSenhaRemoverAtivo(id) {
    const func = estado.funcionarios.find((x) => x.id === id);
    if (!func) return;
    exclusaoFuncPendenteId = { id: func.id, tipo: "ativo" };
    $("#inputSenhaRemoverFunc").value = "";
    $("#erroSenhaRemoverFunc").hidden = true;
    $("#dlgSenhaRemoverFunc").showModal();
}

function pedirSenhaRemoverDesligado(id) {
    const deslig = estado.desligados.find((x) => x.id === id);
    if (!deslig) return;
    exclusaoFuncPendenteId = { id: deslig.id, tipo: "desligado" };
    $("#inputSenhaRemoverFunc").value = "";
    $("#erroSenhaRemoverFunc").hidden = true;
    $("#dlgSenhaRemoverFunc").showModal();
}

/* ==========================================================================
   RENDERIZAÇÃO
   ========================================================================== */

function atualizarContadoresCaixasFunc() {
    const a = $("#qtdFuncAtivos");
    const d = $("#qtdFuncDesligados");
    if (a) a.textContent = estado.funcionarios.length;
    if (d) d.textContent = estado.desligados.length;
}

function renderDesligados() {
    atualizarContadoresCaixasFunc();
    const busca = $("#buscaDesligado").value.trim().toLowerCase();
    const lista = estado.desligados
        .filter((d) => !busca || d.nome.toLowerCase().includes(busca))
        .sort(porNome);

    $("#corpoDesligados").innerHTML = lista.map((d) => {
        const etiqueta = d.devolvido
            ? `<span class="etiqueta-concluido-sutil">Devolvido</span>`
            : `<span class="etiqueta-alerta-sutil">Pendente Devolução</span>`;

        return `
      <tr class="linha-clicavel" data-abrir-detalhes-deslig="${escapar(d.id)}">
        <td><span class="nome-destaque"><strong>${escapar(d.nome)}</strong></span> ${etiqueta}</td>
        <td style="text-align: right;">
          <button class="btn btn-light" type="button" style="padding: 4px 8px; font-size: 0.75rem;">Ver Detalhes</button>
          <button class="btn btn-light" type="button" data-remover-desligado="${escapar(d.id)}" style="padding: 4px 8px; font-size: 0.75rem; color: var(--vermelho-aveludado); border-color: var(--vermelho-borda-suave); margin-left: 4px;">Remover</button>
        </td>
      </tr>`;
    }).join("");

    $("#vazioDeslig").hidden = lista.length > 0;
}

function renderFiltros() {
    const preencher = (sel, opcoes, rotuloTodos) => {
        if (!sel) return;
        const atual = sel.value;
        sel.innerHTML = `<option value="">${rotuloTodos}</option>` +
            opcoes.map(([v, t]) => `<option value="${escapar(v)}">${escapar(t)}</option>`).join("");
        sel.value = opcoes.some(([v]) => v === atual) ? atual : "";
    };
    const tipos = [...new Set(estado.equipamentos.map((e) => e.tipo).filter(Boolean))].sort();
    preencher($("#filtroStatus"), [["online", "Em uso"], ["manutencao", "Em manutenção"], ["parado", "Equip. Parado"]], "Todos");
    preencher($("#filtroTipo"), tipos.map((t) => [t, t]), "Todos");
}

function renderFuncionarios() {
    atualizarContadoresCaixasFunc();
    const busca = $("#buscaFuncionario").value.trim().toLowerCase();
    const lista = estado.funcionarios
        .filter((f) => !busca || f.nome.toLowerCase().includes(busca))
        .sort(porNome);

    $("#corpoFuncionarios").innerHTML = lista.map((f) => {
        let etiqueta = "";
        const temTermoPendente = f.termoStatus === "Pendente" || (f.reserva && f.reserva.termoStatus === "Pendente");
        const temManutencao = (f.equipamentos || []).some((eq) => eq.status === "Em manutenção") || f.status === "Em manutenção";

        if (temManutencao) etiqueta = `<span class="etiqueta-alerta-sutil">Manutenção</span>`;
        else if (temTermoPendente) etiqueta = `<span class="etiqueta-pendente-sutil">Termo Pendente</span>`;

        return `
      <tr class="linha-clicavel" data-abrir-detalhes-func="${escapar(f.id)}">
        <td><span class="nome-destaque"><strong>${escapar(f.nome)}</strong></span> ${etiqueta}</td>
        <td style="text-align: right;">
          <button class="btn btn-light" type="button" style="padding: 4px 8px; font-size: 0.75rem;">Ver Detalhes</button>
          <button class="btn btn-light" type="button" data-remover-ativo="${escapar(f.id)}" style="padding: 4px 8px; font-size: 0.75rem; color: var(--vermelho-aveludado); border-color: var(--vermelho-borda-suave); margin-left: 4px;">Remover</button>
        </td>
      </tr>`;
    }).join("");

    $("#vazioFunc").hidden = lista.length > 0;
}

function renderGradeObras() {
    const container = $("#gradeObras");
    if (!container) return;

    const termo = ($("#buscaObraLista") ? $("#buscaObraLista").value : "").trim().toLowerCase();
    const obrasOrdenadas = [...estado.obras].sort(porNome).filter((o) => {
        if (!termo) return true;
        return `${o.nome} ${o.engenheiro || ""} ${o.admin || ""}`.toLowerCase().includes(termo);
    });

    const lista = [
        ...(!termo ? [{ id: "todas", nome: "Todas as obras (Visão Geral)", engenheiro: "-", admin: "-" }] : []),
        ...obrasOrdenadas
    ];

    $("#qtdObrasGrade").textContent = `${estado.obras.length} obras cadastradas em ordem alfabética`;

    container.innerHTML = lista.map((o) => {
        const isTodas = o.id === "todas";
        const eng = isTodas
            ? "Visão consolidada"
            : (o.engenheiro
                ? escapar(o.engenheiro)
                : `<button type="button" class="etiqueta-alerta-sutil" data-editar-obra="${escapar(o.id)}" style="margin-left:0; cursor:pointer;">+ Cadastrar Engenheiro</button>`);
        const adm = isTodas ? "Todas as equipes" : (o.admin ? escapar(o.admin) : "-");
        const qtdEq = isTodas
            ? estado.equipamentos.length
            : estado.equipamentos.filter((e) => e.obra === o.id).length;
        const selecionada = o.id === obraAtual;

        return `
      <tr class="linha-clicavel ${selecionada ? "obra-linha-ativa" : ""}" data-obra="${escapar(o.id)}">
        <td><span class="nome-destaque"><strong>${escapar(o.nome)}</strong></span></td>
        <td>${eng}</td>
        <td>${adm}</td>
        <td style="text-align: center;"><strong>${qtdEq}</strong></td>
        <td style="text-align: right; white-space: nowrap;">
          ${!isTodas ? `<button class="btn btn-light" type="button" data-editar-obra="${escapar(o.id)}" style="padding: 4px 8px; font-size: 0.75rem; margin-right: 4px;">Editar</button>` : ""}
          <button class="btn btn-primary" type="button" style="padding: 4px 10px; font-size: 0.75rem;">Abrir Obra</button>
        </td>
      </tr>`;
    }).join("");
}

function renderTitulo() {
    const t = $("#tituloObra");
    const s = $("#subObra");
    if (!t || !s) return;

    if (painelGradeAberto) {
        t.textContent = "Obras";
        s.textContent = "Selecione uma obra para ver equipamentos e solicitações";
        return;
    }
    if (obraAtual === "todas") {
        t.textContent = "Todas as obras";
        s.textContent = "Visão geral consolidada de equipamentos e solicitações";
        return;
    }
    const o = estado.obras.find((x) => x.id === obraAtual);
    if (!o) {
        t.textContent = "Obras";
        s.textContent = "";
        return;
    }
    t.textContent = o.nome;
    s.textContent = [
        o.cidade || null,
        o.engenheiro ? `Eng.: ${o.engenheiro}` : null,
        o.admin ? `Escritório: ${o.admin}` : null
    ].filter(Boolean).join(" · ");
}

function equipamentosDaObra() {
    return estado.equipamentos.filter((e) => obraAtual === "todas" || e.obra === obraAtual);
}

function renderKpis() {
    const kp = $("#kpis");
    if (!kp) return;
    const c = contar(equipamentosDaObra());
    const sel = $("#filtroStatus") ? $("#filtroStatus").value : "";
    const itens = [
        ["total", "", c.total, "Equipamentos"],
        ["ok", "online", c.online, "Em uso"],
        ["alerta", "manutencao", c.manutencao, "Em manutenção"],
        ["parado", "parado", c.parado, "Parados"]
    ];
    kp.innerHTML = itens.map(([cls, st, v, rot]) =>
        `<div class="kpi ${cls} ${sel === st ? "ativo-kpi" : ""}" data-kpi-status="${st}" role="button" tabindex="0"><div class="kpi-valor">${v}</div><div class="kpi-rotulo">${rot}</div></div>`
    ).join("");
}

/* ---------- Ordenação ---------- */
const valorEquip = {
    nome: (e) => e.nome, tipo: (e) => e.tipo, obra: (e) => nomeObra(e.obra),
    responsavel: (e) => e.responsavel || "", status: (e) => STATUS[e.status] || e.status
};
const valorSolic = {
    equipamento: (s) => s.equipamento, tipo: (s) => s.tipo, quantidade: (s) => Number(s.quantidade) || 0,
    obra: (s) => nomeObra(s.obra), solicitante: (s) => s.solicitante || "",
    urgencia: (s) => s.urgencia, situacao: (s) => s.situacao, data: (s) => s.data || 0
};
function ordenarLista(lista, ordem, getters) {
    if (!ordem.campo || !getters[ordem.campo]) return lista;
    const g = getters[ordem.campo];
    return [...lista].sort((a, b) => {
        const x = g(a), y = g(b);
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
        return r * ordem.dir;
    });
}
function ligarOrdenacao(theadSel, ordem, render) {
    on(theadSel, "click", (ev) => {
        const btn = ev.target.closest(".th-ordenar");
        if (!btn) return;
        const campo = btn.dataset.ordem;
        if (ordem.campo === campo) ordem.dir *= -1; else { ordem.campo = campo; ordem.dir = 1; }
        $(theadSel).querySelectorAll("th").forEach((th) => th.setAttribute("aria-sort", "none"));
        btn.closest("th").setAttribute("aria-sort", ordem.dir === 1 ? "ascending" : "descending");
        render();
    });
}

function equipamentosFiltrados() {
    const termo = ($("#busca") ? $("#busca").value : "").trim().toLowerCase();
    const st = $("#filtroStatus") ? $("#filtroStatus").value : "";
    const tp = $("#filtroTipo") ? $("#filtroTipo").value : "";
    const lista = equipamentosDaObra().filter((e) =>
        (!st || e.status === st) &&
        (!tp || e.tipo === tp) &&
        (!termo || `${e.nome} ${e.tipo} ${e.responsavel || ""}`.toLowerCase().includes(termo))
    );
    return ordenarLista(lista, ordemEquip, valorEquip);
}

function renderTabela() {
    const listaCompleta = equipamentosFiltrados();
    const lista = expandidoEquip ? listaCompleta : listaCompleta.slice(0, LIMITE_EQUIP);
    const totalObra = equipamentosDaObra().length;

    $("#contagemEquip").textContent = `Mostrando ${lista.length} de ${totalObra} equipamento(s)`;

    $("#corpoTabela").innerHTML = lista.map((e) => `
    <tr>
      <td><strong>${escapar(e.nome)}</strong></td>
      <td>${escapar(e.tipo)}</td>
      <td>${escapar(nomeObra(e.obra))}</td>
      <td>${escapar(e.responsavel || "-")}</td>
      <td><span class="badge ${escapar(e.status)}">${escapar(STATUS[e.status] || e.status)}</span></td>
      <td class="acoes">
        <button class="btn-icone btn-editar" data-editar="${escapar(e.id)}">Editar</button>
        <button class="btn-icone" data-remover="${escapar(e.id)}">Remover</button>
      </td>
    </tr>`).join("");

    const c = contar(listaCompleta);
    $("#tfootEquip").innerHTML = listaCompleta.length
        ? `<tr><td colspan="6"><strong>Total:</strong> ${c.total} · Em uso: ${c.online} · Em manutenção: ${c.manutencao} · Parados: ${c.parado}</td></tr>`
        : "";

    $("#vazio").hidden = listaCompleta.length > 0;

    const btn = $("#btnVerTodosEquip");
    if (btn) {
        if (listaCompleta.length > LIMITE_EQUIP) {
            btn.hidden = false;
            btn.textContent = expandidoEquip ? `Mostrar apenas ${LIMITE_EQUIP}` : `Ver todos (${listaCompleta.length})`;
        } else {
            btn.hidden = true;
        }
    }

    const limpar = $("#limparFiltrosEquip");
    if (limpar) limpar.hidden = !($("#filtroStatus").value || $("#filtroTipo").value || $("#busca").value);
}

function renderTudo() {
    const naListaDeObras = painelGradeAberto;

    const painelLista = $("#painelGradeObras");
    if (painelLista) {
        painelLista.classList.toggle("aberto", naListaDeObras);
        painelLista.hidden = !naListaDeObras;
    }

    $("#kpis").hidden = naListaDeObras;
    $("#painelEquipamentos").hidden = naListaDeObras;
    $("#painelSolicitacoes").hidden = naListaDeObras;
    $("#btnVoltarListaObras").hidden = naListaDeObras;
    $("#acoesTopoObra").hidden = naListaDeObras;
    $("#acoesTopoListaObras").hidden = !naListaDeObras;

    renderTitulo();

    if (naListaDeObras) {
        renderGradeObras();
    } else {
        renderKpis();
        renderFiltros();
        renderTabela();
        renderSolicitacoes();
        $("#btnNovoEquip").hidden = (obraAtual === "todas");
    }

    renderAuditoria();
    if (telaAtual === "resumo") renderResumoObras();
    if (telaAtual === "funcionarios") alternarAbaFuncionarios(abaFuncionariosAtual);
}

/* ---------- Solicitações ---------- */
function solicitacoesFiltradas() {
    const sit = $("#filtroSituacao").value;
    const urg = $("#filtroUrgencia").value;
    const lista = estado.solicitacoes.filter((s) =>
        (obraAtual === "todas" || s.obra === obraAtual) && (!sit || s.situacao === sit) && (!urg || s.urgencia === urg));
    return ordenarLista(lista, ordemSolic, valorSolic);
}

function renderSolicitacoes() {
    const listaCompleta = solicitacoesFiltradas();
    const lista = expandidoSolic ? listaCompleta : listaCompleta.slice(0, LIMITE_SOLIC);
    const totalObra = estado.solicitacoes.filter((s) => obraAtual === "todas" || s.obra === obraAtual).length;

    $("#contagemSolic").textContent = `Mostrando ${lista.length} de ${totalObra} solicitação(ões)`;

    $("#corpoSolic").innerHTML = lista.map((s) => `
    <tr>
      <td><strong>${escapar(s.equipamento)}</strong></td>
      <td>${escapar(s.tipo)}</td>
      <td>${escapar(s.quantidade)}</td>
      <td>${escapar(nomeObra(s.obra))}</td>
      <td>${escapar(s.solicitante || "-")}</td>
      <td><span class="badge ${escapar(URGENCIA[s.urgencia] || "")}">${escapar(s.urgencia)}</span></td>
      <td><select class="sel-situacao" data-situacao="${escapar(s.id)}">
        ${SITUACOES.map((x) => `<option ${x === s.situacao ? "selected" : ""}>${x}</option>`).join("")}
      </select></td>
      <td>${formatarData(s.data)}</td>
      <td class="acoes">
        <button class="btn-icone btn-editar" data-editar-solic="${escapar(s.id)}">Editar</button>
        <button class="btn-icone" data-remover-solic="${escapar(s.id)}">Remover</button>
      </td>
    </tr>`).join("");

    $("#vazioSolic").hidden = listaCompleta.length > 0;

    const btnVerTodas = $("#btnVerTodasSolic");
    if (btnVerTodas) {
        if (listaCompleta.length > LIMITE_SOLIC) {
            btnVerTodas.hidden = false;
            btnVerTodas.textContent = expandidoSolic ? `Mostrar apenas ${LIMITE_SOLIC}` : `Ver todas (${listaCompleta.length})`;
        } else {
            btnVerTodas.hidden = true;
        }
    }
}

function preencherFiltrosSolic() {
    $("#filtroSituacao").innerHTML = `<option value="">Todas</option>` + SITUACOES.map((s) => `<option>${s}</option>`).join("");
    $("#filtroUrgencia").innerHTML = `<option value="">Todas</option><option>Normal</option><option>Média</option><option>Alta</option>`;
}
function atualizarLimparSolic() {
    $("#limparFiltrosSolic").hidden = !($("#filtroSituacao").value || $("#filtroUrgencia").value);
}

function abrirSolic(s) {
    editandoSolic = s ? s.id : null;
    $("#tituloSolic").textContent = s ? "Editar solicitação" : "Solicitar equipamento";
    const f = $("#formSolic");
    f.reset();
    preencherSelObra($("#selObraSolic"), s ? s.obra : (obraAtual !== "todas" ? obraAtual : ""));
    preencherSelPessoas($("#selSolicitante"), s ? s.solicitante : "", $("#selObraSolic").value);
    if (s) {
        f.elements.equipamento.value = s.equipamento;
        f.elements.tipo.value = s.tipo;
        f.elements.quantidade.value = s.quantidade;
        f.elements.urgencia.value = s.urgencia;
        f.elements.motivo.value = s.motivo || "";
    }
    $("#dlgSolic").showModal();
}

/* ---------- Selects de obra e pessoas ---------- */
function preencherSelObra(sel, valor) {
    if (!sel) return;
    sel.innerHTML = [...estado.obras].sort(porNome)
        .map((o) => `<option value="${escapar(o.id)}">${escapar(o.nome)}</option>`).join("");
    if (valor) sel.value = valor;
}

function obterResponsavelPadraoObra(idObra) {
    if (!idObra || idObra === "todas") return "";
    const obra = estado.obras.find((o) => o.id === idObra);
    if (!obra) return "";
    if (obra.admin && obra.admin.trim()) return obra.admin.split(",")[0].trim();
    if (obra.engenheiro && obra.engenheiro.trim()) return obra.engenheiro.trim();
    return "";
}

function preencherSelPessoas(sel, valor, idObraFiltro) {
    if (!sel) return;
    const conjuntoNomes = new Set();

    const idObra = idObraFiltro || (sel.id === "selSolicitante" && $("#selObraSolic")
        ? $("#selObraSolic").value
        : ($("#selObra") ? $("#selObra").value : obraAtual));

    const obrasAlvo = (idObra && idObra !== "todas")
        ? estado.obras.filter((o) => o.id === idObra)
        : estado.obras;

    obrasAlvo.forEach((o) => {
        if (o.admin) o.admin.split(",").forEach((nome) => { if (nome.trim()) conjuntoNomes.add(nome.trim()); });
        if (o.engenheiro && o.engenheiro.trim()) conjuntoNomes.add(o.engenheiro.trim());
    });

    (estado.funcionarios || []).forEach((f) => {
        if (f.nome && f.nome.trim()) conjuntoNomes.add(f.nome.trim());
    });

    const valorFinal = (valor && valor.trim()) ? valor.trim() : obterResponsavelPadraoObra(idObra);
    if (valorFinal) conjuntoNomes.add(valorFinal);

    const nomes = [...conjuntoNomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sel.innerHTML = `<option value="">-</option>` +
        nomes.map((n) => `<option value="${escapar(n)}">${escapar(n)}</option>`).join("");
    sel.value = valorFinal || "";
}

/* ---------- Auditoria ---------- */
function auditoriaFiltrada() {
    const termo = $("#buscaAudit") ? $("#buscaAudit").value.trim().toLowerCase() : "";
    const dataInicioVal = $("#filtroDataInicio") ? $("#filtroDataInicio").value : "";
    const dataFimVal = $("#filtroDataFim") ? $("#filtroDataFim").value : "";

    const timestampInicio = dataInicioVal ? new Date(dataInicioVal + "T00:00:00").getTime() : null;
    const timestampFim = dataFimVal ? new Date(dataFimVal + "T23:59:59").getTime() : null;

    const btnLimparDatas = $("#limparFiltrosDataAudit");
    if (btnLimparDatas) btnLimparDatas.hidden = (!dataInicioVal && !dataFimVal);

    return estado.auditoria.filter((a) => {
        const atendeTermo = !termo || `${a.acao} ${a.item} ${a.obra} ${a.detalhes}`.toLowerCase().includes(termo);

        let atendeData = true;
        if (timestampInicio && a.data < timestampInicio) atendeData = false;
        if (timestampFim && a.data > timestampFim) atendeData = false;

        const acaoMin = (a.acao || "").toLowerCase();
        const detMin = (a.detalhes || "").toLowerCase();
        let atendeFiltroCat = true;
        if (filtroAuditoriaAtual === "novo") {
            atendeFiltroCat = a.cat === "novo";
        } else if (filtroAuditoriaAtual === "edicao") {
            atendeFiltroCat = a.cat === "edicao";
        } else if (filtroAuditoriaAtual === "desligamento") {
            atendeFiltroCat = a.cat === "desligamento" || acaoMin.includes("desligado") || detMin.includes("desligado");
        } else if (filtroAuditoriaAtual === "remocao") {
            atendeFiltroCat = a.cat === "remocao" && !acaoMin.includes("desligado");
        } else if (filtroAuditoriaAtual === "exportacao") {
            atendeFiltroCat = acaoMin.includes("exportação") || a.cat === "sistema";
        }

        return atendeTermo && atendeData && atendeFiltroCat;
    });
}

function renderAuditoria() {
    const corpo = $("#corpoAudit");
    if (!corpo) return;
    const lista = auditoriaFiltrada();
    const mostra = lista.slice(0, 300);

    corpo.innerHTML = mostra.map((a) => `
    <tr>
      <td class="audit-data">${formatarDataHora(a.data)}</td>
      <td><span class="badge online">${escapar(a.acao)}</span></td>
      <td><strong>${escapar(a.item || "-")}</strong></td>
      <td>${escapar(a.obra || "-")}</td>
      <td class="audit-detalhe">${escapar(a.detalhes || "-")}</td>
    </tr>`).join("");
    $("#vazioAudit").hidden = lista.length > 0;

    const nota = $("#notaAudit");
    if (nota) {
        nota.hidden = lista.length <= mostra.length;
        nota.textContent = `Mostrando ${mostra.length} de ${lista.length} registros. A exportação inclui todos.`;
    }
}

function registrar(cat, acao, item, obra, detalhes) {
    estado.auditoria.unshift({ id: novoId("a"), data: Date.now(), cat, acao, item: item || "", obra: obra || "", detalhes: detalhes || "" });
    salvar();
    renderAuditoria();
}

async function arquivarAuditoria() {
    const limite = Date.now() - (90 * 86400000);
    const antigos = estado.auditoria.filter((a) => a.data < limite);
    if (!antigos.length) { mostrarAviso("Não há registros com mais de 90 dias."); return; }
    const confirmadoAudit = await mostrarModalSistema("Arquivar Auditoria", `Arquivar ${antigos.length} registro(s) com mais de 90 dias? Um arquivo será baixado e eles serão removidos do sistema.`, true);
    if (!confirmadoAudit) return;
    baixarArquivo(new Blob([JSON.stringify(antigos, null, 2)], { type: "application/json" }), `auditoria-arquivada-${dataLocal()}.json`);
    estado.auditoria = estado.auditoria.filter((a) => a.data >= limite);
    salvar();
    renderAuditoria();
    mostrarAviso(`${antigos.length} registro(s) arquivado(s).`);
}

/* ---------- Resumo ---------- */
function renderResumoObras() {
    // 1. Quadro de Obras
    const dadosObras = [...estado.obras].sort(porNome).map((o) => {
        const c = contar(estado.equipamentos.filter((e) => e.obra === o.id));
        const sol = estado.solicitacoes.filter((s) => s.obra === o.id).length;
        return { nome: o.nome, eng: o.engenheiro || "-", adm: o.admin || "-", c, total: c.total, sol };
    });

    let sU = 0, sM = 0, sP = 0, sT = 0, sS = 0;
    $("#corpoResumoObras").innerHTML = dadosObras.map((d) => {
        sU += d.c.online; sM += d.c.manutencao; sP += d.c.parado; sT += d.total; sS += d.sol;
        return `
      <tr>
        <td><strong>${escapar(d.nome)}</strong></td>
        <td>${escapar(d.eng)}</td>
        <td>${escapar(d.adm)}</td>
        <td style="text-align: center;"><strong>${d.total}</strong></td>
        <td style="text-align: center;"><span class="badge online">${d.c.online}</span></td>
        <td style="text-align: center;"><span class="badge manutencao">${d.c.manutencao}</span></td>
        <td style="text-align: center;"><span class="badge parado">${d.c.parado}</span></td>
        <td style="text-align: center;">${d.sol}</td>
      </tr>`;
    }).join("");

    $("#tfootResumoObras").innerHTML = `
    <tr>
      <td colspan="3"><strong>TOTAL GERAL DE OBRAS</strong></td>
      <td style="text-align: center;"><strong>${sT}</strong></td>
      <td style="text-align: center;"><span class="badge online">${sU}</span></td>
      <td style="text-align: center;"><span class="badge manutencao">${sM}</span></td>
      <td style="text-align: center;"><span class="badge parado">${sP}</span></td>
      <td style="text-align: center;">${sS}</td>
    </tr>`;

    // 2. Quadro de Estoque (Gaiolas)
    let totalEstoqueGeral = 0, totalTiGeral = 0, totalAdmGeral = 0, totalGuardadoGeral = 0, totalEmUsoGeral = 0;

    $("#corpoResumoEstoque").innerHTML = GAIOLAS_PADRAO.map((g) => {
        const itensGaiola = estado.estoque.filter((i) => String(i.gaiola || "").toLowerCase() === String(g.id).toLowerCase() || String(i.gaiola || "").toLowerCase() === String(g.nome).toLowerCase());
        const total = itensGaiola.length;
        const ti = itensGaiola.filter((i) => String(i.setor || "").toUpperCase() === "TI").length;
        const adm = itensGaiola.filter((i) => String(i.setor || "").toUpperCase() === "ADM").length;
        const guardado = itensGaiola.filter((i) => String(i.status || "").toLowerCase() === "guardado").length;
        const emUso = itensGaiola.filter((i) => String(i.status || "").toLowerCase() === "em uso").length;

        totalEstoqueGeral += total;
        totalTiGeral += ti;
        totalAdmGeral += adm;
        totalGuardadoGeral += guardado;
        totalEmUsoGeral += emUso;

        return `
      <tr>
        <td><strong>${escapar(g.nome)}</strong></td>
        <td style="text-align: center;"><strong>${total}</strong></td>
        <td style="text-align: center;"><span class="badge online">${ti}</span></td>
        <td style="text-align: center;"><span class="badge parado">${adm}</span></td>
        <td style="text-align: center;">${guardado}</td>
        <td style="text-align: center;"><span class="badge manutencao">${emUso}</span></td>
      </tr>`;
    }).join("");

    $("#tfootResumoEstoque").innerHTML = `
    <tr>
      <td><strong>TOTAL GERAL DO ESTOQUE</strong></td>
      <td style="text-align: center;"><strong>${totalEstoqueGeral}</strong></td>
      <td style="text-align: center;"><span class="badge online">${totalTiGeral}</span></td>
      <td style="text-align: center;"><span class="badge parado">${totalAdmGeral}</span></td>
      <td style="text-align: center;">${totalGuardadoGeral}</td>
      <td style="text-align: center;"><span class="badge manutencao">${totalEmUsoGeral}</span></td>
    </tr>`;

    $("#kpisResumo").innerHTML = [
        ["total", sT, "Equipamentos em Obras"], ["ok", sU, "Em Uso nas Obras"],
        ["alerta", totalEstoqueGeral, "Total de Itens no Estoque"], ["parado", sP, "Equip. Parados"]
    ].map(([cls, v, rot]) => `<div class="kpi ${cls}"><div class="kpi-valor">${v}</div><div class="kpi-rotulo">${rot}</div></div>`).join("");

    aplicarBuscaResumo();
}

function aplicarBuscaResumo() {
    const termo = ($("#buscaResumoObra").value || "").trim().toLowerCase();
    document.querySelectorAll("#corpoResumoObras tr").forEach((tr) => {
        tr.hidden = !!termo && !tr.textContent.toLowerCase().includes(termo);
    });
}

/* ==========================================================================
   ESTOQUE E GAIOLAS
   ========================================================================== */

function renderTudoEstoque() {
    const naListaGaiolas = painelGradeGaiolasAberto;

    const painelLista = $("#painelGradeGaiolas");
    if (painelLista) {
        painelLista.classList.toggle("aberto", naListaGaiolas);
        painelLista.hidden = !naListaGaiolas;
    }

    $("#painelItensEstoque").hidden = naListaGaiolas;
    $("#btnVoltarListaGaiolas").hidden = naListaGaiolas;
    $("#acoesTopoGaiola").hidden = naListaGaiolas;
    $("#acoesTopoListaGaiolas").hidden = !naListaGaiolas;

    const t = $("#tituloGaiola");
    const s = $("#subGaiola");

    if (naListaGaiolas) {
        t.textContent = "Estoque";
        s.textContent = "Selecione uma gaiola para gerenciar os itens";
        renderGradeGaiolas();
    } else {
        const nomeG = nomeGaiola(gaiolaAtual);
        t.textContent = nomeG;
        s.textContent = `Gerenciamento de equipamentos e materiais da ${nomeG}`;
        $("#tituloTabelaGaiola").textContent = `Itens da ${nomeG}`;
        renderTabelaEstoque();
        verificarAlertaCincoDias();
    }
}

function renderGradeGaiolas() {
    const container = $("#gradeGaiolas");
    if (!container) return;
    const termo = ($("#buscaGaiolaLista") ? $("#buscaGaiolaLista").value : "").trim().toLowerCase();

    const lista = GAIOLAS_PADRAO.filter((g) => !termo || g.nome.toLowerCase().includes(termo));

    container.innerHTML = lista.map((g) => {
        const qtdItens = estado.estoque.filter((i) => i.gaiola === g.id).length;
        return `
      <tr class="linha-clicavel" data-gaiola="${escapar(g.id)}">
        <td><span class="nome-destaque"><strong>${escapar(g.nome)}</strong></span></td>
        <td style="text-align: center;"><strong>${qtdItens}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-primary" type="button" style="padding: 4px 10px; font-size: 0.75rem;">Abrir Gaiola</button>
        </td>
      </tr>`;
    }).join("");
}

function itensEstoqueDaGaiola() {
    return estado.estoque.filter((i) => i.gaiola === gaiolaAtual);
}

function renderTabelaEstoque() {
    const termo = ($("#buscaEstoque") ? $("#buscaEstoque").value : "").trim().toLowerCase();
    const setorFiltro = $("#filtroSetorEstoque").value;
    const statusFiltro = $("#filtroStatusEstoque").value;

    const lista = itensEstoqueDaGaiola().filter((i) =>
        (!setorFiltro || i.setor === setorFiltro) &&
        (!statusFiltro || i.status === statusFiltro) &&
        (!termo || `${i.nome} ${i.tipo} ${i.setor}`.toLowerCase().includes(termo))
    );

    $("#contagemEstoque").textContent = `Mostrando ${lista.length} de ${itensEstoqueDaGaiola().length} item(ns)`;

    $("#corpoTabelaEstoque").innerHTML = lista.map((i) => `
    <tr>
      <td><strong>${escapar(i.nome)}</strong> <span style="font-size: 0.72rem; color: var(--texto-suave);">(${escapar(i.classificacao)})</span></td>
      <td>${escapar(i.tipo)}</td>
      <td><span class="badge ${i.setor === "TI" ? "online" : "parado"}">${escapar(i.setor)}</span></td>
      <td><span class="badge ${i.status === "Em uso" ? "manutencao" : "online"}">${escapar(i.status)}</span></td>
      <td>${formatarData(i.dataEntrada)}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="btn-icone btn-editar" data-editar-item="${escapar(i.id)}">Editar</button>
        <button class="btn-icone" data-remover-item="${escapar(i.id)}" style="color: var(--vermelho-aveludado);">Remover</button>
      </td>
    </tr>`).join("");

    $("#vazioEstoque").hidden = lista.length > 0;
}

function abrirModalItemEstoque(item) {
    editandoItemEstoqueId = item ? item.id : null;
    $("#tituloDlgItemEstoque").textContent = item ? "Editar Item" : "Cadastrar Item no Estoque";
    $("#formItemEstoque").reset();
    preencherTiposEstoque(item ? item.tipo : "");

    const f = $("#formItemEstoque").elements;
    if (item) {
        // Carrega os dados reais do item (antes sempre voltava para TI / Guardado e o nome ficava em branco)
        f.setor.value = item.setor || "TI";
        $("#inputClassificacaoAuto").value = f.setor.value === "TI" ? "Equipamento" : "Material";
        f.nome.value = item.nome || "";
        f.status.value = item.status || "Guardado";
    } else {
        $("#inputClassificacaoAuto").value = "Equipamento";
    }
    $("#dlgItemEstoque").showModal();
}

function verificarAlertaCincoDias() {
    if (painelGradeGaiolasAberto || telaAtual !== "estoque") return;

    let dlgAlerta = $("#dlgAlertaEstoque5Dias");
    if (dlgAlerta && dlgAlerta.open) return;

    const CINCO_DIAS_MS = 5 * 86400000;
    const agora = Date.now();

    // Item "Em uso" há 5+ dias (contando da entrada ou do último "Não" respondido)
    const itemAlvo = itensEstoqueDaGaiola().find((i) =>
        i.status === "Em uso" && (agora - Math.max(i.dataEntrada || 0, i.ultimoAlerta || 0)) >= CINCO_DIAS_MS
    );
    if (!itemAlvo) return;

    if (!dlgAlerta) {
        dlgAlerta = document.createElement("dialog");
        dlgAlerta.id = "dlgAlertaEstoque5Dias";
        dlgAlerta.innerHTML = `
      <form method="dialog" novalidate style="padding: 20px; display: grid; gap: 12px; max-width: 400px;">
        <h3 style="color: var(--vermelho-aveludado); font-size: 1.05rem;">Alerta de Tempo em Uso</h3>
        <p id="textoAlertaCincoDias" style="font-size: 0.85rem; line-height: 1.4;"></p>
        <div class="dlg-actions" style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
          <button type="button" class="btn btn-light" id="btnNaoAlerta5Dias">Não</button>
          <button type="button" class="btn btn-perigo" id="btnSimAlerta5Dias">Sim</button>
        </div>
      </form>`;
        document.body.appendChild(dlgAlerta);
    }

    $("#textoAlertaCincoDias").textContent =
        `O ${(itemAlvo.classificacao || "item").toLowerCase()} "${itemAlvo.nome}" está em uso há mais de 5 dias. Deseja removê-lo do estoque?`;

    // Não: mantém o item e só pergunta de novo daqui a mais 5 dias
    $("#btnNaoAlerta5Dias").onclick = () => {
        dlgAlerta.close();
        itemAlvo.ultimoAlerta = Date.now();
        salvar();
        verificarAlertaCincoDias();
    };

    // Sim: remove o item
    $("#btnSimAlerta5Dias").onclick = () => {
        dlgAlerta.close();
        estado.estoque = estado.estoque.filter((i) => i.id !== itemAlvo.id);
        registrar("remocao", "Item removido por tempo em uso", itemAlvo.nome, nomeGaiola(itemAlvo.gaiola), "Removido após alerta de 5 dias em uso");
        salvar();
        renderTudoEstoque();
        mostrarAviso(`"${itemAlvo.nome}" foi removido do estoque.`);
    };

    dlgAlerta.showModal();
}

/* ---------- Exportação: uma gaiola ---------- */
function linhasEstoqueGaiola(lista) {
    return lista.map((i) => ({
        "Nome / Descrição": i.nome,
        "Classificação": i.classificacao,
        "Tipo": i.tipo,
        "Setor": i.setor,
        "Status": i.status,
        "Data de Entrada": formatarData(i.dataEntrada)
    }));
}

function exportarEstoqueExcel() {
    const linhas = linhasEstoqueGaiola(itensEstoqueDaGaiola());
    if (!linhas.length) { mostrarAviso("Sem itens nesta gaiola para exportar."); return; }
    gerarPlanilha([{ nome: "Estoque", linhas }], `estoque-${nomeGaiola(gaiolaAtual).toLowerCase().replace(/\s+/g, "-")}-${dataLocal()}`, $("#btnExportarEstoqueExcel"), `Estoque - ${nomeGaiola(gaiolaAtual)}`);
}

function exportarEstoquePdf() {
    const lista = itensEstoqueDaGaiola();
    if (!lista.length) { mostrarAviso("Sem itens nesta gaiola para PDF."); return; }
    let html = `<table><thead><tr><th>Nome / Descrição</th><th>Classificação</th><th>Tipo</th><th>Setor</th><th>Status</th><th>Data de Entrada</th></tr></thead><tbody>`;
    lista.forEach((i) => {
        html += `<tr><td><strong>${escapar(i.nome)}</strong></td><td>${escapar(i.classificacao)}</td><td>${escapar(i.tipo)}</td><td>${escapar(i.setor)}</td><td>${escapar(i.status)}</td><td>${escapar(formatarData(i.dataEntrada))}</td></tr>`;
    });
    html += `</tbody></table>`;
    imprimirComoPdf(`Relatório de Estoque — ${nomeGaiola(gaiolaAtual)}`, `Total: ${lista.length} item(ns)`, html);
}

/* ---------- Exportação: estoque geral (todas as gaiolas) ---------- */
function exportarEstoqueGeralExcel() {
    if (!estado.estoque.length) { mostrarAviso("Não há itens no estoque para exportar."); return; }

    // Aba 1: todos os itens, com a coluna "Gaiola"
    const todos = GAIOLAS_PADRAO.flatMap((g) =>
        estado.estoque.filter((i) => i.gaiola === g.id).map((i) => ({ "Gaiola": g.nome, ...linhasEstoqueGaiola([i])[0] }))
    );

    // Demais abas: uma por gaiola (somente as que têm itens)
    const abasGaiolas = GAIOLAS_PADRAO
        .map((g) => ({ nome: g.nome, linhas: linhasEstoqueGaiola(estado.estoque.filter((i) => i.gaiola === g.id)) }))
        .filter((a) => a.linhas.length);

    gerarPlanilha(
        [{ nome: "Todas as Gaiolas", linhas: todos }, ...abasGaiolas],
        `estoque-geral-${dataLocal()}`,
        $("#btnExportarEstoqueGeralExcel"),
        "Estoque geral (todas as gaiolas)"
    );
}

function exportarEstoqueGeralPdf() {
    if (!estado.estoque.length) { mostrarAviso("Não há itens no estoque para exportar."); return; }

    let html = "";
    GAIOLAS_PADRAO.forEach((g) => {
        const lista = estado.estoque.filter((i) => i.gaiola === g.id);
        if (!lista.length) return;
        html += `<h2 style="font-size:14px; margin:18px 0 6px;">${escapar(g.nome)} <span style="font-weight:normal; color:#6e7076; font-size:11px;">(${lista.length} item(ns))</span></h2>`;
        html += `<table><thead><tr><th>Nome / Descrição</th><th>Classificação</th><th>Tipo</th><th>Setor</th><th>Status</th><th>Data de Entrada</th></tr></thead><tbody>`;
        lista.forEach((i) => {
            html += `<tr><td><strong>${escapar(i.nome)}</strong></td><td>${escapar(i.classificacao)}</td><td>${escapar(i.tipo)}</td><td>${escapar(i.setor)}</td><td>${escapar(i.status)}</td><td>${escapar(formatarData(i.dataEntrada))}</td></tr>`;
        });
        html += `</tbody></table>`;
    });

    imprimirComoPdf("Relatório Geral de Estoque — Todas as Gaiolas", `Total: ${estado.estoque.length} item(ns)`, html);
}

/* ==========================================================================
   BACKUP / ARMAZENAMENTO
   ========================================================================== */

function atualizarInfoBackup() {
    const t = Number(localStorage.getItem(CHAVE_BACKUP) || 0);
    const faixa = $("#faixaBackup");
    if (!t) {
        $("#infoBackup").textContent = "Nenhum backup salvo ainda";
        $("#textoFaixaBackup").textContent = "Você ainda não salvou nenhum backup. Os dados ficam apenas neste navegador.";
        faixa.hidden = false;
        return;
    }
    const dias = Math.floor((Date.now() - t) / 86400000);
    $("#infoBackup").textContent = `Último backup: ${formatarData(t)}`;
    $("#textoFaixaBackup").textContent = `Seu último backup foi há ${dias} dia(s). Salve um novo para não perder dados.`;
    faixa.hidden = dias < DIAS_LEMBRETE;
}

function atualizarAvisoArmazenamento() {
    const faixa = $("#faixaArmazenamento");
    if (!faixa) return;
    const cheio = JSON.stringify(estado).length > 3500000;
    faixa.hidden = !cheio;
    if (cheio) $("#textoFaixaArmazenamento").textContent = "O armazenamento do navegador está quase cheio. Arquive a auditoria antiga.";
}

/* ==========================================================================
   EXPORTAÇÕES EXCEL (XLSX) E PDF
   ========================================================================== */

function linhasEquip() {
    return equipamentosFiltrados().map((e) => ({
        "Equipamento": e.nome, "Tipo": e.tipo, "Obra": nomeObra(e.obra),
        "Responsável": e.responsavel || "-", "Status": STATUS[e.status] || e.status
    }));
}
function linhasSolic() {
    return solicitacoesFiltradas().map((s) => ({
        "Equipamento": s.equipamento, "Tipo": s.tipo, "Quantidade": Number(s.quantidade) || 0,
        "Obra": nomeObra(s.obra), "Solicitante": s.solicitante || "-", "Urgência": s.urgencia,
        "Situação": s.situacao, "Data": formatarData(s.data), "Motivo": s.motivo || ""
    }));
}
function linhasAudit() {
    return auditoriaFiltrada().map((a) => ({
        "Data e hora": formatarDataHora(a.data), "Ação": a.acao, "Item": a.item || "-",
        "Obra": a.obra || "-", "Detalhes": a.detalhes || "-"
    }));
}
function linhasResumo() {
    return [...estado.obras].sort(porNome).map((o) => {
        const c = contar(estado.equipamentos.filter((e) => e.obra === o.id));
        return {
            "Obra": o.nome, "Engenheiro Responsável": o.engenheiro || "-", "Resp. Escritório": o.admin || "-",
            "Total Equipamentos": c.total, "Em Uso": c.online, "Em Manutenção": c.manutencao, "Parados": c.parado,
            "Solicitações": estado.solicitacoes.filter((s) => s.obra === o.id).length
        };
    });
}
function htmlTabela(linhas) {
    const cols = Object.keys(linhas[0]);
    return `<table><thead><tr>${cols.map((c) => `<th>${escapar(c)}</th>`).join("")}</tr></thead><tbody>` +
        linhas.map((l) => `<tr>${cols.map((c) => `<td>${escapar(l[c])}</td>`).join("")}</tr>`).join("") +
        `</tbody></table>`;
}
function exportar(linhas, nomeAba, arquivo, btn, titulo) {
    if (!linhas.length) { mostrarAviso("Nada para exportar."); return; }
    gerarPlanilha([{ nome: nomeAba, linhas }], `${arquivo}-${dataLocal()}`, btn, titulo);
}
function exportarPdf(linhas, titulo) {
    if (!linhas.length) { mostrarAviso("Nada para exportar."); return; }
    imprimirComoPdf(titulo, `Total: ${linhas.length} registro(s)`, htmlTabela(linhas));
}
const subtituloObra = () => (obraAtual === "todas" ? "Todas as obras" : nomeObra(obraAtual));

const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 8; k--; ) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function criarZip(arquivos, tipoMime) {
    const enc = new TextEncoder();
    const d = new Date();
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const locais = [], central = [];
    let deslocamento = 0;
    arquivos.forEach(({ nome, dados }) => {
        const nomeB = enc.encode(nome);
        const crc = crc32(dados);
        const cab = new DataView(new ArrayBuffer(30));
        cab.setUint32(0, 0x04034b50, true); cab.setUint16(4, 20, true); cab.setUint16(6, 0x0800, true);
        cab.setUint16(8, 0, true); cab.setUint16(10, hora, true); cab.setUint16(12, data, true);
        cab.setUint32(14, crc, true); cab.setUint32(18, dados.length, true); cab.setUint32(22, dados.length, true);
        cab.setUint16(26, nomeB.length, true); cab.setUint16(28, 0, true);
        locais.push(new Uint8Array(cab.buffer), nomeB, dados);
        const reg = new DataView(new ArrayBuffer(46));
        reg.setUint32(0, 0x02014b50, true); reg.setUint16(4, 20, true); reg.setUint16(6, 20, true); reg.setUint16(8, 0x0800, true);
        reg.setUint16(10, 0, true); reg.setUint16(12, hora, true); reg.setUint16(14, data, true);
        reg.setUint32(16, crc, true); reg.setUint32(20, dados.length, true); reg.setUint32(24, dados.length, true);
        reg.setUint16(28, nomeB.length, true); reg.setUint32(42, deslocamento, true);
        central.push(new Uint8Array(reg.buffer), nomeB);
        deslocamento += 30 + nomeB.length + dados.length;
    });
    const tamCentral = central.reduce((soma, p) => soma + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true); fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamCentral, true); fim.setUint32(16, deslocamento, true);
    return new Blob([...locais, ...central, new Uint8Array(fim.buffer)], { type: tipoMime });
}

const xmlEsc = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function letraColuna(i) {
    let s = "", n = i + 1;
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

const NS_PLANILHA = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const ESTILOS_XLSX = `<styleSheet xmlns="${NS_PLANILHA}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF25282E"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function xmlPlanilha(linhas) {
    const colunas = Object.keys(linhas[0] || {});
    const larguras = colunas.map((k) => Math.min(50, Math.max(k.length + 3, 14)));
    const celula = (valor, c, r, estilo) => {
        const ref = `${letraColuna(c)}${r}`;
        const s = estilo ? ` s="${estilo}"` : "";
        if (typeof valor === "number" && isFinite(valor)) return `<c r="${ref}"${s}><v>${valor}</v></c>`;
        return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(valor ?? "")}</t></is></c>`;
    };
    const corpo = [
        `<row r="1">${colunas.map((k, c) => celula(k, c, 1, 1)).join("")}</row>`,
        ...linhas.map((l, i) => `<row r="${i + 2}">${colunas.map((k, c) => celula(l[k], c, i + 2)).join("")}</row>`)
    ].join("");
    const ultima = `${letraColuna(colunas.length - 1)}${linhas.length + 1}`;
    return `<worksheet xmlns="${NS_PLANILHA}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${corpo}</sheetData><autoFilter ref="A1:${ultima}"/></worksheet>`;
}

function nomeAbaSeguro(nome, indice) {
    const limpo = String(nome || "").replace(/[\\\/?*\[\]:]/g, " ").trim().slice(0, 31);
    return limpo || `Planilha${indice + 1}`;
}

function criarXlsx(abas) {
    const enc = new TextEncoder();
    const cab = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const abasContent = abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
    const textos = [
        ["[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${abasContent}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
        ["_rels/.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
        ["xl/workbook.xml", `<workbook xmlns="${NS_PLANILHA}" xmlns:r="${NS_REL}"><sheets>${abas.map((a, i) => `<sheet name="${xmlEsc(nomeAbaSeguro(a.nome, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
        ["xl/_rels/workbook.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${abas.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`],
        ["xl/styles.xml", ESTILOS_XLSX],
        ...abas.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, xmlPlanilha(a.linhas)])
    ];
    const arquivos = textos.map(([nome, conteudo]) => ({ nome, dados: enc.encode(cab + conteudo) }));
    return criarZip(arquivos, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function baixarArquivo(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
}

function gerarPlanilha(abas, nomeArquivo, btn, titulo) {
    if (btn) btn.classList.add("carregando");
    try {
        const blob = criarXlsx(abas);
        baixarArquivo(blob, `${nomeArquivo}.xlsx`);
        registrar("sistema", "Exportação Excel", titulo || nomeArquivo, "-", `${nomeArquivo}.xlsx`);
        mostrarAviso("Planilha gerada com sucesso.");
    } catch (e) {
        mostrarAviso("Não foi possível gerar a planilha.");
    } finally {
        if (btn) setTimeout(() => btn.classList.remove("carregando"), 400);
    }
}

/* PDF: usa um quadro (iframe) invisível, sem abrir janela/pop-up,
   para o navegador não bloquear nem mostrar aviso de pop-up. */
function imprimirComoPdf(titulo, subtitulo, htmlConteudo) {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${escapar(titulo)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #2c2e33; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p.sub { font-size: 12px; color: #6e7076; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #2c2e33; color: #ffffff; text-align: left; padding: 6px 8px; }
  td { border-bottom: 1px solid #d9d5cb; padding: 6px 8px; vertical-align: top; }
  tr { page-break-inside: avoid; }
  .badge { font-weight: bold; }
  @page { margin: 14mm; }
</style></head><body>
<h1>${escapar(titulo)}</h1>
<p class="sub">${escapar(subtitulo)} · Gerado em ${escapar(formatarDataHora(Date.now()))}</p>
${htmlConteudo}
</body></html>`);
    doc.close();

    registrar("sistema", "Exportação PDF", titulo, "-", subtitulo);

    const limpar = () => setTimeout(() => iframe.remove(), 1500);
    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.onafterprint = limpar;
            iframe.contentWindow.print();
        } catch (e) {
            mostrarAviso("Não foi possível gerar o PDF.");
            limpar();
        }
    }, 300);
}