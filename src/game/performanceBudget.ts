export interface StreamingBudget {
  visibleChunkRadius: number;
  retainedChunkRadius: number;
  maxLoadedTerrainChunks: number;
}

export interface RuntimePerformanceBudget {
  streaming: StreamingBudget;
  scenery: {
    maxTreesPerChunk: number;
  };
}

export const qinlingRuntimeBudget: RuntimePerformanceBudget = {
  streaming: {
    visibleChunkRadius: 1,
    retainedChunkRadius: 2,
    maxLoadedTerrainChunks: 25
  },
  scenery: {
    maxTreesPerChunk: 46
  }
};
