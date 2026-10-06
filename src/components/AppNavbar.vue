<template>
	<view>
		<view class="navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="navbar__inner">
				<view class="logo">
					<view class="logo__mark">YE</view>
					<text class="logo__text">叶选商城</text>
				</view>

				<view class="nav-links">
					<text
						class="nav-link"
						:class="{ 'nav-link--active': active === 'home' }"
						@click="goHome"
						>首页</text
					>
					<text
						class="nav-link"
						:class="{ 'nav-link--active': active === 'category' }"
						@click="goCategory"
						>分类</text
					>
					<view class="nav-link" @click="goCart">
						<text>购物车</text>
						<text v-if="cartCount > 0" class="nav-link__badge">{{ cartCount }}</text>
					</view>
					<text class="nav-link" @click="goProfile">我的</text>
				</view>
			</view>
		</view>

		<!-- 占位块：与固定导航栏同高，避免内容被遮住。
		     单位与导航栏一一对应（px 状态栏 + 88rpx 内容），无需换算 -->
		<view :style="{ height: statusBarHeight + 'px' }"></view>
		<view class="navbar-spacer"></view>
	</view>
</template>

<script>
import { useUserStore } from '@/store/modules/user'

export default {
	name: 'AppNavbar',
	props: {
		/** 当前所在页：'home' | 'category'，用于高亮 */
		active: {
			type: String,
			default: '',
		},
		cartCount: {
			type: Number,
			default: 0,
		},
	},
	data() {
		return {
			statusBarHeight: 0,
		}
	},
	created() {
		// 状态栏高度用于给自定义导航栏留出刘海/状态栏空间，H5 端为 0
		const info = uni.getSystemInfoSync()
		this.statusBarHeight = info.statusBarHeight || 0
	},
	methods: {
		goHome() {
			if (this.active === 'home') {
				uni.pageScrollTo({ scrollTop: 0, duration: 200 })
				return
			}
			// 分类页是从首页 push 进来的，回退即可，首页的滚动位置和已加载商品都能保留
			const pages = getCurrentPages()
			const prev = pages[pages.length - 2]
			if (prev && `/${prev.route}` === '/pages/index/index') {
				uni.navigateBack()
				return
			}
			// 冷启动直接落在分类页（栈里只有一页）时无处可退，重新打开首页
			uni.reLaunch({ url: '/pages/index/index' })
		},
		goCategory() {
			if (this.active === 'category') {
				uni.pageScrollTo({ scrollTop: 0, duration: 200 })
				return
			}
			// 入栈而不是替换页面，这样返回首页时不用重新加载
			uni.navigateTo({
				url: '/pages/category/category',
				fail: () => uni.reLaunch({ url: '/pages/category/category' }),
			})
		},
		goCart() {
			// TODO: 购物车页建好后改成 uni.navigateTo({ url: '/pages/cart/cart' })
			uni.showToast({ title: `购物车共 ${this.cartCount} 件商品`, icon: 'none' })
		},
		goProfile() {
			const userStore = useUserStore()
			// 正常情况下没登录根本进不来（App.vue 里有路由拦截），这里只是兜底
			if (userStore.isLogin) {
				uni.navigateTo({ url: '/pages/profile/profile' })
			} else {
				uni.navigateTo({ url: '/pages/login/login' })
			}
		},
	},
}
</script>

<style scoped>
.navbar {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	background-color: #ffffff;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.navbar__inner {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 24rpx;
}

.navbar-spacer {
	height: 88rpx;
}

.logo {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.logo__mark {
	width: 56rpx;
	height: 56rpx;
	border-radius: 18rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.3);
	color: #ffffff;
	font-size: 24rpx;
	font-weight: bold;
	text-align: center;
	line-height: 56rpx;
	letter-spacing: 1rpx;
}

.logo__text {
	margin-left: 16rpx;
	font-size: 30rpx;
	font-weight: bold;
	color: #333333;
}

.nav-links {
	display: flex;
	align-items: center;
	flex-shrink: 1;
	overflow: hidden;
}

.nav-link {
	position: relative;
	display: inline-block;
	/* 保证有足够的点击热区，文字本身只有 26rpx 高 */
	padding: 0 12rpx;
	line-height: 88rpx;
	font-size: 26rpx;
	color: #333333;
	white-space: nowrap;
}

.nav-link--active {
	color: #ff6b35;
	font-weight: bold;
}

.nav-link__badge {
	position: absolute;
	top: 12rpx;
	right: 0;
	min-width: 28rpx;
	height: 28rpx;
	padding: 0 6rpx;
	box-sizing: border-box;
	border-radius: 14rpx;
	background-color: #ff6b35;
	color: #ffffff;
	font-size: 20rpx;
	line-height: 28rpx;
	text-align: center;
}
</style>
