import { defineStore } from 'pinia';
import { isAdminByRoles } from '@/utils/roles';
// 暂时注释掉依赖，防止报错，后续再补全
// import cacheUtil from '@/utils/cacheUtil';
// import { userApi } from '@/utils/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: uni.getStorageSync('token') || '',
    refreshToken: uni.getStorageSync('refreshToken') || '',
    userInfo: uni.getStorageSync('userInfo') || {},
    isLogin: !!uni.getStorageSync('token'),
    // 角色和权限来自 GET /api/user/role/permission/get，登录时不返回，要单独查
    sysRoleList: uni.getStorageSync('sysRoleList') || [],
    sysPermissionList: uni.getStorageSync('sysPermissionList') || []
  }),
  getters: {
    userRole: (state) => state.userInfo.role || 'USER',
    isEnterprise: (state) => state.userInfo.isEnterprise || false,
    /** 是不是超级管理员。只看角色，不看 userType（两者在库里对不上） */
    isAdmin: (state) => isAdminByRoles(state.sysRoleList)
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
     * 拉一次角色权限并缓存。
     *
     * 登录接口不返回角色，只有 /api/user/role/permission/get 有，所以单独查一次，
     * 缓存在 state 里（也落 storage），别每次进页面都查一遍。
     */
    async loadRoles() {
      // 故意用动态 import：顶层引 @/utils/api 会经 request.js 绕回本文件，形成循环依赖
      const { userApi } = await import('@/utils/api');
      const data = await userApi.getRolePermission();
      const info = data || {};
      this.sysRoleList = info.sysRoleList || [];
      this.sysPermissionList = info.sysPermissionList || [];
      uni.setStorageSync('sysRoleList', this.sysRoleList);
      uni.setStorageSync('sysPermissionList', this.sysPermissionList);
      return this.sysRoleList;
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
      this.sysRoleList = [];
      this.sysPermissionList = [];
      this.isLogin = false;
      uni.removeStorageSync('token');
      uni.removeStorageSync('refreshToken');
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('sysRoleList');
      uni.removeStorageSync('sysPermissionList');
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
