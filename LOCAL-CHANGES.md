# Cópia independente de Rodrigo — pi-herdr-status

Base: pacote npm **pi-herdr-status 0.2.1**, de
[dereknex/pi-extensions](https://github.com/dereknex/pi-extensions/tree/main/packages/pi-herdr-status).
O primeiro commit preserva o pacote baixado; o seguinte mostra as alterações.
Esta é uma cópia independente do pacote, não um fork GitHub do monorepo.
Autor e licença MIT originais foram mantidos.

## 0.2.1-rodrigo.1 — 2026-10-02

- A função principal registra somente startup, troca de modelo, troca do nível
  de raciocínio, início do turno e encerramento para atualizar `model_info`.
- Deixa o ciclo de vida (`working`, `blocked`, `idle`) com a integração oficial
  `herdr-agent-state.ts`. Não envolve nem substitui diálogos da UI.
- Metadata usa `--source pi-model`, `--agent pi` e
  `--applies-to-source herdr:pi`, com o ID do pane obrigatório.
- Chamadas CLI permanecem em fila FIFO; agora têm timeout de 2 segundos,
  janela oculta no Windows e limite de saída de 64 KiB.
- Ignora processos filhos e contextos sem UI; limpa metadata no encerramento
  real, preservando-a durante reload.
- `package.json`: versão própria, `private: true`, links desta cópia e teste Node 26.

Os helpers exportados de status e diálogos do upstream permanecem no arquivo por
compatibilidade, mas a função principal desta cópia não os utiliza.

No Herdr 0.9.2-preview instalado, o token personalizado na configuração precisa
ser **`$model_info`**, embora o nome enviado na CLI seja `model_info`.

```powershell
pi install https://github.com/rodrigojager/pi-herdr-status@v0.2.1-rodrigo.1
```

Use apenas uma fonte deste plugin. O perfil e a configuração do Herdr estão no
[Pi Home Kit](https://github.com/rodrigojager/pi-home-kit/tree/main/profiles/2026-10-02-ui).
