import { defineStore } from 'pinia';
// 暂时注释掉依赖，防止报错，后续再补全
// import cacheUtil from '@/utils/cacheUtil';
// import socketService from '@/utils/websocket';
// import { userApi } from '@/utils/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('token') || '',
    refreshToken: uni.getStorageSync('refreshToken') || '',
    userInfo: uni.getStorageSync('userInfo') || {},
    isLogin: !!uni.getStorageSync('token')
  }),
  getters: {
    userRole: (state) => state.userInfo.role || 'USER',
    isEnterprise: (state) => state.userInfo.isEnterprise || false
  },
  actions: {
    setUserInfo(userData) {
      this.userInfo = userData.userInfo || userData;
      this.token = userData.accessToken || userData.token || this.token;
      this.refreshToken = userData.refreshToken || this.refreshToken;
      this.isLogin = true;
      uni.setStorageSync('token', this.token);
      if (this.refreshToken) uni.setStorageSync('refreshToken', this.refreshToken);
      uni.setStorageSync('userInfo', this.userInfo);
      if (typeof uni.$emit === 'function') uni.$emit('userLogin', this.userInfo);
    },

    /**
     * 刷新令牌后更新双 Token，不碰 userInfo。
     * 刷新接口只返回 { accessToken, refreshToken }，若复用 setUserInfo，
     * 其内部的 `userInfo.userInfo || userData` 会把 userInfo 覆盖成 token 对象。
     */
    setTokens({ accessToken, refreshToken } = {}) {
      if (accessToken) {
        this.token = accessToken;
        uni.setStorageSync('token', accessToken);
      }
      if (refreshToken) {
        this.refreshToken = refreshToken;
        uni.setStorageSync('refreshToken', refreshToken);
      }
      this.isLogin = !!this.token;
    },

    /** 单独更新用户资料（如拉取用户详情后），不动 token */
    setProfile(info) {
      this.userInfo = info || {};
      uni.setStorageSync('userInfo', this.userInfo);
    },

    async logout() {
      // 清空状态和缓存
      this.token = '';
      this.refreshToken = '';
      this.userInfo = {};
      this.isLogin = false;
      uni.removeStorageSync('token');
      uni.removeStorageSync('refreshToken');
      uni.removeStorageSync('userInfo');
      // 触发登出事件
      if (typeof uni.$emit === 'function') uni.$emit('userLogout');
      // 跳转到登录页
      uni.reLaunch({ url: '/pages/login/login' });
    },
    checkLogin() {
      return this.isLogin;
    }
  }
});
