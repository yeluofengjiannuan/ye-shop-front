<template>
	<view class="page">
		<!--
			管理员进来就是客服工作台：/api/chat/sessions 的查询是
			`WHERE user_id = 我 OR contact_id = 我`，所以 admin 看到的
			天然就是所有找过他的买家，页面本身完全复用。
		-->
		<PageHeader :title="userStore.isAdmin ? '客服工作台' : '消息'" />

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<view v-else-if="!sessions.length" class="status">
			<text class="status__text">{{ userStore.isAdmin ? '还没有买家联系你' : '还没有聊天记录' }}</text>
			<view v-if="!userStore.isAdmin" class="status__btn" @click="goService">
				<text class="status__btn-text">联系客服</text>
			</view>
		</view>

		<view v-else class="list">
			<view class="session" v-for="item in sessions" :key="item.contactId" @click="openRoom(item)">
				<view class="session__avatar">
					<image
						v-if="item.avatar && failedAvatars.indexOf(item.avatar) === -1"
						class="session__avatar-img"
						:src="item.avatar"
						mode="aspectFill"
						@error="onAvatarError(item.avatar)"
					/>
					<text v-else class="session__avatar-text">{{ avatarLetter(item.nickname) }}</text>
				</view>

				<view class="session__body">
					<view class="session__top">
						<text class="session__name">{{ item.nickname }}</text>
						<text class="session__time">{{ item.timeText }}</text>
					</view>
					<text class="session__last">{{ item.lastMsgContent || '（暂无消息）' }}</text>
				</view>

				<text v-if="item.unreadCount > 0" class="session__badge">
					{{ item.unreadCount > 99 ? '99+' : item.unreadCount }}
				</text>
			</view>
		</view>

		<!-- 连接状态：断了要让人看得见，否则发不出消息会一头雾水 -->
		<view v-if="!chatStore.connected" class="conn">
			<text class="conn__text">连接已断开，正在重连…</text>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/store/modules/user'
import { useChatStore } from '@/store/modules/chat'
import { avatarLetter, SERVICE_ADMIN_ID } from '@/utils/chat'

export default {
	components: { PageHeader },
	data() {
		return {
			loading: true,
			failedAvatars: [],
		}
	},
	computed: {
		userStore() {
			return useUserStore()
		},
		chatStore() {
			return useChatStore()
		},
		sessions() {
			return this.chatStore.sessions
		},
	},
	// 用 onShow：从聊天页返回时未读和最后一条要刷新
	onShow() {
		this.refresh()
	},
	methods: {
		avatarLetter,
		async refresh() {
			this.loading = true
			// 列表页只负责把数据拉回来，连接本身由 App.vue 负责建
			this.chatStore.connect()
			await this.chatStore.loadSessions()
			this.loading = false
		},
		openRoom(item) {
			// 昵称/头像通过 query 带过去：/api/chat/history 只返回消息，不带对方资料
			const query = `contactId=${item.contactId}&name=${encodeURIComponent(item.nickname)}&avatar=${encodeURIComponent(item.avatar || '')}`
			uni.navigateTo({ url: `/pages/chat/room?${query}` })
		},
		goService() {
			uni.navigateTo({ url: `/pages/chat/room?contactId=${SERVICE_ADMIN_ID}&name=${encodeURIComponent('客服')}` })
		},
		onAvatarError(url) {
			if (this.failedAvatars.indexOf(url) === -1) this.failedAvatars.push(url)
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

.status {
	padding: 160rpx 0;
	text-align: center;
}

.status__text {
	display: block;
	font-size: 28rpx;
	color: #999999;
}

.status__btn {
	display: inline-block;
	margin-top: 32rpx;
	padding: 0 48rpx;
	height: 68rpx;
	border-radius: 34rpx;
	border: 2rpx solid #ff6b35;
}

.status__btn-text {
	font-size: 28rpx;
	line-height: 64rpx;
	color: #ff6b35;
}

/* ---------- 会话列表 ---------- */
.list {
	margin: 20rpx 24rpx 0;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
	overflow: hidden;
}

.session {
	display: flex;
	align-items: center;
	padding: 24rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.session:last-child {
	border-bottom: none;
}

.session__avatar {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	border-radius: 50%;
	overflow: hidden;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	display: flex;
	align-items: center;
	justify-content: center;
}

.session__avatar-img {
	width: 100%;
	height: 100%;
	display: block;
}

.session__avatar-text {
	font-size: 36rpx;
	font-weight: bold;
	color: #ffffff;
}

.session__body {
	flex: 1;
	margin-left: 20rpx;
	overflow: hidden;
}

.session__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.session__name {
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 30rpx;
	font-weight: bold;
	color: #333333;
}

.session__time {
	flex-shrink: 0;
	margin-left: 16rpx;
	font-size: 22rpx;
	color: #999999;
}

.session__last {
	display: block;
	margin-top: 8rpx;
	font-size: 26rpx;
	color: #999999;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.session__badge {
	flex-shrink: 0;
	margin-left: 16rpx;
	min-width: 36rpx;
	height: 36rpx;
	padding: 0 10rpx;
	box-sizing: border-box;
	border-radius: 18rpx;
	background-color: #ff6b35;
	color: #ffffff;
	font-size: 22rpx;
	line-height: 36rpx;
	text-align: center;
}

/* ---------- 连接状态 ---------- */
.conn {
	margin: 24rpx;
	padding: 16rpx;
	border-radius: 12rpx;
	background-color: #fff4ef;
	text-align: center;
}

.conn__text {
	font-size: 24rpx;
	color: #ff6b35;
}
</style>
