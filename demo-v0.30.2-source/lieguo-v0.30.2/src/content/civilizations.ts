import { z } from "zod";

const civilizationSchema = z.object({
  id: z.string().regex(/^civ_[a-z]+$/),
  name: z.string().min(1),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  strategy: z.string().min(1),
  signatureUnit: z.object({
    id: z.string().regex(/^unit_[a-z_]+$/),
    name: z.string().min(1),
    battlefieldRole: z.string().min(1)
  })
});

export type Civilization = z.infer<typeof civilizationSchema>;

const civilizationData = [
  {
    id: "civ_zhongguo",
    name: "中國",
    accent: "#c8513b",
    strategy: "行政、人口與生產網路",
    signatureUnit: {
      id: "unit_repeating_crossbow_guard",
      name: "連弩衛隊",
      battlefieldRole: "短至中程密集射擊"
    }
  },
  {
    id: "civ_byzantion",
    name: "拜占庭",
    accent: "#8e6bb8",
    strategy: "城防、補給與持久戰",
    signatureUnit: {
      id: "unit_eastern_cataphract",
      name: "東羅馬甲胄騎兵",
      battlefieldRole: "重騎衝擊與追擊"
    }
  },
  {
    id: "civ_frankia",
    name: "法蘭克",
    accent: "#3f6ea8",
    strategy: "農業、騎士與攻勢節奏",
    signatureUnit: {
      id: "unit_frankish_axe_guard",
      name: "法蘭克擲斧衛隊",
      battlefieldRole: "中距離重步兵"
    }
  },
  {
    id: "civ_britannia",
    name: "不列顛",
    accent: "#487d62",
    strategy: "情報、遠射與陣地控制",
    signatureUnit: {
      id: "unit_britannic_longbow_guard",
      name: "不列顛長弓衛隊",
      battlefieldRole: "超遠程陣地壓制"
    }
  },
  {
    id: "civ_japan",
    name: "日本",
    accent: "#d18b35",
    strategy: "紀律、步兵與快速整備",
    signatureUnit: {
      id: "unit_samurai_retinue",
      name: "武士侍從隊",
      battlefieldRole: "高凝聚近戰決勝"
    }
  },
  {
    id: "civ_mongol",
    name: "蒙古",
    accent: "#8b6843",
    strategy: "偵察、機動與草原補給",
    signatureUnit: {
      id: "unit_mongol_guard_archer",
      name: "蒙古親衛騎射隊",
      battlefieldRole: "移動射擊與襲擾"
    }
  }
] as const;

export const civilizations = z
  .array(civilizationSchema)
  .length(6)
  .parse(civilizationData);

export const cultureId=(id:string|null|undefined)=>(id??'').split('~')[0];
class CivilizationMap extends Map<string,typeof civilizations[number]>{override get(id:string){return super.get(cultureId(id));}}
export const civilizationById = new CivilizationMap(
  civilizations.map((civilization) => [civilization.id, civilization])
);
