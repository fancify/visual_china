// POI 名签布局——画在 CanvasTexture 上，再以 Sprite 贴到世界。
//
// 设计目标：
// - 紧凑：旧版 360px 最小宽度，"西安" 两个字两边大量留白；新版宽度跟文本走，
//   "西安" 大概 100px、"都江堰水利工程" 大概 250px。
// - 美观：游戏风的小药丸 pill —— 半透明深底 + 细金边描边 + 文本落在中央。
//   依靠 stroke + drop-shadow 让文字在亮地形上仍可读，不再用厚重圆角背板。
// - 世界单位偏小：scale 用 canvasWidth / 38（旧版 /34）让 sprite 在 3D 里
//   占面积更小，远距离也不会糊到一片。

export interface TextSpriteLayout {
  canvasWidth: number;
  canvasHeight: number;
  fontSize: number;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  };
  text: {
    x: number;
    y: number;
  };
  scale: {
    x: number;
    y: number;
  };
}

export function textSpriteLayout(text: string): TextSpriteLayout {
  // 中文按字号宽度，西文按字号 0.55 宽度估算（西文比中文窄）。
  const fontSize = 28;
  const paddingX = 22;
  const paddingY = 12;
  const estimatedTextWidth = Array.from(text).reduce(
    (width, character) =>
      width + (/[一-鿿]/.test(character) ? fontSize : fontSize * 0.55),
    0
  );
  // 给 canvas 留 4px 安全边方便 stroke 落笔不被裁。最小宽度只保 64
  // （大概一个字 + 双侧 padding），再没有像旧版那样硬撑 360。
  const canvasWidth = Math.ceil(
    Math.max(64, estimatedTextWidth + paddingX * 2 + 8)
  );
  const canvasHeight = Math.ceil(fontSize + paddingY * 2 + 8);
  const rectInset = 4;

  return {
    canvasWidth,
    canvasHeight,
    fontSize,
    rect: {
      x: rectInset,
      y: rectInset,
      width: canvasWidth - rectInset * 2,
      height: canvasHeight - rectInset * 2,
      radius: Math.round(canvasHeight / 2 - rectInset)
    },
    text: {
      x: canvasWidth / 2,
      y: canvasHeight / 2
    },
    scale: {
      // /38 让世界尺寸缩约 11%，加上 canvas 自己变窄，整体比旧版小约 60%。
      x: canvasWidth / 38,
      y: canvasHeight / 38
    }
  };
}
