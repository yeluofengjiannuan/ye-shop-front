/**
 * 分类树接口不可用时的兜底分类。
 *
 * 结构与 /api/category/tree 的一级节点保持一致，让降级路径和正常路径
 * 走同一套过滤/查询逻辑。
 *
 * children 里的 id 是必需的：商品挂二级分类上，按一级分类展示时
 * 需要拿子分类 id 去查商品（见 index.vue 的 loadCategoryProducts）。
 */
export const FALLBACK_CATEGORIES = [
  {
    id: 1,
    name: '智能手机',
    children: [
      { id: 4, name: 'realme' },
      { id: 7, name: '小米手机' },
      { id: 12, name: '鸭梨手机' },
    ],
  },
  { id: 2, name: '服装', children: [] },
  { id: 3, name: '清洁', children: [{ id: 6, name: '洗洁精' }] },
  { id: 8, name: '家具', children: [{ id: 9, name: '桌子' }] },
  { id: 13, name: '衬衣', children: [] },
]
