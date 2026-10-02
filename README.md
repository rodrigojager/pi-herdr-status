# pi-herdr-status — cópia de Rodrigo

Versão **0.2.1-rodrigo.1**, baseada em [pi-herdr-status 0.2.1](https://github.com/dereknex/pi-extensions/tree/main/packages/pi-herdr-status).

[Alterações detalhadas](LOCAL-CHANGES.md) · [Changelog](CHANGELOG.md) · [Origem verificável](UPSTREAM.json) · [Licença MIT original](LICENSE)

Esta cópia preserva o autor original e mantém um commit inicial com os arquivos do pacote npm baixado. Não publica nada sob o nome do autor no npm.

Esta variante informa somente o modelo e o nível de raciocínio ao Herdr. A integração oficial do Herdr continua responsável pelos estados working/blocked/idle. Não substitui diálogos e não registra um segundo repórter de ciclo de vida.

## Instalação

Depois de terminar o trabalho na sessão atual, escolha uma única fonte do plugin e instale:

```powershell
pi install https://github.com/rodrigojager/pi-herdr-status@v0.2.1-rodrigo.1
```

Mantenha a integração oficial `herdr-agent-state.ts`. No Herdr instalado, o campo de exibição é `$model_info`.

[Perfil de configuração da instalação](https://github.com/rodrigojager/pi-home-kit/tree/main/profiles/2026-10-02-ui).

## Validação

Testes de desenvolvimento usam Node 26.

```powershell
npm install
npm test
```

A versão instalada foi validada também pelo loader do Pi 1.0.0 e pelo executável real em RPC isolado, sem chamadas ao modelo.
