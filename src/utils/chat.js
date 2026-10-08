/**
 * 聊天相关的常量与归一化
 */

import { BASE_URL } from './request'

/**
 * 客服账号（就是超级管理员）。
 *
 * ⚠️ 写死的。后端没有「查客服是谁」的接口，而且 `product` 表上也没有任何
 * seller/owner 字段 —— 也就是"商品属于哪个卖家"这件事在当前 schema 里根本不存在。
 * 所以这轮所有商品都指向同一个客服。
 * 后端补了商品→卖家关联或「查客服」接口之后，这里要换掉。
 */
export const SERVICE_ADMIN_ID = 6

/** Netty WebSocket 服务，独立于 HTTP 的 8080 端口 */
export const CHAT_WS_BASE = 'ws://localhost:8888'

/**
 * 消息类型，取自 ChatMessage 实体上的注释：0-文本 1-图片 2-商品卡片 3-语音。
 *
 * 注意文本是 **0**，不是 1 —— 1 是图片。
 * （之前从测试数据里反推成 1 是错的，那些数据本来就是自己造的。）
 */
export const MSG_TYPE = {
	TEXT: 0,
	IMAGE: 1,
	PRODUCT: 2,
	VOICE: 3,
}

/**
 * 拼握手地址。
 *
 * 后端的 JWTUtils.parseJWT 第一行就要求 token 以 "Bearer " 开头
 * （那个方法是给 HTTP 的 Authorization 头复用的），而这里 token 是放在 query 里的，
 * 所以必须自己把前缀补上再整体 URL 编码 —— 空格会编成 %20。
 * 少了这个前缀，服务端会**直接关连接且不返回任何响应**，客户端只能看到 close 1006。
 */
export function buildWsUrl(token) {
	return `${CHAT_WS_BASE}/ws/chat?token=${encodeURIComponent(`Bearer ${token}`)}`
}

/**
 * 解析后端时间。
 * 后端两种格式都出现过：`2026-10-08T23:54:12`（ChatMessage）和
 * `2026-10-08 23:54:12`（ChatSessionVO）。iOS Safari 不认带空格的那种，
 * 统一换成 ISO 再解析。
 *
 * （utils/coupon.js 里有个同样的 parseDate。等第三个模块也需要时再抽出去，
 *   现在抽会多一个只有两个用处的文件。）
 */
export function parseChatTime(raw) {
	if (!raw) return null
	const date = new Date(String(raw).replace(' ', 'T'))
	return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n) => String(n).padStart(2, '0')

/** 会话列表里的时间：今天显示时分，昨天显示「昨天」，今年显示月-日 */
export function formatSessionTime(raw) {
	const date = parseChatTime(raw)
	if (!date) return ''
	const now = new Date()
	if (date.toDateString() === now.toDateString()) {
		return `${pad(date.getHours())}:${pad(date.getMinutes())}`
	}
	const yesterday = new Date(now)
	yesterday.setDate(now.getDate() - 1)
	if (date.toDateString() === yesterday.toDateString()) return '昨天'
	if (date.getFullYear() === now.getFullYear()) {
		return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	}
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 把 Date 直接格式化成 HH:mm —— 本地新造的消息用这个，别去拼字符串再解析 */
export function formatClock(date) {
	if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
	return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 气泡上的时间（后端返回的字符串走这里） */
export function formatMessageTime(raw) {
	return formatClock(parseChatTime(raw))
}

/** 头像地址：后端返回的是相对路径，要补上 BASE_URL */
export function resolveAvatar(raw) {
	if (!raw) return ''
	if (/^https?:\/\//.test(raw) || raw.startsWith('data:')) return raw
	return BASE_URL + (raw.startsWith('/') ? raw : `/${raw}`)
}

/** 昵称首字母，头像加载不出来时兜底（后端默认头像在鉴权后面，必然 401） */
export function avatarLetter(name) {
	return String(name || '?').trim().slice(0, 1).toUpperCase() || '?'
}

/** ChatSessionVO → 页面结构 */
export function normalizeSession(raw) {
	const item = raw || {}
	return {
		contactId: item.contactId,
		nickname: item.contactNickname || '未知用户',
		avatar: resolveAvatar(item.contactAvatar),
		lastMsgContent: item.lastMsgContent || '',
		lastMsgTime: item.lastMsgTime || '',
		timeText: formatSessionTime(item.lastMsgTime),
		unreadCount: Number(item.unreadCount) || 0,
	}
}

/** ChatMessage → 页面结构 */
export function normalizeMessage(raw) {
	const item = raw || {}
	return {
		fromUserId: item.fromUserId,
		toUserId: item.toUserId,
		content: item.content || '',
		msgType: Number(item.msgType) || 0,
		productId: item.productId,
		createTime: item.createTime || '',
		timeText: formatMessageTime(item.createTime),
	}
}

/**
 * 本地消息 key。
 *
 * 后端返回的消息 id 是雪花号（19 位，如 2108224450007678977），
 * **超出 JS 的 Number.MAX_SAFE_INTEGER**，JSON.parse 会把末尾几位舍掉 ——
 * 同一毫秒发出的两条消息可能被舍成同一个数字。拿它当列表 key 会串行。
 * 所以渲染一律用本地自增 key，服务端 id 只用来对账。
 */
let localKeySeed = 0
export function nextLocalKey() {
	localKeySeed += 1
	return `m${localKeySeed}`
}

/* 角色判断挪到了 utils/roles.js —— 那边不引任何东西，
   user store 和这里都能安全引用，不会绕成循环依赖 */
