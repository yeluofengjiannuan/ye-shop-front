import { request } from './request'

export { BASE_URL } from './request'

/**
 * 后端接口
 *
 * 说明：刷新令牌（POST /api/user/refresh/token）由 request.js 的 401 拦截逻辑
 * 内部调用，不在这里暴露 —— 否则 api.js 与 request.js 会互相 import 形成循环依赖。
 */
export const userApi = {
  /** 账号登录 POST /api/user/login/account，返回 { accessToken, refreshToken, userInfo } */
  loginByAccount({ username, password }) {
    return request({
      url: '/api/user/login/account',
      method: 'POST',
      data: { username, password },
    })
  },

  /** 用户详情 GET /api/user/detail/get */
  getUserDetail() {
    return request({ url: '/api/user/detail/get', method: 'GET' })
  },

  /**
   * 收藏商品 POST /api/user/collect/add
   * 参数在后端是 in: query，所以直接拼进 URL。
   * 不能走 data —— POST 的 data 会变成 JSON body，后端读不到。
   * 注意：后端没做幂等，重复收藏同一商品会返回 HTTP 500，调用方要先判状态。
   */
  addCollect({ productId }) {
    return request({ url: `/api/user/collect/add?productId=${productId}`, method: 'POST' })
  },

  /**
   * 取消收藏 DELETE /api/user/collect/delete
   * ⚠️ 参数名是 productIds（数组），不是 productId；多个用逗号分隔。
   */
  removeCollect({ productId }) {
    return request({
      url: `/api/user/collect/delete?productIds=${productId}`,
      method: 'DELETE',
    })
  },
}

export const addressApi = {
  /** 地址列表 GET /api/address/list，data 直接就是数组 */
  getList() {
    return request({ url: '/api/address/list', method: 'GET' })
  },

  /**
   * 新增地址 POST /api/address/add
   * body 是 AddressDTO。isDefault 在后端是 CommonDefault 枚举，
   * 按文档传字符串 'true' / 'false'（传 JSON 布尔也能过，但以文档为准）。
   * 设成默认后端会自动把原来的默认取消掉，前端不用管。
   */
  add(dto) {
    return request({ url: '/api/address/add', method: 'POST', data: dto })
  },

  /** 修改地址 PUT /api/address/update，body 是完整 DTO，必须带 id */
  update(dto) {
    return request({ url: '/api/address/update', method: 'PUT', data: dto })
  },

  /**
   * 删除地址 DELETE /api/address/delete
   * 注意参数名是 addressId；删不存在的 id 后端返回 500「数据异常，请重试」，不是 404。
   */
  remove({ addressId }) {
    return request({ url: `/api/address/delete?addressId=${addressId}`, method: 'DELETE' })
  },
}

export const categoryApi = {
  /**
   * 分类树 GET /api/category/tree
   * 返回一级分类数组，每个节点带 children（二级分类）。
   * 注意：该接口需要登录态，无 token 会返回 401。
   */
  getTree() {
    return request({ url: '/api/category/tree', method: 'GET' })
  },
}

export const productApi = {
  /**
   * 按分类查商品 GET /api/product/category/list
   * 返回 { cursorCommonEntity: { sortType, sortValue, sortId, querySize }, list, isEnd }
   *
   * isFirstCategoryId 是**必填**参数：传 true 时后端会把该一级分类下所有
   * 子分类的商品一并返回（自己做了下钻）。
   * 漏传不会报错，而是**静默返回空列表**（HTTP 200 + list: []），
   * 所以这个参数务必带上，否则看起来就像"这个分类没有商品"。
   */
  getByCategory({
    categoryId,
    isFirstCategoryId = true,
    sortType = 'default',
    querySize = 20,
    sortId,
  } = {}) {
    const data = { sortType, categoryId, isFirstCategoryId, querySize }
    if (sortId != null) data.sortId = sortId
    return request({ url: '/api/product/category/list', method: 'GET', data })
  },

  /**
   * 无限滚动商品流 GET /api/product/scroll/query/list
   * 返回 { simpleCursorCommonEntity: { sortValue, sortId, querySize }, list, isEnd }
   * 翻页：把上一页返回的 sortId 作为下一次的 beginId。
   * 注意 isEnd 只有在「返回条数 < querySize」时才为 true，
   * 拿到满页时仍是 false，所以还要用 list 为空作为终止条件。
   */
  getScrollList({ beginId = 0, querySize = 10 } = {}) {
    return request({ url: '/api/product/scroll/query/list', method: 'GET', data: { beginId, querySize } })
  },

  /**
   * 搜索商品 GET /api/product/search
   * 返回结构与分类接口一致：{ cursorCommonEntity, list, isEnd }
   * sortType 与 categoryId 版本共用同一批取值：default / priceAsc / priceDesc / newest
   */
  search({ keyword, sortType = 'default', querySize = 20, sortId } = {}) {
    const data = { sortType, keyword, querySize }
    if (sortId != null) data.sortId = sortId
    return request({ url: '/api/product/search', method: 'GET', data })
  },

  /** 热销商品 GET /api/product/hot */
  getHot({ limit = 10 } = {}) {
    return request({ url: '/api/product/hot', method: 'GET', data: { limit } })
  },

  /** 搜索热词 GET /api/product/user/keyword/list，返回字符串数组 */
  getKeywords() {
    return request({ url: '/api/product/user/keyword/list', method: 'GET' })
  },

  /**
   * 商品详情 GET /api/product/detail
   *
   * isLogin 是必填的 boolean，按当前登录态传。
   * 返回里 imageUrls / specList / description 都可能为空数组或空串，用前要兜。
   */
  getDetail({ productId, isLogin = false }) {
    return request({
      url: '/api/product/detail',
      method: 'GET',
      data: { productId, isLogin },
    })
  },
}

export const bannerApi = {
  /** 首页轮播图 GET /api/banner/list，返回 [{ id, title, imageUrl, linkUrl, sort, status }] */
  getList() {
    return request({ url: '/api/banner/list', method: 'GET' })
  },
}
