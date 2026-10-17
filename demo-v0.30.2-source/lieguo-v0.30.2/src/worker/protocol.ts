import type {
  OfflineSummary,
  PersistenceStatus,
  WorldCommand,
  WorldView
} from "@/simulation/model";

export type MainToWorkerMessage =
  | {
      type: "initialize";
      campaignId: string;
      campaignSeed: number;
      civilizationId: string;
    }
  | { type: "execute_command"; command: WorldCommand }
  | { type: "resume" }
  | { type: "flush" }
  | { type: "export_save" }
  | { type: "import_save"; serialized: string };

export type WorkerToMainMessage =
  | {
      type: "ready";
      view: WorldView;
      offlineSummary: OfflineSummary | null;
      persistence: PersistenceStatus;
    }
  | { type: "update"; view: WorldView }
  | { type: "command_accepted"; message: string }
  | { type: "command_rejected"; reason: string }
  | { type: "persistence_updated"; backupCount: number }
  | { type: "save_exported"; filename: string; serialized: string }
  | {
      type: "save_imported";
      view: WorldView;
      persistence: PersistenceStatus;
    }
  | {
      type: "operation_failed";
      operation: "export" | "import" | "flush";
      message: string;
    }
  | { type: "flushed" }
  | { type: "error"; message: string };
