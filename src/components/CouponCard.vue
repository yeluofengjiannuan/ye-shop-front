<template>
	<view class="coupon" :class="{ 'coupon--off': coupon.expired }">
		<!-- 左边券面：金额 + 门槛 -->
		<view class="coupon__face">
			<text class="coupon__amount">
				<text v-if="coupon.amountPrefix" class="coupon__unit">{{ coupon.amountPrefix }}</text>{{
					coupon.amountValue
				}}<text v-if="coupon.amountSuffix" class="coupon__unit">{{ coupon.amountSuffix }}</text>
			</text>
			<text class="coupon__condition">{{ coupon.conditionText }}</text>
		</view>

		<!-- 中间信息 -->
		<view class="coupon__body">
			<text class="coupon__name">{{ coupon.name }}</text>
			<text v-if="coupon.maxText" class="coupon__meta coupon__meta--accent">
				{{ coupon.maxText }}
			</text>
			<text v-if="coupon.scopeText" class="coupon__meta">{{ coupon.scopeText }}</text>
			<text v-if="coupon.validText" class="coupon__meta">{{ coupon.validText }}</text>
			<text v-if="coupon.countText" class="coupon__count">{{ coupon.countText }}</text>
		</view>

		<!-- 右边操作。只有「可领取」列表才有按钮：
		     「我的券」里没有可做的事（下单还没做），就不放一个点了没反应的假按钮 -->
		<view v-if="action" class="coupon__action">
			<view
				class="coupon__btn"
				:class="{ 'coupon__btn--off': !clickable }"
				@click="onTap"
			>
				<text class="coupon__btn-text">{{ buttonText }}</text>
			</view>
		</view>
	</view>
</template>

<script>
/**
 * 优惠券卡片。
 *
 * 只接受 normalizeActivity / normalizeMine 处理过的结构，
 * 不直接吃后端原始字段 —— 活动列表和我的券字段名不一样、缺失情况也不一样，
 * 让卡片去猜会到处是兜底判断。
 */
export default {
	name: 'CouponCard',
	props: {
		coupon: {
			type: Object,
			required: true,
		},
		/** receive 立即领取 / claimed 已领取 / soldout 已领完 / '' 不显示按钮 */
		action: {
			type: String,
			default: '',
		},
		/** 领取请求在途，按钮置灰防连点 */
		busy: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['receive'],
	computed: {
		buttonText() {
			if (this.action === 'receive') return this.busy ? '领取中…' : '立即领取'
			if (this.action === 'claimed') return '已领取'
			if (this.action === 'soldout') return '已领完'
			return ''
		},
		clickable() {
			return !this.busy && this.action === 'receive'
		},
	},
	methods: {
		onTap() {
			if (!this.clickable) return
			this.$emit('receive', this.coupon)
		},
	},
}
</script>

<style scoped>
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

.coupon {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
	overflow: hidden;
}

/* 过期整体降饱和，不做删除线，免得像"作废"而不是"过期" */
.coupon--off {
	opacity: 0.55;
}

/* ---------- 左边券面 ---------- */
.coupon__face {
	position: relative;
	width: 200rpx;
	flex-shrink: 0;
	align-self: stretch;
	padding: 28rpx 0;
	background-image: linear-gradient(135deg, #fff2ec 0%, #ffe4d8 100%);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

/* 券面和右侧信息之间的虚线齿孔 */
.coupon__face::after {
	content: '';
	position: absolute;
	right: 0;
	top: 20rpx;
	bottom: 20rpx;
	width: 0;
	border-right: 2rpx dashed #ffd3bd;
}

.coupon__amount {
	font-size: 48rpx;
	font-weight: bold;
	line-height: 56rpx;
	color: #ff6b35;
}

.coupon__unit {
	font-size: 26rpx;
}

.coupon__condition {
	margin-top: 6rpx;
	font-size: 22rpx;
	color: #ff6b35;
}

/* ---------- 中间信息 ---------- */
.coupon__body {
	flex: 1;
	padding: 24rpx 20rpx;
	overflow: hidden;
}

.coupon__name {
	display: block;
	font-size: 28rpx;
	font-weight: bold;
	line-height: 38rpx;
	color: #333333;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.coupon__meta {
	display: block;
	margin-top: 6rpx;
	font-size: 22rpx;
	line-height: 30rpx;
	color: #999999;
}

.coupon__meta--accent {
	color: #ff6b35;
}

.coupon__count {
	display: block;
	margin-top: 8rpx;
	font-size: 24rpx;
	font-weight: bold;
	color: #ff6b35;
}

/* ---------- 右边操作 ---------- */
.coupon__action {
	flex-shrink: 0;
	padding-right: 24rpx;
}

.coupon__btn {
	height: 60rpx;
	padding: 0 28rpx;
	border-radius: 30rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 4rpx 12rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.coupon__btn--off {
	background-image: none;
	background-color: #cccccc;
	box-shadow: none;
}

.coupon__btn-text {
	font-size: 24rpx;
	font-weight: bold;
	color: #ffffff;
	white-space: nowrap;
}
</style>
