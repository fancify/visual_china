export const qinlingRoutes = [
  {
    id: "chencang-road",
    name: "陈仓道",
    label: "陈仓道",
    description: "从关中西侧折入秦岭，绕开主脊正面压力的西线通道。",
    labelPoint: { x: 17, y: 44 },
    points: [
      { x: 29.45, y: 70.08 },
      { x: 23.89, y: 60.48 },
      { x: 16.36, y: 43.2 },
      { x: -3.27, y: 20.64 },
      { x: 14.07, y: 12.48 },
      { x: 25.53, y: 8.16 }
    ]
  },
  {
    id: "baoxie-road",
    name: "褒斜道",
    label: "褒斜道",
    description: "沿褒斜谷穿越秦岭，是关中与汉中之间最直观的谷道意象。",
    labelPoint: { x: 43, y: 39 },
    points: [
      { x: 58, y: 70 },
      { x: 48, y: 56 },
      { x: 40, y: 42 },
      { x: 34, y: 28 },
      { x: 30, y: 17 },
      { x: 26, y: 8 }
    ]
  },
  {
    id: "tangluo-road",
    name: "傥骆道",
    label: "傥骆道",
    description: "从关中东南侧入山，路线更陡更碎，体现山地机动的代价。",
    labelPoint: { x: 58, y: 36 },
    points: [
      { x: 76, y: 68 },
      { x: 66, y: 52 },
      { x: 56, y: 36 },
      { x: 46, y: 22 },
      { x: 36, y: 12 },
      { x: 26, y: 8 }
    ]
  },
  {
    id: "ziwu-road",
    name: "子午道",
    label: "子午道",
    description: "从长安方向南入秦岭，直线诱人，但山地风险和补给压力更高。",
    labelPoint: { x: 66, y: 36 },
    points: [
      { x: 88, y: 69 },
      { x: 78, y: 53 },
      { x: 66, y: 38 },
      { x: 54, y: 24 },
      { x: 40, y: 13 },
      { x: 26, y: 8 }
    ]
  },
  {
    id: "jianmen-shu-road",
    name: "剑门蜀道",
    label: "剑门蜀道",
    description: "从汉中南下，经广元、剑门关进入蜀地，是第二次山地收束的关键通道。",
    labelPoint: { x: -18, y: -31 },
    points: [
      { x: 25.53, y: 8.16 },
      { x: -13.42, y: -22.08 },
      { x: -23.24, y: -33.6 },
      { x: -8.18, y: -64.32 },
      { x: -71.35, y: -107.04 }
    ]
  }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function distancePointToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq,
    0,
    1
  );
  const projectedX = start.x + dx * t;
  const projectedY = start.y + dy * t;

  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function routeDistance(point, route) {
  let best = Number.POSITIVE_INFINITY;

  for (let index = 0; index < route.points.length - 1; index += 1) {
    best = Math.min(
      best,
      distancePointToSegment(point, route.points[index], route.points[index + 1])
    );
  }

  return best;
}

export function routeAffinityAt(point, maxDistance = 11) {
  let nearestRoute = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const route of qinlingRoutes) {
    const distance = routeDistance(point, route);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestRoute = route;
    }
  }

  const falloff = smoothstep(nearestDistance, 2, maxDistance);

  return {
    affinity: clamp(1 - falloff, 0, 1),
    distance: nearestDistance,
    nearestRoute
  };
}
