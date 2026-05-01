"use client";

import { useEffect, useState } from "react";

import { getDrainState } from "@/lib/sync/drain";
import {
  loadQueue,
  QUEUE_CHANGE_EVENT,
  type QueueChangeDetail,
  type StoredQueueRow,
} from "@/lib/sync/queue";

type QueueState = {
  drainState: ReturnType<typeof getDrainState>;
  pendingCount: number;
  rows: StoredQueueRow[];
};

function readQueueState(userId: string): QueueState {
  const rows = loadQueue(userId);

  return {
    rows,
    drainState: getDrainState(),
    pendingCount: rows.length,
  };
}

export function useQueueState(userId: string) {
  const [state, setState] = useState<QueueState>(() => readQueueState(userId));

  useEffect(() => {
    setState(readQueueState(userId));

    const handleQueueChange = (event: Event) => {
      const queueChangeEvent = event as CustomEvent<QueueChangeDetail>;

      if (queueChangeEvent.detail?.userId !== userId) {
        return;
      }

      setState(readQueueState(userId));
    };

    window.addEventListener(QUEUE_CHANGE_EVENT, handleQueueChange);

    return () => {
      window.removeEventListener(QUEUE_CHANGE_EVENT, handleQueueChange);
    };
  }, [userId]);

  return state;
}
