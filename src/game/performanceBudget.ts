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

// 2026-05 Phase 2 全中国扩张：chunk 网格从 9×14 (126) 涨到 ~63×44 (2772)。
// 不能再用 radius=4 覆盖全部 (那等于一次性渲染 81 chunks ≈ 200K cells，
// 全国规模下要把 radius 收紧并依赖 streaming 加载 / 卸载附近 chunks)。
//
// 新 budget 解释：
// - 每 chunk 物理 ≈ 90×90 km（50 cells × 1.8 km）
// - visibleChunkRadius=5 → 11×11=121 chunks 同时 visible（≈ 1000 km
//   diameter），覆盖普通骑乘 + 步行视野，且为筋斗云高空留余裕
// - retainedChunkRadius=7 → 15×15=225 chunks 在内存（buffer，避免快移动
//   时频繁加载 / 释放）
// - maxLoadedTerrainChunks=200 → 内存上限（每 chunk JSON ~80 KB，总
//   ≈ 16 MB JSON，加 mesh ≈ 80 MB，可接受）
//
// 旧 (slice) 注释：用户反馈"镜头转一下树跟城就消失"。slice 总共才 126
// chunks，radius=4 覆盖大部分。全国扩张后已不能这样做。
export const qinlingRuntimeBudget: RuntimePerformanceBudget = {
  streaming: {
    visibleChunkRadius: 5,
    retainedChunkRadius: 7,
    maxLoadedTerrainChunks: 200
  },
  scenery: {
    maxTreesPerChunk: 46
  }
};
