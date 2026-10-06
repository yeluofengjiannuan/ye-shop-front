/**
 * 省市区三级联动数据
 *
 * 背景：uni-app 的 <picker mode="region"> 在 H5 端**没有实现** ——
 * 弹层能弹出来，但列数恒为 0，完全没有省市区可选（小程序/App 才支持）。
 * 所以这里改用 mode="multiSelector" 自绘联动，让 H5 和小程序表现一致。
 *
 * 数据来自 china-area-data，结构是「父级 code → { 子级 code: 名称 }」的平铺映射：
 *   '86'     -> 34 个省级
 *   '110000' -> 北京市的市（["110100","市辖区"]）
 *   '110100' -> 市辖区下的区（东城区 / 西城区 …）
 *
 * 注意：港澳只有两级（'810001' 这类"市"下面没有区），见 buildColumns 的处理。
 */
import pc from 'china-area-data'

const PROVINCE_KEY = '86'

/** 把 { code: name } 转成 [{ code, name }] */
function toList(map) {
	return Object.keys(map || {}).map((code) => ({ code, name: map[code] }))
}

export function getProvinces() {
	return toList(pc[PROVINCE_KEY])
}

export function getCities(provinceCode) {
	if (!provinceCode) return []
	return toList(pc[provinceCode])
}

export function getDistricts(cityCode) {
	if (!cityCode) return []
	return toList(pc[cityCode])
}

/**
 * 根据当前已选的省市区名称，算出三列数据和在每列中的下标。
 * 用于初始化（编辑页要回填）以及切换某一列后重建后续列。
 *
 * @param {object} selected { province, city, district } —— 名称字符串
 * @returns {{ columns: string[][], index: number[] }}
 */
export function buildColumns(selected = {}) {
	const provinces = getProvinces()
	const pIndex = pickIndex(provinces, selected.province)

	const cities = getCities(provinces[pIndex] && provinces[pIndex].code)
	const cIndex = pickIndex(cities, selected.city)

	/*
	 * 港澳只有两级（香港特别行政区 → 中西區），这类"市"下面没有区。
	 * 后端的 district 是必填（@Size(min = 1)），所以第三列退回城市名，
	 * 保证 district 永远非空；展示时 joinAddress 会去重，不会出现重复字样。
	 */
	let districts = getDistricts(cities[cIndex] && cities[cIndex].code)
	if (!districts.length) {
		const cityName = cities[cIndex] && cities[cIndex].name
		districts = cityName ? [{ code: '', name: cityName }] : []
	}
	const dIndex = pickIndex(districts, selected.district)

	return {
		columns: [provinces.map((v) => v.name), cities.map((v) => v.name), districts.map((v) => v.name)],
		index: [pIndex, cIndex, dIndex],
	}
}

/** 在列表里按名称找下标，找不到就回到 0 */
function pickIndex(list, name) {
	if (!name) return 0
	const i = list.findIndex((item) => item.name === name)
	return i === -1 ? 0 : i
}

/**
 * 把列下标翻译成省市区名称。
 * 某列取不到值时（比如港澳没有区）返回空串，交给调用方处理。
 */
export function readSelection(columns, index) {
	const value = [0, 1, 2].map((i) => {
		const col = columns[i] || []
		return col[index[i]] || ''
	})
	return { province: value[0], city: value[1], district: value[2] }
}

/**
 * 拼接完整地址用于展示。
 * 港澳会出现「市」和「区」同名的情况（中西區），这里去重避免读起来重复。
 */
export function joinAddress({ province, city, district, detailAddress } = {}) {
	const parts = [province, city, district].filter((v, i, arr) => v && arr.indexOf(v) === i)
	return `${parts.join('')}${detailAddress || ''}`
}
