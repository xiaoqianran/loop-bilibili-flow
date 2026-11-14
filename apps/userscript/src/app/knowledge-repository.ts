import { knowledgeDb } from "@subbatch/runtime";
import { V6_KNOWLEDGE_DB } from "@subbatch/schemas";

/** Reuse the historical database, stores and schema version. */
export function createRepository(factory: IDBFactory) {
  return knowledgeDb.create(factory, {
    name: V6_KNOWLEDGE_DB.name,
    version: V6_KNOWLEDGE_DB.version,
    anchorStore: V6_KNOWLEDGE_DB.anchorStore,
    nodeStore: V6_KNOWLEDGE_DB.nodeStore,
  });
}
