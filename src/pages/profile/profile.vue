<template>
	<view class="page">
		<!-- 子页面头部。本页是 navigationStyle: custom，原生导航栏（含返回箭头）被去掉了，
		     必须自己提供返回入口，否则在小程序/App 上进得来出不去 -->
		<view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="header__inner">
				<view class="back" @click="goBack">
					<view class="icon-back">
						<view class="icon-back__head"></view>
						<view class="icon-back__shaft"></view>
					</view>
				</view>
				<text class="header__title">个人中心</text>
				<view class="header__placeholder"></view>
			</view>
		</view>

		<!-- 用户信息 -->
		<view class="hero">
			<view class="hero__avatar">
				<image
					v-if="showAvatar"
					class="hero__avatar-img"
					:src="avatarUrl"
					mode="aspectFill"
					@error="onAvatarError"
				/>
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
				<text class="row__label">账号</text>
				<text class="row__value">{{ userInfo.username || nickname }}</text>
			</view>
			<view class="row">
				<text class="row__label">手机号</text>
				<text class="row__value">{{ userInfo.phone || '—' }}</text>
			</view>
			<view class="row">
				<text class="row__label">角色</text>
				<text class="row__value">{{ userStore.userRole }}</text>
			</view>
		</view>

		<view class="logout" @click="handleLogout">
			<text class="logout__text">退出登录</text>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/store/modules/user'
import { userApi } from '@/utils/api'
import { BASE_URL } from '@/utils/request'

export default {
	data() {
		return {
			statusBarHeight: 0,
			// 记录加载失败的头像地址，避免上一张失败后一直显示兜底
			avatarFailedUrl: '',
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
		avatarUrl() {
			const raw = this.userInfo.avatar || ''
			if (!raw) return ''
			if (/^https?:\/\//.test(raw) || raw.startsWith('data:')) return raw
			// 后端返回的是相对路径（如 /static/images/xxx.png），需要补上 BASE_URL
			return BASE_URL + (raw.startsWith('/') ? raw : `/${raw}`)
		},
		showAvatar() {
			return !!this.avatarUrl && this.avatarFailedUrl !== this.avatarUrl
		},
		avatarFallback() {
			return String(this.nickname).slice(0, 1).toUpperCase()
		},
		roleText() {
			return this.userStore.isEnterprise ? '企业用户' : '个人用户'
		},
	},
	onLoad() {
		const info = uni.getSystemInfoSync()
		this.statusBarHeight = info.statusBarHeight || 0
		this.loadDetail()
	},
	methods: {
		goBack() {
			// 栈里只有本页（冷启动直接进来）时无处可退，回首页
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
				return
			}
			uni.reLaunch({ url: '/pages/index/index' })
		},
		/** 拉取用户详情刷新 store。失败时保留缓存数据，只提示一次 */
		async loadDetail() {
			try {
				const data = await userApi.getUserDetail()
				if (data) this.userStore.setProfile(data)
			} catch (err) {
				uni.showToast({
					title: (err && err.message) || '获取用户信息失败',
					icon: 'none',
				})
			}
		},
		onAvatarError() {
			this.avatarFailedUrl = this.avatarUrl
		},
		handleLogout() {
			uni.showModal({
				title: '提示',
				content: '确定要退出登录吗？',
				success: (res) => {
					// 后端没有退出接口，logout 是纯前端行为：
					// 清空 store / 缓存，并 reLaunch 到登录页
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

/* ---------- 子页面头部 ---------- */
.header {
	/* .page 有 24rpx 水平内边距，这里负边距破出来，让头部通栏而不是缩成一张卡片 */
	margin: 0 -24rpx;
	background-color: #ffffff;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.header__inner {
	height: 88rpx;
	display: flex;
	align-items: center;
	padding: 0 24rpx;
}

.back {
	width: 60rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
}

/* 返回箭头（纯 CSS 绘制，与首页图标同一风格） */
.icon-back {
	position: relative;
	width: 44rpx;
	height: 44rpx;
}

.icon-back__head {
	position: absolute;
	left: 11rpx;
	top: 14rpx;
	width: 16rpx;
	height: 16rpx;
	box-sizing: border-box;
	border-left: 4rpx solid #333333;
	border-bottom: 4rpx solid #333333;
	transform: rotate(45deg);
}

.icon-back__shaft {
	position: absolute;
	left: 14rpx;
	top: 20rpx;
	width: 20rpx;
	height: 4rpx;
	border-radius: 2rpx;
	background-color: #333333;
}

.header__title {
	flex: 1;
	text-align: center;
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
}

/* 右侧占位，与左侧返回键等宽，保证标题真正居中 */
.header__placeholder {
	width: 60rpx;
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
