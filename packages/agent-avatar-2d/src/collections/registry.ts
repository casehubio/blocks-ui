import type { AvatarCollection } from '../types.js';

const collections = new Map<string, AvatarCollection>();

export function registerCollection(collection: AvatarCollection): void {
  collections.set(collection.id, collection);
}

export function getCollection(id: string): AvatarCollection | undefined {
  return collections.get(id);
}
