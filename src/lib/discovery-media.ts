/** Author-published media, reviewed before inclusion. Not generated product mockups. */
export const DISCOVERY_MEDIA: Record<string, {
  src: string; width: number; height: number;
  altZh: string; altEn: string; captionZh: string; captionEn: string; source: string;
  animated?: boolean;
}> = {
  'oil-oil-oil-ui': {
    src: '/discovery/oil-ui-directions.webp', width: 2400, height: 1014,
    altZh: 'oil-ui 作者展示的同一个美术馆页面的三种设计方向',
    altEn: 'Three design directions for one museum page, published by the oil-ui author',
    captionZh: '同一个页面，三种气质。图为作者提供的设计对比示例。',
    captionEn: 'One page, three directions. An example published by the author.',
    source: 'https://github.com/oil-oil/oil-ui/blob/main/assets/readme/proof-mona-lisa.webp',
  },
  'arhamkhnz-next-shadcn-admin-dashboard': {
    src: '/discovery/admin-dashboard.png', width: 2400, height: 1260,
    altZh: 'Next Shadcn Admin Dashboard 作者发布的后台模板展示图',
    altEn: 'Dashboard template preview published by the author',
    captionZh: '作者展示的后台界面与组件。', captionEn: 'Dashboard and components shown by the author.',
    source: 'https://github.com/arhamkhnz/next-shadcn-admin-dashboard/blob/main/media/dashboard.png',
  },
  'darkroomengineering-lenis': {
    src: '/discovery/lenis-banner.gif', width: 1660, height: 457,
    altZh: 'Lenis README 中的项目封面', altEn: 'Lenis project banner from its README',
    captionZh: '项目封面，来自作者 README。', captionEn: 'Project banner from the author’s README.',
    source: 'https://github.com/darkroomengineering/lenis', animated: true,
  },
};
