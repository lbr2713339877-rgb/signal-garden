/**
 * Public site constants shared by legal pages and footer links.
 *
 * Keep these values in one place so contact details cannot drift between the
 * policy pages, the footer, and transactional mail.
 */
export const CONTACT_EMAIL =
  process.env.CONTACT_EMAIL ?? 'hello@signalgarden.site';

export const GITHUB_REPO_URL = 'https://github.com/lbr2713339877-rgb/signal-garden';

export const XHS_ID = '95682614775';

export const XHS_URL =
  'https://www.xiaohongshu.com/user/profile/67860c9c000000000801c790?xsec_token=ABpq1lkCJljobjmjNUQA2J8Sim7D7FcEiVd1Man7iu_gw%3D&xsec_source=pc_search';

export const X_URL = 'https://x.com/SIGNoffical';

export const LAST_UPDATED = '2026-10-16';

/**
 * How the daily board is ordered. Heat uses our own star snapshots.
 * Fork counts are a separate card metric, not this score.
 */
export const RANKING_ZH_LONG =
  '按热度分排序：以近 24 小时和近 7 日的 star 增长为主，兼顾社区讨论、可用性和提交活跃度';

export const RANKING_ZH_SHORT = '按近期 star 增长等热度信号排序';

export const RANKING_EN_LONG =
  'Ranked by a momentum score driven mainly by 24-hour and 7-day star growth, plus community discussion, usability and commit activity.';

export const RANKING_EN_SHORT = 'ranked by recent star growth and other momentum signals';

/** Shown next to the heat-score explanation. Not a ranking claim. */
export const FORK_CARD_NOTE_ZH =
  '卡片上也可能显示 7 日新增 fork，这个数字用 fork 时间戳测量，因为 GitHub 不提供 star 历史接口。';

export const FORK_CARD_NOTE_EN =
  'Cards may also show 7-day new forks, measured from fork timestamps because GitHub does not expose a star history API.';
