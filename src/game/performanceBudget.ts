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

// 2026-05 Phase 2 全中国扩张：chunk 网格 ~63×44 (2772)。每 chunk ≈ 90×90 km
// (50×50 cells × 1.8 km)。
//
// 用户报告 1.6× 垂直夸张 + 121 visible chunks 后帧率掉到很卡。把 radius 收紧：
// - visibleChunkRadius=3 → 7×7=49 chunks 同时渲染（≈ 630 km diameter）
//   步行 / 骑马视野完全够；筋斗云高空再单独考虑动态扩展
// - retainedChunkRadius=5 → 11×11=121 chunks 在内存（buffer 防快移动 pop-in）
// - maxLoadedTerrainChunks=140 → 内存上限（每 chunk JSON ~80 KB ≈ 11 MB，
//   加 mesh + scenery ≈ 60 MB，可接受）
//
// 总三角形：49 × 50 × 50 × 2 = 245K triangles。比 121 chunks 时 605K 少 60%。
export const qinlingRuntimeBudget: RuntimePerformanceBudget = {
  streaming: {
    visibleChunkRadius: 3,
    retainedChunkRadius: 5,
    maxLoadedTerrainChunks: 140
  },
  scenery: {
    maxTreesPerChunk: 46
  }
};
