// In-memory browser handles: no user files or real permission prompts are used.
export function installLocalKnowledgeFixture(target = globalThis) {
  const state = { permission: "granted", grant: "granted", checks: 0, requests: 0, reads: 0, activation: null, failRead: false };
  const records = Array.from({ length: 30 }, (_, index) => {
    const name = `品牌资料-${index}.md`;
    const file = new File([`# 品牌资料 ${index}\n测试正文 ${index}`], name, { type: "text/markdown" });
    return {
      id: `local:${name}`, title: `品牌资料 ${index}`, path: name, extension: "md",
      size: file.size, lastModified: file.lastModified, tags: [], excerpt: "测试正文",
      searchText: "测试正文", indexedAt: new Date().toISOString(),
      handle: {
        kind: "file", name,
        async getFile() {
          state.reads += 1;
          if (state.failRead) throw new DOMException("Permission lost", "NotAllowedError");
          return file;
        },
      },
    };
  });
  const root = {
    kind: "directory", name: "测试知识库",
    async queryPermission() { state.checks += 1; return state.permission; },
    async requestPermission() {
      state.requests += 1;
      state.activation = target.navigator?.userActivation?.isActive ?? null;
      state.permission = state.grant;
      return state.permission;
    },
    async *entries() { for (const record of records) yield [record.path, record.handle]; },
  };
  const stores = new Map([
    ["handles", new Map([["root-directory", root]])],
    ["local-index", new Map(records.map((record) => [record.id, record]))],
    ["meta", new Map()],
  ]);
  const request = (result) => {
    const pending = { result };
    queueMicrotask(() => pending.onsuccess?.());
    return pending;
  };
  const database = {
    close() {},
    transaction() {
      const transaction = {
        objectStore(name) {
          const store = stores.get(name);
          return {
            get: (key) => request(store.get(key)),
            getAll: () => request([...store.values()]),
            put: (value, key) => store.set(key ?? value.id, value),
            clear: () => store.clear(),
          };
        },
      };
      setTimeout(() => transaction.oncomplete?.(), 0);
      return transaction;
    },
  };
  Object.defineProperty(target, "indexedDB", { configurable: true, value: { open: () => request(database) } });
  target.showDirectoryPicker = async () => root;
  return { state, records, stores, root };
}
