import { ImageResponse } from 'next/og';
export const alt = 'Signal Garden — 每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#030303',
          color: '#f2f0ea',
          padding: '72px 80px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 28,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#f2f0ea',
          }}
        >
          SIGNAL GARDEN
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ width: 92, height: 1, background: 'rgba(242,240,234,.10)' }} />
          <div
            style={{
              display: 'flex',
              maxWidth: 940,
              fontSize: 58,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
            }}
          >
            每天 5 分钟，从全网噪音里筛出值得打开的开发者项目。
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 22,
            color: 'rgba(242,240,234,.58)',
          }}
        >
          <span>signalgarden.site</span>
          <span>Developer discovery, daily.</span>
        </div>
      </div>
    ),
    size,
  );
}
