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

// 2026-05 用户反馈"镜头转一下树跟城就消失"。根因：visibleChunkRadius=1
// 只让 player 自己 chunk + 8 邻 chunk (9/20) mesh.visible=true。其他 11
// chunk 虽然 mesh 加载了，被设 visible=false → 树 (chunks 的子节点) 全部
// 隐藏；只有 global terrain 还显示低 LOD 表面。slice 总共才 20 chunks，
// radius=4 覆盖全部 (max grid distance = 4 in 4×5 grid)。retain 同步。
// maxLoadedTerrainChunks 从 25 → 30 防裁切。
export const qinlingRuntimeBudget: RuntimePerformanceBudget = {
  streaming: {
    visibleChunkRadius: 4,
    retainedChunkRadius: 4,
    maxLoadedTerrainChunks: 30
  },
  scenery: {
    maxTreesPerChunk: 46
  }
};
