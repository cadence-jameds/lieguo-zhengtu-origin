// Population counts civilians; queued recruits are deducted immediately.
export const TOWN_POPULATION=400;
export const INITIAL_POPULATION=200;
export const MIN_CIVILIAN_POPULATION=200;
export const DEFAULT_SPEED=1;
export const NEW_GAME_SPEEDS=[1,3,6,10,50] as const;
export const SETTLER_POPULATION=400;
export const SETTLEMENT_MIN_POPULATION=600;
export const RECRUIT_POPULATION_PER_UNIT=1;
export const REPEATABLE_CIVIC=['house','warehouse','cellar','market'] as const;
export const GOVERNOR_GARRISON={balanced:[35,55,80],food:[20,30,45],industry:[20,30,45],military:[60,110,180],research:[20,30,45]} as const;
export const GOVERNOR_FOOD_BUFFER=25;
export const GOVERNOR_TRAIN_BATCH=5;
export const MARKET_GOLD_PER_LEVEL=15;
export const GOVERNOR_THREAT_REINFORCEMENT=50;
export const GOVERNOR_RESERVE_SLOTS=3;

export const GOVERNOR_UNIT_WEIGHTS={military:{militia:.05,spear:.25,archer:.25,cavalry:.2,signature:.2,siege:.05},civilian:{militia:.15,spear:.4,archer:.25,cavalry:.15,signature:.05}} as const;
