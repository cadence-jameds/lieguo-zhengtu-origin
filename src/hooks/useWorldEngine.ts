import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OfflineSummary,
  PersistenceStatus,
  WorldView
} from "@/simulation/model";
import type {
  MainToWorkerMessage,
  WorkerToMainMessage
} from "@/worker/protocol";

const CAMPAIGN_ID = "m0-main-campaign";
const CAMPAIGN_LOCK = `guozhan-writer:${CAMPAIGN_ID}`;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

interface WorldEngine {
  status: "loading" | "running" | "readonly" | "error";
  view: WorldView | null;
  offlineSummary: OfflineSummary | null;
  persistence: PersistenceStatus | null;
  error: string | null;
  notice: string | null;
  dispatchScout: (targetNodeId: string, targetName: string) => void;
  flush: () => void;
  exportSave: () => void;
  importSave: (file: File) => Promise<void>;
}

function downloadSave(filename: string, serialized: string): void {
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useWorldEngine(): WorldEngine {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<WorldEngine["status"]>("loading");
  const [view, setView] = useState<WorldView | null>(null);
  const [offlineSummary, setOfflineSummary] =
    useState<OfflineSummary | null>(null);
  const [persistence, setPersistence] =
    useState<PersistenceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let releaseWriterLock: (() => void) | null = null;
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel("guozhan-world-owner");

    const startWorker = (): void => {
      if (disposed) {
        return;
      }

      const worker = new Worker(
        new URL("../worker/world.worker.ts", import.meta.url),
        { type: "module", name: "guozhan-world" }
      );
      workerRef.current = worker;

      worker.addEventListener(
        "message",
        (event: MessageEvent<WorkerToMainMessage>) => {
          if (disposed) {
            return;
          }

          const message = event.data;

          if (message.type === "ready") {
            setView(message.view);
            setOfflineSummary(message.offlineSummary);
            setPersistence(message.persistence);
            setStatus("running");
            return;
          }

          if (message.type === "update") {
            setView(message.view);
            return;
          }

          if (message.type === "command_accepted") {
            setNotice(message.message);
            return;
          }

          if (message.type === "command_rejected") {
            setNotice(message.reason);
            return;
          }

          if (message.type === "persistence_updated") {
            setPersistence((current) => ({
              backupCount: message.backupCount,
              recoveredFromBackup: current?.recoveredFromBackup ?? false,
              ...(current?.recoveryRevision === undefined
                ? {}
                : { recoveryRevision: current.recoveryRevision })
            }));
            return;
          }

          if (message.type === "save_exported") {
            downloadSave(message.filename, message.serialized);
            setNotice("存檔已匯出。請將 .realm-save 檔案妥善保存。");
            return;
          }

          if (message.type === "save_imported") {
            setView(message.view);
            setPersistence(message.persistence);
            setOfflineSummary(null);
            setNotice("存檔已驗證並匯入；原進度已建立回復點。");
            return;
          }

          if (message.type === "operation_failed") {
            setNotice(message.message);
            return;
          }

          if (message.type === "error") {
            setError(message.message);
            setStatus("error");
          }
        }
      );

      worker.postMessage({
        type: "initialize",
        campaignId: CAMPAIGN_ID,
        campaignSeed: 0x1a2b3c4d,
        civilizationId: "civ_zhongguo"
      } satisfies MainToWorkerMessage);

      channel?.postMessage({ type: "writer_active", campaignId: CAMPAIGN_ID });
    };

    const acquireWriter = async (): Promise<void> => {
      if (!("locks" in navigator)) {
        if (!disposed) {
          setError(
            "此瀏覽器不支援安全的跨分頁寫入鎖，請改用最新版 Chrome、Edge、Firefox 或 Safari。"
          );
          setStatus("error");
        }
        return;
      }

      await navigator.locks.request(
        CAMPAIGN_LOCK,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (!lock || disposed) {
            if (!disposed) {
              setStatus("readonly");
            }
            return;
          }

          if (navigator.storage?.persist) {
            void navigator.storage.persist().catch(() => false);
          }

          startWorker();
          await new Promise<void>((resolve) => {
            releaseWriterLock = resolve;
            if (disposed) {
              resolve();
            }
          });
        }
      );
    };

    void acquireWriter().catch((reason: unknown) => {
      if (!disposed) {
        setError(
          reason instanceof Error ? reason.message : "無法取得世界寫入權。"
        );
        setStatus("error");
      }
    });

    const handleVisibility = (): void => {
      const worker = workerRef.current;
      if (!worker) {
        return;
      }

      worker.postMessage({
        type: document.visibilityState === "hidden" ? "flush" : "resume"
      } satisfies MainToWorkerMessage);
    };
    const handlePageHide = (): void => {
      workerRef.current?.postMessage({
        type: "flush"
      } satisfies MainToWorkerMessage);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      const worker = workerRef.current;
      if (worker) {
        worker.postMessage({ type: "flush" } satisfies MainToWorkerMessage);
        worker.terminate();
      }
      workerRef.current = null;
      channel?.postMessage({
        type: "writer_released",
        campaignId: CAMPAIGN_ID
      });
      channel?.close();
      releaseWriterLock?.();
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const dispatchScout = useCallback(
    (targetNodeId: string, targetName: string): void => {
      workerRef.current?.postMessage({
        type: "execute_command",
        command: { type: "dispatch_scout", targetNodeId, targetName }
      } satisfies MainToWorkerMessage);
    },
    []
  );

  const flush = useCallback((): void => {
    workerRef.current?.postMessage({ type: "flush" } satisfies MainToWorkerMessage);
  }, []);

  const exportSave = useCallback((): void => {
    workerRef.current?.postMessage({
      type: "export_save"
    } satisfies MainToWorkerMessage);
    setNotice("正在建立可攜式存檔…");
  }, []);

  const importSave = useCallback(async (file: File): Promise<void> => {
    if (file.size > MAX_IMPORT_BYTES) {
      setNotice("匯入檔超過 5 MiB 安全上限，未讀取或覆蓋存檔。");
      return;
    }

    try {
      const serialized = await file.text();
      workerRef.current?.postMessage({
        type: "import_save",
        serialized
      } satisfies MainToWorkerMessage);
      setNotice("正在隔離驗證存檔版本、事件與 checksum…");
    } catch {
      setNotice("無法讀取選取的存檔。");
    }
  }, []);

  return {
    status,
    view,
    offlineSummary,
    persistence,
    error,
    notice,
    dispatchScout,
    flush,
    exportSave,
    importSave
  };
}
