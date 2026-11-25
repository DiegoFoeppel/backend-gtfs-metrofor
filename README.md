Projeto gtfs metrofor. Criar API com os dados das linhas de metrô do Ceará.

[] Linhas, estações e horários planejados
[] Mapa do trajeto das linhas
[] Calcular tempo estimado de viagem
[] Buscar a estação mais próxima

<!-- [] Planejar rotas com baldeações -->

1 - pesquisar linhas, estações e lista de horários
2 - mapa do trajeto e das estações é de boa
3 - aqui dá uma quebrada maior
4 - da pra calcular distancia entre a loc e as estações, ou stops

## Scripts de dados

```bash
# 1. junta os feeds baixados em data/gtfs_<feed>/ (metrofor, etufor, arce)
npx tsx src/scripts/merge-feeds.ts          # gera data/gtfs_merged/

# 2. importa os .txt para o Postgres (use --dry-run para só simular)
npm run import:gtfs -- --dir data/gtfs_merged [--schema gtfs_metrofor] [--dry-run]

# 3. gera o SQLite que o app mobile embarca
npm run export:sqlite -- --out ../metrofor-gtfs/assets/metrofor.db
```

O import substitui stops, trips, stop_times e calendar, e faz upsert das routes
mantendo o `city_id` (o GTFS não traz cidade). Tudo roda em uma transação.

## Testes

```bash
npm test          # unitários (banco mockado)
npm run test:db   # integração contra o Postgres real do .env
```
