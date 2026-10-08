import { defineStore } from 'pinia'
import { chatApi, userApi, productApi } from '@/utils/api'
import { useUserStore } from './user'
import {
	buildWsUrl,
	normalizeSession,
	normalizeMessage,
	formatClock,
	nextLocalKey,
	MSG_TYPE,
} from '@/utils/chat'

/** 心跳间隔。后端 ChatNettyServer 注释里写的是前端 30 秒一次，服务端 90 秒全空闲就断 */
const HEARTBEAT_MS = 30000
/** 退避重连的间隔，用完就放弃（不再无脑重试，避免后台一直打） */
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]
/** 发出后多久没等到 MSG_ACK 就标成失败 */
const SEND_TIMEOUT_MS = 10000

/*
 * 连接相关的句柄放模块级，不放 state：
 * 它们不需要响应式，塞进 state 反而会被 Pinia 代理一层。
 */
let socketTask = null
let heartbeatTimer = null
let reconnectTimer = null
let reconnectAttempt = 0
/** 主动断开（登出、页面卸载）时不再自动重连 */
let manualClose = false

export const useChatStore = defineStore('chat', {
	state: () => ({
		/** 连接是否处于可用状态 */
		connected: false,
		/** 最近一次失败原因，只用于提示，不影响逻辑 */
		lastError: '',

		sessions: [],
		sessionsLoaded: false,

		/** 当前打开的聊天对象 id；空串表示不在聊天页 */
		activeContactId: '',
		/** 当前会话的消息（只缓存正在看的这一个会话） */
		messages: [],

		/**
		 * 已发出但还没收到 MSG_ACK 的本地消息 key，FIFO。
		 * MSG_ACK 只带 {msgId, status}，**不带内容**，没法精确对应是哪条，
		 * 所以按发送顺序出队匹配。
		 */
		pendingKeys: [],

		/**
		 * 商品简介缓存 { [productId]: brief }。
		 * 消息里只存 productId，卡片要的商品名/图/价格得另外查，
		 * 而 /api/product/brief/list 支持批量，所以一屏消息只查一次。
		 */
		briefs: {},
	}),

	getters: {
		/** 未读总数：后端没有单独的未读接口，把各会话的 unreadCount 加起来 */
		unreadTotal: (state) => state.sessions.reduce((sum, s) => sum + s.unreadCount, 0),
	},

	actions: {
		/* ---------------- 连接 ---------------- */

		connect() {
			const userStore = useUserStore()
			if (!userStore.isLogin || !userStore.token) return
			// 已经有一条在连/连上了就不要再建
			if (socketTask) return

			manualClose = false
			const task = uni.connectSocket({
				url: buildWsUrl(userStore.token),
				// 不传 complete 的话某些平台会打一条 "connectSocket:fail" 的噪音
				complete: () => {},
			})
			// H5 和主流小程序端都会返回 SocketTask；拿不到就说明平台不支持这套 API
			if (!task || typeof task.onOpen !== 'function') {
				console.warn('[chat] 当前平台没有返回 SocketTask，聊天不可用')
				return
			}
			socketTask = task

			task.onOpen(() => {
				this.connected = true
				this.lastError = ''
				reconnectAttempt = 0
				this.startHeartbeat()
				// 连上就把会话列表刷一遍，未读角标才对得上
				this.loadSessions()
			})

			task.onMessage((res) => {
				this.handleFrame(res && res.data)
			})

			task.onClose(() => {
				this.connected = false
				socketTask = null
				this.stopHeartbeat()
				this.failPending()
				this.scheduleReconnect()
			})

			// onError 之后 onClose 一定会来，所以这里不重复处理，
			// 只记一下原因方便排查
			task.onError((err) => {
				this.lastError = (err && (err.errMsg || err.message)) || '连接异常'
			})
		},

		/**
		 * 退避重连。
		 *
		 * 握手失败时后端是**静默关连接**（不返回任何 HTTP 响应），所以客户端
		 * 分不清"token 过期"和"网络抖动"。这里的做法是：连续失败之后先打一个
		 * 普通的鉴权 HTTP 请求 —— 如果 token 过期，request.js 的 401 拦截会自动
		 * 刷新令牌并写回 store，刷新失败它会 logout，我们收到 userLogout 就停。
		 * 这样不用在 WS 层再写一套刷新逻辑。
		 */
		async scheduleReconnect() {
			if (manualClose) return
			const userStore = useUserStore()
			if (!userStore.isLogin) return
			if (reconnectTimer) return
			if (reconnectAttempt >= RECONNECT_DELAYS.length) {
				console.warn('[chat] 重连次数已用尽，停止重连')
				return
			}

			const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)]
			reconnectAttempt += 1

			if (reconnectAttempt >= 2) {
				try {
					// 只为了触发 401 → 刷新令牌这条链路
					await userApi.getUserDetail()
				} catch (err) {
					// request.js 内部已经处理（刷新失败会 logout），这里不需要再做什么
				}
				if (!useUserStore().isLogin) return
			}

			reconnectTimer = setTimeout(() => {
				reconnectTimer = null
				this.connect()
			}, delay)
		},

		disconnect() {
			manualClose = true
			this.stopHeartbeat()
			if (reconnectTimer) {
				clearTimeout(reconnectTimer)
				reconnectTimer = null
			}
			reconnectAttempt = 0
			if (socketTask) {
				try {
					socketTask.close({ code: 1000 })
				} catch (err) {
					// 关就关了，失败无所谓
				}
				socketTask = null
			}
			this.connected = false
		},

		startHeartbeat() {
			this.stopHeartbeat()
			heartbeatTimer = setInterval(() => {
				this.sendFrame({ action: 'HEARTBEAT' })
			}, HEARTBEAT_MS)
		},

		stopHeartbeat() {
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer)
				heartbeatTimer = null
			}
		},

		sendFrame(payload) {
			if (!socketTask || !this.connected) return false
			try {
				socketTask.send({ data: JSON.stringify(payload) })
				return true
			} catch (err) {
				this.lastError = (err && err.message) || '发送失败'
				return false
			}
		},

		/* ---------------- 收帧 ---------------- */

		handleFrame(raw) {
			if (!raw) return
			let frame
			try {
				frame = JSON.parse(raw)
			} catch (err) {
				console.warn('[chat] 收到无法解析的帧：', raw)
				return
			}
			if (frame.action === 'PONG') return
			if (frame.action === 'MSG_ACK') {
				this.resolveAck()
				return
			}
			if (frame.action === 'PUSH_MSG') {
				this.onPush(frame.data || {})
			}
		},

		/** MSG_ACK 不带内容，只能按发送顺序对上队首那条 */
		resolveAck() {
			const key = this.pendingKeys.shift()
			if (!key) return
			const msg = this.messages.find((m) => m.key === key)
			if (msg) msg.status = 'sent'
		},

		/**
		 * 收到别人的消息。
		 *
		 * 注意 PUSH_MSG **只推给接收方**，不回显给发送方 ——
		 * 所以自己发的消息不会又收到一遍，但也意味着发送方必须自己先把本地那条画出来。
		 */
		onPush(data) {
			const fromUserId = data && data.fromUserId
			if (fromUserId == null) return
			const from = normalizeMessage(data)
			// 别人推过来的商品卡片也要能渲染出来
			if (from.msgType === MSG_TYPE.PRODUCT) this.ensureBriefs([from.productId])

			if (String(this.activeContactId) === String(fromUserId)) {
				this.messages.push({ ...from, key: nextLocalKey(), mine: false, status: 'sent' })
				// 人正在这个会话里看着，直接清未读，省得角标闪一下
				this.markRead(fromUserId)
			} else {
				// 不在这个会话，刷新列表把未读和最后一条更新出来
				this.loadSessions()
			}
		},

		/* ---------------- 数据 ---------------- */

		async loadSessions() {
			const userStore = useUserStore()
			if (!userStore.isLogin) {
				this.sessions = []
				return
			}
			try {
				const list = await chatApi.getSessions()
				const myId = String(userStore.userInfo.id || '')
				this.sessions = list
					.map(normalizeSession)
					/*
					 * 滤掉「自己和自己」的会话。
					 * 库里确实存在这种数据（管理员在商品详情点「客服」，
					 * 打开的就是他自己），会话列表的 SQL 是
					 * `WHERE user_id = 我 OR contact_id = 我`，
					 * 所以自我会话会被查出来。前端挡掉，不改后端。
					 */
					.filter((s) => !myId || String(s.contactId) !== myId)
				this.sessionsLoaded = true
			} catch (err) {
				console.warn('[chat] 会话列表加载失败：', err && err.message)
			}
		},

		/**
		 * 保证这批商品 id 的简介都在缓存里。
		 * 只查缺的那些，一次请求搞定；接口失败就静默降级成占位卡片。
		 */
		async ensureBriefs(productIds) {
			const ids = (productIds || [])
				.filter((id) => id != null && !this.briefs[id])
				.filter((id, index, arr) => arr.indexOf(id) === index)
			if (!ids.length) return
			try {
				const list = await productApi.getBriefList({ productIds: ids })
				list.forEach((item) => {
					if (item && item.id != null) this.briefs[item.id] = item
				})
			} catch (err) {
				console.warn('[chat] 商品简介加载失败：', err && err.message)
			}
		},

		/**
		 * 拉历史消息。
		 * 后端按 create_time **倒序**返回，所以这里反转成正序再给页面用。
		 * @param page 1 是最新的一页；page 2、3… 越来越早
		 *
		 * 注意要在这里补 `mine` —— normalizeMessage 只转字段，不判断归属。
		 * 自己发的和推送来的都有明确的 mine，只有从历史里翻出来的没有，
		 * 漏了这一步重新进页面就会把"我发的"全渲染成"对方发的"。
		 */
		async loadHistory({ contactId, page = 1, size = 20 }) {
			const { list } = await chatApi.getHistory({ contactId, page, size })
			const myId = String(useUserStore().userInfo.id || '')
			const messages = list
				.map((raw) => {
					const msg = normalizeMessage(raw)
					return {
						...msg,
						key: nextLocalKey(),
						// 拿不到自己的 id 就退而求其次：1对1 历史里只有我和对方两种，
						// 不是对方发的就是我发的
						mine: myId
							? String(msg.fromUserId) === myId
							: String(msg.fromUserId) !== String(contactId),
						status: 'sent',
					}
				})
				.reverse()

			/*
			 * 商品卡片的简介不在消息里，要按 productId 另查。
			 * 故意**不 await**：消息列表先渲染出来，简介到了 Vue 自己会补上，
			 * 不该让一屏文字消息卡在一个商品请求上。
			 */
			const productIds = messages
				.filter((m) => m.msgType === MSG_TYPE.PRODUCT)
				.map((m) => m.productId)
			this.ensureBriefs(productIds)

			return messages
		},

		/** 进入某个会话 */
		async openRoom(contactId) {
			this.activeContactId = String(contactId)
			this.messages = []
			this.pendingKeys = []
		},

		closeRoom() {
			this.activeContactId = ''
			this.messages = []
			this.pendingKeys = []
		},

		/** 清除未读：本地先归零保证角标立刻反应，再让服务端确认 */
		async markRead(contactId) {
			const session = this.sessions.find((s) => String(s.contactId) === String(contactId))
			if (session && session.unreadCount) session.unreadCount = 0
			try {
				await chatApi.clearUnread({ contactId })
			} catch (err) {
				console.warn('[chat] 清除未读失败：', err && err.message)
			}
		},

		/**
		 * 发送的公共部分：先乐观上屏，再发帧，然后等 MSG_ACK。
		 * 文本和商品卡片只差 content / msgType / productId 三个字段。
		 */
		pushOutgoing({ toUserId, content, msgType, productId }) {
			if (!this.connected) {
				uni.showToast({ title: '连接已断开，正在重连…', icon: 'none' })
				this.connect()
				return false
			}

			const key = nextLocalKey()
			this.messages.push({
				key,
				content,
				msgType,
				productId,
				// 直接把 Date 格式化。之前这里拼了个不带补零的字符串再让 parseChatTime 解析，
				// "2026-10-9 0:12:22" 不是合法日期，时间那一栏就一直是空的
				timeText: formatClock(new Date()),
				mine: true,
				status: 'sending',
			})
			this.pendingKeys.push(key)

			const data = { toUserId: Number(toUserId), content, msgType }
			if (productId != null) data.productId = productId
			const ok = this.sendFrame({ action: 'SEND_MSG', data })
			if (!ok) {
				this.pendingKeys = this.pendingKeys.filter((k) => k !== key)
				const msg = this.messages.find((m) => m.key === key)
				if (msg) msg.status = 'failed'
				return false
			}

			// ACK 一直不来也要给个交代，不能让气泡永远转圈
			setTimeout(() => {
				const msg = this.messages.find((m) => m.key === key)
				if (msg && msg.status === 'sending') msg.status = 'failed'
			}, SEND_TIMEOUT_MS)
			return true
		},

		/** 发送文本消息。注意 msgType 是 0（文本），1 是图片 */
		send(toUserId, content) {
			const text = String(content || '').trim()
			if (!text) return false
			return this.pushOutgoing({ toUserId, content: text, msgType: MSG_TYPE.TEXT })
		},

		/**
		 * 发一张商品卡片。
		 *
		 * content 用商品名 —— 后端会拿它当会话列表的 lastMsgContent，
		 * 这样管理员在列表里一眼就能看出买家问的是哪个商品，不用点进去。
		 */
		sendProductCard({ toUserId, productId, productName }) {
			if (productId == null) return false
			const name = productName || '这件商品'
			// 自己发的卡片也要查简介，否则价格那行会一直是兜底文案，
			// 得等重进房间（loadHistory）才补上
			this.ensureBriefs([productId])
			return this.pushOutgoing({
				toUserId,
				content: name,
				msgType: MSG_TYPE.PRODUCT,
				productId: Number(productId),
			})
		},

		/** 连接断开时把在途的消息全部标失败 */
		failPending() {
			this.pendingKeys.forEach((key) => {
				const msg = this.messages.find((m) => m.key === key)
				if (msg) msg.status = 'failed'
			})
			this.pendingKeys = []
		},

		/** 重发一条失败的消息 */
		resend(key) {
			const msg = this.messages.find((m) => m.key === key)
			if (!msg || msg.status !== 'failed') return
			msg.status = 'sending'
			this.pendingKeys.push(key)
			const data = {
				toUserId: Number(this.activeContactId),
				content: msg.content,
				// 保持原类型：商品卡片重发成文本会把 productId 丢掉
				msgType: msg.msgType,
			}
			if (msg.productId != null) data.productId = msg.productId
			const ok = this.sendFrame({ action: 'SEND_MSG', data })
			if (!ok) msg.status = 'failed'
		},

		/** 退出登录时清干净 */
		reset() {
			this.disconnect()
			this.sessions = []
			this.sessionsLoaded = false
			this.activeContactId = ''
			this.messages = []
			this.pendingKeys = []
			this.lastError = ''
		},
	},
})
