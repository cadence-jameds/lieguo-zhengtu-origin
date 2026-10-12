export type MapNodeKind = "capital" | "settlement" | "resource";

export interface MapNode {
  id: string;
  name: string;
  kind: MapNodeKind;
  civilizationId?: string;
  column: number;
  row: number;
  note: string;
}

export const mapNodes: MapNode[] = [
  {
    id: "settlement_capital",
    name: "京師",
    kind: "capital",
    civilizationId: "civ_zhongguo",
    column: 5,
    row: 14,
    note: "玩家起始核心城市，人口 300。"
  },
  {
    id: "capital_byzantion",
    name: "君士坦丁堡",
    kind: "capital",
    civilizationId: "civ_byzantion",
    column: 19,
    row: 15,
    note: "城防與海陸交通樞紐。"
  },
  {
    id: "capital_frankia",
    name: "法蘭克王城",
    kind: "capital",
    civilizationId: "civ_frankia",
    column: 13,
    row: 5,
    note: "農業腹地與騎士集結中心。"
  },
  {
    id: "capital_britannia",
    name: "倫敦",
    kind: "capital",
    civilizationId: "civ_britannia",
    column: 7,
    row: 2,
    note: "遠程兵力與情報網核心。"
  },
  {
    id: "capital_japan",
    name: "京都",
    kind: "capital",
    civilizationId: "civ_japan",
    column: 25,
    row: 8,
    note: "紀律嚴整的島岸政權。"
  },
  {
    id: "capital_mongol",
    name: "哈拉和林",
    kind: "capital",
    civilizationId: "civ_mongol",
    column: 20,
    row: 3,
    note: "草原機動軍隊的集結中心。"
  },
  {
    id: "village_riverford",
    name: "河渡村",
    kind: "settlement",
    column: 9,
    row: 14,
    note: "控制河橋的小型中立聚落。"
  },
  {
    id: "village_hillwatch",
    name: "丘望鎮",
    kind: "settlement",
    column: 15,
    row: 17,
    note: "俯瞰南方道路的中立城鎮。"
  },
  {
    id: "resource_ironwood",
    name: "鐵杉谷",
    kind: "resource",
    column: 11,
    row: 10,
    note: "已知可能存在木材與鐵礦。"
  },
  {
    id: "resource_horseplain",
    name: "風馬原",
    kind: "resource",
    column: 16,
    row: 11,
    note: "適合取得戰馬的開闊草原。"
  }
];
