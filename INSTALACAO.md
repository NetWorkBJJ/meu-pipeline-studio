# WorkFlowAA - Guia de Instalacao

## Requisitos

- **Windows 10 ou superior** (64-bit)
- **CapCut Desktop** instalado (baixe em https://www.capcut.com/)
- Abra o CapCut pelo menos uma vez antes de usar o WorkFlowAA (para criar o diretorio de projetos)

## Instalacao

1. Execute o arquivo `workflowaa-X.X.X-setup.exe`
2. O instalador nao requer permissao de administrador
3. Apos a instalacao, um atalho sera criado na area de trabalho

## Windows SmartScreen

Na primeira execucao, o Windows pode exibir o aviso **"O Windows protegeu o seu PC"**:

1. Clique em **"Mais informacoes"** (link abaixo do texto de aviso)
2. Clique em **"Executar assim mesmo"**
3. Isso so acontece uma vez por versao

> Isso ocorre porque o instalador nao possui certificado de assinatura digital (code signing). O app e seguro.

## Antivirus

Alguns antivirus podem bloquear o executavel na primeira execucao. Se isso acontecer:

1. Adicione o diretorio de instalacao como excecao no seu antivirus
2. O diretorio padrao e: `C:\Users\<seu-usuario>\AppData\Local\Programs\workflowaa\`

## Verificacao do Sistema

Ao abrir o app pela primeira vez, um modal de verificacao vai aparecer mostrando:

- **Python bridge**: Motor interno do app (embutido, nao precisa instalar Python)
- **CapCut Desktop**: Se o CapCut esta instalado na maquina
- **Projetos CapCut**: Se o diretorio de projetos existe

Se algum item estiver vermelho, siga a orientacao exibida.

## Onde o App Salva Dados

- Configuracoes e workspaces: `%APPDATA%\workflowaa\`
- Logs: `%APPDATA%\workflowaa\logs\`
- Downloads Veo3: `%USERPROFILE%\Downloads\WorkFlowAA\midias\` (configuravel)

## Problemas Conhecidos

- Se o app ficar travado na tela inicial, verifique os logs em `%APPDATA%\workflowaa\logs\`
- Se o CapCut nao abrir pelo app, verifique se esta instalado em `%LOCALAPPDATA%\CapCut\`

## Atualizacao

Para atualizar, basta instalar a nova versao por cima. Seus dados e configuracoes serao preservados.
