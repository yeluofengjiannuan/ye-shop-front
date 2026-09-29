<template>
	<view class="page">
		<view :style="{ height: statusBarHeight + 'px' }"></view>

		<!-- 用户信息 -->
		<view class="hero">
			<view class="hero__avatar">
				<image v-if="avatar" class="hero__avatar-img" :src="avatar" mode="aspectFill" />
				<text v-else class="hero__avatar-text">{{ avatarFallback }}</text>
			</view>
			<text class="hero__name">{{ nickname }}</text>
			<text class="hero__role">{{ roleText }}</text>
		</view>

		<!-- 明细 -->
		<view class="panel">
			<view class="row">
				<text class="row__label">用户 ID</text>
				<text class="row__value">{{ userInfo.id || '—' }}</text>
			</view>
			<view class="row">
				<text class="row__label">角色</text>
				<text class="row__value">{{ userStore.userRole }}</text>
			</view>
			<view class="row">
				<text class="row__label">Token</text>
				<text class="row__value row__value--mono">{{ tokenPreview }}</text>
			</view>
		</view>

		<view class="logout" @click="handleLogout">
			<text class="logout__text">退出登录</text>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/store/modules/user'

export default {
	data() {
		return {
			statusBarHeight: 0,
		}
	},
	computed: {
		// Pinia store 在 Options API 里用 computed 取，避免塞进 data() 被重复包裹
		userStore() {
			return useUserStore()
		},
		userInfo() {
			return this.userStore.userInfo || {}
		},
		nickname() {
			return this.userInfo.nickname || this.userInfo.username || '未命名用户'
		},
		avatar() {
			return this.userInfo.avatar || ''
		},
		avatarFallback() {
			return String(this.nickname).slice(0, 1).toUpperCase()
		},
		roleText() {
			return this.userStore.isEnterprise ? '企业用户' : '个人用户'
		},
		tokenPreview() {
			const token = this.userStore.token || ''
			if (!token) return '—'
			return token.length > 16 ? `${token.slice(0, 16)}…` : token
		},
	},
	onLoad() {
		const info = uni.getSystemInfoSync()
		this.statusBarHeight = info.statusBarHeight || 0
	},
	methods: {
		handleLogout() {
			uni.showModal({
				title: '提示',
				content: '确定要退出登录吗？',
				success: (res) => {
					// logout() 内部会清空 store / 缓存，并 reLaunch 到登录页
					if (res.confirm) this.userStore.logout()
				},
			})
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
/* 沿用首页色板：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 */
.page {
	min-height: 100vh;
	padding: 0 24rpx 40rpx;
	box-sizing: border-box;
}

.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 40rpx 0 20rpx;
	padding: 48rpx 20rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.hero__avatar {
	width: 140rpx;
	height: 140rpx;
	border-radius: 50%;
	overflow: hidden;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.hero__avatar-img {
	width: 140rpx;
	height: 140rpx;
	display: block;
}

.hero__avatar-text {
	font-size: 56rpx;
	font-weight: bold;
	color: #ffffff;
}

.hero__name {
	margin-top: 24rpx;
	font-size: 36rpx;
	font-weight: bold;
	color: #333333;
}

.hero__role {
	margin-top: 10rpx;
	font-size: 24rpx;
	color: #999999;
}

.panel {
	margin-top: 20rpx;
	padding: 8rpx 32rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 28rpx 0;
	border-bottom: 2rpx solid #f0f0f0;
}

.row:last-child {
	border-bottom: none;
}

.row__label {
	font-size: 28rpx;
	color: #999999;
}

.row__value {
	font-size: 28rpx;
	color: #333333;
}

.row__value--mono {
	font-size: 24rpx;
	color: #666666;
}

.logout {
	margin-top: 40rpx;
	height: 88rpx;
	border-radius: 44rpx;
	background-color: #ffffff;
	border: 2rpx solid #ff6b35;
	display: flex;
	align-items: center;
	justify-content: center;
}

.logout__text {
	font-size: 30rpx;
	font-weight: bold;
	color: #ff6b35;
}
</style>
