/**
 * /v3 was the staging route for the V3 art direction while the V2 homepage
 * still owned /. V3 is now the homepage, so this route is kept as a permanent
 * redirect — the URL was shared around during design review and should not 404.
 */

import { permanentRedirect } from 'next/navigation';

export default function V3Redirect() {
  permanentRedirect('/');
}
