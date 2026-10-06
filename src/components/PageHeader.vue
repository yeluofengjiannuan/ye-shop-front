<template>
	<view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
		<view class="header__inner">
			<view class="back" @click="goBack">
				<view class="icon-back">
					<view class="icon-back__head"></view>
					<view class="icon-back__shaft"></view>
				</view>
			</view>

			<!-- 默认渲染标题；需要放输入框等自定义内容时用默认插槽覆盖 -->
			<view class="header__main">
				<slot>
					<text class="header__title">{{ title }}</text>
				</slot>
			</view>

			<view class="header__right">
				<slot name="right"></slot>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	name: 'PageHeader',
	props: {
		title: {
			type: String,
			default: '',
		},
		/** 返回时的兜底目标：页面栈里没有上一页时跳这里 */
		fallback: {
			type: String,
			default: '/pages/index/index',
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
		goBack() {
			// 栈里只有本页（冷启动直接进来）时无处可退，去兜底页面
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
				return
			}
			uni.reLaunch({ url: this.fallback })
		},
	},
}
</script>

<style scoped>
.header {
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
	flex-shrink: 0;
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

.header__main {
	flex: 1;
	display: flex;
	align-items: center;
	overflow: hidden;
}

.header__title {
	width: 100%;
	text-align: center;
	font-size: 32rpx;
	font-weight: bold;
	color: #333333;
}

/* 右侧占位，与左侧返回键等宽，保证只用标题时它是真正居中的 */
.header__right {
	min-width: 60rpx;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: flex-end;
	flex-shrink: 0;
}
</style>
