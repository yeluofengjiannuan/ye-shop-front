<template>
	<view class="page">
		<PageHeader :title="contactName" />

		<scroll-view
			class="scroll"
			scroll-y
			:scroll-into-view="scrollTarget"
			:upper-threshold="60"
			@scrolltoupper="loadMore"
		>
			<view class="scroll__inner">
				<view v-if="loadingMore" class="more">
					<text class="more__text">加载中…</text>
				</view>
				<view v-else-if="!hasMore && messages.length" class="more">
					<text class="more__text">没有更早的消息了</text>
				</view>

				<view v-if="loading" class="more">
					<text class="more__text">加载中…</text>
				</view>

				<view v-else-if="!messages.length" class="empty">
					<text class="empty__text">还没有消息，打个招呼吧</text>
				</view>

				<view
					v-for="item in messages"
					:key="item.key"
					:id="'msg-' + item.key"
					class="msg"
					:class="{ 'msg--mine': item.mine }"
				>
					<view class="msg__row">
						<text
							v-if="item.mine && item.status === 'failed'"
							class="msg__fail"
							@click="resend(item)"
							>!</text
						>
						<view
							class="msg__bubble"
							:class="{
								'msg__bubble--mine': item.mine && !isProduct(item),
								'msg__bubble--card': isProduct(item),
							}"
						>
							<!-- 商品卡片：气泡只当定位容器，样式交给卡片自己，免得橙色底压着白卡片 -->
							<view
								v-if="isProduct(item)"
								class="pcard"
								@click="goProduct(item.productId)"
							>
								<image
									class="pcard__img"
									:src="cardImage(item)"
									mode="aspectFill"
									@error="onCardImageError(item)"
								/>
								<view class="pcard__body">
									<text class="pcard__name">{{ cardName(item) }}</text>
									<text v-if="cardPrice(item) !== null" class="pcard__price">
										¥{{ formatPrice(cardPrice(item)) }}
									</text>
									<text v-else class="pcard__tip">点击查看商品</text>
								</view>
							</view>
							<text v-else class="msg__text">{{ item.content }}</text>
						</view>
					</view>
					<text class="msg__time">
						{{ item.timeText }}<text v-if="item.mine && item.status === 'sending'"> · 发送中</text>
					</text>
				</view>
			</view>
		</scroll-view>

		<!-- 输入栏 -->
		<view class="bar">
			<view v-if="!chatStore.connected" class="bar__off">
				<text class="bar__off-text">连接已断开，正在重连…</text>
			</view>
			<block v-else>
				<!-- 从商品详情进来的才有这个按钮：把当前商品作为卡片发出去 -->
				<view v-if="canSendProduct" class="bar__product" @click="sendProduct">
					<view class="icon-product"></view>
					<text class="bar__product-text">商品</text>
				</view>
				<input
					class="bar__input"
					v-model="draft"
					type="text"
					maxlength="500"
					confirm-type="send"
					placeholder="说点什么…"
					placeholder-class="bar__placeholder"
					@confirm="send"
				/>
				<view
					class="bar__send"
					:class="{ 'bar__send--off': !draft.trim() }"
					@click="send"
				>
					<text class="bar__send-text">发送</text>
				</view>
			</block>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { useChatStore } from '@/store/modules/chat'
import { useUserStore } from '@/store/modules/user'
import { resolveImage, formatPrice } from '@/utils/productImage'
import { MSG_TYPE } from '@/utils/chat'

const PAGE_SIZE = 20

/**
 * 路由参数里的中文会被编码两次（我们编码一次，uni 的路由再编码一次 %），
 * 所以这里解一次。昵称里带 % 时 decodeURIComponent 会抛，兜住就行。
 */
function safeDecode(value) {
	try {
		return decodeURIComponent(value)
	} catch (err) {
		return value
	}
}

export default {
	components: { PageHeader },
	data() {
		return {
			contactId: '',
			contactName: '聊天',
			// 从商品详情带进来的商品上下文，有才显示「发送商品」按钮
			productId: '',
			productName: '',
			draft: '',
			loading: true,
			loadingMore: false,
			page: 1,
			hasMore: true,
			failedImageIds: [],
			// 受控的滚动目标：只有追加新消息时才设它，
			// 上拉加载更早的消息时要保持视觉位置，所以那时候不设
			scrollTarget: '',
		}
	},
	computed: {
		chatStore() {
			return useChatStore()
		},
		userStore() {
			return useUserStore()
		},
		messages() {
			return this.chatStore.messages
		},
		/** 有商品上下文、而且自己不是客服时，才给「发送商品」按钮 */
		canSendProduct() {
			return !!this.productId && !this.userStore.isAdmin
		},
	},
	watch: {
		// 新消息（自己发的或推来的）追加到尾部时滚到底
		'messages.length'(next, prev) {
			if (next > prev && this.page === 1) this.$nextTick(() => this.scrollToBottom())
		},
	},
	onLoad(options) {
		this.contactId = (options && options.contactId) || ''
		const name = (options && options.name) || ''
		// 从会话列表进来会带昵称；从商品详情「联系客服」进来只有 id，就显示「客服」
		this.contactName = name ? safeDecode(name) : '客服'
		// 商品上下文：只有从商品详情进来才有
		this.productId = (options && options.productId) || ''
		this.productName = (options && options.productName) ? safeDecode(options.productName) : ''
		this.chatStore.connect()
		this.open()
	},
	// 离开时把当前会话标记清掉，推送就不会再往这个已销毁的列表里塞
	onUnload() {
		this.chatStore.closeRoom()
	},
	methods: {
		formatPrice,
		isProduct(item) {
			return item.msgType === MSG_TYPE.PRODUCT
		},
		async open() {
			this.chatStore.openRoom(this.contactId)
			this.loading = true
			this.page = 1
			this.hasMore = true
			try {
				const list = await this.chatStore.loadHistory({
					contactId: this.contactId,
					page: 1,
					size: PAGE_SIZE,
				})
				this.chatStore.messages = list
				// 满一页就认为可能还有更早的
				this.hasMore = list.length >= PAGE_SIZE
				this.$nextTick(() => this.scrollToBottom())
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '聊天记录加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
			// 进来就把未读清掉
			this.chatStore.markRead(this.contactId)
		},
		async loadMore() {
			if (this.loading || this.loadingMore || !this.hasMore || !this.messages.length) return
			this.loadingMore = true
			// 记下当前最上面那条，加载完把它滚回可视区 —— 这样视觉位置不会跳
			const anchorKey = this.messages[0].key
			try {
				const older = await this.chatStore.loadHistory({
					contactId: this.contactId,
					page: this.page + 1,
					size: PAGE_SIZE,
				})
				if (!older.length) {
					this.hasMore = false
					return
				}
				this.page += 1
				this.hasMore = older.length >= PAGE_SIZE
				this.chatStore.messages = older.concat(this.chatStore.messages)
				this.$nextTick(() => {
					this.scrollTarget = ''
					this.$nextTick(() => {
						this.scrollTarget = 'msg-' + anchorKey
					})
				})
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '加载失败', icon: 'none' })
			} finally {
				this.loadingMore = false
			}
		},
		scrollToBottom() {
			const list = this.messages
			if (!list.length) return
			this.scrollTarget = ''
			this.$nextTick(() => {
				this.scrollTarget = 'msg-' + list[list.length - 1].key
			})
		},
		send() {
			const text = this.draft.trim()
			if (!text) return
			const ok = this.chatStore.send(this.contactId, text)
			if (ok) {
				this.draft = ''
				this.$nextTick(() => this.scrollToBottom())
			}
		},
		resend(item) {
			this.chatStore.resend(item.key)
		},
		/** 把当前商品作为一张卡片发给对方 */
		sendProduct() {
			const ok = this.chatStore.sendProductCard({
				toUserId: this.contactId,
				productId: this.productId,
				productName: this.productName,
			})
			if (ok) this.$nextTick(() => this.scrollToBottom())
		},
		goProduct(productId) {
			if (productId == null) return
			uni.navigateTo({ url: `/pages/product/detail?productId=${productId}` })
		},
		/*
		 * 商品卡片的名称/价格来自 store 里的简介缓存（由 /api/product/brief/list 批量查）。
		 * 简介还没到、或者商品被删了，就用消息里的 content 兜底 ——
		 * 发送时 content 存的就是商品名，所以卡片不会开天窗。
		 */
		briefOf(productId) {
			return this.chatStore.briefs[productId] || null
		},
		cardName(item) {
			const brief = this.briefOf(item.productId)
			return (brief && brief.name) || item.content || '商品'
		},
		cardPrice(item) {
			const brief = this.briefOf(item.productId)
			return brief && brief.price != null ? brief.price : null
		},
		cardImage(item) {
			const brief = this.briefOf(item.productId)
			// 后端商品图基本都是坏的，resolveImage 会兜到占位图
			return resolveImage(brief && brief.image, item.productId, this.failedImageIds)
		},
		onCardImageError(item) {
			if (this.failedImageIds.indexOf(item.productId) === -1) {
				this.failedImageIds.push(item.productId)
			}
		},
	},
}
</script>

<style>
page {
	background-color: #f5f5f5;
}
</style>

<style scoped>
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

/* 用 flex 撑满整屏：头部在流里，中间滚动，底部输入栏固定占比。
   这样不用去算固定定位的占位高度 */
.page {
	display: flex;
	flex-direction: column;
	height: 100vh;
}

.scroll {
	flex: 1;
	overflow: hidden;
}

.scroll__inner {
	padding: 20rpx 24rpx 24rpx;
}

.more {
	padding: 20rpx 0;
	text-align: center;
}

.more__text {
	font-size: 22rpx;
	color: #999999;
}

.empty {
	padding: 120rpx 0;
	text-align: center;
}

.empty__text {
	font-size: 26rpx;
	color: #999999;
}

/* ---------- 消息 ---------- */
.msg {
	margin-bottom: 24rpx;
}

.msg--mine {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
}

.msg__row {
	display: flex;
	align-items: center;
	max-width: 100%;
}

.msg--mine .msg__row {
	flex-direction: row;
}

.msg__bubble {
	max-width: 72%;
	padding: 18rpx 22rpx;
	border-radius: 16rpx;
	background-color: #ffffff;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.msg__bubble--mine {
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
}

.msg__text {
	font-size: 28rpx;
	line-height: 42rpx;
	color: #333333;
	word-break: break-all;
}

.msg__bubble--mine .msg__text {
	color: #ffffff;
}

/* 商品卡片：气泡不再当视觉容器，去掉底色和内边距 */
.msg__bubble--card {
	padding: 0;
	background-color: transparent;
	background-image: none;
	box-shadow: none;
}

.pcard {
	display: flex;
	align-items: center;
	width: 440rpx;
	padding: 16rpx;
	box-sizing: border-box;
	background-color: #ffffff;
	border: 2rpx solid #f0f0f0;
	border-radius: 16rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.pcard__img {
	width: 140rpx;
	height: 140rpx;
	flex-shrink: 0;
	border-radius: 12rpx;
	background-color: #f5f5f5;
}

.pcard__body {
	flex: 1;
	margin-left: 16rpx;
	overflow: hidden;
}

.pcard__name {
	font-size: 28rpx;
	line-height: 38rpx;
	color: #333333;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.pcard__price {
	display: block;
	margin-top: 10rpx;
	font-size: 30rpx;
	font-weight: bold;
	color: #ff6b35;
}

/* 简介没查到时的兜底文案，不要留白 */
.pcard__tip {
	display: block;
	margin-top: 10rpx;
	font-size: 24rpx;
	color: #999999;
}

.msg__time {
	margin-top: 8rpx;
	font-size: 20rpx;
	color: #999999;
}

/* 发送失败：点一下重发 */
.msg__fail {
	flex-shrink: 0;
	margin-right: 12rpx;
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background-color: #ff6b35;
	color: #ffffff;
	font-size: 24rpx;
	line-height: 36rpx;
	text-align: center;
}

/* ---------- 输入栏 ---------- */
.bar {
	flex-shrink: 0;
	display: flex;
	align-items: center;
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

/* 发送商品的按钮：描边款，和实心的「发送」拉开层级，免得两个橙色按钮抢视线 */
.bar__product {
	flex-shrink: 0;
	margin-right: 16rpx;
	width: 88rpx;
	height: 72rpx;
	border-radius: 16rpx;
	border: 2rpx solid #ff6b35;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

/* 纯 CSS 画个购物袋（页面里的图标都是这么画的，不用 emoji/字体图标） */
.icon-product {
	position: relative;
	width: 34rpx;
	height: 28rpx;
	margin-top: 6rpx;
	box-sizing: border-box;
	border: 3rpx solid #ff6b35;
	border-radius: 4rpx 4rpx 8rpx 8rpx;
}

.icon-product::before {
	content: '';
	position: absolute;
	left: 7rpx;
	top: -12rpx;
	width: 14rpx;
	height: 12rpx;
	box-sizing: border-box;
	border: 3rpx solid #ff6b35;
	border-bottom: none;
	border-radius: 8rpx 8rpx 0 0;
}

.bar__product-text {
	font-size: 20rpx;
	line-height: 24rpx;
	color: #ff6b35;
}

.bar__input {
	flex: 1;
	height: 72rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
	border-radius: 36rpx;
	background-color: #f5f5f5;
	font-size: 28rpx;
	color: #333333;
}

.bar__placeholder {
	font-size: 28rpx;
	color: #cccccc;
}

.bar__send {
	flex-shrink: 0;
	margin-left: 16rpx;
	padding: 0 36rpx;
	height: 72rpx;
	border-radius: 36rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.bar__send--off {
	background-image: none;
	background-color: #cccccc;
}

.bar__send-text {
	font-size: 28rpx;
	font-weight: bold;
	color: #ffffff;
}

.bar__off {
	flex: 1;
	text-align: center;
	padding: 16rpx 0;
}

.bar__off-text {
	font-size: 24rpx;
	color: #ff6b35;
}
</style>
