import { qinlingRouteAnchors } from "./data/qinlingRouteAnchors.js";

const historicalRouteSource = Object.freeze({
  name: "historical-anchor-points",
  verification: "historical-references"
});

function isHistoricalRouteVisible(route) {
  return (
    route.source?.verification === "external-vector" ||
    route.source?.verification === "verified" ||
    route.source?.verification === "historical-references"
  );
}

export const qinlingRoutes = [
  {
    id: "chencang-road",
    name: "陈仓道",
    source: historicalRouteSource,
    label: "陈仓道",
    description: "从宝鸡、凤县沿嘉陵江上游南下，是绕开秦岭正面的西线主干。",
    labelPoint: qinlingRouteAnchors["chencang-road"].labelPoint,
    points: qinlingRouteAnchors["chencang-road"].points
  },
  {
    id: "baoxie-road",
    name: "褒斜道",
    source: historicalRouteSource,
    label: "褒斜道",
    description: "从斜谷北口绕太白西侧入褒水，是关中直抵汉中的经典谷道。",
    labelPoint: qinlingRouteAnchors["baoxie-road"].labelPoint,
    points: qinlingRouteAnchors["baoxie-road"].points
  },
  {
    id: "tangluo-road",
    name: "傥骆道",
    source: historicalRouteSource,
    label: "傥骆道",
    description: "由周至骆谷越黑河源、十八盘南下洋县，路陡而碎，机动性强但代价高。",
    labelPoint: qinlingRouteAnchors["tangluo-road"].labelPoint,
    points: qinlingRouteAnchors["tangluo-road"].points
  },
  {
    id: "ziwu-road",
    name: "子午道",
    source: historicalRouteSource,
    label: "子午道",
    description: "从长安子午谷南入秦岭，直线最短但补给最艰，三国时多次成为奇袭通道。",
    labelPoint: qinlingRouteAnchors["ziwu-road"].labelPoint,
    points: qinlingRouteAnchors["ziwu-road"].points
  },
  {
    id: "jinniu-road",
    name: "金牛道",
    source: historicalRouteSource,
    label: "金牛道",
    description: "自汉中经宁强、昭化、剑门关入成都，是连接汉中与蜀地腹心的主干蜀道。",
    labelPoint: qinlingRouteAnchors["jinniu-road"].labelPoint,
    points: qinlingRouteAnchors["jinniu-road"].points
  },
  {
    id: "micang-road",
    name: "米仓道",
    source: historicalRouteSource,
    label: "米仓道",
    description: "由汉中南下穿米仓山抵南江、巴中，是越大巴山进入川东北的要道。",
    labelPoint: qinlingRouteAnchors["micang-road"].labelPoint,
    points: qinlingRouteAnchors["micang-road"].points
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
  const options =
    typeof maxDistance === "object"
      ? maxDistance
      : arguments[2] ?? {};
  const searchDistance = typeof maxDistance === "number" ? maxDistance : 11;
  const routes = options.includeUnverifiedRoutes
    ? qinlingRoutes
    : qinlingRoutes.filter((route) => isHistoricalRouteVisible(route));
  let nearestRoute = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const route of routes) {
    const distance = routeDistance(point, route);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestRoute = route;
    }
  }

  const falloff = smoothstep(nearestDistance, 2, searchDistance);

  return {
    affinity: nearestRoute ? clamp(1 - falloff, 0, 1) : 0,
    distance: nearestDistance,
    nearestRoute
  };
}
