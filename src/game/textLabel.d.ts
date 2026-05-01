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

export function textSpriteLayout(text: string): TextSpriteLayout;
