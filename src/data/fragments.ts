import { Vector2 } from "three";

export interface FragmentDetails {
  geo: string;
  history: string;
  strategy: string;
}

export interface KnowledgeFragment {
  id: string;
  title: string;
  zone: string;
  position: Vector2;
  pickupLine: string;
  details: FragmentDetails;
}

export const knowledgeFragments: KnowledgeFragment[] = [
  {
    id: "guanzhong-heartland",
    title: "腹地残简",
    zone: "关中平原",
    position: new Vector2(84, -69),
    pickupLine: "你拾得《关中残简》：平原不只适合行走，它也适合组织。 ",
    details: {
      geo: "渭河平原连贯、开阔、坡度温和，是天然适合聚落、道路与农田扩展的空间。",
      history: "关中之所以长期成为政治重心，不只是因为城强，而是因为腹地能稳定供养城与军。",
      strategy: "谁占有这种腹地，谁就更容易维持后勤、集结兵力，并在多个方向上发起行动。"
    }
  },
  {
    id: "north-loess-edge",
    title: "塬上风痕",
    zone: "关中北缘",
    position: new Vector2(-42, -78),
    pickupLine: "你拾得《塬上风痕》：边缘地带往往先看见道路，也先看见威胁。",
    details: {
      geo: "黄土台塬与平原交错的边缘，不像纯平原那样一马平川，却也不会像高山那样完全封闭。",
      history: "这类边缘地带经常同时承担耕作、屯驻与通行的功能，既连接腹地，也暴露在外。",
      strategy: "边缘地形决定预警、机动和集结速度，是腹地的前门厅而不是附属空间。"
    }
  },
  {
    id: "qinling-wall",
    title: "山墙初见",
    zone: "秦岭北麓",
    position: new Vector2(10, -38),
    pickupLine: "你拾得《山墙初见》：秦岭像墙，不因为它最高，而因为它连续。",
    details: {
      geo: "真正改变通行的往往不是单峰高度，而是山脊是否连续、谷道是否稀少。",
      history: "秦岭长期塑造了南北两侧的交通节奏、气候体验与区域联系强度。",
      strategy: "一条连续山系会把原本宽阔的行动面压缩成少数穿越节点，让防守价值陡增。"
    }
  },
  {
    id: "mountain-pass",
    title: "关口回响",
    zone: "秦岭山口",
    position: new Vector2(-32, -16),
    pickupLine: "你拾得《关口回响》：真正重要的地方，常常不是山顶，而是能过山的那条缝。",
    details: {
      geo: "山口会把地形阻隔收束成一个可通行的狭窄切口，因此比周围大片山体更具行动意义。",
      history: "古道、关城和驻防设施往往围绕这些切口生长，因为交通只能在这里被集中管理。",
      strategy: "控制山口就等于控制敌军过岭成本、补给风险与行军节奏。"
    }
  },
  {
    id: "hanzhong-hinge",
    title: "门轴之地",
    zone: "汉中盆地",
    position: new Vector2(26, -8),
    pickupLine: "你拾得《门轴之地》：翻过山以后，并不是终点，而是方向突然变多了。",
    details: {
      geo: "汉中处在多条山间通路的汇接处，是盆地与谷道之间的缓冲平台。",
      history: "它经常被视作关中与巴蜀之间的锁眼，因为南北双方都难以绕开它。",
      strategy: "占住这里，可以决定下一步是北望关中、南下入蜀，还是截断对方转换方向。"
    }
  },
  {
    id: "southern-compression",
    title: "南下折岭",
    zone: "米仓山前",
    position: new Vector2(0, 56),
    pickupLine: "你拾得《南下折岭》：同样是前进，山道会把时间拉长，把错误放大。",
    details: {
      geo: "离开汉中以后，南侧山地再次抬高，行动从盆地展开重新回到谷道压缩。",
      history: "许多看似距离不远的路线，真正的困难在于爬升、转折、补给和视野受限。",
      strategy: "山道会把轻微失误变成大问题，因为部队无法像在平原上一样快速纠偏。"
    }
  },
  {
    id: "sichuan-gate",
    title: "入蜀片羽",
    zone: "入蜀谷口",
    position: new Vector2(12, 84),
    pickupLine: "你拾得《入蜀片羽》：一旦道路再次变窄，争夺就会重新聚焦到少数节点。",
    details: {
      geo: "进入四川盆地前，山势与河谷会再次把路线压进更少的通道中。",
      history: "入蜀道路之所以反复出现在历史叙事里，不只是因为险，而是因为替代路径稀少。",
      strategy: "替代路线越少，防守方就越能用更小的兵力放大地形收益。"
    }
  },
  {
    id: "chengdu-release",
    title: "盆地舒展",
    zone: "成都平原",
    position: new Vector2(-42, 102),
    pickupLine: "你拾得《盆地舒展》：穿过险道后，世界忽然像能被安顿下来。",
    details: {
      geo: "四川盆地内部地势相对舒缓，成都平原尤其适合农耕、水利与稳定聚落。",
      history: "这种被外山环绕、内部丰饶的空间，使巴蜀常常具备较强的自持与恢复能力。",
      strategy: "拥有盆地纵深，就拥有持续经营、休整补给和长期防守的战略资本。"
    }
  }
];
