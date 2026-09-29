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
