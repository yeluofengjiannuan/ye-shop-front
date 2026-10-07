<template>
	<view class="page">
		<!-- 本页是 navigationStyle: custom，原生导航栏（含返回箭头）被去掉了，
		     必须自己提供返回入口，否则在小程序/App 上进得来出不去 -->
		<PageHeader title="个人中心" />

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

		<!-- 我的订单入口 -->
		<view class="entry" @click="onOrder">
			<text class="entry__label">我的订单</text>
			<view class="entry__right">
				<text class="entry__value" :class="{ 'entry__value--accent': orderPendingCount > 0 }">
					{{ orderSummary }}
				</text>
				<view class="entry__arrow"></view>
			</view>
		</view>

		<!-- 我的优惠券入口 -->
		<view class="entry" @click="onCoupon">
			<text class="entry__label">我的优惠券</text>
			<view class="entry__right">
				<text class="entry__value" :class="{ 'entry__value--accent': couponTotal > 0 }">
					{{ couponSummary }}
				</text>
				<view class="entry__arrow"></view>
			</view>
		</view>

		<!-- 收货地址入口 -->
		<view class="entry" @click="onAddress">
			<text class="entry__label">收货地址</text>
			<view class="entry__right">
				<text class="entry__value">{{ addressSummary }}</text>
				<view class="entry__arrow"></view>
			</view>
		</view>

		<view class="logout" @click="handleLogout">
			<text class="logout__text">退出登录</text>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { useUserStore } from '@/store/modules/user'
import { userApi, addressApi, couponApi, orderApi } from '@/utils/api'
import { BASE_URL } from '@/utils/request'

export default {
	components: { PageHeader },
	data() {
		return {
			// 记录加载失败的头像地址，避免上一张失败后一直显示兜底
			avatarFailedUrl: '',
			addresses: [],
			// 我持有的优惠券，用于右侧摘要
			coupons: [],
			// 我的订单，只用来算右侧摘要
			orders: [],
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
		/** 入口右侧摘要：优先默认地址，没有就取第一条；都没有则提示去添加 */
		addressSummary() {
			if (!this.addresses.length) return '暂无收货地址'
			const item =
				this.addresses.find((a) => a.isDefault === true || a.isDefault === 'true') ||
				this.addresses[0]
			return `${item.receiver || ''} ${item.phone || ''}`.trim()
		},
		/** 可用券总数：按每张券的未使用张数累加，不是记录条数 */
		couponTotal() {
			return this.coupons.reduce((sum, item) => sum + (Number(item.unusedCount) || 0), 0)
		},
		couponSummary() {
			return this.couponTotal > 0 ? `${this.couponTotal} 张可用` : '暂无可用优惠券'
		},
		/** 待付款的笔数。列表接口没排序，靠排序取"最近一单"不稳，所以数待付款更实在 */
		orderPendingCount() {
			return this.orders.filter((o) => o.status === 'pendingPayment').length
		},
		orderSummary() {
			if (this.orderPendingCount > 0) return `${this.orderPendingCount} 笔待付款`
			return this.orders.length > 0 ? `${this.orders.length} 笔订单` : '暂无订单'
		},
	},
	onLoad() {
		this.loadDetail()
	},
	// 用 onShow：从地址管理页/领券页/订单页返回时摘要能自动刷新
	onShow() {
		this.loadAddresses()
		this.loadCoupons()
		this.loadOrders()
	},
	methods: {
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
		async loadAddresses() {
			try {
				const data = await addressApi.getList()
				this.addresses = Array.isArray(data) ? data.filter((item) => item && item.id != null) : []
			} catch (err) {
				// 地址拿不到不该影响个人中心其他内容
				this.addresses = []
				console.warn('[profile] 地址加载失败：', err && err.message)
			}
		},
		async loadCoupons() {
			try {
				// 空列表时后端不返回 data 字段，getMyList 已经兜成 []
				this.coupons = await couponApi.getMyList()
			} catch (err) {
				// 同地址：拿不到不该影响个人中心其他内容
				this.coupons = []
				console.warn('[profile] 优惠券加载失败：', err && err.message)
			}
		},
		onCoupon() {
			// 直接落在「我的券」那个 tab
			uni.navigateTo({ url: '/pages/coupon/list?tab=mine' })
		},
		async loadOrders() {
			try {
				// 只要摘要，不需要商品明细，所以直接用列表接口
				this.orders = await orderApi.getListByPage({ pageName: 'allPage' })
			} catch (err) {
				// 同地址：拿不到不该影响个人中心其他内容
				this.orders = []
				console.warn('[profile] 订单加载失败：', err && err.message)
			}
		},
		onOrder() {
			uni.navigateTo({ url: '/pages/order/list' })
		},
		onAddress() {
			uni.navigateTo({ url: '/pages/address/list' })
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
	padding-bottom: 40rpx;
	box-sizing: border-box;
}

.hero {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin: 40rpx 24rpx 20rpx;
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
	margin: 20rpx 24rpx 0;
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

/* ---------- 收货地址入口 ---------- */
.entry {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 20rpx 24rpx 0;
	padding: 28rpx 32rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.entry__label {
	font-size: 28rpx;
	color: #333333;
}

.entry__right {
	display: flex;
	align-items: center;
}

.entry__value {
	font-size: 26rpx;
	color: #999999;
}

/* 有可用券时用主色提一下，和「暂无」拉开区别 */
.entry__value--accent {
	color: #ff6b35;
	font-weight: bold;
}

/* 右向箭头（纯 CSS，与返回箭头同一风格，只是转个方向） */
.entry__arrow {
	width: 14rpx;
	height: 14rpx;
	margin-left: 12rpx;
	box-sizing: border-box;
	border-top: 3rpx solid #cccccc;
	border-right: 3rpx solid #cccccc;
	transform: rotate(45deg);
}

.logout {
	margin: 40rpx 24rpx 0;
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
