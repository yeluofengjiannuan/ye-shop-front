<template>
	<view class="page">
		<PageHeader :title="isEdit ? '编辑地址' : '新增地址'" />

		<view class="form">
			<view class="field">
				<text class="field__label">收件人</text>
				<input
					class="field__input"
					v-model="form.receiver"
					type="text"
					placeholder="请输入收件人姓名"
					placeholder-class="field__placeholder"
				/>
			</view>

			<view class="field">
				<text class="field__label">手机号</text>
				<input
					class="field__input"
					v-model="form.phone"
					type="number"
					maxlength="11"
					placeholder="请输入 11 位手机号"
					placeholder-class="field__placeholder"
				/>
			</view>

			<!--
				所在地区：自绘底部弹层。
				没用 <picker mode="region">（H5 端 uni-app 没实现，弹层是空的），
				也没用 <picker mode="multiSelector">（弹层内部的尺寸改不动 ——
				行高是硬编码的，只改 indicator 会错位）。
				直接用 <picker-view> 自己搭，行高/选中条/配色全可控。
			-->
			<view class="field" @click="openRegion">
				<text class="field__label">所在地区</text>
				<view class="field__picker">
					<text
						class="field__picker-text"
						:class="regionText ? 'field__value' : 'field__placeholder'"
					>
						{{ regionText || '请选择省 / 市 / 区' }}
					</text>
					<!-- 右向箭头，提示这一行可以点开选择 -->
					<view class="field__arrow"></view>
				</view>
			</view>

			<view class="field">
				<text class="field__label">详细地址</text>
				<textarea
					class="field__textarea"
					v-model="form.detailAddress"
					placeholder="街道、楼牌号等"
					placeholder-class="field__placeholder"
					maxlength="200"
					:auto-height="true"
				/>
			</view>

			<view class="field field--switch">
				<text class="field__label field__label--inline">设为默认地址</text>
				<switch
					:checked="form.isDefault"
					color="#ff6b35"
					@change="onDefaultChange"
				/>
			</view>
		</view>

		<!-- 底部操作栏 -->
		<view class="actionbar">
			<view class="actionbar__btn" :class="{ 'actionbar__btn--busy': saving }" @click="save">
				<text class="actionbar__btn-text">{{ saving ? '保存中…' : '保存' }}</text>
			</view>
		</view>
		<view class="actionbar-spacer"></view>

		<!-- 地区选择底部弹层 -->
		<view v-if="regionVisible" class="sheet-mask" @click="closeRegion">
			<view class="sheet" @click.stop>
				<view class="sheet__header">
					<text class="sheet__action" @click="closeRegion">取消</text>
					<text class="sheet__action sheet__action--confirm" @click="confirmRegion">确定</text>
				</view>

				<!--
					选中行的灰底自己画：不能写进 indicator-style，
					那样 uni 的指示条会盖住选中行的文字（它 z-index 高于内容）。
					所以这里把灰底放在 picker-view 下面一层。
				-->
				<view class="sheet__body">
					<view class="sheet__band"></view>
					<picker-view
						class="sheet__picker"
						:value="regionIndex"
						:indicator-style="indicatorStyle"
						@change="onPickerChange"
					>
						<picker-view-column v-for="(col, ci) in regionColumns" :key="ci">
							<view class="sheet__item" v-for="(name, ii) in col" :key="ii">{{ name }}</view>
						</picker-view-column>
					</picker-view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
import PageHeader from '@/components/PageHeader.vue'
import { addressApi } from '@/utils/api'
import { buildColumns, readSelection, joinAddress } from '@/utils/region'

/** 和后端一致的手机号规则（AddressDTO 上的 @Pattern） */
const PHONE_RE = /^1[3-9]\d{9}$/

export default {
	components: { PageHeader },
	data() {
		return {
			addressId: '',
			saving: false,
			form: {
				receiver: '',
				phone: '',
				province: '',
				city: '',
				district: '',
				detailAddress: '',
				isDefault: false,
			},
			// 三级联动：columns 是三列的可选项，index 是当前选中的下标
			regionColumns: [[], [], []],
			regionIndex: [0, 0, 0],
			regionVisible: false,
			/*
			 * 行高必须和 .sheet__item 的高度一致，否则选中行和指示条会错位。
			 * 这里用 px 而不是 rpx —— picker-view 内部本来就按 px 算，
			 * 混用 rpx 会因为换算误差对不齐。
			 */
			indicatorStyle: 'height: 50px;',
		}
	},
	computed: {
		isEdit() {
			return !!this.addressId
		},
		regionText() {
			return [this.form.province, this.form.city, this.form.district]
				.filter((v, i, arr) => v && arr.indexOf(v) === i)
				.join('')
		},
	},
	onLoad(options) {
		// 新增时先把三列初始化好（默认选中第一个省）
		this.syncRegionColumns()
		this.addressId = (options && options.addressId) || ''
		// 编辑时要把原有数据回填：列表接口没有单条查询，
		// 拉一次列表按 id 找（地址数量很少，代价可接受）
		if (this.addressId) this.loadOriginal()
	},
	methods: {
		async loadOriginal() {
			try {
				const data = await addressApi.getList()
				const list = Array.isArray(data) ? data : []
				const found = list.find((item) => String(item.id) === String(this.addressId))
				if (!found) {
					uni.showToast({ title: '地址不存在', icon: 'none' })
					return
				}
				this.form = {
					receiver: found.receiver || '',
					phone: found.phone || '',
					province: found.province || '',
					city: found.city || '',
					district: found.district || '',
					detailAddress: found.detailAddress || '',
					// 后端回读是布尔，兼容字符串写法
					isDefault: found.isDefault === true || found.isDefault === 'true',
				}
				// 回填后重建三列，让选择器定位到这条地址的省市区
				this.syncRegionColumns()
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '地址加载失败', icon: 'none' })
			}
		},
		/** 按当前已选的省市区重建三列和下标 */
		syncRegionColumns() {
			const { columns, index } = buildColumns({
				province: this.form.province,
				city: this.form.city,
				district: this.form.district,
			})
			this.regionColumns = columns
			this.regionIndex = index
		},
		openRegion() {
			// 打开时按当前已选的省市区重建列，保证定位到原来那一条
			this.syncRegionColumns()
			this.regionVisible = true
		},
		closeRegion() {
			this.regionVisible = false
		},
		/** 只有点「确定」才写回表单，取消不改动 */
		confirmRegion() {
			const { province, city, district } = readSelection(this.regionColumns, this.regionIndex)
			this.form.province = province
			this.form.city = city
			this.form.district = district
			this.regionVisible = false
		},
		/**
		 * 联动。picker-view 只在滚动停下时触发 change（不像 picker 的
		 * columnchange 能实时触发），所以这里判断「哪一列变了」再重建后续列。
		 */
		onPickerChange(e) {
			const index = e.detail.value || [0, 0, 0]
			const column = index.findIndex((v, i) => v !== this.regionIndex[i])
			if (column === -1) return

			const selected = readSelection(this.regionColumns, index)
			if (column === 0) {
				selected.city = ''
				selected.district = ''
			} else if (column === 1) {
				selected.district = ''
			}
			const { columns, index: rebuilt } = buildColumns(selected)
			// 改动列之前的列保持不动，避免把用户已经选好的前面几列重置掉
			for (let i = 0; i < column; i++) rebuilt[i] = index[i]
			this.regionColumns = columns
			this.regionIndex = rebuilt
		},
		onDefaultChange(e) {
			this.form.isDefault = e.detail.value
		},
		/** 本地先校验一遍，省得白跑一次请求拿后端 400 */
		validate() {
			const f = this.form
			if (!f.receiver.trim()) return '请输入收件人姓名'
			if (f.receiver.trim().length > 20) return '收件人姓名不能超过 20 个字符'
			if (!PHONE_RE.test(f.phone)) return '请输入正确的手机号格式'
			if (!f.province || !f.city || !f.district) return '请选择所在地区'
			if (!f.detailAddress.trim()) return '请输入详细地址'
			return ''
		},
		async save() {
			if (this.saving) return
			const msg = this.validate()
			if (msg) {
				uni.showToast({ title: msg, icon: 'none' })
				return
			}

			this.saving = true
			try {
				const dto = {
					receiver: this.form.receiver.trim(),
					phone: this.form.phone,
					province: this.form.province,
					city: this.form.city,
					district: this.form.district,
					detailAddress: this.form.detailAddress.trim(),
					// 文档里是字符串枚举，按文档传
					isDefault: this.form.isDefault ? 'true' : 'false',
				}
				if (this.isEdit) {
					// 修改要把完整 DTO 传回去，必须带 id
					dto.id = Number(this.addressId)
					await addressApi.update(dto)
				} else {
					await addressApi.add(dto)
				}
				uni.showToast({ title: this.isEdit ? '已保存' : '已新增', icon: 'none' })
				setTimeout(() => uni.navigateBack(), 400)
			} catch (err) {
				uni.showToast({ title: (err && err.message) || '保存失败', icon: 'none' })
			} finally {
				this.saving = false
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
/* 主题色板与全局一致：主色 #FF6B35 / 背景 #F5F5F5 / 文字 #333333 / 次要 #999999 */

.form {
	margin: 20rpx 24rpx 0;
	padding: 0 24rpx;
	background-color: #ffffff;
	border-radius: 20rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.field {
	display: flex;
	align-items: center;
	padding: 26rpx 0;
	border-bottom: 2rpx solid #f0f0f0;
}

.field:last-child {
	border-bottom: none;
}

.field__label {
	width: 170rpx;
	flex-shrink: 0;
	font-size: 28rpx;
	color: #333333;
}

.field__label--inline {
	flex: 1;
	width: auto;
}

.field__input {
	flex: 1;
	height: 48rpx;
	font-size: 28rpx;
	color: #333333;
}

.field__picker {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: space-between;
	/* 让整行都是热区，而不是只有文字可点 */
	min-height: 48rpx;
}

.field__picker-text {
	flex: 1;
}

/* 右向箭头（纯 CSS，与个人中心入口同一风格） */
.field__arrow {
	width: 14rpx;
	height: 14rpx;
	margin-left: 12rpx;
	flex-shrink: 0;
	box-sizing: border-box;
	border-top: 3rpx solid #cccccc;
	border-right: 3rpx solid #cccccc;
	transform: rotate(45deg);
}

.field__value {
	font-size: 28rpx;
	color: #333333;
}

.field__textarea {
	flex: 1;
	min-height: 48rpx;
	font-size: 28rpx;
	line-height: 40rpx;
	color: #333333;
}

.field__placeholder {
	font-size: 28rpx;
	color: #cccccc;
}

.field--switch {
	justify-content: space-between;
}

/* ---------- 地区选择底部弹层 ---------- */
.sheet-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 200;
	background-color: rgba(0, 0, 0, 0.4);
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
}

.sheet {
	width: 100%;
	background-color: #ffffff;
	border-radius: 24rpx 24rpx 0 0;
	overflow: hidden;
	/* 让出 iPhone 底部安全区 */
	padding-bottom: constant(safe-area-inset-bottom);
	padding-bottom: env(safe-area-inset-bottom);
}

.sheet__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 100rpx;
	padding: 0 24rpx;
	border-bottom: 2rpx solid #f0f0f0;
}

.sheet__action {
	padding: 10rpx 16rpx;
	font-size: 30rpx;
	color: #666666;
}

.sheet__action--confirm {
	color: #ff6b35;
	font-weight: bold;
}

.sheet__body {
	position: relative;
	width: 100%;
	height: 250px;
}

/* 选中行灰底，垫在 picker-view 下面 */
.sheet__band {
	position: absolute;
	left: 16rpx;
	right: 16rpx;
	top: 50%;
	height: 50px;
	margin-top: -25px;
	background-color: #f7f7f7;
	border-radius: 12rpx;
	z-index: 0;
}

.sheet__picker {
	position: relative;
	z-index: 1;
	width: 100%;
	height: 100%;
}

/*
 * 行高必须和 indicatorStyle 里的 height（50px）严格一致，
 * 否则选中行和指示条会错位。picker-view 内部按 px 计算，这里也用 px。
 */
.sheet__item {
	height: 50px;
	line-height: 50px;
	text-align: center;
	font-size: 17px;
	color: #333333;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	padding: 0 8rpx;
	box-sizing: border-box;
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

.actionbar__btn--busy {
	opacity: 0.6;
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
