import Dexie from 'dexie';

export const db = new Dexie('VME_COLLECTION_BUILDER');
db.version(1).stores({ sources: 'id', workspace: 'key' });
