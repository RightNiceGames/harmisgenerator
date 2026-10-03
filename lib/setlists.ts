import { z } from 'zod';
export const setlistSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().trim().min(1, 'Ge setlistan ett namn.').max(100),
  songs: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]*\.ya?ml$/)).max(300),
});
export const setlistsSchema = z.array(setlistSchema).max(100).refine(lists => new Set(lists.map(list => list.id)).size === lists.length, 'Setlistornas id måste vara unika.');
export type Setlist = z.infer<typeof setlistSchema>;
export type SetlistLibrary = { lists: Setlist[]; revision: string };
