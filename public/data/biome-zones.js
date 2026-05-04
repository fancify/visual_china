export const BIOME_ZONE_DATA = Object.freeze({
  qinlingSlice: {
    west: 103.5,
    east: 110.0,
    south: 30.4,
    north: 35.4
  },
  phase1: {
    southToNorth: { start: 33.0, end: 34.5 },
    northToSemiarid: { start: 34.9, end: 35.75 }
  },
  presets: {
    "subtropical-humid": {
      hueShift: 0.028,
      satScale: 1.16,
      lumScale: 0.96,
      vegetationDensity: 1.3,
      treeHue: 0.31
    },
    "tropical-humid": {
      hueShift: 0.045,
      satScale: 1.25,
      lumScale: 0.95,
      vegetationDensity: 1.45,
      treeHue: 0.34
    },
    "warm-temperate-humid": {
      hueShift: -0.012,
      satScale: 0.92,
      lumScale: 1.02,
      vegetationDensity: 0.85,
      treeHue: 0.24
    },
    "warm-temperate-semiarid": {
      hueShift: -0.045,
      satScale: 0.76,
      lumScale: 1.08,
      vegetationDensity: 0.45,
      treeHue: 0.18
    },
    "northeast-cold-humid": {
      hueShift: 0.012,
      satScale: 1.05,
      lumScale: 0.85,
      vegetationDensity: 1.05,
      treeHue: 0.29
    },
    "temperate-grassland": {
      hueShift: -0.03,
      satScale: 0.7,
      lumScale: 1.1,
      vegetationDensity: 0.7,
      treeHue: 0.2
    },
    "arid-desert": {
      hueShift: -0.06,
      satScale: 0.5,
      lumScale: 1.2,
      vegetationDensity: 0.18,
      treeHue: 0.12
    },
    "alpine-meadow": {
      hueShift: -0.01,
      satScale: 0.65,
      lumScale: 1.15,
      vegetationDensity: 0.4,
      treeHue: 0.17
    }
  },
  nationwideZones: [
    {
      biomeId: "tropical-humid",
      regions: [
        { name: "hainan-leizhou", west: 108.4, east: 111.4, south: 18.0, north: 21.4, feather: 1.2 },
        { name: "xishuangbanna", west: 99.1, east: 101.9, south: 21.0, north: 22.3, feather: 0.8 }
      ]
    },
    {
      biomeId: "subtropical-humid",
      regions: [
        { name: "jiangnan-south-china", west: 103.0, east: 122.8, south: 22.0, north: 32.8, feather: 1.6 },
        { name: "sichuan-basin", west: 101.8, east: 109.6, south: 27.0, north: 33.5, feather: 1.8 },
        { name: "yunnan-guizhou", west: 98.8, east: 108.8, south: 23.0, north: 29.4, feather: 1.6 }
      ]
    },
    {
      biomeId: "warm-temperate-humid",
      regions: [
        { name: "north-china-plain", west: 103.0, east: 123.8, south: 34.0, north: 40.3, feather: 1.6 },
        { name: "liaodong-transition", west: 118.0, east: 135.0, south: 37.0, north: 43.2, feather: 1.8 }
      ]
    },
    {
      biomeId: "northeast-cold-humid",
      regions: [
        { name: "northeast-forest", west: 118.0, east: 135.0, south: 42.0, north: 53.5, feather: 2.5 }
      ]
    },
    {
      biomeId: "temperate-grassland",
      regions: [
        { name: "inner-mongolia-grassland", west: 100.0, east: 118.0, south: 39.0, north: 45.5, feather: 2.0 }
      ]
    },
    {
      biomeId: "arid-desert",
      regions: [
        { name: "western-desert-belt", west: 73.0, east: 96.0, south: 35.0, north: 47.5, feather: 3.0 },
        { name: "ordos-badain-jaran", west: 104.0, east: 109.6, south: 37.0, north: 39.8, feather: 0.8 }
      ]
    },
    {
      biomeId: "alpine-meadow",
      regions: [
        { name: "qinghai-tibet-plateau", west: 78.0, east: 103.0, south: 28.0, north: 36.0, feather: 1.6 }
      ]
    }
  ]
});

export const SEASONAL_PALETTE = Object.freeze({
  spring: {
    hueShift: 0,
    satScale: 0.95,
    lumScale: 1.1,
    vegDensity: 1.05,
    treeHueShift: 0.005
  },
  summer: {
    hueShift: 0,
    satScale: 1,
    lumScale: 1,
    vegDensity: 1,
    treeHueShift: 0
  },
  autumn: {
    hueShift: -0.1,
    satScale: 1.1,
    lumScale: 1,
    vegDensity: 0.85,
    treeHueShift: -0.08
  },
  winter: {
    hueShift: -0.05,
    satScale: 0.55,
    lumScale: 1.2,
    vegDensity: 0.3,
    treeHueShift: -0.04
  }
});

export default BIOME_ZONE_DATA;
