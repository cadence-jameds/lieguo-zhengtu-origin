// All rates are per world hour; costs and times below apply to one resource parcel.
export const FIELD_COUNT=18;
export const FIELD_BASE_OUTPUT={food:18,wood:20,stone:15,gold:12};
export const FIELD_LEVEL_FACTORS=[1,1.6,2.6,4.2,6.8,11] as const;
export const FIELD_COSTS={farm:{food:12,wood:32,stone:8,gold:0},lumber:{food:14,wood:24,stone:8,gold:0},quarry:{food:16,wood:28,stone:10,gold:0},mine:{food:18,wood:30,stone:20,gold:0}};
export const FIELD_BUILD_SECONDS=[30,120,360,1080,2700];
export const FIELD_COST_GROWTH=1.7;
export const REPORT_LIMITS={battle:300,diplomacy:100,chronicle:100};
