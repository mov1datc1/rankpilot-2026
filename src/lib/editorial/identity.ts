import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from '@/utils/supabase/server';

/** In-process capability for the trusted worker. Never populated from HTTP headers. */
export const editorialIdentity = new AsyncLocalStorage<{userId:string;submissionId:string}>();
export async function editorialUser(request: Request) {
  const identity = editorialIdentity.getStore();
  if (identity) {
    const body = await request.clone().json();
    return body.submissionId === identity.submissionId ? {id:identity.userId,email:null} : null;
  }
  return (await (await createClient()).auth.getUser()).data.user;
}
