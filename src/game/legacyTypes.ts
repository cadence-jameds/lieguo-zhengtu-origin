export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const SCHEMA = 6;
export const CONTENT = 'river-valley-0.27.0';
export const resources = ['food', 'wood', 'stone', 'gold'] as const;
export type Resource = typeof resources[number];
export type Stock = Record<Resource, number>;
export const unitIds = ['militia', 'spear', 'archer', 'cavalry', 'siege', 'scout', 'signature'] as const;
export type Unit = typeof unitIds[number];
export type Troops = Record<Unit, number>;
export const buildingIds = ['hall', 'farm', 'lumber', 'quarry', 'mine', 'house', 'warehouse', 'barracks', 'range', 'stable', 'workshop', 'academy', 'market', 'wall', 'cellar', 'castle'] as const;
export type Building = typeof buildingIds[number];
export type Research = 'feudal' | 'castle' | 'logistics' | 'steel' | 'agriculture' | 'carpentry' | 'forging' | 'irrigation';
export type Point = { x: number; y: number };
export type Policy = 'balanced' | 'food' | 'industry' | 'military' | 'research';
export type Plot = { id: number; kind: 'center' | 'resource' | 'urban' | 'wall'; building: Building | null; level?: number };
export type Governor = { enabled: boolean; budget: number; reserve: number; spent: Stock; period: number; blocked: string; autoNew: boolean };
export type Job = { started?: number; id: number; item: string; quantity: number; at: number; owner: string; plot?: number; action?: 'build' | 'demolish' };
export type GovernorDefaults = Pick<Governor, "enabled"|"budget"|"reserve"> & {policy:Policy};
export type TradeRoute = {id:number;owner:string;from:string;to:string;mode:"once"|"route"|"refill";amount:Stock;reserve:Stock;target:Stock;enabled:boolean;status:string};
export type RankingRow = {id:string;cities:number;population:number;power:number;members:number};
export type Node = Point & {
  policyOverride?:boolean;
  id: string; name: string; customName?: boolean; kind: 'capital' | 'village' | 'camp' | 'iron' | 'horses' | 'ruins';
  retiring?:boolean; npcResource?: Resource; npcLevel?: number; respawnAt?: number; generation?: number;
  owner: string | null; stock: Stock; population: number; integration: number; stability: number;
  buildings: Record<Building, number>; troops: Troops; build: Job[]; train: Job[];
  policy: Policy; plots: Plot[]; governor: Governor;
};
export type Intel = { generation?:number; era?:number; scouted?:boolean; stock?:Stock;tech?:string[];stability?:number;supplied?:boolean; realAt?:number; at: number; troops: Troops; wall: number; owner: string | null };
export type Faction = { leagueName?:string; empireName?:string; empireId?:string|null; governorDefaults?:GovernorDefaults; personality?:number; grudges?:Record<string,number>; gratitude?:Record<string,number>; protectionUntil?: number; objectives?: number[]; lastAid?:number; civilization?:string; name?:string; league?:string|null; empire?:'direct'|'vassal'|'federal'|null; id: string; capital: string; era: number; tech: string[]; eraUpgrade?: Job | null; research: Job | null; intel: Record<string, Intel>; vassal: string | null; regent: boolean; intent: string; exile: { at: number; refuge: string; population: number; troops: Troops; stock: Stock } | null };
export type Mission = 'scout' | 'raid' | 'occupy' | 'reinforce' | 'transport' | 'settle';
export type March = { transportLoad?:number; tradeRoute?:number; stationed?:boolean; supplyCity?: string; targetGeneration?: number; id: number; owner: string; from: string; to: string; kind: Mission; troops: Troops; cargo: Stock; started: number; at: number; status: 'outbound' | 'returning' | 'battle'; path: Point[]; retreatAt?: number; redirect?: { to: string; at: number }; supply: number; settlers?: number };
export type Battle = { id: number; march: number; target: string; round: number; at: number; started?:number };
export type BattleParty = {lord:string;league?:string;leagueColor?:string;empire?:string;empireColor?:string};
export type Report = { scoutIntel?:Intel; important?:boolean;groupHour?:number;realAt?:number;entries?:{text:string;count:number;city?:string;at?:number;realAt?:number;category?:'city'|'trade'}[]; battleSides?:{attacker:BattleParty;defender:BattleParty}; art?:string; read?: boolean; id: number; at: number; owner: string; title: string; text: string; node?: string; location?: Point; kind: 'system' | 'scout' | 'battle' | 'economy' | 'diplomacy'; before?: Troops; after?: Troops; enemyBefore?: Troops; enemyAfter?: Troops; loot?: Stock };
export type BattleStatistics = Record<string,{wins:number;losses:number;casualties:number;conquests:number}>;
export type Event = { id: number; at: number; type: 'pulse' | 'ai' | 'build' | 'train' | 'research' | 'arrive' | 'round' | 'retreat' | 'redirect'; ref: string | number };
export type Game = {
  offlineLimit?:number; offlineSince?:number; defeat?:{at:number;city?:string;winner:string|null;ended:boolean}; restorations?:number; routes?:TradeRoute[]; favoriteTiles?:Point[]; leaderboard?:{at:number;lords:RankingRow[];leagues:RankingRow[];empires:RankingRow[]};
  terrainVersion?:number; mountainRevision?:number; mountainClearings?:Point[]; wildVersion?:number; balanceVersion?: number;
  schema: 6; campaign: string; acceptedCommands: string[]; content: string; seed: number; player: string; speed: number; time: number; savedAt: number; revision: number; next: number; rng: number;
  nodes: Node[]; factions: Faction[]; events: Event[]; marches: March[]; battles: Battle[]; reports: Report[];
  reportUnread?:number;reportAlerts?:number;battleStatistics?:BattleStatistics;
  protectionUntil: number; treaties: { a: string; b: string; kind: 'war' | 'truce' | 'alliance'; until: number }[];
  log: { at: number; type: string; owner: string }[]; hegemony: { owner: string; since: number } | null;
  result: { kind: 'conquest' | 'hegemony' | 'defeat'; winner: string | null; text: string } | null; sandbox: boolean;
};
export type Command =
  | { type:'tile_favorite'; action:'add'|'remove'; at:Point }
  | { type:'rename_organization'; organization:'empire'|'league'; name:string }
  | { type: 'rename'; name: string }
  | { type: 'rename_city'; city:string; name:string }
  | { type: 'reports'; action: 'read' | 'clear'; ids: number[] }
  | { type: 'settle_at'; from: string; at: Point; troops?: Troops; name?:string }
  | { type: 'build'; city: string; building: Building; plot?: number }
  | { type: 'cancel_build'; city: string; job: number }
  | { type: 'demolish'; city: string; plot: number }
  | { type: 'governor'; cities: string[]; enabled: boolean; policy: Policy; budget: number; reserve: number; autoNew?: boolean }
  | { type: 'league'; action:'create'|'join'|'leave'|'disband'|'invite'|'aid'; target?:string; name?:string }
  | { type: 'empire'; mode:'direct'|'vassal'|'federal'; name?:string }
  | { type: 'empire'; action:'join'; target:string }
  | { type: 'empire'; action:'leave'|'dissolve' }
  | { type: 'restore_realm'; at?:Point }
  | { type:'end_realm' }
  | {type:'governor_default'; settings:GovernorDefaults}
  | {type:'governor_inherit'; cities:string[]}
  | {type:'trade_route'; id?:number; route:Omit<TradeRoute,'id'|'owner'|'status'>}
  | {type:'trade_toggle'; id:number; enabled:boolean}
  | { type: 'redirect'; march: number; to: string }
  | { type: 'train'; city: string; unit: Unit; count: number }
  | { type: 'research'; city: string; research: Research }
  | { type: 'march'; from: string; to: string; kind: Mission; troops: Troops; cargo?: Stock }
  | { type: 'retreat'; march: number }
  | { type: 'diplomacy'; target: string; action: 'war' | 'truce' | 'vassal' | 'alliance' }
  | { type: 'policy'; city: string; policy: Node['policy'] }
  | { type: 'regent'; enabled: boolean }
  | { type: 'continue' };
export const emptyStock = (): Stock => ({ food: 0, wood: 0, stone: 0, gold: 0 });
export const emptyTroops = (): Troops => ({ militia: 0, spear: 0, archer: 0, cavalry: 0, siege: 0, scout: 0, signature: 0 });
export const countTroops = (t: Troops) => unitIds.reduce((n, u) => n + t[u], 0);

export type CommandEnvelope={commandId:string;campaignId:string;issuerId:string;issuedWorldTime:number;expectedRevision:number;payload:Command};
