# B3 — Economy / Population / City / Logistics

Adds 18 Lv0–15 field economics, formula costs, exact center acceleration, economic building catalog, 15 free slots, repeated warehouses/bunkers, warehouse capacities and raid protection interface. All data is native; no retained engine authority.

CityEconomy persists settlement anchors, fractional resource remainder, permanent milestones, slots, construction lanes, independent City administrative research, incoming capacity and stable settlement EventId. Hourly per-city heap events bound pending event count to active cities; commands/events settle only affected entities. UI reads citySnapshot for exact current-time projection. No per-minute full-world economy scan. Piecewise analytic population integration crosses size/housing thresholds and clamps at housing; no civilian grain upkeep. Construction qualification is checked at enqueue only, durations are snapshotted, queued work is serial per lane/target. Second lane is permanent15k.

City promotion: 10k population + 10k housing + townhall5, 12/18/18/12k, fixed6h, independent. D2 requires permanent10k + permanentCity + currenthousing10k at each new high-field enqueue. Existing/queued fields never revalidate.

Integration stores12h/18h work; dynamic current-Faction administration counts completed townhalls (not levels), max15, minimum multiplier. Only field production is×.4. Administrative ownership changes settle old/new networks at boundary before updating indexes.

Ordinary logistics: source market, 2000/caravan, shortest legal grid route (rivers pass, no water/mountain or diagonal corner-cut),60s/distance, actual outbound stock, capacity reservation, arrival deposit and empty return. Returned shipment records are removed while durable CommandId receipts remain. B1 projectShipmentRecord adapter preserves authorization fields; large project eligibility/pool/completion remains B9.

Run test:b3 + test:b2 + test:b1 + recoveryR1 + typecheck + build. Native content/ruleset advance to b3.1, schema2 and world-generator-v1 unchanged. Production/save native bounds are strict and do not repair inputs. Complete UI/artwork, battle, politics, AI and endgame remain in later batches.
