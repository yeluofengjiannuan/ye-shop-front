<template>
	<view class="sort">
		<view
			class="sort-item"
			:class="{ 'sort-item--active': modelValue === 'default' }"
			@click="pick('default')"
		>
			<text class="sort-item__text">默认</text>
		</view>

		<!-- 价格用一个按钮来回切升降序，4 个排序值（default/priceAsc/priceDesc/newest）都可到达 -->
		<view
			class="sort-item"
			:class="{ 'sort-item--active': isPriceSort }"
			@click="togglePrice"
		>
			<text class="sort-item__text">价格</text>
			<view class="sort-arrows">
				<view
					class="sort-arrow sort-arrow--up"
					:class="{ 'sort-arrow--on': modelValue === 'priceAsc' }"
				></view>
				<view
					class="sort-arrow sort-arrow--down"
					:class="{ 'sort-arrow--on': modelValue === 'priceDesc' }"
				></view>
			</view>
		</view>

		<view
			class="sort-item"
			:class="{ 'sort-item--active': modelValue === 'newest' }"
			@click="pick('newest')"
		>
			<text class="sort-item__text">最新</text>
		</view>
	</view>
</template>

<script>
export default {
	name: 'SortBar',
	props: {
		/** 当前排序：default | priceAsc | priceDesc | newest */
		modelValue: {
			type: String,
			default: 'default',
		},
	},
	emits: ['update:modelValue'],
	computed: {
		isPriceSort() {
			return this.modelValue === 'priceAsc' || this.modelValue === 'priceDesc'
		},
	},
	methods: {
		pick(type) {
			if (this.modelValue === type) return
			this.$emit('update:modelValue', type)
		},
		togglePrice() {
			// 价格升 -> 价格降 -> 价格升，来回切换
			this.pick(this.modelValue === 'priceAsc' ? 'priceDesc' : 'priceAsc')
		},
	},
}
</script>

<style scoped>
.sort {
	display: flex;
	align-items: center;
	padding: 0 12rpx;
	height: 80rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.sort-item {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 80rpx;
}

.sort-item__text {
	font-size: 28rpx;
	color: #333333;
}

.sort-item--active .sort-item__text {
	color: #ff6b35;
	font-weight: bold;
}

/* 价格升降序箭头（纯 CSS 三角形） */
.sort-arrows {
	display: flex;
	flex-direction: column;
	justify-content: center;
	margin-left: 8rpx;
	height: 28rpx;
}

.sort-arrow {
	width: 0;
	height: 0;
	border-left: 8rpx solid transparent;
	border-right: 8rpx solid transparent;
}

.sort-arrow--up {
	border-bottom: 9rpx solid #cccccc;
	margin-bottom: 4rpx;
}

.sort-arrow--down {
	border-top: 9rpx solid #cccccc;
}

.sort-arrow--on.sort-arrow--up {
	border-bottom-color: #ff6b35;
}

.sort-arrow--on.sort-arrow--down {
	border-top-color: #ff6b35;
}
</style>
