# Padrão de idioma — Português (PT-BR)

Estas regras valem para **todas as sessões** neste repositório.

## Comunicação
- Responda **sempre em português do Brasil**, desde a primeira mensagem da sessão — mesmo que o prompt, o código ou a saída de ferramentas esteja em inglês.
- Toda pergunta, confirmação ou pedido de esclarecimento ao usuário deve ser feito **em português**.
- Ao usar `AskUserQuestion`: pergunta, opções, descrições e `header` em português. O `header` deve ter no máximo 12 caracteres (ex.: "Abordagem", "Deploy", "Escopo").
- Resumos, planos, relatórios e mensagens de status também em português.

## Código e artefatos
- Mensagens de commit, descrições de PR, documentação (README, PRDs, runbooks) e comentários novos: em português, salvo se o projeto já adotar outro idioma de forma consistente.
- Nomes de identificadores (variáveis, funções, arquivos) seguem a convenção já existente no código.
- Termos técnicos consagrados (ex.: deploy, commit, pull request, hook, painel, dashboard) podem ficar em inglês.

## Exceções
- Só mude de idioma se o usuário pedir explicitamente.

## Regras deste projeto

- **O JSON é gerado.** Nunca edite `operacoes-infraestrutura.json` nem o dashboard pela UI do Grafana; mude `src/` ou `gerar-dashboard.py` e rode `scripts/publicar.sh`.
- **Antes de publicar:** `node tests/harness.js operacoes-infraestrutura.json tests/fixtures/frames.json` (o `publicar.sh` já roda). Depois de publicar, valide com `scripts/testar-navegador.py` e olhe os prints.
- **Credenciais:** a senha de admin do Grafana nunca sai da VM 100 (o import roda com `docker exec` usando as variáveis do container). Tokens do Zabbix ficam em `~/.config/zabbix-mcp/` (fora do repo). Não grave credencial em arquivo versionado.
- **Mudanças na VM 100** (compose, plugins, restart do Grafana): a skill `infrastructure-devops` do repo `zabbix-mcp` é obrigatória: diagnóstico → backup (`./scripts/backup.sh`) → mudança → validação → documentação.
- **Grupo novo no Zabbix** que deva aparecer no painel: dar leitura ao grupo de usuários "Grafana Read-Only" (`grafana-ro`) e reiniciar o Grafana (o plugin cacheia grupos e hosts).
- **Topologia** (hosts, nós, coordenadas no mapa) fica em `gerar-dashboard.py` (`HOSTS`, `montar_nos`, `INTERFACES`) e no início de `src/mapa.js` (`DEV`, `GRUPOS`, `ENL`).
