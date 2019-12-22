import * as PouchDB from "pouchdb";
import * as DS from "../src";
import { createLocalDB } from "./util";

interface Post {
  body: string;
  reply: Post;
}

function PostSpec(): DS.ValidationSpec<Post> {
  return {
    type: "post",
    schema: {
      body: {
        required: true,
        validations: [
          (lib, body) =>
            lib.failIf(body.length > 10, "Post must be at most 256 characters")
        ]
      },
      reply: {
        spec: PostSpec
      }
    }
  };
}

describe("document modelling", () => {
  const refs = createLocalDB();

  it("should define a cyclic document model", async () => {
    await DS.defineOnly(refs.db, PostSpec);

    const root = await DS.useRoot(refs.db, PostSpec);

    expect(root.db).toEqual(refs.db);
    expect(root.spec).toEqual(PostSpec);
    expect(root.path).toEqual([]);
  });

  it("should reject documents that aren't among the allowed document types", async () => {
    let failed = false;

    try {
      await DS.useRoot(refs.db, PostSpec)
        .then(_ => _.create())
        .then(_ => _.mutate(d => ({ ...d, type: "non-existent" })));
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should reject invalid documents", async () => {
    const body = new Array(11).fill("x").join("");

    let failed = false;

    try {
      await DS.useRoot(refs.db, PostSpec)
        .then(_ => _.create())
        .then(_ => _.mutate(d => ({ ...d, content: { body } })));
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should accept valid and allowed documents", async () => {
    const root = DS.useRoot(refs.db, PostSpec);
    const body = new Array(10).fill("x").join("");

    await root.then(_ => _.create()).then(_ => _.mutate(d => ({ body })));

    const docHandle = await root.then(_ => _.find());
    const doc = docHandle && (await docHandle.resolve());

    expect(doc && doc.content.body).toEqual(body);
  });

  it("should create a document reference under a path", async () => {
    const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

    await root
      .then(_ => _.create())
      .then(_ => _.path.reply())
      .then(_ => _.create());

    const list = await root.then(_ => _.list());

    expect(list.length).toBe(1);

    const replyList = await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.list());

    expect(replyList && replyList.length).toBe(1);
  });

  it("should reject updating a document under a path with an invalid update", async () => {
    let failed = false;

    try {
      const body = new Array(11).fill("x").join("");

      const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

      await root
        .then(_ => _.find())
        .then(_ => _ && _.path.reply())
        .then(_ => _ && _.find())
        .then(_ => _ && _.mutate(c => ({ ...c, body })));
    } catch (_) {
      failed = true;
    }

    expect(failed).toBe(true);
  });

  it("should allow updating a document under a path with a valid update", async () => {
    const root = DS.usePathHandle(refs.db, PostSpec, ["feed"]);

    const body = new Array(10).fill("x").join("");

    await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.find())
      .then(_ => _ && _.mutate(c => ({ ...c, body })));

    const result = await root
      .then(_ => _.find())
      .then(_ => _ && _.path.reply())
      .then(_ => _ && _.find())
      .then(_ => _ && _.resolve());

    expect(result && result.content.body).toEqual(body);
  });
});
