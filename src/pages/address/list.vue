<template>
	<view class="page">
		<PageHeader title="收货地址" />

		<view v-if="loading" class="status">
			<text class="status__text">加载中…</text>
		</view>

		<block v-else>
			<view v-if="list.length" class="list">
				<view class="addr" v-for="item in list" :key="item.id">
					<view class="addr__main" @click="onEdit(item)">
						<view class="addr__top">
							<text class="addr__receiver">{{ item.receiver }}</text>
							<text class="addr__phone">{{ item.phone }}</text>
							<text v-if="isDefault(item)" class="addr__badge">默认</text>
						</view>
						<text class="addr__detail">{{ fullAddress(item) }}</text>
					</view>

					<view class="addr__actions">
						<text class="addr__action" @click="onEdit(item)">编辑</text>
						<text class="addr__action addr__action--danger" @click="onDelete(item)">删除</text>
					</view>
				</view>
			</view>

			<view v-else class="status">
				<text class="status__text">暂无收货地址</text>
			</view>
		</block>

		<!-- 底部操作栏 -->
		<view class="actionbar">
			<view class="actionbar__btn" @click="onAdd">
				<text class="actionbar__btn-text">+ 新增地址</text>
			</view>
		</view>
		<view class="actionbar-spacer"></view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { addressApi } from '@/utils/api'
import { joinAddress } from '@/utils/region'

export default {
	components: { PageHeader },
	data() {
		return {
			list: [],
			loading: true,
			deleting: false,
		}
	},
	// 用 onShow 而不是 onLoad：从新增/编辑页返回时能自动刷新
	onShow() {
		this.loadList()
	},
	methods: {
		async loadList() {
			this.loading = true
			try {
				const data = await addressApi.getList()
				this.list = Array.isArray(data) ? data.filter((item) => item && item.id != null) : []
			} catch (err) {
				this.list = []
				uni.showToast({ title: (err && err.message) || '地址加载失败', icon: 'none' })
			} finally {
				this.loading = false
			}
		},
		/** 后端回读是布尔，但历史上文档写的是字符串枚举，两种都兜住 */
		isDefault(item) {
			return item.isDefault === true || item.isDefault === 'true'
		},
		fullAddress(item) {
			// 复用 region 工具：港澳会出现市/区同名，那里会去重
			return joinAddress(item)
		},
		onAdd() {
			uni.navigateTo({ url: '/pages/address/edit' })
		},
		onEdit(item) {
			uni.navigateTo({ url: `/pages/address/edit?addressId=${item.id}` })
		},
		onDelete(item) {
			if (this.deleting) return
			uni.showModal({
				title: '提示',
				content: `确定删除「${item.receiver}」这条地址吗？`,
				success: async (res) => {
					if (!res.confirm) return
					this.deleting = true
					try {
						await addressApi.remove({ addressId: item.id })
						uni.showToast({ title: '已删除', icon: 'none' })
						this.loadList()
					} catch (err) {
						uni.showToast({ title: (err && err.message) || '删除失败', icon: 'none' })
					} finally {
						this.deleting = false
					}
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
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

.status {
	padding: 160rpx 0;
	text-align: center;
}

.status__text {
	font-size: 28rpx;
	color: #999999;
}

.list {
	padding: 20rpx 24rpx 0;
}

.addr {
	margin-bottom: 20rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
	overflow: hidden;
}

.addr__main {
	padding: 28rpx 24rpx;
}

.addr__top {
	display: flex;
	align-items: center;
}

.addr__receiver {
	font-size: 30rpx;
	font-weight: bold;
	color: #333333;
}

.addr__phone {
	margin-left: 16rpx;
	font-size: 26rpx;
	color: #666666;
}

.addr__badge {
	margin-left: 16rpx;
	padding: 0 12rpx;
	height: 32rpx;
	border-radius: 16rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	color: #ffffff;
	font-size: 20rpx;
	line-height: 32rpx;
}

.addr__detail {
	display: block;
	margin-top: 12rpx;
	font-size: 26rpx;
	line-height: 38rpx;
	color: #666666;
}

.addr__actions {
	display: flex;
	justify-content: flex-end;
	border-top: 2rpx solid #f0f0f0;
}

.addr__action {
	padding: 20rpx 32rpx;
	font-size: 26rpx;
	color: #666666;
}

.addr__action--danger {
	color: #ff6b35;
}

/* ---------- 底部操作栏 ---------- */
.actionbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 100;
	padding: 16rpx 24rpx;
	background-color: #ffffff;
	box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
	/* 让出 iPhone 底部安全区 */
	padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
	padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}

.actionbar__btn {
	height: 84rpx;
	border-radius: 42rpx;
	background-image: linear-gradient(135deg, #ff8a5b 0%, #ff6b35 100%);
	box-shadow: 0 8rpx 20rpx rgba(255, 107, 53, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
}

.actionbar__btn-text {
	font-size: 32rpx;
	font-weight: bold;
	color: #ffffff;
}

.actionbar-spacer {
	height: 140rpx;
}
</style>
