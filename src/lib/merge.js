/**
 * Three-way merge for the farm's shared data, used when two devices saved the same kind of data:
 * `base` is what this device last read from the server, `local` is what it holds now, `server` is what
 * the server holds now. Changes made here since `base` are applied on top of `server`, so nobody's
 * work is silently lost. Lists are matched by item `id` (by content when an item has none); objects
 * field by field. When the two sides changed the same item or field, this device's version wins.
 */

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (item) => (isObject(item) && item.id !== undefined ? `id:${JSON.stringify(item.id)}` : `value:${JSON.stringify(item)}`);

function mergeLists(base, local, server) {
  const baseById = new Map(base.map((item) => [identity(item), item]));
  const localIds = new Set(local.map(identity));
  const deletedHere = new Set([...baseById.keys()].filter((id) => !localIds.has(id)));

  const merged = server.filter((item) => !deletedHere.has(identity(item)));
  for (const item of local) {
    const id = identity(item);
    const changedHere = !baseById.has(id) || !same(baseById.get(id), item);
    if (!changedHere) continue;
    const at = merged.findIndex((other) => identity(other) === id);
    if (at === -1) merged.push(item);
    else merged[at] = item;
  }
  return merged;
}

function mergeObjects(base, local, server) {
  const merged = { ...server };
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    const hereHas = Object.hasOwn(local, key);
    if (same(hereHas ? local[key] : undefined, Object.hasOwn(base, key) ? base[key] : undefined)) continue;
    if (hereHas) merged[key] = local[key];
    else delete merged[key];
  }
  return merged;
}

/**
 * @template T
 * @param {T | undefined | null} base what this device last read (missing when it never had one)
 * @param {T} local what this device holds now
 * @param {T | undefined | null} server what the server holds now
 * @returns {T}
 */
export function mergeChanges(base, local, server) {
  if (Array.isArray(local) && Array.isArray(server)) return mergeLists(Array.isArray(base) ? base : [], local, server);
  if (isObject(local) && isObject(server)) return mergeObjects(isObject(base) ? base : {}, local, server);
  return local;
}
