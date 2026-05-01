export function textSpriteLayout(text) {
  const fontSize = 34;
  const paddingX = 56;
  const paddingY = 30;
  const estimatedTextWidth = Array.from(text).reduce(
    (width, character) => width + (/[\u4e00-\u9fff]/.test(character) ? fontSize : fontSize * 0.58),
    0
  );
  const canvasWidth = Math.ceil(Math.max(360, estimatedTextWidth + paddingX * 2));
  const canvasHeight = 128;

  return {
    canvasWidth,
    canvasHeight,
    fontSize,
    rect: {
      x: 12,
      y: 14,
      width: canvasWidth - 24,
      height: canvasHeight - 28,
      radius: 24
    },
    text: {
      x: canvasWidth / 2,
      y: canvasHeight / 2
    },
    scale: {
      x: canvasWidth / 34,
      y: canvasHeight / 34
    }
  };
}
