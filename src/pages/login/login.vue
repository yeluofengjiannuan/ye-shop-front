<template>
	<view class="page">
		<view :style="{ height: statusBarHeight + 'px' }"></view>

		<!-- 品牌区 -->
		<view class="header">
			<view class="brand">
				<view class="brand__mark">YE</view>
				<text class="brand__name">叶选商城</text>
			</view>
			<text class="header__title">欢迎回来</text>
			<text class="header__desc">登录后可同步购物车与订单</text>
		</view>

		<!-- 表单 -->
		<view class="form">
			<view class="field">
				<text class="field__label">账号</text>
				<input
					class="field__input"
					v-model="username"
					type="text"
					placeholder="请输入账号"
					placeholder-class="field__placeholder"
					@confirm="handleLogin"
				/>
			</view>

			<view class="field">
				<text class="field__label">密码</text>
				<input
					class="field__input"
					v-model="password"
					:password="true"
					placeholder="请输入密码"
					placeholder-class="field__placeholder"
					@confirm="handleLogin"
				/>
			</view>

			<view class="submit" :class="{ 'submit--loading': loading }" @click="handleLogin">
				<text class="submit__text">{{ loading ? '登录中…' : '登 录' }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import { useUserStore } from '@/store/modules/user'
import { userApi } from '@/utils/api'

export default {
	data() {
		return {
			statusBarHeight: 0,
			username: '',
			password: '',
			loading: false,
		}
	},
	onLoad() {
		// 状态栏高度用于给自定义导航区留白，H5 端为 0
		const info = uni.getSystemInfoSync()
		this.statusBarHeight = info.statusBarHeight || 0
	},
	methods: {
		async handleLogin() {
			if (this.loading) return

			const username = this.username.trim()
			if (!username) {
				uni.showToast({ title: '请输入账号', icon: 'none' })
				return
			}
			if (!this.password) {
				uni.showToast({ title: '请输入密码', icon: 'none' })
				return
			}

			this.loading = true
			try {
				// request.js 已做统一封装：成功时直接拿到 data
				// 即 { accessToken, refreshToken, userInfo }
				const data = await userApi.loginByAccount({
					username,
					password: this.password,
				})
				// setUserInfo 内部会更新 store、写入本地缓存，并派发 userLogin 事件
				useUserStore().setUserInfo(data)
				uni.showToast({ title: '登录成功', icon: 'none' })
				// 首页不在 tabBar 中，且需要清空页面栈，所以用 reLaunch 而不是 switchTab
				setTimeout(() => {
					uni.reLaunch({ url: '/pages/index/index' })
				}, 400)
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '登录失败', icon: 'none' })
			} finally {
				this.loading = false
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
/* 沿用首页色板：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 */
.page {
	min-height: 100vh;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.header {
	padding: 80rpx 0 60rpx;
}

.brand {
	display: flex;
	align-items: center;
}

.brand__mark {
	width: 72rpx;
	height: 72rpx;
	border-radius: 22rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 6rpx 16rpx rgba(255, 107, 53, 0.3);
	color: #ffffff;
	font-size: 30rpx;
	font-weight: bold;
	text-align: center;
	line-height: 72rpx;
	letter-spacing: 1rpx;
}

.brand__name {
	margin-left: 20rpx;
	font-size: 36rpx;
	font-weight: bold;
	color: #333333;
}

.header__title {
	display: block;
	margin-top: 48rpx;
	font-size: 48rpx;
	font-weight: bold;
	color: #333333;
}

.header__desc {
	display: block;
	margin-top: 16rpx;
	font-size: 26rpx;
	color: #999999;
}

.form {
	padding: 40rpx 32rpx 32rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.field {
	padding: 20rpx 0;
	border-bottom: 2rpx solid #f0f0f0;
}

.field:last-of-type {
	border-bottom: none;
}

.field__label {
	display: block;
	font-size: 24rpx;
	color: #999999;
}

.field__input {
	margin-top: 12rpx;
	height: 56rpx;
	font-size: 30rpx;
	color: #333333;
}

.field__placeholder {
	color: #cccccc;
}

.submit {
	margin-top: 48rpx;
	height: 88rpx;
	border-radius: 44rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.submit--loading {
	opacity: 0.6;
}

.submit__text {
	font-size: 32rpx;
	font-weight: bold;
	color: #ffffff;
	letter-spacing: 4rpx;
}
</style>
